import React, {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Download,Printer,RefreshCw,FileText,AlertTriangle} from 'lucide-react';
import {api,apiBlob} from '../lib/api.js';
import '../cheque-control.css';

const localDate=()=>{
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
const money=v=>`₹${Number(v||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const ddmmyyyy=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?`${s.slice(8,10)}-${s.slice(5,7)}-${s.slice(0,4)}`:'—';

export default function ChequeDepositSlipPage({banks=[],initialBankId='',canPrint,onBack}){
  const [bankId,setBankId]=useState(initialBankId||banks.find(b=>b.isPrimary)?.bankAccountId||banks[0]?.bankAccountId||'');
  const [depositDate,setDepositDate]=useState(localDate);
  const [items,setItems]=useState([]),[selected,setSelected]=useState([]);
  const [bank,setBank]=useState(null),[supported,setSupported]=useState(true),[hasMore,setHasMore]=useState(false);
  const [loading,setLoading]=useState(false),[error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [generating,setGenerating]=useState(false),[pdfUrl,setPdfUrl]=useState('');
  const today=localDate();
  const selectedSet=useMemo(()=>new Set(selected),[selected]);
  const selectedRows=useMemo(()=>items.filter(r=>selectedSet.has(r.id)),[items,selectedSet]);
  const selectedTotal=selectedRows.reduce((sum,c)=>sum+Number(c.amount||0),0);
  const pages=Math.ceil(selectedRows.length/4);
  // Any change invalidates a previously generated preview. No background posting.
  useEffect(()=>{setPdfUrl(old=>{if(old)URL.revokeObjectURL(old);return '';});},[selected,depositDate,bankId]);
  useEffect(()=>()=>{if(pdfUrl)URL.revokeObjectURL(pdfUrl);},[pdfUrl]);
  useEffect(()=>{
    if(!bankId){setItems([]);setSelected([]);setBank(null);return;}
    let live=true;setLoading(true);setError('');
    const q=new URLSearchParams({bankAccountId:bankId,depositDate});
    api(`/cheques/received/deposit-slip/eligible?${q}`)
      .then(r=>{if(!live)return;setItems(r.items||[]);setSelected((r.items||[]).map(x=>x.id));setBank(r.bank);setSupported(!!r.supportedForm);setHasMore(!!r.hasMore);})
      .catch(err=>{if(live){setError(err.message);setItems([]);setSelected([]);}})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[bankId,depositDate,refresh]);
  const generate=async()=>{
    if(!canPrint||!supported||!selected.length||generating)return;
    setGenerating(true);setError('');
    try{
      const response=await apiBlob('/cheques/received/deposit-slip/pdf',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({bankAccountId:bankId,depositDate,chequeIds:selected})
      });
      if(!String(response.contentType||'').includes('application/pdf'))throw new Error('Server did not return a PDF');
      const next=URL.createObjectURL(response.blob);
      setPdfUrl(old=>{if(old)URL.revokeObjectURL(old);return next;});
    }catch(err){setError(err.message);}finally{setGenerating(false);}
  };
  const toggle=id=>setSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  const allSelected=items.length>0&&selected.length===items.length;
  return <div className="chequePage chequeSlipPage">
    <div className="chequeSlipTop">
      <button className="btn ghost" type="button" onClick={onBack}><ArrowLeft size={15}/> Company Received</button>
      <strong><FileText size={18}/> Automatic Cheque Deposit Slips</strong>
      <span>Your clean SBI Assamese / English form</span>
    </div>
    <section className="panel chequeSlipPanel">
      <div className="chequeSlipControls">
        <label>Company bank account
          <select value={bankId} onChange={e=>setBankId(e.target.value)}>
            <option value="">Select deposit bank</option>
            {banks.map(b=><option key={b.bankAccountId} value={b.bankAccountId}>{b.bankName} ···{String(b.accountNumber||'').slice(-4)}</option>)}
          </select>
        </label>
        <label>Deposit slip date
          <input type="date" max={today} value={depositDate} onChange={e=>setDepositDate(e.target.value)} />
        </label>
        <button className="btn ghost" type="button" onClick={()=>setRefresh(n=>n+1)} disabled={loading}><RefreshCw size={15}/> Refresh eligible cheques</button>
      </div>
      <p className="chequeSlipNote">Cheques are picked automatically once their cheque date has arrived and their status is <strong>Pending Received</strong>. Cheques still with the Salesperson/Collector, already deposited, future-dated, bounced, or cleared are excluded. Select the cheques you will physically deposit.</p>
      {!supported&&bank&&<div className="resultBanner bad"><AlertTriangle size={16}/> This SBI-style deposit slip is for State Bank of India accounts only. Choose an SBI company bank account.</div>}
      {error&&<div className="resultBanner bad" role="alert">{error}</div>}
      {hasMore&&<div className="resultBanner bad">There are over 1,500 eligible cheques. Narrow the date/bank before printing.</div>}
      <div className="chequeSlipSummary">
        <span>Due cheques <strong>{items.length}</strong></span>
        <span>Selected <strong>{selected.length}</strong></span>
        <span>Total <strong>{money(selectedTotal)}</strong></span>
        <span>Slips to print <strong>{pages}</strong></span>
      </div>
      {loading?<div className="chequeSlipEmpty">Checking cheque dates and company custody…</div>:items.length===0?<div className="chequeSlipEmpty">No eligible cheques for this account and date. Once their cheque date arrives and the Cashier receives them, they will appear here automatically.</div>:
        <div className="chequeSlipTableWrap"><table className="chequeSlipTable"><thead><tr><th><input aria-label="Select all due cheques" type="checkbox" checked={allSelected} onChange={e=>setSelected(e.target.checked?items.map(r=>r.id):[])}/></th><th>Cheque No.</th><th>Party Name</th><th>Cheque Date</th><th>Received Date</th><th>Issuing Bank / Branch</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{items.map(r=><tr key={r.id}><td><input aria-label={`Select cheque ${r.chequeNo}`} type="checkbox" checked={selectedSet.has(r.id)} onChange={()=>toggle(r.id)} /></td><td>{r.chequeNo}</td><td>{r.issuedByPartyName||'—'}</td><td>{ddmmyyyy(r.chequeDate)}</td><td>{ddmmyyyy(r.receivedDate)}</td><td>{r.issuerBankName||'—'}<small>{r.issuerBranchName||''}</small></td><td className="number">{money(r.amount)}</td><td>{r.status.replaceAll('_',' ')}</td></tr>)}</tbody></table></div>}
      <div className="chequeSlipButtons">
        <span>Auto-fill your new SBI template: bank and depositor copies, up to four cheques per page. No ledger posting occurs.</span>
        <button className="btn primary" type="button" disabled={loading||generating||!canPrint||!supported||!selected.length||selected.length>200||hasMore} onClick={generate}><FileText size={16}/>{generating?'Preparing PDF…':'Auto Generate SBI Slip & Preview'}</button>
        {pdfUrl&&<>
          <button className="btn ghost" type="button" onClick={()=>window.open(pdfUrl,'_blank','noopener,noreferrer')}><Printer size={16}/> Print</button>
          <a className="btn ghost" href={pdfUrl} download={`SBI_Cheque_Deposit_${depositDate}.pdf`}><Download size={16}/> Save PDF</a>
        </>}
      </div>
      {pdfUrl&&<div className="chequeSlipPreview"><div>Auto-filled SBI deposit slip (your new template) — {pages} page{pages===1?'':'s'} • verify and sign before handing to bank</div><iframe title="Printable SBI deposit slip preview" src={pdfUrl} /></div>}
    </section>
  </div>;
}
