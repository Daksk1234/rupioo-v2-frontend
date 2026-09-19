import React,{useEffect,useMemo,useState} from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Landmark, RefreshCw, Search, Upload, X } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import EditMasterLink from "../components/EditMasterLink.jsx";
import SalespersonCashControl from "../components/SalespersonCashControl.jsx";
import { api, getUser } from "../lib/api.js";
import { fetchTransactionParties, partyOptionLabel } from "../lib/partyDirectory.js";
import "../profile-bank.css";

const money=v=>`₹${Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const bankBalance=v=>`${money(Math.abs(Number(v||0)))} ${Number(v||0)<0?"Dr":"Cr"}`;
const fmtDate=v=>v?new Date(v).toLocaleDateString("en-IN"):"—";
const uniq=arr=>[...new Set(arr.filter(Boolean))];
const partyRef=p=>String(p?.partyRef||p?.globalCustomerId||p?._id||"");
const financePartyLabel=p=>{
  if(String(p?.partyKind||"").toUpperCase()==="USER"){
    const account=String(p?.tallyAccountTypeName||p?.accountType||p?.tallyAccountTypeCode||"USER").trim();
    return `${p?.name||"User"} • USER${account?` • ${account}`:""}`;
  }
  return partyOptionLabel(p);
};

export default function BankTransactionPage(){
  const user=getUser();
  const selectedFy=localStorage.getItem("financialYearSelected")||user?.companyProfile?.financialYear||"";
  const years=uniq([...(user?.companyProfile?.financialYears||[]),user?.companyProfile?.financialYear,selectedFy]);
  const[fy,setFy]=useState(selectedFy||years[0]||"");
  const[banks,setBanks]=useState([]),[parties,setParties]=useState([]),[rows,setRows]=useState([]),[meta,setMeta]=useState({page:1,pages:1,total:0});
  const[bankFilter,setBankFilter]=useState(""),[typeFilter,setTypeFilter]=useState("ALL"),[q,setQ]=useState(""),[page,setPage]=useState(1);
  const[show,setShow]=useState(false),[uploadBank,setUploadBank]=useState(""),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[preview,setPreview]=useState(null),[assignments,setAssignments]=useState({}),[reviewFilter,setReviewFilter]=useState("ALL");
  const[msg,setMsg]=useState(""),[error,setError]=useState("");

  const loadBanks=()=>api(`/banks?status=ACTIVE&financialYear=${encodeURIComponent(fy)}&page=1&limit=200`).then(d=>{const items=d.items||[];setBanks(items);if(!uploadBank&&items.length)setUploadBank(items.find(x=>x.isPrimary)?._id||items[0]._id)}).catch(e=>setError(e.message));
  const loadParties=()=>Promise.all([
    fetchTransactionParties(500),
    api("/access/users/options")
  ]).then(([customers,users])=>{
    const combined=[
      ...(customers||[]).map(x=>({...x,partyKind:"CUSTOMER",partyRef:String(x.globalCustomerId||x._id||"")})),
      ...(users||[]).map(x=>({...x,partyKind:"USER",partyRef:`USER:${x._id}`}))
    ].filter(x=>partyRef(x));
    combined.sort((a,b)=>financePartyLabel(a).localeCompare(financePartyLabel(b),"en",{sensitivity:"base"}));
    setParties(combined);
  }).catch(()=>setParties([]));
  const load=async(next=page)=>{try{setError("");const d=await api(`/banks/transactions?financialYear=${encodeURIComponent(fy)}&bankAccountId=${encodeURIComponent(bankFilter)}&type=${encodeURIComponent(typeFilter)}&q=${encodeURIComponent(q)}&page=${next}&limit=50`);setRows(d.items||[]);setMeta(d.meta||{page:next,pages:1,total:0});setPage(d.meta?.page||next)}catch(e){setError(e.message)}};
  useEffect(()=>{loadBanks();loadParties();load(1)},[fy]);

  const labelById=useMemo(()=>{const m=new Map();for(const p of parties)m.set(partyRef(p),financePartyLabel(p));return m},[parties]);
  const idByLabel=useMemo(()=>{const m=new Map();for(const p of parties)m.set(financePartyLabel(p),partyRef(p));m.set("Suspense Account","SUSPENSE");return m},[parties]);

  const openUpload=()=>{setShow(true);setPreview(null);setAssignments({});setFile(null);setReviewFilter("ALL");setError("");setMsg("");if(!uploadBank&&banks.length)setUploadBank(banks.find(x=>x.isPrimary)?._id||banks[0]._id)};
  const downloadTemplate=()=>{const csv="Date,Party Name,Remarks,Mode,Debit,Credit,Running Balance\n";const a=document.createElement("a");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.href=url;a.download="bank-statement-review-template.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),0)};
  const previewStatement=async()=>{if(!uploadBank)return setError("Select Bank Account");if(!fy)return setError("Select Financial Year");if(!file)return setError("Choose bank statement file");setBusy(true);setError("");try{const fd=new FormData();fd.append("file",file);fd.append("financialYear",fy);const d=await api(`/banks/${uploadBank}/statement-preview`,{method:"POST",body:fd});setPreview(d);const next={};for(const r of d.reviewRows||[])next[r.rowNo]={partyGlobalId:r.matchedPartyGlobalId||"SUSPENSE",partyLabel:r.matchedPartyGlobalId?(labelById.get(String(r.matchedPartyGlobalId))||r.matchedPartyName||"Suspense Account"):"Suspense Account"};setAssignments(next);setMsg(`Review ready: ${d.autoMatchedRows||0} matched • ${d.unmatchedRows||0} suspense • ${d.duplicateRows||0} duplicates skipped${d.ignoredTemplateRows?` • ${d.ignoredTemplateRows} old template sample rows ignored`:""}${d.ignoredOpeningRows?` • opening balance row read`:""}`)}catch(e){setError(e.message)}finally{setBusy(false)}};
  const changeParty=(rowNo,label)=>{const id=idByLabel.get(label);setAssignments(cur=>({...cur,[rowNo]:{partyGlobalId:id||"SUSPENSE",partyLabel:label||"Suspense Account"}}))};
  const submitStatement=async()=>{if(!preview?.importId)return;setBusy(true);setError("");try{const payload=Object.entries(assignments).map(([rowNo,x])=>({rowNo:Number(rowNo),partyGlobalId:x.partyGlobalId||"SUSPENSE"}));const d=await api(`/banks/${uploadBank}/statement-submit/${preview.importId}`,{method:"POST",body:JSON.stringify({financialYear:fy,assignments:payload})});setMsg(`Statement submitted: ${d.postedRows||0} transactions • ${d.unmatchedRows||0} Suspense`);setShow(false);setPreview(null);setFile(null);await load(1)}catch(e){setError(e.message)}finally{setBusy(false)}};

  const filteredReview=(preview?.reviewRows||[]).filter(r=>reviewFilter==="ALL"||(reviewFilter==="SUSPENSE"?(assignments[r.rowNo]?.partyGlobalId||"SUSPENSE")==="SUSPENSE":(assignments[r.rowNo]?.partyGlobalId||"SUSPENSE")!=="SUSPENSE"));
  const suspenseCount=Object.values(assignments).filter(x=>(x.partyGlobalId||"SUSPENSE")==="SUSPENSE").length;
  const receiptCount=(preview?.reviewRows||[]).filter(x=>x.transactionType==="RECEIPT").length;
  const paymentCount=(preview?.reviewRows||[]).filter(x=>x.transactionType==="PAYMENT").length;

  const columns=[
    {key:"date",label:"Date",render:r=>fmtDate(r.date)},
    {key:"transactionType",label:"Type",render:r=><span className={`financeTypePill ${String(r.transactionType||"").toLowerCase()}`}>{r.transactionType}</span>},
    {key:"matchedPartyName",label:"Party",render:r=>{
      const ref=String(r.matchedPartyGlobalId||"");
      if(!ref)return <span className="suspenseText">Suspense Account</span>;
      if(ref.startsWith("USER:"))return <EditMasterLink to="/dms/users" id={ref.slice(5)} resource="user">{r.partyNameDisplay||r.matchedPartyName||"—"}</EditMasterLink>;
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
      <div className="toolbar financeUnifiedToolbar"><select value={fy} onChange={e=>setFy(e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select><select value={bankFilter} onChange={e=>{setBankFilter(e.target.value);setTimeout(()=>load(1),0)}}><option value="">All Banks</option>{banks.map(b=><option key={b._id} value={b.bankAccountId}>{b.bankName} • {String(b.accountNumber||"").slice(-4)}</option>)}</select><select value={typeFilter} onChange={e=>{setTypeFilter(e.target.value);setTimeout(()=>load(1),0)}}><option>ALL</option><option>RECEIPT</option><option>PAYMENT</option></select><div className="searchBox"><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load(1)} placeholder="Party, remarks, mode, voucher…"/></div><button className="btn ghost" onClick={()=>load(1)}><RefreshCw size={15}/>Refresh</button></div>
      <DataTable rows={rows} columns={columns} rowId={r=>r._listId||r._id} mobileCards stickyFirstColumn/>
      <div className="paginationBar"><span>Page {meta.page||page} of {Math.max(1,meta.pages||1)} • {meta.total||0}</span><div><button className="btn ghost" disabled={(meta.page||page)<=1} onClick={()=>load((meta.page||page)-1)}><ChevronLeft size={15}/>Previous</button><button className="btn ghost" disabled={(meta.page||page)>=(meta.pages||1)} onClick={()=>load((meta.page||page)+1)}>Next<ChevronRight size={15}/></button></div></div>
    </section>

    {show&&<div className="modalOverlay"><section className="panel modalPanel financeReviewModal">
      <div className="formTitle"><div><h3>Upload Bank Statement</h3><span>Nothing is posted until you review every detected party and click Submit Statement.</span></div><button className="iconBtn" onClick={()=>setShow(false)}><X/></button></div>
      <div className="statementWizardSteps"><span className={!preview?"active":"done"}>1 Upload</span><span className={preview?"active":""}>2 Review Party Mapping</span><span>3 Submit</span></div>
      {!preview&&<>
        <div className="statementUploadHero"><FileSpreadsheet size={28}/><div><strong>Simple Bank Statement Format</strong><span>Date · Party Name (optional) · Remarks · Mode (BANK/CASH) · Debit · Credit · Running Balance</span></div><button className="btn ghost" onClick={downloadTemplate}><Download size={14}/>Template</button></div>
        <div className="formGrid compactGrid financeUploadGrid"><label>Financial Year *<select value={fy} onChange={e=>setFy(e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select></label><label>Bank Account *<select value={uploadBank} onChange={e=>setUploadBank(e.target.value)}><option value="">Select Bank</option>{banks.map(b=><option key={b._id} value={b._id}>{b.bankName} • {String(b.accountNumber||"").slice(-4)}{b.isPrimary?" • Primary":""}</option>)}</select></label><label className="wideField">Statement File *<input type="file" accept=".xlsx,.xls,.csv" onChange={e=>setFile(e.target.files?.[0]||null)}/></label></div>
        <div className="financeDetectionNote"><Search size={16}/><span><strong>Smart Party Detection:</strong> Party Name may be left blank. The system reads the Remarks first and matches the party from Customer Master or User/Ledger Master. If no party is found it automatically uses <b>Suspense Account</b>. Mode is normalized automatically to <b>BANK</b> or <b>CASH</b>.</span></div>
        <div className="formActions"><button className="btn ghost" onClick={()=>setShow(false)}>Cancel</button><button className="btn primary" disabled={!file||!uploadBank||busy} onClick={previewStatement}><Upload size={15}/>{busy?"Reading…":"Upload & Review"}</button></div>
      </>}
      {preview&&<>
        <div className="statementReviewSummary"><div><small>Rows to Post</small><strong>{preview.reviewRows?.length||0}</strong></div><div><small>Receipts</small><strong>{receiptCount}</strong></div><div><small>Payments</small><strong>{paymentCount}</strong></div><div className={suspenseCount?"warning":""}><small>Suspense</small><strong>{suspenseCount}</strong></div><div><small>Duplicates Skipped</small><strong>{preview.duplicateRows||0}</strong></div><div><small>Closing Balance</small><strong>{bankBalance(preview.closingBalance)}</strong></div></div>
        <div className="statementReviewToolbar"><div><strong>Review Party Mapping</strong><span>Party is fetched from Remarks across Customer + User/Ledger Masters. Unknown parties are shown as Suspense Account. BANK/CASH mode is set automatically.</span></div><select value={reviewFilter} onChange={e=>setReviewFilter(e.target.value)}><option value="ALL">All Rows</option><option value="SUSPENSE">Suspense Only</option><option value="MATCHED">Matched Only</option></select></div>
        <datalist id="finance-party-options"><option value="Suspense Account"/>{parties.map(p=><option key={partyRef(p)} value={financePartyLabel(p)}/>)}</datalist>
        <div className="statementReviewTableWrap"><table className="statementReviewTable"><thead><tr><th>Date</th><th>Type</th><th>Remarks</th><th>Detected / Selected Party</th><th>Match</th><th>Mode</th><th>Debit</th><th>Credit</th><th>Run. Bal.</th></tr></thead><tbody>{filteredReview.map(r=>{const a=assignments[r.rowNo]||{partyGlobalId:"SUSPENSE",partyLabel:"Suspense Account"};const suspense=(a.partyGlobalId||"SUSPENSE")==="SUSPENSE";return <tr key={r.rowNo} className={suspense?"reviewSuspenseRow":"reviewMatchedRow"}><td>{fmtDate(r.date)}</td><td><span className={`financeTypePill ${String(r.transactionType).toLowerCase()}`}>{r.transactionType}</span></td><td><div className="reviewRemark"><strong>{r.matchedPartyName||r.partyName||"Suspense Account"}</strong><span>{r.remarks||"—"}</span></div></td><td><div className="partyReviewBox">{suspense?<AlertTriangle size={14}/>:<CheckCircle2 size={14}/>}<input list="finance-party-options" value={a.partyLabel||""} onChange={e=>changeParty(r.rowNo,e.target.value)} onBlur={e=>{if(!idByLabel.has(e.target.value))changeParty(r.rowNo,"Suspense Account")}}/></div></td><td><div className="matchConfidence"><strong>{suspense?"Review":`${r.matchConfidence||0}%`}</strong><span>{String(r.detectionSource||"").replaceAll("_"," ")}</span></div></td><td>{r.mode||"BANK"}</td><td className="numericCell">{r.debit?money(r.debit):"—"}</td><td className="numericCell">{r.credit?money(r.credit):"—"}</td><td className="numericCell">{bankBalance(r.runningBalance)}</td></tr>})}</tbody></table></div>
        <div className="financeSafetyNote">Submitting posts every reviewed row. Rows left on Suspense are posted to the Suspense ledger and remain marked Pending Classification for later correction; the system never guesses an ambiguous party.</div>
        <div className="formActions"><button className="btn ghost" disabled={busy} onClick={()=>{setPreview(null);setAssignments({})}}>Back</button><span className="formActionSpacer"/><button className="btn primary" disabled={busy} onClick={submitStatement}>{busy?"Posting…":`Submit Statement (${preview.reviewRows?.length||0})`}</button></div>
      </>}
    </section></div>}
  </>;
}
