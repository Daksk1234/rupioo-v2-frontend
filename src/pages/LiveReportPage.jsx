import React,{useEffect,useMemo,useState} from "react";
import { RefreshCw,FileSpreadsheet,Printer,Mail,Send } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import { api } from "../lib/api.js";
import { accessForPath } from "../lib/permissionAccess.js";
import { isAdminUser } from "../lib/adminVisibility.js";
import { fetchTransactionParties, partyOptionLabel } from "../lib/partyDirectory.js";

const esc=v=>String(v??"").replaceAll('"','""');
const PROFIT_SENSITIVE=/(profit|margin|trading|break-even|company health)/i;

export default function LiveReportPage({page}){
  const[fy,setFy]=useState(localStorage.getItem("financialYearSelected")||"2026-27");
  const[data,setData]=useState({rows:[],summary:{}});
  const[loading,setLoading]=useState(false);
  const[msg,setMsg]=useState("");
  const[parties,setParties]=useState([]);
  const[partyId,setPartyId]=useState("");
  const[sendingLedger,setSendingLedger]=useState(false);
  const admin=isAdminUser();
  const restricted=!admin&&PROFIT_SENSITIVE.test(String(page?.label||""));
  const access=accessForPath(page?.path||"/dms/reports");
  const isLedger=page?.path==="/dms/ledger";

  const load=async()=>{
    if(restricted){
      setData({rows:[],summary:{}});
      setMsg("Profit, margin and profitability reports are available only to Admin users.");
      return;
    }
    setLoading(true);setMsg("");
    try{
      const partyQuery=isLedger&&partyId?`&partyGlobalId=${encodeURIComponent(partyId)}`:"";
      setData(await api(`/reports/run?name=${encodeURIComponent(page.label)}&financialYear=${encodeURIComponent(fy)}${partyQuery}`))
    }
    catch(e){setMsg(e.message)}
    finally{setLoading(false)}
  };

  useEffect(()=>{
    if(isLedger){fetchTransactionParties(200).then(setParties).catch(()=>setParties([]));}
    load();
  },[page.path]);

  useEffect(()=>{if(isLedger)load()},[partyId]);

  const rows=data.rows||[];
  const keys=useMemo(()=>rows.length?Object.keys(rows[0]).slice(0,8):[],[rows]);
  const columns=keys.map(k=>({
    key:k,
    label:k.replace(/([A-Z])/g," $1").replaceAll("_"," ").replace(/^./,c=>c.toUpperCase()),
    render:r=>r[k] instanceof Object?JSON.stringify(r[k]):(String(k).toLowerCase().includes("date")&&r[k]?new Date(r[k]).toLocaleDateString("en-IN"):String(r[k]??"—"))
  }));

  const sendLedgerMail=async()=>{
    if(!partyId){setMsg("Select a party before sending ledger mail");return;}
    setSendingLedger(true);setMsg("");
    try{
      const result=await api("/reports/ledger/email",{method:"POST",body:JSON.stringify({financialYear:fy,partyGlobalId:partyId})});
      setMsg(`Ledger sent by email${result?.to?` to ${result.to}`:""}.`);
    }catch(e){setMsg(e.message)}finally{setSendingLedger(false)}
  };

  const exportCsv=()=>{
    const all=[...new Set(rows.flatMap(r=>Object.keys(r)))];
    const csv=[all.join(","),...rows.map(r=>all.map(k=>`"${esc(r[k] instanceof Object?JSON.stringify(r[k]):r[k])}"`).join(","))].join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`${page.label.replace(/[^a-z0-9]+/gi,"_")}_${fy}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if(restricted){
    return <>
      <PageHeader title={page.label} description="Admin-only profitability report" actions={false}/>
      <div className="adminSensitiveNotice">Profit, margin, profitability and company-profit health information is restricted to Admin users.</div>
    </>;
  }

  return <>
    <PageHeader title={page.label} description={page.description} actions={false}/>
    {msg&&<div className="resultBanner bad">{msg}</div>}
    <section className="panel">
      <div className="toolbar">
        <label style={{fontSize:9,fontWeight:700}}>Financial Year
          <select style={{marginLeft:8,padding:"8px 10px",border:"1px solid var(--line)",borderRadius:9}} value={fy} onChange={e=>{setFy(e.target.value);localStorage.setItem("financialYearSelected",e.target.value)}}>
            {["2024-25","2025-26","2026-27","2027-28","2028-29"].map(x=><option key={x}>{x}</option>)}
          </select>
        </label>
        {isLedger&&<label className="ledgerPartySelector" style={{fontSize:9,fontWeight:700}}>Party
          <select value={partyId} onChange={e=>setPartyId(e.target.value)}><option value="">Select Customer / Supplier</option>{parties.map(p=><option key={p.globalCustomerId} value={p.globalCustomerId}>{partyOptionLabel(p)}</option>)}</select>
        </label>}
        <button className="btn ghost" onClick={load}><RefreshCw/> {loading?"Generating":"Refresh"}</button>
        {isLedger&&<button className="btn primary ledgerMailButton" onClick={sendLedgerMail} disabled={!partyId||sendingLedger} title="Send ledger PDF by email"><Mail/>{sendingLedger?"Sending...":"Send Mail"}</button>}
        {access.download&&<button className="btn ghost" onClick={exportCsv} disabled={!rows.length}><FileSpreadsheet/>Excel / CSV</button>}
        {access.print&&<button className="btn ghost" onClick={()=>window.print()}><Printer/>Print / PDF</button>}
      </div>
      <div className="summaryCards">{Object.entries(data.summary||{}).slice(0,6).map(([k,v])=><div key={k}><strong>{typeof v==="number"?v.toLocaleString("en-IN"):String(v)}</strong><span>{k.replace(/([A-Z])/g," $1")}</span></div>)}</div>
      <DataTable columns={columns.length?columns:[{key:"empty",label:"Report"}]} rows={rows} empty="No data for the selected financial year."/>
      <footer style={{marginTop:12,fontSize:8,color:"#999"}}>This page is generated by the Rupioo Global System. • Generated {data.generatedAt?new Date(data.generatedAt).toLocaleString("en-IN"):""}</footer>
    </section>
  </>;
}
