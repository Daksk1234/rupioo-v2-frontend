import React,{useCallback,useEffect,useState} from "react";
import {useNavigate} from "react-router-dom";
import {ChevronLeft,ChevronRight,Download,Plus,RefreshCw,Search,Upload} from "lucide-react";
import DataTable from "../components/DataTable.jsx";
import {api,getUser} from "../lib/api.js";
import {currentFinancialYear,financialYearOptions} from "../lib/financialYear.js";
import {MONTHS,FY_MONTHS,monthBounds} from "../lib/periodFilters.js";
import {downloadTransactionTemplate} from "./TransactionEntryDialog.jsx";
import {exportTransactionList} from "../lib/transactionExport.js";
import {fetchAccountPaths,accountPathHeaders,accountPathForParty} from "../lib/accountHierarchyPaths.js";
import "../profile-bank.css";
import "../transaction-books.css";
const money=n=>`₹${Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const signed=n=>`${money(Math.abs(Number(n||0)))} ${Number(n||0)<0?"Cr":"Dr"}`;
export default function CashbookPage(){
 const navigate=useNavigate();
 const years=financialYearOptions(getUser(),{count:10});
 const[fy,setFy]=useState(currentFinancialYear()),[month,setMonth]=useState("ALL"),[monthReady,setMonthReady]=useState(false),[initialMonthSearch,setInitialMonthSearch]=useState(true),[type,setType]=useState("ALL"),[q,setQ]=useState(""),[page,setPage]=useState(1);
 const[rows,setRows]=useState([]),[meta,setMeta]=useState({page:1,pages:1,total:0}),[opening,setOpening]=useState(0),[closing,setClosing]=useState(0);
 const[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const query=(next=page,limit=50)=>{const {startDate,endDate}=monthBounds(fy,month);return `/transactions/cashbook?financialYear=${encodeURIComponent(fy)}&fromDate=${encodeURIComponent(startDate)}&toDate=${encodeURIComponent(endDate)}&type=${type}&q=${encodeURIComponent(q)}&page=${next}&limit=${limit}`;};
 const load=useCallback(async(next=1)=>{setBusy(true);setError("");try{const d=await api(query(next));setRows(d.items||[]);setMeta(d.meta||{page:next,pages:1,total:0});setOpening(d.openingBalance||0);setClosing(d.closingBalance||0);setPage(next);}catch(e){setError(e.message);}finally{setBusy(false);}},[fy,month,type,q]);
 useEffect(()=>{let active=true;setMonthReady(false);
  const fetchLatest=async()=>{
   try{
    const d=await api(`/transactions/cashbook/latest-month?financialYear=${encodeURIComponent(fy)}`);
    if(!active)return;
    // On first visit, find the latest FY with actual transactions if the
    // current FY has none. Subsequent FY choices remain user-controlled.
    if(!d.month&&initialMonthSearch){
     for(const oldFy of years.filter(x=>x<fy)){
      const prior=await api(`/transactions/cashbook/latest-month?financialYear=${encodeURIComponent(oldFy)}`);
      if(!active)return;
      if(prior.month){setInitialMonthSearch(false);setFy(oldFy);return;}
     }
    }
    setInitialMonthSearch(false);setMonth(d.month?MONTHS[d.month-1]||"ALL":"ALL");setMonthReady(true);
   }catch(e){if(active){setError(e.message);setMonth("ALL");setMonthReady(true);}}
  };fetchLatest();return()=>{active=false;};},[fy]);
 useEffect(()=>{if(monthReady)load(1);},[load,monthReady]);
 const exportData=async(format,printWindow)=>{
  try{setError("");const accountPaths=await fetchAccountPaths().catch(()=>new Map());const all=[];const pages=Math.max(1,Math.ceil((meta.total||0)/200));for(let i=1;i<=pages;i++){const d=await api(query(i,200));all.push(...(d.items||[]));}
   const date=v=>v?new Date(v).toLocaleDateString("en-IN"):"";
   const headers=["Date","Voucher No.","Party Name",...accountPathHeaders,"Remarks","Payment","Receipt","Running Balance"];
   const data=[["FY Opening Balance","","","","","","","","","",Number(opening||0).toFixed(2)],
     ...all.map(x=>[date(x.date),x.transactionId,x.partyName,...accountPathForParty(accountPaths,x.partyGlobalId),x.remarks,
       Number(x.debit||0).toFixed(2),Number(x.credit||0).toFixed(2),Number(x.runningBalance||0).toFixed(2)])];
   await exportTransactionList("Cashbook",format,headers,data,`${fy}-${month}`,printWindow);
  }catch(e){setError(e.message);}
 };
 const columns=[
  {key:"date",label:"Date",render:r=>r.date?new Date(r.date).toLocaleDateString("en-IN"):"—"},
  {key:"transactionId",label:"Voucher No."},
  {key:"partyName",label:"Party Name"},
  {key:"remarks",label:"Remarks",width:520,render:r=><span className="financeRemarkCell">{r.remarks||"—"}</span>},
  {key:"debit",label:"Payment",render:r=>Number(r.debit)?money(r.debit):"—"},
  {key:"credit",label:"Receipt",render:r=>Number(r.credit)?money(r.credit):"—"},
  {key:"runningBalance",label:"Running Balance",render:r=><strong>{signed(r.runningBalance)}</strong>},
 ];
 return <div className="transactionPage">
  <section className="panel transactionLedgerPanel">
   <div className="transactionSingleToolbar">
    <select aria-label="Financial Year" value={fy} onChange={e=>{setInitialMonthSearch(false);setFy(e.target.value);}}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select>
    <select aria-label="Month" value={month} onChange={e=>setMonth(e.target.value)}><option value="ALL">Full FY</option>{FY_MONTHS.map(m=><option key={m} value={m}>{m}</option>)}</select>
    <select aria-label="Transaction mode" value={type} onChange={e=>setType(e.target.value)}><option value="ALL">All Types</option><option value="RECEIPT">Receipt</option><option value="PAYMENT">Payment</option></select>
    <div className="searchBox"><Search size={15}/><input value={q} placeholder="Party, voucher, remarks" onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load(1)}/></div>
    <button className="btn ghost" onClick={()=>load(1)} disabled={busy}><RefreshCw size={15}/>Refresh</button>
    <select aria-label="Download Cashbook" value="" onChange={e=>{const value=e.target.value;e.target.value="";if(value==="template")downloadTransactionTemplate("cash");else if(value)exportData(value,value==="print"?window.open("","_blank"):null);}}><option value="">Download ▾</option><option value="excel">Excel</option><option value="pdf">PDF</option><option value="print">Print</option><option value="template">Template</option></select>
    <button className="btn ghost" onClick={()=>navigate("/dms/cashbook/bulk")}><Upload size={15}/>Bulk Upload</button>
    <button className="btn primary" onClick={()=>navigate("/dms/cashbook/add")}><Plus size={15}/>Add Transaction</button>
   </div>
   {error&&<div className="resultBanner bad">{error}</div>}
   <div className="cashbookBalanceStrip"><span>FY Opening <strong>{signed(opening)}</strong></span><span>FY Closing <strong>{signed(closing)}</strong></span><span>Entries <strong>{meta.total||0}</strong></span></div>
   <DataTable rows={rows} columns={columns} rowId={r=>r._id} className="transactionCenteredTable" mobileCards stickyFirstColumn/>
   <div className="paginationBar"><span>Page {meta.page||page} / {Math.max(meta.pages||1,1)} • {meta.total||0} entries</span><div><button className="btn ghost" disabled={page<=1||busy} onClick={()=>load(page-1)}><ChevronLeft size={15}/>Previous</button><button className="btn ghost" disabled={page>=(meta.pages||1)||busy} onClick={()=>load(page+1)}>Next<ChevronRight size={15}/></button></div></div>
  </section>

 </div>;
}
