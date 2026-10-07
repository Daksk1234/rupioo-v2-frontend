import React,{useEffect,useMemo,useState} from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Landmark, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import EditMasterLink from "../components/EditMasterLink.jsx";
import SalespersonCashControl from "../components/SalespersonCashControl.jsx";
import { api, getUser } from "../lib/api.js";
import { fetchTransactionParties, partyOptionLabel } from "../lib/partyDirectory.js";
import { currentFinancialYear, financialYearOptions } from "../lib/financialYear.js";
import "../profile-bank.css";

const money=v=>`₹${Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
const fyMonthOrder=["April","May","June","July","August","September","October","November","December","January","February","March"];
const currentMonthName=()=>monthNames[new Date().getMonth()];
const monthBounds=(fy,monthName)=>{const startYear=Number(String(fy||"").slice(0,4));const monthIndex=monthNames.indexOf(monthName);if(!Number.isFinite(startYear))return {fromDate:"",toDate:""};if(monthName==="ALL")return {fromDate:`${startYear}-04-01`,toDate:`${startYear+1}-03-31`};if(monthIndex<0)return {fromDate:"",toDate:""};const year=monthIndex>=3?startYear:startYear+1;const mm=String(monthIndex+1).padStart(2,"0");const last=String(new Date(year,monthIndex+1,0).getDate()).padStart(2,"0");return {fromDate:`${year}-${mm}-01`,toDate:`${year}-${mm}-${last}`};};
const bankBalance=v=>`${money(Math.abs(Number(v||0)))} ${Number(v||0)<0?"Dr":"Cr"}`;
const fmtDate=v=>v?new Date(v).toLocaleDateString("en-IN"):"—";
const dateInputValue=v=>v?String(v).slice(0,10):"";
const bankPartyRef=b=>`BANK:${String(b?.bankAccountId||"")}`;
const bankPartyLabel=b=>`${b?.accountHolderName||b?.bankName||"Bank Account"} • BANK ACCOUNT • ${b?.bankName||"Bank"}${b?.accountNumber?` • ${String(b.accountNumber).slice(-4)}`:""}`;
const partyRef=p=>String(p?.partyRef||p?.globalCustomerId||p?._id||"");
const financePartyLabel=p=>{
  if(String(p?.partyKind||"").toUpperCase()==="USER"){
    const account=String(p?.tallyAccountTypeName||p?.accountType||p?.tallyAccountTypeCode||"USER").trim();
    return `${p?.name||"User"} • USER${account?` • ${account}`:""}`;
  }
  return partyOptionLabel(p);
};
const apiErrorText=e=>{const rows=e?.details?.errors;if(Array.isArray(rows)&&rows.length)return `${e.message}: ${rows.slice(0,8).map(x=>`Row ${x.row||"?"}: ${x.error||"Invalid"}`).join(" • ")}`;return e?.message||"Request failed";};

export default function BankTransactionPage(){
  const user=getUser();
  const selectedFy=currentFinancialYear();
  const years=financialYearOptions(user,{count:10});
  const[fy,setFy]=useState(selectedFy);
  const[selectedMonth,setSelectedMonth]=useState(currentMonthName());
  const[banks,setBanks]=useState([]),[parties,setParties]=useState([]),[rows,setRows]=useState([]),[meta,setMeta]=useState({page:1,pages:1,total:0});
  const[bankFilter,setBankFilter]=useState(""),[typeFilter,setTypeFilter]=useState("ALL"),[q,setQ]=useState(""),[page,setPage]=useState(1),[selected,setSelected]=useState([]);
  const[show,setShow]=useState(false),[uploadBank,setUploadBank]=useState(""),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[preview,setPreview]=useState(null),[assignments,setAssignments]=useState({}),[reviewFilter,setReviewFilter]=useState("ALL"),[draftRows,setDraftRows]=useState([]);
  const[msg,setMsg]=useState(""),[error,setError]=useState("");

  const loadBanks=()=>api(`/banks?status=ACTIVE&financialYear=${encodeURIComponent(fy)}&page=1&limit=200`).then(d=>{const items=d.items||[];setBanks(items);if(!uploadBank&&items.length)setUploadBank(items.find(x=>x.isPrimary)?._id||items[0]._id)}).catch(e=>setError(e.message));
  const loadParties=()=>Promise.all([
    fetchTransactionParties(500),
    api("/access/users/options")
  ]).then(([customers,users])=>{
    const hasSystemCashCustomer=(customers||[]).some(x=>String(x.systemKey||"").toUpperCase()==="CASH");
    const combined=[
      ...(customers||[]).map(x=>({...x,partyKind:"CUSTOMER",partyRef:String(x.globalCustomerId||x._id||"")})),
      ...(users||[]).filter(x=>!(hasSystemCashCustomer&&String(x.systemKey||"").toUpperCase()==="CASH")).map(x=>({...x,partyKind:"USER",partyRef:`USER:${x._id}`}))
    ].filter(x=>partyRef(x));
    combined.sort((a,b)=>financePartyLabel(a).localeCompare(financePartyLabel(b),"en",{sensitivity:"base"}));
    setParties(combined);
  }).catch(()=>setParties([]));
  const load=async(next=page)=>{try{setError("");const {fromDate,toDate}=monthBounds(fy,selectedMonth);const d=await api(`/banks/transactions?financialYear=${encodeURIComponent(fy)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}&bankAccountId=${encodeURIComponent(bankFilter)}&type=${encodeURIComponent(typeFilter)}&q=${encodeURIComponent(q)}&page=${next}&limit=50`);setRows(d.items||[]);setMeta(d.meta||{page:next,pages:1,total:0});setPage(d.meta?.page||next);setSelected([])}catch(e){setError(apiErrorText(e))}};
  const toggleSelected=id=>setSelected(cur=>cur.includes(id)?cur.filter(x=>x!==id):[...cur,id]);
  const toggleAll=(checked,ids)=>setSelected(cur=>checked?[...new Set([...cur,...ids])]:cur.filter(x=>!ids.includes(x)));
  const bulkDelete=async()=>{if(!selected.length)return setError("Select at least one bank transaction");if(!confirm(`Delete ${selected.length} selected bank transaction(s)? Their linked receipt/payment and accounting entries will also be deleted.`))return;setBusy(true);setError("");try{const d=await api("/banks/transactions/bulk-delete",{method:"POST",body:JSON.stringify({financialYear:fy,ids:selected})});setMsg(`${d.deleted||0} selected bank transaction(s) deleted`);await load(1)}catch(e){setError(apiErrorText(e))}finally{setBusy(false)}};
  const deleteAll=async()=>{const {fromDate,toDate}=monthBounds(fy,selectedMonth);const scope=[selectedMonth,bankFilter?"selected bank":"all banks",typeFilter!=="ALL"?typeFilter.toLowerCase():"all types",q?`search “${q}”`:"no search filter"].join(" • ");if(!confirm(`DELETE ALL bank transactions for ${selectedMonth} • FY ${fy} matching the current filters (${scope})? This also deletes linked receipt/payment and accounting entries and cannot be undone.`))return;setBusy(true);setError("");try{const d=await api("/banks/transactions/delete-all",{method:"POST",body:JSON.stringify({financialYear:fy,fromDate,toDate,bankAccountId:bankFilter,type:typeFilter,q})});setMsg(`${d.deleted||0} bank transaction(s) deleted`);await load(1)}catch(e){setError(apiErrorText(e))}finally{setBusy(false)}};
  useEffect(()=>{loadBanks();loadParties()},[fy]);
  useEffect(()=>{load(1)},[fy,selectedMonth,bankFilter,typeFilter]);

  const bankPartyOptions=useMemo(()=>banks.filter(b=>String(b._id)!==String(uploadBank)&&b.bankAccountId).map(b=>({ref:bankPartyRef(b),label:bankPartyLabel(b),bank:b})),[banks,uploadBank]);
  const labelById=useMemo(()=>{const m=new Map();for(const p of parties)m.set(partyRef(p),financePartyLabel(p));for(const b of bankPartyOptions)m.set(b.ref,b.label);return m},[parties,bankPartyOptions]);
  const idByLabel=useMemo(()=>{const m=new Map();for(const p of parties)m.set(financePartyLabel(p),partyRef(p));for(const b of bankPartyOptions)m.set(b.label,b.ref);m.set("Suspense Account","SUSPENSE");return m},[parties,bankPartyOptions]);

  const openUpload=()=>{setShow(true);setPreview(null);setAssignments({});setDraftRows([]);setFile(null);setReviewFilter("ALL");setError("");setMsg("");if(!uploadBank&&banks.length)setUploadBank(banks.find(x=>x.isPrimary)?._id||banks[0]._id)};
  const downloadTemplate=()=>{const csv="Date,Party Name,Remarks,Mode,Debit,Credit,Running Balance\n";const a=document.createElement("a");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.href=url;a.download="bank-statement-review-template.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),0)};
  const previewStatement=async()=>{if(!uploadBank)return setError("Select Bank Account");if(!file)return setError("Choose bank statement file");setBusy(true);setError("");try{const fd=new FormData();fd.append("file",file);const d=await api(`/banks/${uploadBank}/statement-preview`,{method:"POST",body:fd});setPreview(d);setDraftRows((d.reviewRows||[]).map(r=>({...r,date:dateInputValue(r.date),mode:r.mode||"BANK",debit:Number(r.debit||0),credit:Number(r.credit||0),runningBalance:Number(r.runningBalance||0)})));if(d.financialYear)setFy(d.financialYear);const firstStatementDate=(d.reviewRows||[])[0]?.date;const firstDate=firstStatementDate?new Date(firstStatementDate):null;if(firstDate&&!Number.isNaN(firstDate.getTime()))setSelectedMonth(monthNames[firstDate.getMonth()]);const next={};for(const r of d.reviewRows||[])next[r.rowNo]={partyGlobalId:r.matchedPartyGlobalId||"SUSPENSE",partyLabel:r.matchedPartyGlobalId?(labelById.get(String(r.matchedPartyGlobalId))||r.matchedPartyName||"Suspense Account"):"Suspense Account"};setAssignments(next);setMsg(`Review ready: ${d.autoMatchedRows||0} matched • ${d.unmatchedRows||0} suspense • ${d.duplicateRows||0} duplicates skipped${d.ignoredTemplateRows?` • ${d.ignoredTemplateRows} old template sample rows ignored`:""}${d.ignoredOpeningRows?` • opening balance row read`:""}`)}catch(e){setError(apiErrorText(e))}finally{setBusy(false)}};
  const changeParty=(rowNo,label)=>{const id=idByLabel.get(label);setAssignments(cur=>({...cur,[rowNo]:{partyGlobalId:id||"SUSPENSE",partyLabel:label||"Suspense Account"}}))};
  const changeReviewField=(rowNo,key,value)=>setDraftRows(cur=>cur.map(r=>Number(r.rowNo)===Number(rowNo)?{...r,[key]:value}:r));
  const changeReviewType=(rowNo,type)=>setDraftRows(cur=>cur.map(r=>{if(Number(r.rowNo)!==Number(rowNo))return r;const amount=Math.max(Number(r.debit||0),Number(r.credit||0));return {...r,transactionType:type,debit:type==="PAYMENT"?amount:0,credit:type==="RECEIPT"?amount:0}}));
  const changeReviewAmount=(rowNo,key,value)=>setDraftRows(cur=>cur.map(r=>{if(Number(r.rowNo)!==Number(rowNo))return r;const amount=value===""?0:Number(value||0);if(key==="debit")return {...r,debit:amount,credit:amount>0?0:Number(r.credit||0),transactionType:amount>0?"PAYMENT":r.transactionType};return {...r,credit:amount,debit:amount>0?0:Number(r.debit||0),transactionType:amount>0?"RECEIPT":r.transactionType}}));
  const reviewPayload=()=>draftRows.map(r=>({rowNo:Number(r.rowNo),date:r.date,transactionType:r.transactionType,remarks:r.remarks||"",mode:r.mode||"BANK",debit:Number(r.debit||0),credit:Number(r.credit||0),runningBalance:Number(r.runningBalance||0),partyGlobalId:assignments[r.rowNo]?.partyGlobalId||"SUSPENSE"}));
  const persistReview=async(showSuccess=true)=>{const d=await api(`/banks/${uploadBank}/statement-review/${preview.importId}`,{method:"PUT",body:JSON.stringify({financialYear:preview.financialYear||fy,rows:reviewPayload()})});if(d.reviewRows){setDraftRows(d.reviewRows.map(r=>({...r,date:dateInputValue(r.date),mode:r.mode||"BANK",debit:Number(r.debit||0),credit:Number(r.credit||0),runningBalance:Number(r.runningBalance||0)})));setPreview(cur=>({...cur,...d,reviewRows:d.reviewRows}));const next={};for(const r of d.reviewRows)next[r.rowNo]={partyGlobalId:r.matchedPartyGlobalId||"SUSPENSE",partyLabel:r.matchedPartyGlobalId?(labelById.get(String(r.matchedPartyGlobalId))||r.matchedPartyName||"Suspense Account"):"Suspense Account"};setAssignments(next)}if(showSuccess)setMsg("Review changes saved");return d};
  const saveReview=async()=>{if(!preview?.importId)return;setBusy(true);setError("");try{await persistReview(true)}catch(e){setError(apiErrorText(e))}finally{setBusy(false)}};
  const submitStatement=async()=>{if(!preview?.importId)return;setBusy(true);setError("");try{await persistReview(false);const payload=Object.entries(assignments).map(([rowNo,x])=>({rowNo:Number(rowNo),partyGlobalId:x.partyGlobalId||"SUSPENSE"}));const d=await api(`/banks/${uploadBank}/statement-submit/${preview.importId}`,{method:"POST",body:JSON.stringify({financialYear:preview.financialYear||fy,assignments:payload})});setMsg(`Statement submitted: ${d.postedRows||0} transactions • ${d.unmatchedRows||0} Suspense`);setShow(false);setPreview(null);setDraftRows([]);setFile(null);await load(1)}catch(e){setError(apiErrorText(e))}finally{setBusy(false)}};

  const filteredReview=draftRows.filter(r=>reviewFilter==="ALL"||(reviewFilter==="SUSPENSE"?(assignments[r.rowNo]?.partyGlobalId||"SUSPENSE")==="SUSPENSE":(assignments[r.rowNo]?.partyGlobalId||"SUSPENSE")!=="SUSPENSE"));
  const suspenseCount=Object.values(assignments).filter(x=>(x.partyGlobalId||"SUSPENSE")==="SUSPENSE").length;
  const receiptCount=draftRows.filter(x=>x.transactionType==="RECEIPT").length;
  const paymentCount=draftRows.filter(x=>x.transactionType==="PAYMENT").length;

  const columns=[
    {key:"date",label:"Date",render:r=>fmtDate(r.date)},
    {key:"transactionType",label:"Type",render:r=><span className={`financeTypePill ${String(r.transactionType||"").toLowerCase()}`}>{r.transactionType}</span>},
    {key:"matchedPartyName",label:"Party",render:r=>{
      const ref=String(r.matchedPartyGlobalId||"");
      if(!ref)return <span className="suspenseText">Suspense Account</span>;
      if(ref.startsWith("USER:"))return <EditMasterLink to="/dms/users" id={ref.slice(5)} resource="user">{r.partyNameDisplay||r.matchedPartyName||"—"}</EditMasterLink>;
      if(ref.startsWith("BANK:"))return <span>{r.partyNameDisplay||r.matchedPartyName||"Bank Account"}</span>;
      return <EditMasterLink to="/dms/customers" id={ref} resource="customer">{r.partyNameDisplay||r.matchedPartyName||"—"}</EditMasterLink>;
    }},
    {key:"userNameDisplay",label:"User Name",render:r=>r.userNameDisplay||"—"},
    {key:"remarks",label:"Remarks",render:r=><span className="financeRemarkCell">{r.remarks||r.partyName||"—"}</span>},
    {key:"mode",label:"Mode"},
    {key:"debit",label:"Debit",render:r=>Number(r.debit||0)?money(r.debit):"—"},
    {key:"credit",label:"Credit",render:r=>Number(r.credit||0)?money(r.credit):"—"},
    {key:"runningBalance",label:"Running Bal.",render:r=>bankBalance(r.runningBalance)},
    {key:"bankNameSnapshot",label:"Bank"},
    {key:"classification",label:"Status",render:r=><span className={r.classification==="SUSPENSE"?"suspenseText":"matchedText"}>{r.classification==="SUSPENSE"?"Suspense":"Posted"}</span>},
  ];

  return <>
    <PageHeader title="Bank Transactions" description="Receipts, payments and bank statements in one reviewed workflow." onAdd={openUpload} addLabel="Upload Bank Statement"/>
    {msg&&<div className="resultBanner good">{msg}</div>}{error&&<div className="resultBanner bad">{error}</div>}
    {window.location.pathname==="/dms/banking"&&<SalespersonCashControl financialYear={fy}/>}
    <section className="financeUnifiedStrip"><div><Landmark size={19}/><span><small>Financial Year</small><strong>{fy||"—"}</strong></span></div><div><small>Total Transactions</small><strong>{meta.total||0}</strong></div><div><small>Workflow</small><strong>Upload → Review → Submit</strong></div><div><small>Uncertain Match</small><strong>Suspense Account</strong></div></section>
    <section className="panel">
      <div className="toolbar financeUnifiedToolbar"><select value={fy} onChange={e=>setFy(e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select><select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}><option value="ALL">Full FY</option>{fyMonthOrder.map(m=><option key={m}>{m}</option>)}</select><select value={bankFilter} onChange={e=>setBankFilter(e.target.value)}><option value="">All Banks</option>{banks.map(b=><option key={b._id} value={b.bankAccountId}>{b.bankName} • {String(b.accountNumber||"").slice(-4)}</option>)}</select><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option>ALL</option><option>RECEIPT</option><option>PAYMENT</option></select><div className="searchBox"><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load(1)} placeholder="Party, remarks, mode, voucher…"/></div><button className="btn ghost" onClick={()=>load(1)}><RefreshCw size={15}/>Refresh</button><button className="btn ghost danger" disabled={!selected.length||busy} onClick={bulkDelete}><Trash2 size={15}/>Bulk Delete ({selected.length})</button><button className="btn danger" disabled={!meta.total||busy} onClick={deleteAll}><Trash2 size={15}/>Delete All</button></div>
      <DataTable rows={rows} columns={columns} rowId={r=>r._listId||r._id} selectable selectedIds={selected} onToggle={toggleSelected} onToggleAll={toggleAll} mobileCards stickyFirstColumn/>
      <div className="paginationBar"><span>Page {meta.page||page} of {Math.max(1,meta.pages||1)} • {meta.total||0}</span><div><button className="btn ghost" disabled={(meta.page||page)<=1} onClick={()=>load((meta.page||page)-1)}><ChevronLeft size={15}/>Previous</button><button className="btn ghost" disabled={(meta.page||page)>=(meta.pages||1)} onClick={()=>load((meta.page||page)+1)}>Next<ChevronRight size={15}/></button></div></div>
    </section>

    {show&&<div className="modalOverlay"><section className="panel modalPanel financeReviewModal">
      <div className="formTitle"><div><h3>Upload Bank Statement</h3><span>Nothing is posted until you review every detected party and click Submit Statement.</span></div><button className="iconBtn" onClick={()=>setShow(false)}><X/></button></div>
      <div className="statementWizardSteps"><span className={!preview?"active":"done"}>1 Upload</span><span className={preview?"active":""}>2 Review Party Mapping</span><span>3 Submit</span></div>
      {!preview&&<>
        <div className="statementUploadHero"><FileSpreadsheet size={28}/><div><strong>Simple Bank Statement Format</strong><span>Date · Party Name (optional) · Remarks · Mode (BANK/CASH) · Debit · Credit · Running Balance</span></div><button className="btn ghost" onClick={downloadTemplate}><Download size={14}/>Template</button></div>
        <div className="formGrid compactGrid financeUploadGrid"><label>Financial Year<input readOnly value="Auto from statement dates"/><small>The Date column decides FY automatically.</small></label><label>Bank Account *<select value={uploadBank} onChange={e=>setUploadBank(e.target.value)}><option value="">Select Bank</option>{banks.map(b=><option key={b._id} value={b._id}>{b.bankName} • {String(b.accountNumber||"").slice(-4)}{b.isPrimary?" • Primary":""}</option>)}</select></label><label className="wideField">Statement File *<input type="file" accept=".xlsx,.xls,.csv" onChange={e=>setFile(e.target.files?.[0]||null)}/></label></div>
        <div className="financeDetectionNote"><Search size={16}/><span><strong>AI Narration Matching:</strong> Party Name may be blank. The system reads the complete Remarks/Narration, checks exact bank account numbers, Customer names, User names and Admin-created Bank Accounts, then uses AI fallback for unresolved candidate matches when AI is configured. If it is still uncertain, it keeps the row in <b>Suspense Account</b> for review.</span></div>
        <div className="formActions"><button className="btn ghost" onClick={()=>setShow(false)}>Cancel</button><button className="btn primary" disabled={!file||!uploadBank||busy} onClick={previewStatement}><Upload size={15}/>{busy?"Reading…":"Upload & Review"}</button></div>
      </>}
      {preview&&<>
        <div className="statementReviewSummary"><div><small>Financial Year</small><strong>{preview.financialYear||fy}</strong></div><div><small>Rows to Post</small><strong>{preview.reviewRows?.length||0}</strong></div><div><small>Receipts</small><strong>{receiptCount}</strong></div><div><small>Payments</small><strong>{paymentCount}</strong></div><div className={suspenseCount?"warning":""}><small>Suspense</small><strong>{suspenseCount}</strong></div><div><small>Duplicates Skipped</small><strong>{preview.duplicateRows||0}</strong></div><div><small>Closing Balance</small><strong>{bankBalance(preview.closingBalance)}</strong></div></div>
        <div className="statementReviewToolbar"><div><strong>Review & Edit Bank Statement</strong><span>The matcher scans the complete narration for Customer names, User names, saved account numbers and Admin-created Bank Accounts. Every transaction field below can be corrected before posting.</span></div><select value={reviewFilter} onChange={e=>setReviewFilter(e.target.value)}><option value="ALL">All Rows</option><option value="SUSPENSE">Suspense Only</option><option value="MATCHED">Matched Only</option></select></div>
        <datalist id="finance-party-options"><option value="Suspense Account"/>{parties.map(p=><option key={partyRef(p)} value={financePartyLabel(p)}/>)}{bankPartyOptions.map(b=><option key={b.ref} value={b.label}/>)}</datalist>
        <div className="statementReviewTableWrap"><table className="statementReviewTable editableStatementTable"><thead><tr><th>Date</th><th>Type</th><th>Remarks / Narration</th><th>Detected / Selected Party</th><th>Match</th><th>Mode</th><th>Debit</th><th>Credit</th><th>Run. Bal.</th></tr></thead><tbody>{filteredReview.map(r=>{const a=assignments[r.rowNo]||{partyGlobalId:"SUSPENSE",partyLabel:"Suspense Account"};const suspense=(a.partyGlobalId||"SUSPENSE")==="SUSPENSE";return <tr key={r.rowNo} className={suspense?"reviewSuspenseRow":"reviewMatchedRow"}><td><input className="reviewDateInput" type="date" value={dateInputValue(r.date)} onChange={e=>changeReviewField(r.rowNo,"date",e.target.value)}/></td><td><select className="reviewTypeInput" value={r.transactionType||((Number(r.credit||0)>0)?"RECEIPT":"PAYMENT")} onChange={e=>changeReviewType(r.rowNo,e.target.value)}><option value="RECEIPT">Receipt</option><option value="PAYMENT">Payment</option></select></td><td><textarea className="reviewRemarksInput" rows={2} value={r.remarks||""} onChange={e=>changeReviewField(r.rowNo,"remarks",e.target.value)}/></td><td><div className="partyReviewBox">{suspense?<AlertTriangle size={14}/>:<CheckCircle2 size={14}/>}<input list="finance-party-options" value={a.partyLabel||""} onChange={e=>changeParty(r.rowNo,e.target.value)} onBlur={e=>{if(!idByLabel.has(e.target.value))changeParty(r.rowNo,"Suspense Account")}}/></div></td><td><div className="matchConfidence"><strong>{suspense?"Review":`${r.matchConfidence||0}%`}</strong><span>{String(r.detectionSource||"").replaceAll("_"," ")}</span></div></td><td><select className="reviewModeInput" value={r.mode||"BANK"} onChange={e=>changeReviewField(r.rowNo,"mode",e.target.value)}><option value="BANK">Bank</option><option value="CASH">Cash</option></select></td><td><input className="reviewNumberInput" type="number" step="0.01" min="0" value={Number(r.debit||0)||""} onChange={e=>changeReviewAmount(r.rowNo,"debit",e.target.value)}/></td><td><input className="reviewNumberInput" type="number" step="0.01" min="0" value={Number(r.credit||0)||""} onChange={e=>changeReviewAmount(r.rowNo,"credit",e.target.value)}/></td><td><input className="reviewNumberInput wide" type="number" step="0.01" value={Number.isFinite(Number(r.runningBalance))?r.runningBalance:""} onChange={e=>changeReviewField(r.rowNo,"runningBalance",e.target.value)}/></td></tr>})}</tbody></table></div>
        <div className="financeSafetyNote">Use <b>Save Review Changes</b> to store corrections before posting. Submit also saves the latest edits automatically. Rows left on Suspense are posted to Suspense only when no reliable party/account match is available.</div>
        <div className="formActions"><button className="btn ghost" disabled={busy} onClick={()=>{setPreview(null);setAssignments({});setDraftRows([])}}>Back</button><span className="formActionSpacer"/><button className="btn ghost" disabled={busy} onClick={saveReview}>{busy?"Saving…":"Save Review Changes"}</button><button className="btn primary" disabled={busy} onClick={submitStatement}>{busy?"Posting…":`Submit Statement (${draftRows.length})`}</button></div>
      </>}
    </section></div>}
  </>;
}
