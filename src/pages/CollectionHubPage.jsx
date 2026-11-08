import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getUser } from '../lib/api.js';
import { currentFinancialYear, financialYearOptions } from '../lib/financialYear.js';

const money = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const dateText = value => value ? new Date(value).toLocaleDateString('en-IN') : '—';
const STATUS = { CASH:'Cash',CHEQUE:'Cheques',ONLINE:'Online / UPI / Bank' };
export default function CollectionHubPage({initialTab='CASH',inside='cashier'}) {
  const user=getUser();
  const [fy,setFy]=useState(currentFinancialYear()),[page,setPage]=useState(1);
  const [tab,setTab]=useState(initialTab);
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [bankAccounts,setBankAccounts]=useState([]);
  const [match,setMatch]=useState({receiptId:'',statementRowId:'',bankAccountId:''});
  const [suggestions,setSuggestions]=useState([]);
  const load=useCallback(async()=>{
    setBusy(true);setError('');
    try{const result=await api(`/collection-hub/overview?financialYear=${encodeURIComponent(fy)}&limit=500&page=${page}`);setData(result);}
    catch(e){setError(e.message||'Failed to load collections');}
    finally{setBusy(false);}
  },[fy,page]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{if(inside==='cheque')setTab('ONLINE');},[inside]);
  useEffect(()=>{
    if(tab!=='ONLINE')return;
    api('/cheques/banks').then(x=>setBankAccounts(x.items||[])).catch(()=>setBankAccounts([]));
  },[tab]);
  const items=useMemo(()=>(data?.items||[]).filter(row=>row.channel===tab),[data,tab]);
  const sync=async()=>{
    if(!window.confirm('Link existing customer-OTP-verified cheques to Company Received? No accounting posting will be created.'))return;
    setBusy(true);try{
      const result=await api('/collection-hub/sync-cheques',{method:'POST',body:JSON.stringify({financialYear:fy})});
      window.alert(`Linked ${result.linked}, already linked ${result.alreadyLinked}, needs review ${result.needsReview?.length||0}. ${result.needsReview?.slice(0,5).map(x=>`${x.receiptNo}: ${x.reason}`).join('\n')||''}`);
      await load();
    }catch(e){setError(e.message||'Sync failed');}finally{setBusy(false);}
  };
  const findSuggestions=async(row)=>{
    setBusy(true);setError('');try{
      const result=await api(`/collection-hub/online/${encodeURIComponent(row.id)}/suggestions?financialYear=${encodeURIComponent(fy)}`);
      setSuggestions(result.items||[]);
      if((result.items||[]).length===1){const r=result.items[0];setMatch({receiptId:row.id,statementRowId:r.id,bankAccountId:r.bankAccountId});}
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const verify=async(row)=>{
    if(!match.statementRowId||!match.bankAccountId)return window.alert('Select the bank and enter an existing posted bank-statement row ID.');
    if(!window.confirm(`Match ${row.receiptNo} for ${money(row.amount)} to the selected company bank credit? This does not create a second accounting entry.`))return;
    setBusy(true);try{
      await api(`/collection-hub/online/${encodeURIComponent(row.id)}/match`,{method:'POST',body:JSON.stringify({financialYear:fy,bankAccountId:match.bankAccountId,statementRowId:match.statementRowId})});
      setMatch({receiptId:'',bankAccountId:'',statementRowId:''});setSuggestions([]);await load();
    }catch(e){setError(e.message||'Bank match failed');}finally{setBusy(false);}
  };
  return <section className="collectionHub" style={{background:'#fff',border:'1px solid #e5e7eb',padding:14,borderRadius:12}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
      <strong>{inside==='cheque'?'Company Received — Online Payments':'Salesperson / Collector Collections'}</strong>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <label style={{fontSize:11,fontWeight:800}}>FY <select value={fy} onChange={e=>{setFy(e.target.value);setPage(1)}}>{financialYearOptions(user,{count:8,extra:[currentFinancialYear()]}).map(v=>typeof v==='string'?<option key={v}>{v}</option>:<option key={v.value} value={v.value}>{v.label}</option>)}</select></label>
        <button type="button" disabled={busy} onClick={load}>Refresh</button>
      </div>
    </div>
    {inside!=='cheque'&&<div style={{display:'flex',gap:6,margin:'12px 0'}}>{Object.entries(STATUS).map(([key,label])=><button key={key} type="button" onClick={()=>setTab(key)} style={{padding:'7px 12px',borderRadius:8,border:'1px solid #e5e7eb',fontWeight:tab===key?800:500,background:tab===key?'#eef2ff':'white'}}>{label}</button>)}</div>}
    {data&&<div style={{display:'flex',gap:8,flexWrap:'wrap',fontSize:11,margin:'12px 0'}}>{[['Cash',data.summary?.cash],['Cheques',data.summary?.cheque],['Online',data.summary?.online],['Pending Bank Checks',data.summary?.onlinePending]].map(([label,n])=><div key={label} style={{border:'1px solid #e5e7eb',borderRadius:8,padding:9}}><div style={{color:'#64748b'}}>{label}</div><strong>{label==='Pending Bank Checks'?n:money(n)}</strong></div>)}</div>}
    {error&&<div role="alert" style={{color:'#b91c1c',padding:'8px 0'}}>{error}</div>}
    {tab==='CHEQUE'&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'7px 0'}}><small>Missing cheque links (visible page): {data?.summary?.chequeUnlinked||0}</small><button type="button" disabled={busy} onClick={sync}>Sync Missing Cheques</button></div>}
    <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%',fontSize:11,whiteSpace:'nowrap'}}><thead><tr>{['Date','Receipt','Party','Collected By','Amount','Status','Reference'].map(h=><th key={h} style={{textAlign:'left',padding:8,background:'#f8fafc',borderBottom:'1px solid #e5e7eb'}}>{h}</th>)}</tr></thead><tbody>
      {items.length?items.map(row=><React.Fragment key={row.id}><tr>{[
        dateText(row.date),row.receiptNo,row.partyName,row.collectedBy||'—',money(row.amount),
        row.channel==='ONLINE'?row.onlineStatus:row.channel==='CHEQUE'?(row.chequeRegister?.status||'NEEDS CHEQUE LINK'):row.physicalStatus,
        row.channel==='CHEQUE'?row.chequeNo:(row.reference||'—')
      ].map((v,i)=><td key={i} style={{padding:8,borderBottom:'1px solid #eef2f7'}}>{v}</td>)}</tr>
      {tab==='ONLINE'&&row.onlineStatus==='PENDING_BANK_VERIFICATION'&&match.receiptId===row.id&&<tr><td colSpan={7} style={{padding:12,background:'#f8fafc'}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'end'}}>
          <label>Company Bank<select value={match.bankAccountId} onChange={e=>setMatch(m=>({...m,bankAccountId:e.target.value}))}><option value="">Select verified bank</option>{bankAccounts.map(b=><option key={b.bankAccountId} value={b.bankAccountId}>{b.bankName} •••{String(b.accountNumber||'').slice(-4)}</option>)}</select></label>
          <label>Matched Bank Credit<select value={match.statementRowId} onChange={e=>{const item=suggestions.find(x=>x.id===e.target.value);setMatch(m=>({...m,statementRowId:e.target.value,bankAccountId:item?.bankAccountId||m.bankAccountId}));}}><option value="">Select matching credit</option>{suggestions.map(c=><option key={c.id} value={c.id}>{dateText(c.date)} · {money(c.amount)} · {String(c.reference||'').slice(0,90)}</option>)}</select></label><button type="button" onClick={()=>findSuggestions(row)} disabled={busy}>Find UTR Matches</button>
          <button onClick={()=>verify(row)} disabled={busy}>Match Credit</button><button onClick={()=>setMatch({receiptId:'',statementRowId:'',bankAccountId:''})}>Cancel</button>
        </div><small>Only a validated posted bank credit can be linked. Customer/suspense ledger settlement remains a separate accounting reconciliation.</small>
      </td></tr>}
      {tab==='ONLINE'&&row.onlineStatus==='PENDING_BANK_VERIFICATION'&&match.receiptId!==row.id&&<tr><td colSpan={7} style={{padding:'4px 8px',borderBottom:'1px solid #eef2f7'}}><button type="button" onClick={()=>{setMatch({receiptId:row.id,bankAccountId:'',statementRowId:''});setSuggestions([]);findSuggestions(row);}}>Find Matching Bank Credit</button></td></tr>}
      </React.Fragment>):<tr><td colSpan={7} style={{padding:30,textAlign:'center'}}>No confirmed collections of this type in the selected FY.</td></tr>}
    </tbody></table></div>
    <div style={{display:'flex',justifyContent:'flex-end',gap:9,alignItems:'center',paddingTop:8}}><button disabled={page<=1||busy} onClick={()=>setPage(x=>Math.max(1,x-1))}>Previous</button><small>Page {page} · Up to {data?.limit||500} entries</small><button disabled={!data?.hasMore||busy} onClick={()=>setPage(x=>x+1)}>Next</button></div>
    <p style={{fontSize:11,color:'#64748b'}}>Each item comes from the original OTP-verified receipt. Cheque registration, Cashier custody and bank settlement are independent stages; this page does not post another customer receipt.</p>
  </section>;
}
