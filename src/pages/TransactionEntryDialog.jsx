import React,{useEffect,useMemo,useState} from "react";
import {ArrowLeft,Download,Plus,Trash2,Upload} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {api,getUser} from "../lib/api.js";
import { fetchCompanyBankAccounts, companyBankParty, newTransferReference } from "../lib/companyBankOptions.js";
import "../transaction-books.css";

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const blank=(bank="")=>({key:`${Date.now()}-${Math.random()}`,date:today(),partyName:"",partyType:"",transferNo:newTransferReference(),transactionType:"RECEIPT",bankAccountId:bank,amount:"",remarks:""});
const strictDate=s=>{
 const v=String(s||"").trim();let y,m,d;
 let match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
 if(match){[,y,m,d]=match;}else{match=/^(\d{2})-(\d{2})-(\d{4})$/.exec(v);if(!match)return false;[,d,m,y]=match;}
 const dt=new Date(Date.UTC(+y,+m-1,+d));return +y>=1900&&+y<=2100&&dt.getUTCFullYear()===+y&&dt.getUTCMonth()===+m-1&&dt.getUTCDate()===+d;
};
const partyLabel=p=>`${p.name} • ${p.type}${p.subtype?` • ${p.subtype}`:""}${p.identifier?` • ${p.identifier}`:""}`;
const csvCell=x=>`"${String(x??"").replaceAll('"','""')}"`;
export function downloadTransactionTemplate(channel){
 const fields=channel==="cash"?["Date","Party Name","Remarks","Mode","Debit","Credit"]:["Transaction Mode","Date","Party Name / ID","Party Type","Amount","Remarks","Bank Account ID"];
 const url=URL.createObjectURL(new Blob(["\uFEFF",fields.map(csvCell).join(","),"\r\n"],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download=`${channel}-transactions-template.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
/** Routed full page, never a modal. */
export default function TransactionEntryPage({channel="cash",initialTab="single"}){
 const navigate=useNavigate();const isBank=channel==="bank",isBulk=initialTab==="bulk";
 const returnPath=isBank?"/dms/banking":"/dms/cashbook";
 const[banks,setBanks]=useState([]),[parties,setParties]=useState([]),[rows,setRows]=useState([blank()]);
 const[bankDefault,setBankDefault]=useState(""),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 useEffect(()=>{
  api("/transactions/voucher-party-options").then(d=>setParties(Array.isArray(d)?d:(d.items||[]))).catch(e=>setError(e.message));
  if(isBank)fetchCompanyBankAccounts().then(list=>{
    setBanks(list);const mainNumber=String(getUser()?.companyProfile?.bankDetails?.accountNumber||"").replace(/\s/g,"");
    const preferred=list.find(x=>x.isPrimary)||(mainNumber?list.find(x=>String(x.accountNumber||"").replace(/\s/g,"")===mainNumber):null)||list[0];
    const primary=String(preferred?._id||"");
    setBankDefault(primary);setRows(r=>r.map(x=>({...x,bankAccountId:x.bankAccountId||primary})));
  }).catch(e=>setError(e.message));
 },[isBank]);
 const available=useMemo(()=>new Map((isBank?[...parties,...banks.map(companyBankParty)]:parties).map(p=>[partyLabel(p),p])),[parties,banks,isBank]);
 const field=(key,k,value)=>setRows(current=>current.map(r=>r.key===key?{...r,[k]:value}:r));
 const updateParty=(key,value)=>{
  const matched=available.get(value);
  setRows(current=>current.map(r=>r.key===key?{...r,partyName:value,partyType:matched?.type||""}:r));
 };
 const validate=(r,i)=>{
  if(!strictDate(r.date))return `Line ${i+1}: Date must be DD-MM-YYYY or YYYY-MM-DD and be a real calendar day.`;
  if(!r.partyName.trim())return `Line ${i+1}: Select or enter a Party Name.`;
  if(!["RECEIPT","PAYMENT"].includes(r.transactionType))return `Line ${i+1}: Select Receipt or Payment.`;
  if(!Number.isFinite(Number(r.amount))||Number(r.amount)<=0)return `Line ${i+1}: Amount must be greater than zero.`;
  if(isBank&&!r.bankAccountId)return `Line ${i+1}: Select a Bank Account.`;
  if(isBank&&r.partyType==="BANK_ACCOUNT"){
   const party=available.get(r.partyName);
   const bank=banks.find(b=>String(b._id)===String(r.bankAccountId));
   if(!party||!bank)return `Line ${i+1}: Select a valid own-bank party and account.`;
   if(party.id===bank.bankAccountId)return `Line ${i+1}: Source and destination cannot be the same account.`;
  }
  return "";
 };
 const post=async()=>{
  setError("");setSuccess("");
  for(let i=0;i<rows.length;i++){const error=validate(rows[i],i);if(error)return setError(error);}
  setBusy(true);const succeeded=new Set();const failed=[];
  try{
   for(let i=0;i<rows.length;i++){
    const r=rows[i];const party=available.get(r.partyName);
    // A cash voucher has the SAME form as a bank voucher, except there is
    // no bank account selector. Unknown typed parties go to Suspense rather
    // than being matched to a different person's ledger.
    const exactNameMatches=parties.filter(p=>String(p.name||"").trim().toLowerCase()===r.partyName.trim().toLowerCase());
    const resolved=isBank?party:(party||(exactNameMatches.length===1?exactNameMatches[0]:null));
    const payload={date:r.date,partyName:resolved?.id||r.partyName,partyType:resolved?.type||(isBank?r.partyType:"OTHER"),
     transactionType:r.transactionType,bankAccountId:isBank?r.bankAccountId:"",
     amount:Number(r.amount),remarks:r.remarks,mode:isBank?"BANK":"CASH"};
    try{
     if(isBank&&party?.type==="BANK_ACCOUNT"){
      const currentBank=banks.find(b=>String(b._id)===String(r.bankAccountId));
      if(!currentBank)throw new Error("Selected account no longer exists");
      await api('/transactions/bank-transfer',{method:'POST',body:JSON.stringify({
       transferNo:r.transferNo,date:r.date,amount:Number(r.amount),remarks:r.remarks,
       fromBankAccountId:r.transactionType==="PAYMENT"?currentBank.bankAccountId:party.id,
       toBankAccountId:r.transactionType==="PAYMENT"?party.id:currentBank.bankAccountId,
      })});
     }else{
      await api(`/transactions/manual-entry/${channel}`,{method:"POST",body:JSON.stringify(payload)});
     }
     succeeded.add(r.key);
    }
    catch(e){failed.push(`Line ${i+1}: ${e.message}`);}
   }
   if(failed.length){setRows(current=>current.filter(r=>!succeeded.has(r.key)));setError(`${succeeded.size} posted, ${failed.length} failed. Only failed lines remain (avoid posting successful lines again). ${failed.join(" | ")}`);}
   else{setSuccess(`${succeeded.size} ${isBank?"bank":"cash"} transaction(s) posted.`);setRows([blank(bankDefault)]);}
  }finally{setBusy(false);}
 };
 const upload=async()=>{
  if(!file)return setError("Choose an Excel/CSV file.");
  if(isBank&&!bankDefault)return setError("Select a bank account.");
  setBusy(true);setError("");setSuccess("");
  try{const body=new FormData();body.append("file",file);if(isBank)body.append("bankAccountId",bankDefault);
   const d=await api(`/transactions/manual-bulk/${channel}`,{method:"POST",body});
   if(d.invalid||d.partial)setError(`${d.inserted||0} posted, ${d.invalid||0} rejected. ${(d.errors||[]).map(x=>`Row ${x.row}: ${x.error}`).join(" | ")}`);
   else setSuccess(`${d.inserted||0} entries posted.${!isBank?` ${d.inferredFromRemarks||0} party name(s) identified from Remarks; ${d.postedToSuspense||0} unmatched/ambiguous party entry(ies) posted to Suspense.`:""}`);
  }catch(e){setError(e.message+(e.details?.errors?.length?": "+e.details.errors.map(x=>`Row ${x.row}: ${x.error}`).join(" | "):""));}
  finally{setBusy(false);}
 };
 const downloadParties=()=>{
  const lines=[["Party Name","Party Type","Party ID","Identifier","Account Hierarchy"],...parties.map(p=>[p.name,p.type,p.id,p.identifier||"",p.accountPath||""])].map(r=>r.map(csvCell).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF",lines],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="transaction-party-directory.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <div className="transactionPage transactionEntryFullPage">
  <div className="transactionSingleToolbar">
   <button className="btn ghost" onClick={()=>navigate(returnPath)}><ArrowLeft size={15}/>Back</button>
   <span className="transactionDialogMode">{isBank?"Bank":"Cash"} · {isBulk?"Bulk Upload":"Create Transactions"}</span>
   {isBulk&&<select aria-label="Download Bulk Upload Resources" value="" onChange={e=>{const choice=e.target.value;e.target.value="";if(choice==="template")downloadTransactionTemplate(channel);if(choice==="parties")downloadParties();}}><option value="">Download ▾</option><option value="template">Template</option><option value="parties">Party Directory</option></select>}
  </div>
  {error&&<div className="resultBanner bad" role="alert">{error}</div>}
  {success&&<div className="resultBanner good" role="status">{success}</div>}
  <section className="panel transactionLedgerPanel">
  {isBulk?<div className="transactionBulkForm">
    {isBank&&<label>Bank Account *<select value={bankDefault} onChange={e=>setBankDefault(e.target.value)}><option value="">Select Bank</option>{banks.map(b=><option key={b._id} value={b._id}>{b.bankName} · {b.accountNumber}{b.isPrimary?" · Main":""}</option>)}</select></label>}
    <label>Excel / CSV (Date: DD-MM-YYYY or YYYY-MM-DD)<input type="file" accept=".csv,.xlsx,.xls" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
    {!isBank&&<div className="financeSafetyNote">CASH upload columns, in order: <strong>Date · Party Name · Remarks · Mode · Debit · Credit</strong>. Enter CASH in Mode. Leave Party Name blank to detect a unique party from Remarks. Unmatched or ambiguous names post to Suspense, never to a guessed customer. Debit decreases cash; Credit increases cash.</div>}
    <div className="formActions"><button className="btn primary" disabled={busy||!file} onClick={upload}><Upload size={15}/>{busy?"Uploading…":"Upload & Post"}</button></div>
   </div>:<>
    <datalist id="transaction-master-parties">{(isBank?[...parties,...banks.map(companyBankParty)]:parties).map(p=><option key={`${p.type}-${p.id}`} value={partyLabel(p)}/>)}</datalist>
    <div className="transactionLineTableScroll"><table className="transactionLineTable"><thead><tr><th>Date *</th><th>Party Name *</th><th>Receipt / Payment *</th>{isBank&&<th>Bank Account *</th>}<th>Amount *</th><th>Remarks</th><th aria-label="Remove line"/></tr></thead>
    <tbody>{rows.map((r,i)=><tr key={r.key}>
     <td><input aria-label={`Date line ${i+1}`} value={r.date} placeholder="DD-MM-YYYY" onChange={e=>field(r.key,"date",e.target.value)}/></td>
     <td><input aria-label={`Party line ${i+1}`} value={r.partyName} list="transaction-master-parties" placeholder="Search customer / user / transporter" onChange={e=>updateParty(r.key,e.target.value)}/></td>
     <td><select aria-label={`Transaction mode line ${i+1}`} value={r.transactionType} onChange={e=>field(r.key,"transactionType",e.target.value)}><option value="RECEIPT">Receipt</option><option value="PAYMENT">Payment</option></select></td>
     {isBank&&<td><select aria-label={`Bank line ${i+1}`} value={r.bankAccountId} onChange={e=>field(r.key,"bankAccountId",e.target.value)}><option value="">Select Account</option>{banks.map(b=><option key={b._id} value={b._id}>{b.bankName} · {b.accountNumber}</option>)}</select></td>}
     <td><input aria-label={`Amount line ${i+1}`} type="number" min="0.01" step="0.01" value={r.amount} onChange={e=>field(r.key,"amount",e.target.value)}/></td>
     <td><input aria-label={`Remarks line ${i+1}`} value={r.remarks} onChange={e=>field(r.key,"remarks",e.target.value)}/></td>
     <td><button className="btn ghost" aria-label={`Remove line ${i+1}`} disabled={rows.length===1} onClick={()=>setRows(current=>current.filter(x=>x.key!==r.key))}><Trash2 size={15}/></button></td>
    </tr>)}</tbody></table></div>
    {isBank&&<div className="financeSafetyNote">For transfers between company banks, select the other bank in Party Name. With Payment, money moves FROM the selected Bank Account to the party bank; with Receipt it moves FROM the party bank INTO the selected Bank Account. The system posts ONE internal transfer, not customer income or expense.</div>}
    <div className="transactionLineActions"><button className="btn ghost" onClick={()=>setRows(current=>[...current,blank(isBank?rows[rows.length-1]?.bankAccountId||bankDefault:"")])}><Plus size={15}/>Add More Row</button><button className="btn primary" disabled={busy} onClick={post}>{busy?"Posting…":`Post ${rows.length} Transaction${rows.length===1?"":"s"}`}</button></div>
   </>}
  </section>
 </div>;
}
