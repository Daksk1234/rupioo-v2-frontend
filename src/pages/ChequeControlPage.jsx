import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Search, Landmark, Pencil, Trash2, BookOpen, Download, Printer, ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api, getUser } from '../lib/api.js';
import { currentFinancialYear, financialYearOptions } from '../lib/financialYear.js';
import ChequeDepositSlipPage from './ChequeDepositSlipPage.jsx';
import { accessForPath } from '../lib/permissionAccess.js';
import '../cheque-control.css';

const today = ()=>new Date().toISOString().slice(0,10);
const money = value=>`₹${Number(value||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const displayChequeDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? `${value.slice(8,10)}-${value.slice(5,7)}-${value.slice(0,4)}` : (value || '—');
const blankBook=()=>({bankAccountId:'',numberOfLeaves:'25',startingNo:'',receivedDate:today(),remarks:''});
const blankIssued=()=>({status:'ISSUED',issueFor:'CHEQUE',issuedDate:today(),chequeDate:today(),issuedPartyName:'',issuedPartyGlobalId:'',amount:'',clearedDate:'',bankTransactionReference:'',remarks:'',reason:''});
const blankIssuePage=()=>({bankAccountId:'',issueFor:'CHEQUE',issuedDate:today(),chequeDate:today(),issuedPartyName:'',issuedPartyGlobalId:'',amount:'',bankTransactionReference:'',remarks:''});
const blankReceived=()=>({chequeNo:'',receivedDate:today(),chequeDate:today(),issuedByPartyName:'',customerGlobalId:'',ifsc:'',amount:'',depositBankAccountId:'',depositDate:'',clearedDate:'',statusDate:today(),bankTransactionReference:'',status:'PENDING_RECEIVED',bounceCharge:'',bounceChargeBearer:'COMPANY',linkedReceiptNo:'',linkedReceiptFy:'',linkedBankTransactionId:'',remarks:'',reason:''});
const incomingStatuses={RECEIVED:['RECEIVED','PENDING_RECEIVED','DEPOSITED','CANCELLED','LOST'],PENDING_RECEIVED:['PENDING_RECEIVED','RECEIVED','DEPOSITED','CANCELLED','LOST'],DEPOSITED:['DEPOSITED','CLEARED','RETURNED','BOUNCED'],RETURNED:['RETURNED','REDEPOSITED'],BOUNCED:['BOUNCED','REDEPOSITED'],REDEPOSITED:['REDEPOSITED','CLEARED','RETURNED','BOUNCED'],CLEARED:['CLEARED'],CANCELLED:['CANCELLED'],LOST:['LOST']};
const outgoingStatuses={AVAILABLE:['AVAILABLE','CANCELLED','LOST','STOLEN','MISTAKEN'],ISSUED:['ISSUED','CLEARED','RETURNED','CANCELLED','LOST','STOLEN','MISTAKEN'],RETURNED:['RETURNED','ISSUED'],CLEARED:['CLEARED'],CANCELLED:['CANCELLED'],LOST:['LOST'],STOLEN:['STOLEN'],MISTAKEN:['MISTAKEN']};
const maskBank=b=>`${b.bankName||''} ${b.accountNumber?`•••• ${String(b.accountNumber).slice(-4)}`:''}`;
function EntryField({label,value,onChange,type='text',required=false,children}) { return <label className="chequeField"><span>{label}{required?' *':''}</span>{children||<input type={type} value={value??''} onChange={e=>onChange(e.target.value)} required={required}/>}</label>; }
const asCSV=(items,cols)=>[cols.map(c=>`"${c.label}"`).join(','),...items.map(row=>cols.map(c=>`"${String(row[c.key]??'').replaceAll('"','""')}"`).join(','))].join('\r\n');

