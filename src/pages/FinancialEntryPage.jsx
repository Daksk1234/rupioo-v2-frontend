import React,{useEffect,useState} from "react";
import {useNavigate} from "react-router-dom";
import { Plus,RefreshCw,Search,ChevronLeft,ChevronRight,Landmark,Download,Pencil } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import EditMasterLink from "../components/EditMasterLink.jsx";
import DataTable from "../components/DataTable.jsx";
import BulkTools from "../components/BulkTools.jsx";
import CreateLookupButton from "../components/CreateLookupButton.jsx";
import ScanAndFill from "../components/ScanAndFill.jsx";
import { api,getUser } from "../lib/api.js";
import { mayEditPostedVoucher } from "../lib/voucherEditPermissions.js";
import { currentFinancialYear,financialYearFromDate,financialYearOptions,initialDateForFinancialYear } from "../lib/financialYear.js";
import { fetchCompanyBankAccounts, companyBankParty, newTransferReference } from "../lib/companyBankOptions.js";


const config={
 receipts:{title:"Receipts",description:"Create and view receipts from parties; bank receipts also appear on Bank Transactions by date.",numberField:"receiptNo",fields:[
  {key:"receiptNo",label:"Receipt No.",example:"RCT-001"},
  {key:"customer",label:"Party Name / ID",example:"A B Traders"},
  {key:"partyType",label:"Party Type",example:"CUSTOMER"},
  {key:"date",label:"Date (DD-MM-YYYY or YYYY-MM-DD)",example:"29-10-2026"},
  {key:"amount",label:"Amount",type:"number",example:"1500"},
  {key:"mode",label:"Mode",example:"BANK"},
  {key:"bankAccountId",label:"Bank Account ID",example:""},
  {key:"reference",label:"Reference",example:"UTR123456"},
  {key:"remarks",label:"Remarks",example:"Against invoice"},
  {key:"bounceStatus",label:"Bounce Status",example:"CLEAR"}
 ]},
 payments:{title:"Payments",description:"Create and view payments to parties; bank payments also appear on Bank Transactions by date.",numberField:"paymentNo",fields:[
  {key:"paymentNo",label:"Payment No.",example:"PAY-001"},
  {key:"partyGlobalId",label:"Party Name / ID",example:"A B Traders"},
  {key:"partyType",label:"Party Type",example:"CUSTOMER"},
  {key:"date",label:"Date (DD-MM-YYYY or YYYY-MM-DD)",example:"2026-10-29"},
  {key:"amount",label:"Amount",type:"number",example:"1200"},
  {key:"mode",label:"Mode",example:"BANK"},
  {key:"bankAccountId",label:"Bank Account ID",example:""},
  {key:"reference",label:"Reference",example:"UTR789012"},
  {key:"remarks",label:"Remarks",example:"Supplier settlement"}
 ]},
 expenses:{title:"Expense Management",description:"Expense posting with accounting-safe bulk tools.",numberField:"expenseNo",fields:[{key:"expenseNo",label:"Expense No.",example:"EXP-001",noBulkEdit:true},{key:"accountCode",label:"Expense Account",example:"SYS_INDIRECT_EXPENSE",noBulkEdit:true},{key:"date",label:"Date",type:"date",example:"2026-03-31",noBulkEdit:true},{key:"amount",label:"Amount",type:"number",example:"5000",noBulkEdit:true},{key:"paymentMode",label:"Payment Mode",example:"BANK",noBulkEdit:true},{key:"nature",label:"Nature",type:"select",options:["FIXED","VARIABLE","SEMI_VARIABLE"],example:"FIXED"},{key:"allocationMethod",label:"Allocation Method",type:"select",options:["DIRECT","TURNOVER","QUANTITY","GROSS_PROFIT","EMPLOYEE_COUNT","MANUAL","NONE"],example:"TURNOVER"},{key:"narration",label:"Narration",example:"Office rent",noBulkEdit:true}]}
};
const defaultForm=(type,fy)=>type==="receipts"?{date:initialDateForFinancialYear(fy),customerGlobalId:"",partyType:"",transferNo:newTransferReference(),amount:0,mode:"BANK",bankAccountId:"",reference:"",remarks:""}:type==="payments"?{date:initialDateForFinancialYear(fy),partyGlobalId:"",partyType:"",transferNo:newTransferReference(),amount:0,mode:"BANK",bankAccountId:"",reference:"",remarks:""}:{date:initialDateForFinancialYear(fy),accountCode:"SYS_INDIRECT_EXPENSE",amount:0,paymentMode:"BANK",nature:"FIXED",allocationMethod:"TURNOVER",narration:""};
const money=v=>`₹${Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
const fyMonthOrder=["April","May","June","July","August","September","October","November","December","January","February","March"];
const currentMonthName=()=>monthNames[new Date().getMonth()];
// Mirrors backend validation; never let browser date parsing guess the format.
const strictVoucherDateIso=(input)=>{
 const value=String(input||"").trim();let year,month,day;
 let m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
 if(m){[,year,month,day]=m;}else{m=/^(\d{2})-(\d{2})-(\d{4})$/.exec(value);if(!m)return "";[,day,month,year]=m;}
 const y=Number(year),mm=Number(month),dd=Number(day),d=new Date(Date.UTC(y,mm-1,dd));
 return y>=1900&&y<=2100&&d.getUTCFullYear()===y&&d.getUTCMonth()===mm-1&&d.getUTCDate()===dd?`${year}-${month}-${day}`:"";
};
const voucherPartyLabel=p=>`${p.name} • ${p.type}${p.subtype?` (${p.subtype})`:""}${p.identifier?` • ${p.identifier}`:""}`;

const monthBounds=(fy,monthName)=>{const startYear=Number(String(fy||"").slice(0,4));const monthIndex=monthNames.indexOf(monthName);if(!Number.isFinite(startYear))return {fromDate:"",toDate:""};if(monthName==="ALL")return {fromDate:`${startYear}-04-01`,toDate:`${startYear+1}-03-31`};if(monthIndex<0)return {fromDate:"",toDate:""};const year=monthIndex>=3?startYear:startYear+1;const mm=String(monthIndex+1).padStart(2,"0");const last=String(new Date(year,monthIndex+1,0).getDate()).padStart(2,"0");return {fromDate:`${year}-${mm}-01`,toDate:`${year}-${mm}-${last}`};};

export default function FinancialEntryPage({type}){
 const navigate=useNavigate();
 const c=config[type],user=getUser(),defaultFy=currentFinancialYear(),years=financialYearOptions(user,{count:10,extra:[defaultFy]});
 const[fy,setFy]=useState(defaultFy),[selectedMonth,setSelectedMonth]=useState(currentMonthName()),[rows,setRows]=useState([]),[show,setShow]=useState(false),[msg,setMsg]=useState(""),[parties,setParties]=useState([]),[partySearch,setPartySearch]=useState(""),[accounts,setAccounts]=useState([]),[banks,setBanks]=useState([]),[bulkBankId,setBulkBankId]=useState(""),[selected,setSelected]=useState([]),[q,setQ]=useState(""),[page,setPage]=useState(1),[meta,setMeta]=useState({page:1,pages:1,total:0}),[form,setForm]=useState(()=>defaultForm(type,defaultFy));
 const isVoucher=type==="receipts"||type==="payments";
 const parsedVoucherDate=isVoucher?strictVoucherDateIso(form.date):"";
 const postingFy=financialYearFromDate(isVoucher?parsedVoucherDate:form.date)||fy;
 const partyField=type==="receipts"?"customerGlobalId":"partyGlobalId";
 const bankParties=banks.map(companyBankParty);
 const combinedParties=[...parties,...bankParties];
 const selectedParty=combinedParties.find(p=>p.id===form[partyField]&&p.type===form.partyType);
 const partyOptions=combinedParties.filter(p=>!form.partyType||p.type===form.partyType);
 const isBankTransfer=isVoucher&&form.partyType==="BANK_ACCOUNT";
 const changePartySearch=(text)=>{const exact=partyOptions.find(p=>voucherPartyLabel(p)===text);setPartySearch(text);setForm(f=>({...f,[partyField]:exact?.id||text,partyType:exact?.type||f.partyType,...(exact?.type==="BANK_ACCOUNT"?{mode:"BANK"}:{})}));};
 const load=async(next=page,year=fy)=>{try{const {fromDate,toDate}=monthBounds(year,selectedMonth);const d=await api(`/transactions/${type}?financialYear=${encodeURIComponent(year)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}&q=${encodeURIComponent(q)}&page=${next}&limit=50`);setRows(d.items||[]);setMeta(d.meta||{page:next,pages:1,total:(d.items||[]).length});setPage(d.meta?.page||next);}catch(e){setMsg(e.message)}};
 const loadParties=()=>api("/transactions/voucher-party-options").then(d=>setParties(Array.isArray(d)?d:(d.items||[]))).catch(e=>setMsg(e.message));
 const downloadPartyDirectory=()=>{
  if(!parties.length){setMsg("No active parties were loaded; refresh the page before downloading.");return;}
  const csvValue=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const records=[["Party Name","Party Type","Party ID","Identifier","Sub Type"],...parties.map(p=>[p.name,p.type,p.id,p.identifier,p.subtype])];
  const blob=new Blob(["\uFEFF",records.map(r=>r.map(csvValue).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="receipts-payments-party-directory.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const loadBanks=(year=fy)=>fetchCompanyBankAccounts(year).then(list=>{setBanks(list);setBulkBankId(previous=>list.some(b=>String(b._id)===String(previous))?previous:String((list.find(b=>b.isPrimary)||list[0])?._id||""));}).catch(e=>setMsg(e.message));
 useEffect(()=>{setSelected([]);setForm(defaultForm(type,fy));setPartySearch("");if(isVoucher)loadParties();loadBanks(fy);api("/reference/accounts").then(setAccounts).catch(()=>{})},[type,fy]);
 useEffect(()=>{setSelected([]);load(1,fy)},[type,fy,selectedMonth]);
 const applyExpenseScan=(values)=>{if(type!=="expenses")return;setForm(f=>({...f,amount:values.amount||f.amount,paymentMode:values.paymentMode||f.paymentMode,narration:[values.vendorName,values.invoiceNo,values.narration].filter(Boolean).join(" • ")||f.narration}));};
 const requiresBank=type!=="expenses"&&String(form.mode||"").toUpperCase()!=="CASH";
 const save=async()=>{
   try{
     if(isVoucher&&!parsedVoucherDate)throw new Error("Date must be a real date in DD-MM-YYYY or YYYY-MM-DD format (example 29-10-2026)");
     if(isVoucher&&!String(form[partyField]||"").trim())throw new Error("Select a party or enter its exact name");
     if(isVoucher&&form.partyType==="OTHER"&&!String(partySearch||"").trim())throw new Error("Enter the miscellaneous party name");
     if(requiresBank&&!form.bankAccountId)throw new Error("Select Bank Account");
     let result;
     if(isBankTransfer){
       const counterparty=banks.find(b=>String(b.bankAccountId)===String(form[partyField]));
       const selectedBank=banks.find(b=>String(b._id)===String(form.bankAccountId));
       if(!counterparty||!selectedBank)throw new Error("Choose two active company bank accounts");
       if(counterparty.bankAccountId===selectedBank.bankAccountId)throw new Error("Source and destination must be different bank accounts");
       if(String(form.mode).toUpperCase()==="CASH")throw new Error("Internal bank transfers cannot use CASH mode");
       // A Payment sends funds FROM the selected account TO the bank party;
       // a Receipt receives funds FROM the bank party INTO the selected account.
       result=await api("/transactions/bank-transfer",{method:"POST",body:JSON.stringify({
         transferNo:form.transferNo,date:form.date,amount:Number(form.amount||0),
         fromBankAccountId:type==="payments"?selectedBank.bankAccountId:counterparty.bankAccountId,
         toBankAccountId:type==="payments"?counterparty.bankAccountId:selectedBank.bankAccountId,
         reference:form.reference,remarks:form.remarks,
       })});
       setMsg(`Internal bank transfer ${result.transferNo} posted in BOTH bank books. No customer receipt/payment created.${result.balanceWarning?` Balance refresh: ${result.balanceWarning}`:""}`);
     }else{
       result=await api(`/transactions/${type}`,{method:"POST",body:JSON.stringify({...form,financialYear:postingFy,amount:Number(form.amount||0)})});
       setMsg(`${c.title} entry posted in FY ${postingFy}${result?.balanceWarning?` • Bank running-balance refresh needs attention: ${result.balanceWarning}`:""}`);
     }
     setShow(false);setPartySearch("");setForm(defaultForm(type,postingFy));
     if(postingFy!==fy)setFy(postingFy);else await load(1,postingFy);
   }catch(e){setMsg(e.message)}
 };
 const toggle=id=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);const toggleAll=(checked,ids)=>setSelected(s=>checked?[...new Set([...s,...ids])]:s.filter(x=>!ids.includes(x)));
 const partyCell=r=>{const pid=type==="receipts"?r.customerGlobalId:r.partyGlobalId;const party=parties.find(x=>x.id===pid);const name=r.partyNameSnapshot||party?.name||pid||"Unmatched Party";const category=r.partyType||party?.type||"CUSTOMER";const page=category==="USER"?"/dms/users":category==="TRANSPORTER"?"/dms/transporters":category==="CUSTOMER"?"/dms/customers":"";return page?<EditMasterLink to={page} id={String(pid).replace(/^(USER|TRANSPORTER):/,"")} resource={category.toLowerCase()}>{name}</EditMasterLink>:<span className="pendingPartyName">{name} ({category})</span>};
 const columns=type==="expenses"?[{key:"expenseNo",label:"Voucher"},{key:"date",label:"Date",render:r=>new Date(r.date).toLocaleDateString("en-IN")},{key:"accountCode",label:"Account"},{key:"amount",label:"Amount",render:r=>money(r.amount)},{key:"nature",label:"Nature"},{key:"allocationMethod",label:"Allocation"},{key:"status",label:"Status",status:true}]:[
  {key:c.numberField,label:"Voucher"},{key:"date",label:"Date",render:r=>new Date(r.date).toLocaleDateString("en-IN")},{key:"party",label:"Party",render:partyCell},{key:"amount",label:"Amount",render:r=><strong>{money(r.amount)}</strong>},{key:"mode",label:"Mode"},{key:"bankNameSnapshot",label:"Bank / Cash",render:r=>r.mode==="CASH"?"Cash":(r.bankNameSnapshot||"Bank")},{key:"remarks",label:"Remarks",render:r=>r.remarks||r.reference||"—"},{key:"runningBalance",label:"Run. Bal.",render:r=>r.runningBalance===undefined||r.runningBalance===null?"—":money(r.runningBalance)},{key:"status",label:"Status",status:true},
  {key:"edit",label:"Edit",width:75,render:r=>mayEditPostedVoucher(user,type,r.mode==="CASH"?"cash":"bank")&&r.status==="POSTED"&&r.sourceKey&&!r.statementImportId&&
    (type==="payments"||(r.receiptWorkflowStatus==="DMS_DIRECT"&&!r.collectedBySalespersonId&&!r.cashCustodyMovementId))
    ?<button type="button" className="btn ghost" aria-label={`Edit ${r[c.numberField]}`} onClick={()=>navigate(`/dms/transactions/edit/${type}/${encodeURIComponent(r._id)}?fy=${encodeURIComponent(fy)}`)} title="Edit posted DMS voucher"><Pencil size={15}/></button>
    :<span title="This entry belongs to an import or controlled workflow; correct it through its original process">—</span>},
 ];
 return <>
  <PageHeader title={c.title} description={c.description} onAdd={()=>{setPartySearch("");setForm(defaultForm(type,fy));setShow(true)}} addLabel={`Create ${c.title.slice(0,-1)}`}/>
  {msg&&<div className="resultBanner good">{msg}</div>}
  {type==="expenses"?<><BulkTools endpoint={`/transactions/${type}`} fields={c.fields} editFields={c.fields.filter(f=>!f.noBulkEdit)} selectedIds={selected} onClear={()=>setSelected([])} onDone={()=>load()} extraFormData={{financialYear:fy}} extraBody={{financialYear:fy}} schemaForUpload={false} templateName={`${type}-bulk-template.csv`}/><div className="financeSafetyNote">Bulk uploads are filed by each row's Date. Bulk Delete never erases accounting history; cancellation posts balancing reversals.</div></>:<>
   <div className="toolbar"><label>Default bank for bulk upload <select value={bulkBankId} onChange={e=>setBulkBankId(e.target.value)}><option value="">Select bank account</option>{banks.map(b=><option key={b._id} value={b._id}>{b.bankName} • {String(b.accountNumber||"").slice(-4)}{b.isPrimary?" • Primary":""}</option>)}</select></label><span className="tableSubText">Applied to bank-mode rows unless their Bank Account ID column specifies a different account. CASH requires no bank.</span></div>
   <BulkTools endpoint={`/transactions/${type}`} fields={c.fields} onDone={()=>load(1)} extraFormData={{financialYear:fy,bankAccountId:bulkBankId}} allowEdit={false} allowDelete={false} schemaForUpload={false} templateName={`${type}-bulk-upload-template.csv`}/>
   <div className="toolbar"><button className="btn ghost" type="button" onClick={downloadPartyDirectory}><Download size={15}/>Download Party Directory (Customer / User / Transporter)</button><span className="tableSubText">Use names or copy a unique Party ID from this directory into the bulk template.</span></div>
   <div className="financeStatementHint"><Landmark size={16}/><span>Upload Excel/CSV with <strong>Party Name / ID</strong>, optional <strong>Party Type</strong> (CUSTOMER, USER, TRANSPORTER, OTHER), Date, Amount and Mode. Exact names are matched against active masters; if names overlap, provide Party Type and ID. OTHER names are assigned to Suspense A/c until classified. Only DD-MM-YYYY or YYYY-MM-DD calendar dates are accepted (as text or explicitly formatted Excel dates). <strong>BANK / NEFT / RTGS / UPI / CHEQUE</strong> are linked to the selected bank and update running balances in date order. <strong>CASH</strong> remains outside the bank statement. The optional Bank Account ID column supports different banks per row.</span></div>
  </>}

  {show&&<section className="panel editorPanel financeEntryEditor">{type==="expenses"&&<div className="formTitleActions"><ScanAndFill documentType="EXPENSE" targetPath="/dms/expenses" onApply={applyExpenseScan}/></div>}<div className="formGrid">
   <label>Date *{isVoucher?<><input type="text" inputMode="numeric" placeholder="DD-MM-YYYY or YYYY-MM-DD" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={!parsedVoucherDate?{borderColor:"#dc2626"}:undefined}/><small>{parsedVoucherDate?`Posting FY: ${postingFy}`:"Required: DD-MM-YYYY / YYYY-MM-DD (valid calendar date)"}</small></>:<><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/><small>Posting FY: {postingFy}</small></>}</label>
   {isVoucher&&<>
    <label>Party Type <select value={form.partyType||""} onChange={e=>{setPartySearch("");setForm(f=>({...f,partyType:e.target.value,[partyField]:"",...(e.target.value==="BANK_ACCOUNT"?{mode:"BANK"}:{})}));}}><option value="">All Master Types</option><option value="CUSTOMER">Customer / Supplier / Buyer</option><option value="USER">User / Employee</option><option value="TRANSPORTER">Transporter</option><option value="BANK_ACCOUNT">Own Company Bank (Internal Transfer)</option><option value="OTHER">Other (manual name / Suspense A/c)</option></select></label>
    <label className="wideField">{isBankTransfer?"Other Company Bank Account *":"Party Name / ID *"}<div className="lookupSelectRow">{isBankTransfer
      ? <select aria-label="Other company bank account" value={form[partyField]||""} onChange={e=>{const bank=banks.find(b=>String(b.bankAccountId)===e.target.value);setPartySearch(bank?voucherPartyLabel(companyBankParty(bank)):"");setForm(f=>({...f,[partyField]:e.target.value,mode:"BANK"}));}}>
          <option value="">Select the other company bank account</option>
          {banks.map(b=><option key={b.bankAccountId} value={b.bankAccountId}>{b.bankName} • {b.accountHolderName} • {b.accountNumber}</option>)}
        </select>
      : <input list={`voucher-parties-${type}`} value={partySearch} placeholder={form.partyType==="OTHER"?"Type miscellaneous party name":"Start typing or choose existing party (name / ID)"} onChange={e=>changePartySearch(e.target.value)}/>}<datalist id={`voucher-parties-${type}`}>{(form.partyType==="OTHER"?[]:partyOptions).map(p=><option key={`${p.type}:${p.id}`} value={voucherPartyLabel(p)}/>)}</datalist>{(form.partyType==="CUSTOMER"||!form.partyType)&&<CreateLookupButton to="/dms/customers" label="Create" resource="customer" onReturn={loadParties}/>}</div><small>{selectedParty?`Selected ${selectedParty.type}: ${selectedParty.name}`:form.partyType==="OTHER"?"A new name is allowed; posted to Suspense A/c until classified.":"Select a suggested master record; typed exact names also work. Duplicate names need a specific Party Type / ID."}</small></label>
    <label>Amount *<input type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label>
    <label>Mode<select value={form.mode} onChange={e=>setForm({...form,mode:e.target.value,bankAccountId:e.target.value==="CASH"?"":form.bankAccountId})}>{(isBankTransfer?["BANK","NEFT","RTGS","UPI"]:["BANK","NEFT","RTGS","UPI","CHEQUE","CASH"]).map(x=><option key={x}>{x}</option>)}</select></label>
    {requiresBank&&<label>{isBankTransfer?(type==="payments"?"Transfer FROM (Company Bank) *":"Transfer INTO (Company Bank) *"):"Bank Account *"}<select value={form.bankAccountId} onChange={e=>setForm({...form,bankAccountId:e.target.value})}><option value="">Select Bank Account</option>{banks.map(b=><option key={b._id} value={b._id}>{b.bankName} • {String(b.accountNumber||"").slice(-4)}{b.isPrimary?" • Primary":""}</option>)}</select></label>}
    {isBankTransfer&&<div className="wideField financeSafetyNote">Internal bank transfer: {type==="payments"?"source is the Bank Account above; destination is the bank selected as the party":"source is the bank selected as the party; destination is the Bank Account above"}. The debit appears in the source BANK book and the credit in the destination BANK book. No customer ledger is affected.</div>}
    <label>Reference / UTR / Cheque<input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></label><label className="wideField">Remarks<input value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label>
   </>}
   {type==="expenses"&&<><label>Expense Account<select value={form.accountCode} onChange={e=>setForm({...form,accountCode:e.target.value})}>{accounts.filter(x=>x.nature==="EXPENSE").map(x=><option key={x.systemCode} value={x.systemCode}>{x.name}</option>)}</select></label><label>Amount<input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label>Payment Mode<select value={form.paymentMode} onChange={e=>setForm({...form,paymentMode:e.target.value})}><option>BANK</option><option>CASH</option></select></label><label>Nature<select value={form.nature} onChange={e=>setForm({...form,nature:e.target.value})}><option>FIXED</option><option>VARIABLE</option><option>SEMI_VARIABLE</option></select></label><label>Allocation<select value={form.allocationMethod} onChange={e=>setForm({...form,allocationMethod:e.target.value})}>{["DIRECT","TURNOVER","QUANTITY","GROSS_PROFIT","EMPLOYEE_COUNT","MANUAL","NONE"].map(x=><option key={x}>{x}</option>)}</select></label><label>Narration<input value={form.narration} onChange={e=>setForm({...form,narration:e.target.value})}/></label></>}
  </div><div className="formActions"><button className="btn ghost" onClick={()=>setShow(false)}>Cancel</button><button className="btn primary" disabled={Number(form.amount||0)<=0||(isVoucher&&(!parsedVoucherDate||!form[partyField]))||(requiresBank&&!form.bankAccountId)} onClick={save}><Plus/>Post Entry</button></div></section>}

  <section className="panel"><div className="toolbar"><label>FY <select value={fy} onChange={e=>setFy(e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select></label><label>Month <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}><option value="ALL">Full FY</option>{fyMonthOrder.map(m=><option key={m}>{m}</option>)}</select></label><div className="searchBox"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(setSelected([]),load(1))} placeholder={`Search ${c.title.toLowerCase()}...`}/></div><button className="btn ghost" onClick={()=>load()}><RefreshCw/>Refresh</button><div className="recordCount">{meta.total||0} records • FY {fy}</div></div><DataTable selectable={type==="expenses"} selectedIds={selected} onToggle={toggle} onToggleAll={toggleAll} rows={rows} columns={columns}/><div className="paginationBar"><span>Page {meta.page||page} of {Math.max(1,meta.pages||1)} • {meta.total||0} records</span><div><button className="btn ghost" disabled={(meta.page||page)<=1} onClick={()=>{setSelected([]);load((meta.page||page)-1)}}><ChevronLeft size={15}/>Previous</button><button className="btn ghost" disabled={(meta.page||page)>=(meta.pages||1)} onClick={()=>{setSelected([]);load((meta.page||page)+1)}}>Next<ChevronRight size={15}/></button></div></div></section>
 </>;
}
