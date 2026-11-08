import React,{useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowLeft,Download,Upload,CheckCircle,AlertTriangle} from 'lucide-react';
import {api} from '../lib/api.js';
import '../transaction-books.css';
const fmt=n=>`₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const esc=x=>`"${String(x??'').replaceAll('"','""')}"`;
export function downloadCashbookTemplate(){
 const columns=['Date','Party Name','Remarks','Mode','Debit','Credit'];
 const blob=new Blob(['\uFEFF'+columns.map(esc).join(',')+'\r\n'],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rupioo-cashbook-bulk-template.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function CashbookBulkPage(){
 const navigate=useNavigate();const [file,setFile]=useState(null),[preview,setPreview]=useState(null),[rows,setRows]=useState([]),[parties,setParties]=useState([]);
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{api('/transactions/voucher-party-options').then(x=>setParties(Array.isArray(x)?x:(x.items||[]))).catch(()=>setParties([]));},[]);
 const fullName=p=>`${p.name} • ${p.type}${p.identifier?' • '+p.identifier:''}`;
 const update=(i,key,v)=>setRows(all=>all.map((x,index)=>index===i?{...x,[key]:v}:x));
 const partyChange=(i,value)=>{
  const match=parties.find(p=>fullName(p)===value);
  setRows(all=>all.map((r,j)=>j===i?{...r,partySearch:value,partyName:match?.id||value,partyId:match?.id||'',partyType:match?.type||'OTHER'}:r));
 };
 const review=async()=>{
  if(!file)return setError('Choose CSV, XLS or XLSX file');setBusy(true);setError('');setMessage('');
  try{const f=new FormData();f.append('file',file);
   const d=await api('/transactions/cashbook/bulk-preview',{method:'POST',body:f});
   setPreview(d);setRows((d.items||[]).map(x=>({...x,partySearch:x.partyId?
    fullName(parties.find(p=>p.id===x.partyId)||{name:x.partyName,type:x.partyType}):x.partyName||'',confirmCash:false})));
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const post=async()=>{
  if(!preview)return;const invalid=rows.find(x=>x.error||x.requiresContra||!x.partyName||!x.partyType||(x.bankWarning&&!x.confirmCash));
  if(invalid)return setError(`Row ${invalid.rowNo}: ${invalid.error||(invalid.requiresContra?'This is a Cash/Bank transfer: use Contra, not Cashbook Bulk Upload':'Select a party and confirm any bank-related narration before posting')}`);
  setBusy(true);setError('');setMessage('');
  try{const d=await api('/transactions/cashbook/bulk-post',{method:'POST',body:JSON.stringify({importId:preview.importId,rows:rows.map(x=>({
   rowNo:x.rowNo,date:x.date,particulars:x.particulars,debit:x.debit,credit:x.credit,
   partyName:x.partyName,partyId:x.partyId,partyType:x.partyType,confirmCash:x.confirmCash,
  }))})});
   setMessage(`${d.inserted||0} entries posted. ${(d.errors||[]).length} not posted.`);
   if(d.errors?.length)setError(d.errors.map(x=>`Row ${x.row}: ${x.error}`).join(' | '));
   else navigate('/dms/cashbook');
  }catch(e){setError(e.message+(e.details?.errors?': '+e.details.errors.map(x=>`Row ${x.row}: ${x.error}`).join(' | '):''));}
  finally{setBusy(false);}
 };
 // Illustration balance for rows INSIDE the file only. Actual Cashbook joins
 // chronological posted entries and FY opening when uploaded.
 let illustrative=0;
 const calculated=new Map(rows.filter(r=>!r.error).sort((a,b)=>a.date.localeCompare(b.date)||a.rowNo-b.rowNo).map(r=>{
  illustrative+=Number(r.credit||0)-Number(r.debit||0);return [r.rowNo,Math.round(illustrative*100)/100];
 }));
 return <div className="transactionPage transactionEntryFullPage">
  <div className="transactionSingleToolbar"><button className="btn ghost" onClick={()=>navigate('/dms/cashbook')}><ArrowLeft size={15}/>Back</button>
   <button className="btn ghost" onClick={downloadCashbookTemplate}><Download size={15}/>Template (6 columns)</button></div>
  {error&&<div className="resultBanner bad" role="alert">{error}</div>}
  {message&&<div className="resultBanner good">{message}</div>}
  <section className="panel transactionLedgerPanel">
   <div className="transactionSingleToolbar"><input type="file" accept=".xlsx,.xls,.csv" onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);setRows([]);}}/>
    <button className="btn primary" disabled={busy||!file} onClick={review}><Upload size={15}/>{busy?'Processing…':'Upload & Review'}</button></div>
   <div className="financeSafetyNote">Excel columns: <strong>Date · Party Name · Remarks · Mode · Debit · Credit</strong>. Debit is cash paid out; Credit is cash received. Leave Running Balance blank—DMS calculates it by date. Choose the real party or mark an unmatched party as OTHER (Suspense), then review before posting. Bank deposits/withdrawals should be posted through Contra, not twice.</div>
   {preview&&<>
    <div className="cashbookBalanceStrip"><span>Rows <strong>{rows.length}</strong></span><span>Payments <strong>{rows.filter(x=>!x.error&&x.debit>0).length}</strong></span><span>Receipts <strong>{rows.filter(x=>!x.error&&x.credit>0).length}</strong></span><span>Invalid <strong>{rows.filter(x=>x.error).length}</strong></span></div>
    <datalist id="cashbook-bulk-parties">{parties.map(p=><option key={`${p.id}-${p.type}`} value={fullName(p)}/>)}</datalist>
    <div className="transactionLineTableScroll"><table className="transactionLineTable cashbookBulkTable"><thead><tr>
     <th>Date</th><th>Particulars</th><th>Debit</th><th>Credit</th><th>File Net*</th><th>Matched Party / Ledger</th><th>Type</th><th>Review</th>
    </tr></thead><tbody>{rows.map((r,i)=><tr key={r.rowNo}>
     <td>{r.date||'—'}</td><td className="cashbookParticular">{r.particulars||'—'}<small>Excel row {r.rowNo}{r.categoryHint?` · Suggested: ${r.categoryHint}`:''}</small></td>
     <td>{r.debit?fmt(r.debit):'—'}</td><td>{r.credit?fmt(r.credit):'—'}</td>
     <td>{r.error?'—':fmt(calculated.get(r.rowNo))}</td>
     <td><input disabled={Boolean(r.error)} value={r.partySearch||''} list="cashbook-bulk-parties" placeholder="Search/select party or type name" onChange={e=>partyChange(i,e.target.value)}/></td>
     <td><select disabled={Boolean(r.error)} value={r.partyType||''} onChange={e=>setRows(all=>all.map((x,j)=>j===i?{...x,partyType:e.target.value,...(x.partyType!==e.target.value?{partyId:''}:{})}:x))}><option value="">Choose</option><option value="CUSTOMER">Customer</option><option value="USER">User/Ledger</option><option value="TRANSPORTER">Transporter</option><option value="OTHER">Other/Suspense</option></select></td>
     <td>{r.error?<span className="cashbookError">{r.error}</span>:r.requiresContra?<span className="cashbookError">Cash/Bank Contra required</span>:r.bankWarning?<label className="cashbookWarning"><input type="checkbox" checked={Boolean(r.confirmCash)} onChange={e=>update(i,'confirmCash',e.target.checked)}/> Confirm CASH (not bank)</label>:r.partyId?<span title={r.confidence}><CheckCircle size={16}/> Matched</span>:<span><AlertTriangle size={15}/> Review</span>}</td>
    </tr>)}</tbody></table></div>
    <div className="financeSafetyNote">*File Net is an illustrative running net of the imported file only, starting from zero. The actual Cashbook running balance includes the financial-year opening amount and existing date-ordered transactions; it recalculates after posting. Suggested party matches are not automatic approvals.</div>
    <div className="formActions"><button className="btn primary" disabled={busy||rows.some(r=>r.error||r.requiresContra)||!rows.length} onClick={post}>{busy?'Posting…':`Post Reviewed ${rows.length} Rows`}</button></div>
   </>}
  </section>
 </div>;
}