// Search the full tenant's Debtor/Creditor master instead of a capped 100-party list.
// A selected party is retained when a different search page is loaded.
function ChequePartySelect({value='',initialName='',onChange}){
  const [query,setQuery]=useState('');
  const [page,setPage]=useState(1);
  const [items,setItems]=useState([]);
  const [meta,setMeta]=useState({page:1,pages:1,total:0});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState(null);
  useEffect(()=>{
    let active=true;
    const timer=setTimeout(async()=>{
      setLoading(true);setError('');
      try{
        const result=await api(`/cheques/parties?page=${page}&limit=60&q=${encodeURIComponent(query.trim())}`);
        if(!active)return;
        setItems(prev=>page===1?(result.items||[]):[...prev,...(result.items||[]).filter(item=>!prev.some(old=>old.id===item.id))]);
        setMeta(result.meta||{page,pages:1,total:0});
      }catch(e){if(active){setError(e.message||'Could not load party master');if(page===1)setItems([]);}}
      finally{if(active)setLoading(false);}
    },query.trim()?220:0);
    return ()=>{active=false;clearTimeout(timer);};
  },[query,page]);
  // New form or another edited voucher: prevent a stale selected label.
  useEffect(()=>{setSelected(null);},[value,initialName]);
  const current=items.find(item=>item.id===value)||selected;
  const selectedExists=items.some(item=>item.id===value);
  const label=item=>`${item.name} · ${item.partyType}${item.identifier?` · ${item.identifier}`:''}`;
  return <div className="chequePartyPicker">
    <input type="search" aria-label="Search Debtors and Creditors" placeholder="Search all Debtors / Creditors" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} autoComplete="off" />
    <select aria-label="Party Name — Debtor or Creditor" required value={value||''} onChange={e=>{
      const item=items.find(x=>x.id===e.target.value)||null;
      setSelected(item);onChange(item);
    }}>
      <option value="">Select Debtor / Creditor</option>
      {value&&!selectedExists&&<option value={value}>{current?label(current):`${initialName||'Previously selected party'} · (selected)`}</option>}
      {items.map(item=><option key={item.id} value={item.id}>{label(item)}</option>)}
    </select>
    <div className="chequePartyFooter">
      {error?<span className="chequeError" role="alert">{error}</span>:<span>{loading?'Searching…':`${meta.total||0} matching party${Number(meta.total)===1?'':'ies'}`}</span>}
      {page<(meta.pages||1)&&<button type="button" className="btn ghost small" disabled={loading} onClick={()=>setPage(p=>p+1)}>Load more</button>}
    </div>
  </div>;
}
function downloadCSV(rows,tab){const cols=tab==='issued'?[{key:'chequeNo',label:'Cheque No'},{key:'issuedDate',label:'Date Issued'},{key:'chequeDate',label:'Cheque Date'},{key:'issuedPartyName',label:'Issued Party'},{key:'issueFor',label:'Issued For'},{key:'amount',label:'Amount'},{key:'status',label:'Status'},{key:'bankName',label:'Bank'},{key:'clearedDate',label:'Cheque Cleared Date'},{key:'remarks',label:'Remarks'}]:[{key:'chequeNo',label:'Cheque No'},{key:'receivedDate',label:'Received Date'},{key:'chequeDate',label:'Cheque Date'},{key:'issuedByPartyName',label:'Received From'},{key:'ifsc',label:'IFSC'},{key:'issuerBankName',label:'Issuer Bank'},{key:'issuerBranchName',label:'Branch'},{key:'amount',label:'Amount'},{key:'status',label:'Status'},{key:'statusDate',label:'Status Date'},{key:'depositBankName',label:'Company Bank'},{key:'clearedDate',label:'Cheque Cleared Date'},{key:'ledgerStatus',label:'Ledger Status'},{key:'bounceCharge',label:'Bounce Charges'},{key:'remarks',label:'Remarks'}];const url=URL.createObjectURL(new Blob(['\uFEFF'+asCSV(rows,cols)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`rupioo-cheques-${tab}.csv`;a.click();URL.revokeObjectURL(url);}

export default function ChequeControlPage(){
  const [params,setParams]=useSearchParams();const tab=['approvals','online','received'].includes(params.get('tab'))?'received':'issued';const issuePage=tab==='issued'&&params.get('view')==='issue';const slipPage=tab==='received'&&params.get('view')==='deposit-slip';const rights=accessForPath('/dms/cheque-control');
  const [banks,setBanks]=useState([]),[books,setBooks]=useState([]),[items,setItems]=useState([]),[meta,setMeta]=useState({page:1,pages:1,total:0});
  const [fy,setFy]=useState(params.get('fy')||currentFinancialYear()),[category,setCategory]=useState(params.get('category')||'ALL'),[counts,setCounts]=useState({}),[partial,setPartial]=useState(false);
  const [onlineMatch,setOnlineMatch]=useState(null),[matchSuggestions,setMatchSuggestions]=useState([]);
  const [bankAccountId,setBankAccountId]=useState(''),[bookId,setBookId]=useState(''),[status,setStatus]=useState(''),[q,setQ]=useState(params.get('q')||''),[page,setPage]=useState(1);
  const [loading,setLoading]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [deletingId,setDeletingId]=useState('');
  const [approvalOtp,setApprovalOtp]=useState({}),[approvalBusy,setApprovalBusy]=useState('');
  const [ledgerTarget,setLedgerTarget]=useState(null),[bankReceivedDate,setBankReceivedDate]=useState(today());
  const [modal,setModal]=useState(''),[editRecord,setEditRecord]=useState(null),[form,setForm]=useState({});
  const [ifscInfo,setIfscInfo]=useState(null),[ifscLoading,setIfscLoading]=useState(false),[ifscError,setIfscError]=useState('');
  const [issueForm,setIssueForm]=useState(blankIssuePage),[nextLeaf,setNextLeaf]=useState(null),[nextLoading,setNextLoading]=useState(false),[issueBusy,setIssueBusy]=useState(false),[issueError,setIssueError]=useState(''),[issueNotice,setIssueNotice]=useState(''),[leafException,setLeafException]=useState('CANCELLED'),[exceptionReason,setExceptionReason]=useState(''),[nextVersion,setNextVersion]=useState(0);
  useEffect(()=>{
    if(modal!=='received')return;
    const code=String(form.ifsc||'').toUpperCase().replace(/\s/g,'');
    if(!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)){setIfscInfo(null);setIfscError('');return;}
    let live=true;setIfscLoading(true);setIfscError('');
    api(`/cheques/ifsc/${encodeURIComponent(code)}`).then(r=>{if(live)setIfscInfo(r.details||null);})
      .catch(e=>{if(live){setIfscInfo(null);setIfscError(e.message);}})
      .finally(()=>{if(live)setIfscLoading(false);});
    return ()=>{live=false;};
  },[modal,form.ifsc]);
  const changeTab=(next)=>{setParams({tab:next});setPage(1);setStatus('');setBookId('');setQ('');setError('');};
  const loadBanks=useCallback(async()=>{try{const [bankResult,bookResult]=await Promise.all([api('/cheques/banks'),api('/cheques/issued/books')]);setBanks(bankResult.items||[]);setBooks(bookResult.items||[]);}catch(e){setError(e.message);}},[]);
  const load=useCallback(async()=>{setLoading(true);setError('');try{
    const query=new URLSearchParams({page:String(page),limit:'50'});if(bankAccountId)query.set('bankAccountId',bankAccountId);if(status)query.set('status',status);if(q.trim())query.set('q',q.trim());if(tab==='issued'&&bookId)query.set('bookId',bookId);if(tab==='received'){query.set('financialYear',fy);query.set('category',category);}
    const result=await api(tab==='received'?`/cheques/company-received?${query}`:`/cheques/issued?${query}`);setItems(result.items||[]);setMeta(result.meta||{page,pages:1,total:0});setCounts(result.counts||{});setPartial(Boolean(result.partial));
  }catch(e){setError(e.message);}finally{setLoading(false);}},[tab,page,bankAccountId,bookId,status,q,fy,category]);
  useEffect(()=>{loadBanks();},[loadBanks]);useEffect(()=>{if(!issuePage)load();},[load,issuePage]);
  useEffect(()=>{if(issuePage&&!issueForm.bankAccountId&&banks.length){setIssueForm(f=>({...f,bankAccountId:bankAccountId||banks.find(b=>b.isPrimary)?.bankAccountId||banks[0].bankAccountId}));}},[issuePage,issueForm.bankAccountId,banks,bankAccountId]);
  useEffect(()=>{
    if(!issuePage||!issueForm.bankAccountId){setNextLeaf(null);return;}
    let alive=true;setNextLoading(true);setIssueError('');
    api(`/cheques/issued/next?bankAccountId=${encodeURIComponent(issueForm.bankAccountId)}`)
      .then(r=>{if(alive)setNextLeaf(r.next||null);})
      .catch(e=>{if(alive){setNextLeaf(null);setIssueError(e.message);}})
      .finally(()=>{if(alive)setNextLoading(false);});
    return ()=>{alive=false;};
  },[issuePage,issueForm.bankAccountId,nextVersion]);
  const openIssuePage=()=>{setIssueForm({...blankIssuePage(),bankAccountId:bankAccountId||banks.find(b=>b.isPrimary)?.bankAccountId||banks[0]?.bankAccountId||''});setIssueError('');setIssueNotice('');setExceptionReason('');setNextLeaf(null);setParams({tab:'issued',view:'issue'});};
  const backToIssued=()=>{setParams({tab:'issued'});setPage(1);setError('');};
  const openBook=()=>{setEditRecord(null);setForm({...blankBook(),bankAccountId:bankAccountId||banks[0]?.bankAccountId||''});setModal('book');};
  const openReceived=(row=null)=>{setIfscInfo(null);setIfscError('');setEditRecord(row);setForm(row?{...blankReceived(),...row,amount:String(row.amount??'') }:{...blankReceived(),depositBankAccountId:bankAccountId||banks[0]?.bankAccountId||''});setModal('received');};
  const openIssued=(row)=>{setEditRecord(row);setForm({...blankIssued(),...row,amount:row.amount?String(row.amount):'',status:row.status});setModal('issued');};
  const update=(key,value)=>setForm(prev=>({...prev,[key]:value,...(key==='status'&&prev.status!==value?{statusDate:today()}:{} )}));
  const changeIssue=(key,value)=>setIssueForm(prev=>({...prev,[key]:value}));
  const submitIssue=async(e)=>{
    e.preventDefault();if(!nextLeaf||issueBusy)return;
    setIssueBusy(true);setIssueError('');setIssueNotice('');
    try{
      const result=await api('/cheques/issued/issue',{method:'POST',body:JSON.stringify(issueForm)});
      setIssueNotice(`Cheque ${result.chequeNo||result.item?.chequeNo} issued for ${issueForm.issueFor}. The next available number is shown below.`);
      setIssueForm(prev=>({...blankIssuePage(),bankAccountId:prev.bankAccountId,issueFor:prev.issueFor}));
      setNextVersion(n=>n+1);
    }catch(err){setIssueError(err.message);setNextVersion(n=>n+1);}finally{setIssueBusy(false);}
  };
  const markUnavailable=async(e)=>{
    e.preventDefault();if(!nextLeaf||issueBusy)return;
    if(!exceptionReason.trim()){setIssueError('Enter the reason why this physical cheque leaf cannot be used.');return;}
    setIssueBusy(true);setIssueError('');setIssueNotice('');
    try{
      const result=await api('/cheques/issued/skip',{method:'POST',body:JSON.stringify({bankAccountId:issueForm.bankAccountId,status:leafException,reason:exceptionReason,remarks:issueForm.remarks})});
      setIssueNotice(`Cheque ${result.chequeNo||result.item?.chequeNo} marked ${leafException}. The next available number will load automatically.`);
      setExceptionReason('');setNextVersion(n=>n+1);
    }catch(err){setIssueError(err.message);setNextVersion(n=>n+1);}finally{setIssueBusy(false);}
  };
  const save=async(e)=>{e.preventDefault();setLoading(true);setError('');try{
    if(modal==='book')await api('/cheques/issued/books',{method:'POST',body:JSON.stringify(form)});
    else if(modal==='issued')await api(`/cheques/issued/${editRecord.id}`,{method:'PATCH',body:JSON.stringify(form)});
    else if(modal==='received')await api(editRecord?`/cheques/received/${editRecord.id}`:'/cheques/received',{method:editRecord?'PATCH':'POST',body:JSON.stringify(form)});
    setMessage(modal==='book'?'Cheque book registered and leaves generated':'Cheque register saved');setModal('');await Promise.all([load(),loadBanks()]);
  }catch(err){setError(err.message);}finally{setLoading(false);}};
  const editItem=async(row)=>{
    if(tab==='issued'){
      if(row.status==='AVAILABLE')return window.alert('Available cheque leaves are controlled by the book. Use Issue Cheque or delete the unused book.');
      if(['CLEARED','CANCELLED','LOST','STOLEN','MISTAKEN'].includes(row.status))return window.alert('This cheque has a final audit status and cannot be modified.');
      return openIssued(row);
    }
    if(row.entryType==='ONLINE'||row.status==='NEEDS_REGISTRATION'||String(row.status||'').startsWith('HANDOVER_')||String(row.status||'').startsWith('PENDING_WITH_')||['CLEARED','CANCELLED','LOST'].includes(row.status)){
      if(row.status==='NEEDS_REGISTRATION'){
        const ifsc=window.prompt('This original cheque receipt is missing registration. Enter/confirm the payer IFSC (11 characters) to retry linking:',row.ifsc||'');
        if(ifsc===null)return;
        try{await api(`/cheques/company-received/receipts/${encodeURIComponent(row.receiptId)}/ifsc`,{method:'PATCH',body:JSON.stringify({financialYear:fy,ifsc:ifsc.toUpperCase().trim()})});setMessage('IFSC saved and cheque linkage retried');await load();}
        catch(e){setError(e.message);}return;
      }
      const remarks=window.prompt('Edit non-financial remarks only (receipt and ledger amounts remain unchanged):',row.remarks||'');if(remarks===null)return;
      try{if(row.entryType==='ONLINE')await api(`/collection-hub/receipts/${encodeURIComponent(row.receiptId)}/notes`,{method:'PATCH',body:JSON.stringify({financialYear:fy,remarks})});
        else await api(`/cheques/received/${encodeURIComponent(row.id)}/notes`,{method:'PATCH',body:JSON.stringify({remarks})});
        setMessage('Remarks updated');await load();}catch(e){setError(e.message);}return;
    }
    openReceived(row);
  };
  const deleteItem=async(row)=>{
    if(deletingId)return;
    setError('');setMessage('');
    // Receipt-backed rows are visible in this register but are not independent
    // cheque records. Clicking Delete must explain why, not silently do nothing.
    if(tab==='received'){
      const block=row.deleteBlockedReason||(
        row.entryType==='ONLINE'?'Online receipts cannot be deleted in Cheque Control: correct/reverse the original receipt through accounting.':
        (row.receiptBacked||row.linkedReceiptNo)?'This cheque is linked to an original receipt/ledger. Reverse the accounting receipt through the authorised workflow before deleting.':
        row.status==='NEEDS_REGISTRATION'?'This cheque originates from an OTP-verified receipt. Repair cheque registration instead of deleting the receipt.':'');
      if(block){window.alert(`Cannot delete ${row.chequeNo||row.receiptNo||'this entry'}.\n\n${block}`);return;}
    }
    const reason=window.prompt(tab==='issued'
      ?`Cancel issued cheque ${row.chequeNo}? Enter a reason (minimum 5 characters):`
      :`Permanently delete independent unposted cheque ${row.chequeNo||'this entry'}? Enter a reason (minimum 5 characters):`,
      'Entered in error');
    if(reason===null)return;
    if(reason.trim().length<5){window.alert('Please enter a reason of at least 5 characters.');return;}
    if(!window.confirm(tab==='issued'
      ?`Mark cheque ${row.chequeNo} CANCELLED while retaining its numbered audit history?`
      :`Delete cheque ${row.chequeNo||'this entry'} from Company Received? This cannot be undone.`))return;
    setDeletingId(row.id);
    try{
      await api(`/cheques/${tab==='issued'?'issued':'received'}/${encodeURIComponent(row.id)}`,{method:'DELETE',body:JSON.stringify({reason:reason.trim()})});
      setMessage(tab==='issued'?'Issued cheque marked Cancelled; cheque number retained':'Unposted received cheque deleted');
      // Last item on a paginated page: return to the preceding page.
      if(items.length===1&&page>1)setPage(p=>p-1);else await load();
    }catch(e){setError(e.message||'Deletion failed');window.alert(`Delete failed: ${e.message||'Unable to delete this cheque'}`);}
    finally{setDeletingId('');}
  };
  const findOnlineMatches=async(row)=>{setError('');setOnlineMatch({row,statementRowId:''});setMatchSuggestions([]);
    try{const result=await api(`/collection-hub/online/${encodeURIComponent(row.receiptId)}/suggestions?financialYear=${encodeURIComponent(fy)}`);setMatchSuggestions(result.items||[]);
      if(!(result.items||[]).length)setError('No posted bank credit with an exact matching UTR and amount was found.');}
    catch(e){setError(e.message);}
  };
  const verifyOnlineMatch=async()=>{const suggestion=matchSuggestions.find(x=>x.id===onlineMatch?.statementRowId);if(!suggestion)return;
    if(!window.confirm(`Match ${onlineMatch.row.receiptNo} to the existing ${money(suggestion.amount)} company bank credit? No second ledger entry will be posted.`))return;
    try{await api(`/collection-hub/online/${encodeURIComponent(onlineMatch.row.receiptId)}/match`,{method:'POST',body:JSON.stringify({financialYear:fy,bankAccountId:suggestion.bankAccountId,statementRowId:suggestion.id})});setOnlineMatch(null);setMessage('Online credit matched to existing bank posting');await load();}catch(e){setError(e.message);}
  };
  const verifyBundle=async(row)=>{
    const otp=String(approvalOtp[row.id]||'').trim();if(!/^\d{6}$/.test(otp))return setError('Enter the 6-digit OTP shown to Cashier');
    setApprovalBusy(row.id);setError('');try{
      const r=await api(`/cheques/pending-approvals/${encodeURIComponent(row.id)}/verify`,{method:'POST',body:JSON.stringify({otp})});
      setMessage(`${r.count} cheques approved. They are now in Company Received.`);setApprovalOtp(v=>({...v,[row.id]:''}));await load();
    }catch(e){setError(e.message);}finally{setApprovalBusy('');}
  };
  const postChequeLedger=async()=>{
    if(!ledgerTarget)return;setApprovalBusy(ledgerTarget.id);setError('');try{
      const r=await api(`/cheques/company-received/${encodeURIComponent(ledgerTarget.id)}/post-ledger`,{method:'POST',body:JSON.stringify({financialYear:fy,bankReceivedDate})});
      setMessage(`${r.receiptNo} posted to customer ledger using bank receipt date ${bankReceivedDate}.`);setLedgerTarget(null);await load();
    }catch(e){setError(e.message);}finally{setApprovalBusy('');}
  };
  const statuses=tab==='issued'?['AVAILABLE','ISSUED','CLEARED','RETURNED','CANCELLED','LOST','STOLEN','MISTAKEN']:['NEEDS_REGISTRATION','BANK_MATCHED','PENDING_BANK_VERIFICATION','PENDING_WITH_SALESPERSON','PENDING_WITH_COLLECTOR','HANDOVER_REQUESTED','HANDOVER_OTP_ISSUED','HANDOVER_VERIFIED','PENDING_RECEIVED','RECEIVED','DEPOSITED','REDEPOSITED','CLEARED','RETURNED','BOUNCED','CANCELLED','LOST'];
  const header=tab==='issued'
    ? ['Cheque No','Date Issued','Cheque Date','Issued Party','Amount','Cheque Cleared Date','Cleared / Uncleared','Exception Status','Actions']
    : ['Type / Reference','Party Name','IFSC / UTR','Bank Details','Received Date','Cheque Date','Amount','Status','Status Date','Company Bank','Ledger','Actions'];
  // Each table has exactly nine fixed columns. Widths add up to 100%,
  // preventing long descriptions or newly entered dates from shifting headers.
  const columnWidths=tab==='issued'
    ? [12,10,10,19,11,11,13,8,6]
    : [9,12,9,12,8,8,8,11,8,7,5,3];
  const totalVisible=useMemo(()=>items.reduce((sum,r)=>sum+Number(r.amount||0),0),[items]);
  const focused=params.get('focus')||'';const isFocused=r=>!!focused&&(focused===r.id||focused===r.receiptNo||focused===r.chequeNo);

  if(slipPage)return <ChequeDepositSlipPage banks={banks} initialBankId={bankAccountId} canPrint={rights.download} onBack={()=>{setParams({tab:'received'});setError('');}}/>;
  if(issuePage)return <div className="chequePage chequeIssuePage">
    <section className="chequeIssueHead"><button type="button" className="btn ghost" onClick={backToIssued}><ArrowLeft size={16}/> Back to Company Issued</button><strong>Issue Cheque</strong><span>First available leaf · No manual cheque selection</span></section>
    {issueError&&<div className="resultBanner bad" role="alert">{issueError}</div>}
    {issueNotice&&<div className="resultBanner good" role="status"><CheckCircle2 size={15}/> {issueNotice}</div>}
    <section className="panel chequeIssuePanel">
      <div className="chequeIssueIntro"><BookOpen size={18}/><span>Choose the company bank. The system automatically reserves the lowest-numbered available cheque on submission, even across multiple books.</span></div>
      <form onSubmit={submitIssue}>
        <div className="chequeFields">
          <EntryField label="Company Bank Account" required><select value={issueForm.bankAccountId} onChange={e=>{changeIssue('bankAccountId',e.target.value);setIssueNotice('');}} required><option value="">Select company bank</option>{banks.map(b=><option key={b.bankAccountId} value={b.bankAccountId}>{maskBank(b)}</option>)}</select></EntryField>
          <EntryField label="First Available Cheque No."><input value={nextLoading?'Finding next available cheque…':nextLeaf?.chequeNo||'No available cheque leaf'} readOnly aria-label="Automatically selected cheque number" className="chequeReadOnly"/></EntryField>
          <EntryField label="Issued For" required><select value={issueForm.issueFor} onChange={e=>changeIssue('issueFor',e.target.value)}><option value="CHEQUE">Cheque Payment</option><option value="NEFT">NEFT</option><option value="RTGS">RTGS</option></select></EntryField>
          <EntryField label="Date Issued" type="date" required value={issueForm.issuedDate} onChange={v=>changeIssue('issuedDate',v)}/>
          <EntryField label="Cheque Date" type="date" value={issueForm.chequeDate} onChange={v=>changeIssue('chequeDate',v)}/>
          <EntryField label="Issued Party Name" required><ChequePartySelect value={issueForm.issuedPartyGlobalId||''} initialName={issueForm.issuedPartyName||''} onChange={party=>setIssueForm(prev=>({...prev,issuedPartyGlobalId:party?.id||'',issuedPartyName:party?.name||''}))}/></EntryField>
          <EntryField label="Amount" type="number" required value={issueForm.amount} onChange={v=>changeIssue('amount',v)}><input type="number" min="0.01" step="0.01" required value={issueForm.amount} onChange={e=>changeIssue('amount',e.target.value)}/></EntryField>
          <EntryField label="Bank Transaction / UTR Reference" value={issueForm.bankTransactionReference} onChange={v=>changeIssue('bankTransactionReference',v)}/>
          <EntryField label="Remarks" value={issueForm.remarks} onChange={v=>changeIssue('remarks',v)}/>
        </div>
        <p className="chequeHint">The cheque number is automatic and cannot be changed. Issuing a cheque, including for NEFT/RTGS, records cheque control only; it does not create a duplicate Bank Book posting.</p>
        <div className="chequeModalButtons"><button type="button" className="btn ghost" onClick={backToIssued}>Cancel</button><button type="submit" className="btn primary" disabled={!rights.create||!issueForm.bankAccountId||!nextLeaf||nextLoading||issueBusy}>{issueBusy?'Saving…':`Issue Cheque ${nextLeaf?.chequeNo||''}`}</button></div>
      </form>
    </section>
    <section className="panel chequeIssuePanel chequeMissingPanel">
      <div className="chequeIssueIntro"><AlertTriangle size={18}/><span><strong>Physical cheque unavailable?</strong> Before moving to another number, record why this exact first available cheque leaf cannot be used.</span></div>
      <form onSubmit={markUnavailable}>
        <div className="chequeFields">
          <EntryField label="Unavailable Cheque No."><input value={nextLeaf?.chequeNo||'No available leaf'} readOnly className="chequeReadOnly"/></EntryField>
          <EntryField label="Reason Status" required><select value={leafException} onChange={e=>setLeafException(e.target.value)}><option value="CANCELLED">Cancelled</option><option value="STOLEN">Stolen</option><option value="MISTAKEN">Mistaken / Spoiled</option></select></EntryField>
          <EntryField label="Explanation" required value={exceptionReason} onChange={setExceptionReason}/>
        </div>
        <p className="chequeHint">Marking a leaf unavailable is permanent in this register and keeps a history of who changed it and why. The next available cheque is displayed after saving.</p>
        <div className="chequeModalButtons"><button type="submit" className="btn ghost chequeDanger" disabled={!rights.create||!nextLeaf||nextLoading||issueBusy||!exceptionReason.trim()}>{issueBusy?'Saving…':`Mark ${leafException} & Continue`}</button></div>
      </form>
      {!nextLoading&&!nextLeaf&&<div className="chequeEmpty">No available cheque leaves for this bank. <button type="button" className="btn ghost" onClick={()=>{backToIssued();openBook();}}>Register Cheque Book</button></div>}
    </section>
  </div>;
  return <div className="chequePage">
    <section className="chequeTopbar">
      <div className="chequeTabs"><button className={tab==='issued'?'active':''} onClick={()=>changeTab('issued')}>Company Issued</button><button className={tab==='received'?'active':''} onClick={()=>changeTab('received')}>Company Received</button></div>
      <div className="chequeActions">
        {tab==='received'&&<select aria-label="Financial year" value={fy} onChange={e=>{setFy(e.target.value);setPage(1)}}>{financialYearOptions(getUser(),{count:10,extra:[currentFinancialYear()]}).map(y=>typeof y==='string'?<option key={y} value={y}>{y}</option>:<option key={y.value} value={y.value}>{y.label}</option>)}</select>}
        {tab==='received'&&<select aria-label="Received payment type" value={category} onChange={e=>{setCategory(e.target.value);setStatus('');setPage(1)}}><option value="ALL">All Received (Cheque + Online)</option><option value="CHEQUE">Cheques ({counts.cheques||0})</option><option value="ONLINE">Online / UPI ({counts.online||0})</option></select>}

        <select aria-label="Bank account" value={bankAccountId} onChange={e=>{setBankAccountId(e.target.value);setPage(1)}}><option value="">All Company Banks</option>{banks.map(b=><option key={b.bankAccountId} value={b.bankAccountId}>{maskBank(b)}</option>)}</select>
        {tab==='issued'&&<select aria-label="Cheque book" value={bookId} onChange={e=>{setBookId(e.target.value);setPage(1)}}><option value="">All Cheque Books</option>{books.filter(b=>!bankAccountId||b.bankAccountId===bankAccountId).map(b=><option key={b.bookId} value={b.bookId}>{b.startingNo}–{b.endingNo}</option>)}</select>}
        {tab==='issued'&&rights.delete&&bookId&&<button className="btn ghost" type="button" title="Delete entire book only when all leaves are unused" onClick={async()=>{if(!window.confirm('Delete this UNUSED cheque book and all its available leaves? This is blocked once any leaf is issued, lost or cancelled.'))return;try{await api(`/cheques/issued/books/${encodeURIComponent(bookId)}`,{method:'DELETE'});setBookId('');setMessage('Unused cheque book deleted');await loadBanks();await load();}catch(e){setError(e.message);}}}><Trash2 size={15}/> Delete Unused Book</button>}
        <select aria-label="Cheque status" value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="">All Status</option>{statuses.map(s=><option key={s}>{s}</option>)}</select>
        <div className="chequeSearch"><Search size={15}/><input placeholder="Search cheque / party" value={q} onChange={e=>{setQ(e.target.value);setPage(1)}}/></div>
        <button type="button" className="btn ghost" onClick={()=>{load();loadBanks();}} title="Refresh"><RefreshCw size={16}/></button>
        {rights.download&&<button type="button" className="btn ghost" onClick={()=>downloadCSV(items,tab)} title="Export current page"><Download size={16}/></button>}
        {rights.download&&tab==='received'&&<button type="button" className="btn primary" onClick={()=>setParams({tab:'received',view:'deposit-slip'})}><Printer size={16}/> Deposit Slips</button>}
        {rights.create&&tab==='issued'&&<button type="button" className="btn primary" onClick={openIssuePage}><Plus size={16}/>Issue Cheque</button>}
        {rights.edit&&tab==='received'&&<button type="button" className="btn ghost" title="Retry linkage for verified cheques" onClick={async()=>{if(!window.confirm('Retry registering verified cheques from original receipts? No second ledger entries are created.'))return;try{const r=await api('/collection-hub/sync-cheques',{method:'POST',body:JSON.stringify({financialYear:fy})});setMessage(`Cheque reconciliation: ${r.linked} linked, ${r.alreadyLinked} previously linked, ${r.needsReview?.length||0} need review.`);await load();}catch(e){setError(e.message);}}}>Sync Missing Cheques</button>}
        {rights.create&&<button type="button" className="btn ghost" onClick={tab==='issued'?openBook:()=>openReceived()}><Plus size={16}/>{tab==='issued'?'Register Cheque Book':'Receive Cheque'}</button>}
      </div>
    </section>
    {focused&&tab==='received'&&<div className="resultBanner" style={{background:'#fff3c4',border:'1px solid #eab308',color:'#713f12',display:'flex',alignItems:'center',gap:10}}>Highlighted receipt opened from Cashier Pending Handover — read-only in this view. <button className="btn ghost small" onClick={()=>setParams({tab:'received'})}>Exit highlight</button></div>}
    {error&&<div className="resultBanner bad" role="alert">{error}</div>}{message&&<div className="resultBanner good">{message}</div>}{partial&&tab==='received'&&<div className="resultBanner">Large register: this view has reached its current record scan cap. Narrow by FY and contact the administrator if older entries are not visible.</div>}
    <section className="panel chequeContent">
      <div className="chequeSummary"><span><BookOpen size={16}/> {tab==='issued'?'Issued cheque leaves':'Received cheques'}: <strong>{meta.total}</strong></span><span>Current page amount: <strong>{money(totalVisible)}</strong></span><span>Cheque tracking only · Bank ledger updates separately</span></div>
      <div className="tableWrap chequeTableWrap" role="region" aria-label={`${tab==='issued'?'Company Issued':'Company Received'} cheque register`} tabIndex={0}>
        <table className={`chequeTable chequeTable--${tab}`}>
          <colgroup>{columnWidths.map((width,index)=><col key={index} style={{width:`${width}%`}}/>)}</colgroup>
          <thead><tr>{header.map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>
            {items.map(r=><tr key={r.id} style={isFocused(r)?{background:'#fff3c4',outline:'2px solid #eab308',outlineOffset:'-2px'}:{}}>
              {tab==='issued'?<>
                <td><div className="chequeCellTruncate" title={r.chequeNo||''}><strong>{r.chequeNo}</strong></div><small>{r.bankName}</small></td>
                <td className="chequeDateCell">{displayChequeDate(r.issuedDate)}</td>
                <td className="chequeDateCell">{displayChequeDate(r.chequeDate)}</td>
                <td><div className="chequeCellTruncate" title={r.issuedPartyName||''}>{r.issuedPartyName||'—'}</div>{r.status==='ISSUED'&&r.issueFor!=='CHEQUE'&&<small>{r.issueFor}</small>}</td>
                <td className="amount chequeAmountCell">{r.amount?money(r.amount):'—'}</td>
                <td className="chequeDateCell">{displayChequeDate(r.clearedDate)}</td>
                <td><span className={'chequeStatus '+(r.status==='CLEARED'?'cleared':'')}>{r.status==='CLEARED'?'CLEARED':r.status==='ISSUED'?'UNCLEARED':r.status}</span></td>
                <td>{['CANCELLED','LOST','STOLEN','MISTAKEN'].includes(r.status)?r.status:'—'}</td>
              </>:r.entryType==='ONLINE'?<>
                <td><strong>ONLINE / UPI</strong><small>{r.receiptNo||'—'}</small></td>
                <td><strong>{r.issuedByPartyName||'—'}</strong><small>{r.collectedBy||'—'}</small></td>
                <td><div className="chequeCellTruncate" title={r.reference||''}>{r.reference||'—'}</div></td>
                <td>{r.paymentType||'Online Payment'}</td>
                <td>{displayChequeDate(String(r.date||'').slice(0,10))}</td><td>—</td>
                <td className="amount chequeAmountCell">{money(r.amount)}</td>
                <td><span className="chequeStatus">{String(r.status||'').replaceAll('_',' ')}</span></td>
                <td>—</td><td>{r.bankAccountId||'—'}</td><td>{r.bankMatchStatus==='BANK_MATCHED'?'BANK MATCHED':'PENDING BANK MATCH'}</td>
              </>:<>
                <td><strong>{r.chequeNo||'—'}</strong>{r.receiptNo&&<small>{r.receiptNo}</small>}</td>
                <td><div className="chequeCellTruncate" title={r.issuedByPartyName||''}>{r.issuedByPartyName||'—'}</div><small>{r.receivedByName||r.collectedBy||r.receivedByRole||''}</small></td>
                <td className="chequeDateCell">{r.ifsc||'—'}</td>
                <td><div className="chequeCellTruncate" title={`${r.issuerBankName||''} ${r.issuerBranchName||''}`}>{r.issuerBankName||'—'}</div><small className="chequeCellTruncate">{r.issuerBranchName||''}</small></td>
                <td className="chequeDateCell">{displayChequeDate(r.receivedDate||String(r.date||'').slice(0,10))}</td>
                <td className="chequeDateCell">{displayChequeDate(r.chequeDate)}</td>
                <td className="amount chequeAmountCell">{r.amount?money(r.amount):'—'}</td>
                <td><span className={'chequeStatus '+(r.status==='CLEARED'?'cleared':'')}>{String(r.status||'').replaceAll('_',' ')}</span>{r.registrationIssue&&<small title={r.registrationIssue} style={{color:'#b91c1c'}}>{r.registrationIssue}</small>}</td>
                <td className="chequeDateCell">{displayChequeDate(r.statusDate)}</td>
                <td><div className="chequeCellTruncate" title={r.depositBankName||''}>{r.depositBankName||'—'}</div></td>
                <td><span className="chequeCellTruncate" title={r.ledgerTransactionId||''}>{r.ledgerStatus||'NOT POSTED'}</span>{r.bounceChargeTransactionId&&<small>Bounce fee posted</small>}</td>
              </>}
              <td className="chequeActionCell"><div style={{display:'flex',gap:4,alignItems:'center'}}>
                {tab==='received'&&r.entryType==='CHEQUE'&&r.approvalBundleId&&['RECEIVED','DEPOSITED','REDEPOSITED','CLEARED'].includes(r.status)&&rights.edit&&<button type="button" className="btn primary small" disabled={isFocused(r)||!!approvalBusy||r.ledgerStatus==='POSTED'} title="Post the approved cheque to customer ledger" onClick={()=>{setLedgerTarget(r);setBankReceivedDate(r.bankReceivedDate||today());}}>POST TO LEDGER</button>}
                {rights.edit&&<button type="button" disabled={isFocused(r)} className="btn ghost small" title="Edit cheque details when permitted; otherwise edit remarks without modifying financial postings" onClick={()=>editItem(r)}><Pencil size={15}/></button>}
                {tab==='received'&&r.entryType==='ONLINE'&&r.status==='PENDING_BANK_VERIFICATION'&&<button type="button" className="btn ghost small" title="Match this online receipt to posted bank credit" onClick={()=>findOnlineMatches(r)}>Match</button>}
                {rights.delete&&<button type="button" className="btn ghost small" aria-label={`Delete ${r.chequeNo||r.receiptNo||'cheque record'}`} title={tab==='received'?(r.deleteBlockedReason||'Delete independent, unposted cheque (requires reason)'):'Cancel issued cheque (audit retained)'} disabled={Boolean(deletingId)||isFocused(r)||tab==='issued'&&!['ISSUED','RETURNED'].includes(r.status)} onClick={()=>deleteItem(r)}><Trash2 size={15}/></button>}
              </div></td>
            </tr>)}
            {!items.length&&<tr><td colSpan={header.length} className="chequeEmpty">{loading?'Loading cheques…':tab==='issued'?'No issued cheques found. Register a cheque book or change filters.':'No received cheques or online collections found in this FY. Check filters and customer-OTP confirmation.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {onlineMatch&&<div className="panel" style={{padding:12,marginTop:8}}>
        <strong>Bank Credit Verification — {onlineMatch.row.receiptNo}</strong>
        <p style={{fontSize:11}}>Only bank statement credits with matching amount and UTR are eligible; this action does not post another customer receipt.</p>
        <select aria-label="Matching posted bank credit" value={onlineMatch.statementRowId||''} onChange={e=>setOnlineMatch(x=>({...x,statementRowId:e.target.value}))}>
          <option value="">Choose matched posted bank credit</option>{matchSuggestions.map(x=><option key={x.id} value={x.id}>{displayChequeDate(String(x.date||'').slice(0,10))} · {money(x.amount)} · {x.reference||''}</option>)}
        </select>
        <button type="button" className="btn primary" disabled={!onlineMatch.statementRowId||loading} onClick={verifyOnlineMatch}>Confirm Bank Match</button>
        <button type="button" className="btn ghost" onClick={()=>setOnlineMatch(null)}>Cancel</button>
      </div>}
      {ledgerTarget&&<div className="modalOverlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setLedgerTarget(null);}}><div className="panel chequeModal" role="dialog" aria-modal="true" aria-label="Post approved cheque to customer ledger"><strong>POST CHEQUE TO CUSTOMER LEDGER</strong><p style={{fontSize:11}}>{ledgerTarget.issuedByPartyName} · {ledgerTarget.chequeNo} · {money(ledgerTarget.amount)}</p><label className="chequeField"><span>Date Received in Bank *</span><input type="date" required value={bankReceivedDate} onChange={e=>setBankReceivedDate(e.target.value)}/></label><p style={{fontSize:11}}>Posts the original cheque receipt once. Actual cheque clearance is handled separately.</p><div className="chequeModalButtons"><button className="btn ghost" type="button" onClick={()=>setLedgerTarget(null)}>Cancel</button><button className="btn primary" type="button" disabled={!bankReceivedDate||!!approvalBusy} onClick={postChequeLedger}>CONFIRM POST TO LEDGER</button></div></div></div>}
      <div className="chequeFooter"><span>Page {meta.page||1} of {meta.pages||1}</span><div><button className="btn ghost small" disabled={page<=1||loading} onClick={()=>setPage(p=>p-1)}>Previous</button><button className="btn ghost small" disabled={page>=(meta.pages||1)||loading} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>
    </section>
    {modal&&<div className="modalOverlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setModal('');}}><form className="panel chequeModal" onSubmit={save}>
      <div className="chequeModalTitle"><strong>{modal==='book'?'Register Company Cheque Book':modal==='issued'?`Update Issued Cheque ${editRecord?.chequeNo}`:editRecord?'Update Received Cheque':'Register Received Cheque'}</strong><button className="btn ghost small" type="button" onClick={()=>setModal('')}>Close</button></div>
      {modal==='book'?<div className="chequeFields">
        <EntryField label="Company Bank Account" required><select value={form.bankAccountId||''} onChange={e=>update('bankAccountId',e.target.value)} required><option value="">Select bank</option>{banks.map(b=><option key={b.bankAccountId} value={b.bankAccountId}>{maskBank(b)}</option>)}</select></EntryField>
        <EntryField label="Number of Cheque Leaves" type="number" required value={form.numberOfLeaves} onChange={v=>update('numberOfLeaves',v)}/>
        <EntryField label="Starting Cheque Number" required value={form.startingNo} onChange={v=>update('startingNo',v)}/>
        <EntryField label="Received from Bank On" type="date" required value={form.receivedDate} onChange={v=>update('receivedDate',v)}/>
        <EntryField label="Remarks" value={form.remarks} onChange={v=>update('remarks',v)}/>
      </div>:modal==='issued'?<div className="chequeFields">
        <EntryField label="Cheque Number" value={editRecord?.chequeNo} onChange={()=>{}}><input value={editRecord?.chequeNo||''} disabled/></EntryField>
        <EntryField label="Status" required><select value={form.status||'ISSUED'} onChange={e=>update('status',e.target.value)}>{(outgoingStatuses[editRecord?.status]||['ISSUED']).map(s=><option key={s}>{s}</option>)}</select></EntryField>
        <EntryField label="Issued For"><select value={form.issueFor||'CHEQUE'} onChange={e=>update('issueFor',e.target.value)}><option value="CHEQUE">Cheque Payment</option><option value="NEFT">NEFT</option><option value="RTGS">RTGS</option></select></EntryField>
        <EntryField label="Date Issued" type="date" value={form.issuedDate} onChange={v=>update('issuedDate',v)}/>
        <EntryField label="Cheque Date" type="date" value={form.chequeDate} onChange={v=>update('chequeDate',v)}/>
        <EntryField label="Issued Party Name" required><ChequePartySelect value={form.issuedPartyGlobalId||''} initialName={form.issuedPartyName||''} onChange={party=>setForm(prev=>({...prev,issuedPartyGlobalId:party?.id||'',issuedPartyName:party?.name||''}))}/></EntryField>
        <EntryField label="Amount" type="number" value={form.amount} onChange={v=>update('amount',v)}/>
        {form.status==='CLEARED'&&<EntryField label="Cleared Date" type="date" required value={form.clearedDate} onChange={v=>update('clearedDate',v)}/>}
        <EntryField label="Bank Transaction Reference" value={form.bankTransactionReference} onChange={v=>update('bankTransactionReference',v)}/>
        <EntryField label="Remarks" value={form.remarks} onChange={v=>update('remarks',v)}/>
        {['CANCELLED','LOST','STOLEN','MISTAKEN','RETURNED'].includes(form.status)&&<EntryField label="Reason" required value={form.reason} onChange={v=>update('reason',v)}/>}
      </div>:<div className="chequeFields">
        <EntryField label="Cheque Number" value={form.chequeNo} onChange={v=>update('chequeNo',v)} required/>
        <EntryField label="Party Name" required><ChequePartySelect value={form.customerGlobalId||''} initialName={form.issuedByPartyName||''} onChange={party=>setForm(prev=>({...prev,customerGlobalId:party?.id||'',issuedByPartyName:party?.name||''}))}/></EntryField>
        <div className="chequePartyHint">Choose from the company Debtor / Creditor master. The selected party is automatically linked to the cheque ledger for clearance and bounce handling.</div>
        <EntryField label="IFSC" value={form.ifsc||''} onChange={v=>update('ifsc',v.toUpperCase())} required/>
        <div className="chequeBankLookup"><strong>Bank Details (Global IFSC Master)</strong>{ifscLoading?<span>Looking up IFSC…</span>:ifscError?<span className="chequeError">{ifscError}</span>:ifscInfo?<span>{ifscInfo.bankName} · {ifscInfo.branchName} · {ifscInfo.city}, {ifscInfo.state}<small>{ifscInfo.bankAddress}</small></span>:<span>Enter 11-character IFSC to auto-fill issuing bank</span>}</div>
        <EntryField label="Cheque Received Date" type="date" required value={form.receivedDate} onChange={v=>update('receivedDate',v)}/>
        <EntryField label="Cheque Date" type="date" required value={form.chequeDate} onChange={v=>update('chequeDate',v)}/>
        <EntryField label="Amount" type="number" value={form.amount} onChange={v=>update('amount',v)} required/>
        {editRecord&&<EntryField label="Status"><select value={form.status||'PENDING_RECEIVED'} onChange={e=>update('status',e.target.value)}>{(incomingStatuses[editRecord.status]||[editRecord.status]).map(s=><option key={s} value={s}>{s==='PENDING_RECEIVED'?'Pending Company Receipt (with Cashier)':s==='RECEIVED'?'Received at Company':s.replaceAll('_',' ')}</option>)}</select></EntryField>}
        {editRecord&&<EntryField label="Status Date" type="date" value={form.statusDate} onChange={v=>update('statusDate',v)} required/>}
        <EntryField label="Company Deposit Bank"><select value={form.depositBankAccountId||''} onChange={e=>update('depositBankAccountId',e.target.value)}><option value="">Select bank when deposited</option>{banks.map(b=><option key={b.bankAccountId} value={b.bankAccountId}>{maskBank(b)}</option>)}</select></EntryField>
        {['DEPOSITED','REDEPOSITED','CLEARED','RETURNED','BOUNCED'].includes(form.status)&&<EntryField label="Deposit Date" type="date" value={form.depositDate} onChange={v=>update('depositDate',v)}/>}
        {form.status==='CLEARED'&&<EntryField label="Cheque Cleared Date" type="date" required value={form.clearedDate} onChange={v=>update('clearedDate',v)}/>}
        {form.status==='CLEARED'&&<div className="chequeBankLookup"><strong>Ledger on clearance</strong><span>Once confirmed cleared, Bank is debited and the linked customer ledger is credited. Existing verified cheque receipts are transferred from suspense, not credited to the customer again.</span></div>}
        <EntryField label="Bank Transaction / UTR Reference" value={form.bankTransactionReference} onChange={v=>update('bankTransactionReference',v)}/>
        <EntryField label="Link Already-Posted Bank Transaction ID (optional)" value={form.linkedBankTransactionId||''} onChange={v=>update('linkedBankTransactionId',v)}/>
        <EntryField label="Existing Posted Cheque Receipt No (optional)" value={form.linkedReceiptNo||''} onChange={v=>update('linkedReceiptNo',v)}/>
        <EntryField label="Existing Receipt FY (optional, e.g. 2025-26)" value={form.linkedReceiptFy||''} onChange={v=>update('linkedReceiptFy',v)}/>
        {form.status==='BOUNCED'&&<>
          <EntryField label="Bank Bounce Charge" type="number" value={form.bounceCharge||''} onChange={v=>update('bounceCharge',v)}/>
          <EntryField label="Charge Borne By"><select value={form.bounceChargeBearer||'COMPANY'} onChange={e=>update('bounceChargeBearer',e.target.value)}><option value="COMPANY">Company — Bank Charges expense</option><option value="CUSTOMER">Customer — Add to Receivable</option></select></EntryField>
        </>}
        <EntryField label="Remarks" value={form.remarks} onChange={v=>update('remarks',v)}/>
        {['BOUNCED','RETURNED','CANCELLED','LOST'].includes(form.status)&&<EntryField label="Reason" required value={form.reason} onChange={v=>update('reason',v)}/ >}
      </div>}
      <p className="chequeHint">Physical custody and deposit do not post bank income. Clearing posts a verified ledger entry; bounce charge posts only when an actual bank charge amount is entered. Existing receipts must be linked to avoid double credit.</p>
      <div className="chequeModalButtons"><button type="button" className="btn ghost" onClick={()=>setModal('')}>Cancel</button><button type="submit" className="btn primary" disabled={loading}>{loading?'Saving…':'Save'}</button></div>
    </form></div>}
  </div>;
}
