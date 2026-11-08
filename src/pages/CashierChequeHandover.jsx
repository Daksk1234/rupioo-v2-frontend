import React,{useEffect,useState} from 'react';
import {api,getUser} from '../lib/api.js';
import {accessForPath} from '../lib/permissionAccess.js';
const money=n=>`₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export default function CashierChequeHandover({financialYear}){
  const [items,setItems]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[otpCodes,setOtpCodes]=useState({});
  const role=String(getUser()?.role||'').toUpperCase();
  const rights=accessForPath('/dms/cashier');
  const load=async()=>{setBusy(true);setError('');try{const r=await api(`/cheques/cashier/queue?financialYear=${encodeURIComponent(financialYear||'')}`);setItems((r.items||[]).filter(x=>!financialYear||!x.receivedDate||
    (Number(String(x.receivedDate).slice(0,4))-(Number(String(x.receivedDate).slice(5,7))<4?1:0))===Number(financialYear.slice(0,4))));}catch(e){setError(e.message||'Cannot load cheque handovers');}finally{setBusy(false);}};
  useEffect(()=>{load();},[financialYear]);
  const generate=async(id)=>{setBusy(true);setError('');try{const result=await api(`/sales-app/cheques/received/${id}/handover/cashier-otp`,{method:'POST',body:'{}'});setOtpCodes(p=>({...p,[id]:result.otp}));await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
  const accept=async(id)=>{if(!window.confirm('Have you physically checked this cheque and confirmed the sender OTP is verified?'))return;setBusy(true);setError('');try{await api(`/sales-app/cheques/received/${id}/handover/cashier-accept`,{method:'POST',body:'{}'});await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
  const edit=async(item)=>{if(item.status==='NEEDS_REGISTRATION'){
    const ifsc=window.prompt(`Cheque ${item.receiptNo} needs registration. Enter original payer IFSC:`,item.ifsc||'');
    if(ifsc===null)return;setBusy(true);setError('');try{await api(`/cheques/company-received/receipts/${encodeURIComponent(item.receiptId)}/ifsc`,{method:'PATCH',body:JSON.stringify({financialYear,ifsc:ifsc.toUpperCase().trim()})});await load();}catch(e){setError(e.message);}finally{setBusy(false);}return;
  }const remarks=window.prompt('Edit cheque remarks only (amount, bank and custody cannot be changed here)',item.remarks||'');if(remarks===null)return;setBusy(true);try{await api(`/cheques/received/${item.id}/notes`,{method:'PATCH',body:JSON.stringify({remarks})});await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
  const remove=async(item)=>{const reason=window.prompt(`Delete independent, unposted cheque ${item.chequeNo}? Linked receipts and OTP handovers cannot be deleted. Give a reason:`, 'Entered in error');if(reason===null)return;setBusy(true);try{await api(`/cheques/received/${item.id}`,{method:'DELETE',body:JSON.stringify({reason})});await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <section style={{background:'#fff',padding:12,borderRadius:10,border:'1px solid #e5e7eb'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong>CHEQUES — PENDING CASHIER HANDOVER ({items.length})</strong><button className="cbtn" disabled={busy} onClick={load}>REFRESH</button></div>
    <small>All collected cheques also appear in Cheque Controlling System → Company Received. Physical custody requires cashier OTP; no bank posting occurs here.</small>
    {role!=='CASHIER'&&<p style={{color:'#92400e',fontSize:11}}>Only an authenticated CASHIER can generate or accept a custody OTP. Other authorized DMS users can review this queue.</p>}
    {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
    <div style={{overflow:'auto'}}><table className="table"><thead><tr>{['Cheque','Party','Amount','Collector / Salesperson','Status','Handover / Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
      {items.map(x=><tr key={x.id}><td>{x.chequeNo}</td><td>{x.issuedByPartyName||'—'}</td><td>{money(x.amount)}</td><td>{x.receivedByName||'—'}</td><td>{String(x.status||'').replaceAll('_',' ')}</td><td>
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        {role==='CASHIER'&&['HANDOVER_REQUESTED','HANDOVER_OTP_ISSUED'].includes(x.status)&&<button className="cbtn primary" disabled={busy} onClick={()=>generate(x.id)}>Cashier OTP</button>}
        {role==='CASHIER'&&x.status==='HANDOVER_VERIFIED'&&<button className="cbtn primary" disabled={busy} onClick={()=>accept(x.id)}>Accept Cheque</button>}
        {rights.edit&&<button className="cbtn" disabled={busy} onClick={()=>edit(x)}>EDIT</button>}
        {rights.delete&&<button className="cbtn danger" disabled={busy||!!x.linkedReceiptNo||x.collectionLinked||x.status?.startsWith('HANDOVER_')} title="Only independent unposted control entries can be deleted" onClick={()=>remove(x)}>DELETE</button>}
        </div>{otpCodes[x.id]&&<div className="otpBox">CASHIER OTP: {otpCodes[x.id]}</div>}
      </td></tr>)}
      {!items.length&&<tr><td colSpan="6" className="state">No cheque handovers pending for this financial year.</td></tr>}
    </tbody></table></div>
  </section>;
}
