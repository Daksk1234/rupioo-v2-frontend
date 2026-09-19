import React, { useEffect, useMemo, useState } from "react";
import { Download, Printer, RefreshCw, Search } from "lucide-react";
import { api, apiBlob } from "../lib/api.js";

const REPORTS = [
  ["GSTR1", "GSTR 1"],
  ["GSTR2B", "GSTR 2B"],
  ["GSTR3B", "GSTR 3B"],
  ["HSN", "HSN Wise"],
  ["INPUTOUTPUT", "GST Input/Output"],
  ["TAX", "Tax"],
];
const MONTHS = [[4,"April"],[5,"May"],[6,"June"],[7,"July"],[8,"August"],[9,"September"],[10,"October"],[11,"November"],[12,"December"],[1,"January"],[2,"February"],[3,"March"]];
const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 });
const text = (v) => v == null || v === "" ? "-" : String(v);
const escCsv = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;

function fyDefault(){const d=new Date(),y=d.getFullYear(),m=d.getMonth()+1;const s=m>=4?y:y-1;return `${s}-${String((s+1)%100).padStart(2,"0")}`;}
function fyStart(fy){return Number(String(fy).split("-")[0])||new Date().getFullYear();}
function pad(n){return String(n).padStart(2,"0");}
function periodRange(fy,type,month,quarter,half,customStart,customEnd){
  const y=fyStart(fy);
  if(type==="CUSTOM")return {startDate:customStart,endDate:customEnd};
  if(type==="MONTH"){const m=Number(month),year=m>=4?y:y+1;const last=new Date(Date.UTC(year,m,0)).getUTCDate();return{startDate:`${year}-${pad(m)}-01`,endDate:`${year}-${pad(m)}-${pad(last)}`};}
  if(type==="QUARTER"){const q=Number(quarter),starts=[[4,y],[7,y],[10,y],[1,y+1]],ends=[[6,y],[9,y],[12,y],[3,y+1]],a=starts[q-1]||starts[0],b=ends[q-1]||ends[0],last=new Date(Date.UTC(b[1],b[0],0)).getUTCDate();return{startDate:`${a[1]}-${pad(a[0])}-01`,endDate:`${b[1]}-${pad(b[0])}-${pad(last)}`};}
  if(type==="HALF")return Number(half)===1?{startDate:`${y}-04-01`,endDate:`${y}-09-30`}:{startDate:`${y}-10-01`,endDate:`${y+1}-03-31`};
  return {startDate:`${y}-04-01`,endDate:`${y+1}-03-31`};
}
function downloadBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);}
function csvDownload(rows,name){if(!rows?.length)return;const keys=Object.keys(rows[0]);const csv=[keys.map(escCsv).join(","),...rows.map(r=>keys.map(k=>escCsv(r[k])).join(","))].join("\n");downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),name);}

const COLS={
 GSTR1:[['invoiceNo','Invoice No.'],['invoiceDate','Invoice Date'],['partyName','Party Name'],['gstin','GSTIN/UIN'],['placeOfSupply','Place of Supply'],['rate','Rate'],['taxableValue','Taxable Value'],['cgst','CGST'],['sgst','SGST'],['igst','IGST'],['roundOff','Round Off'],['grandTotal','Grand Total']],
 CDNR:[['recipientGSTIN','GSTIN/UIN of Recipient'],['receiverName','Receiver Name'],['noteNumber','Note Number'],['noteDate','Note Date'],['noteType','Note Type'],['placeOfSupply','Place of Supply'],['noteValue','Note Value'],['rate','Rate'],['taxableValue','Taxable Value']],
 CDNUR:[['urType','UR Type'],['noteNumber','Note Number'],['noteDate','Note Date'],['noteType','Note Type'],['placeOfSupply','Place of Supply'],['noteValue','Note Value'],['rate','Rate'],['taxableValue','Taxable Value']],
 GSTR2B:[['srNo','Sr No'],['supplierGSTIN','Supplier GSTIN'],['supplierName','Supplier Name'],['invoiceNo','Invoice Number'],['invoiceDate','Invoice Date'],['invoiceValue','Invoice Value'],['taxableValue','Taxable Value'],['placeOfSupply','Place of Supply'],['reverseCharge','Reverse Charge'],['gstRate','GST Rate'],['igstAmount','IGST'],['cgstAmount','CGST'],['sgstAmount','SGST'],['eligibleITC','Eligible ITC'],['reasonForIneligibility','Reason for Ineligibility']],
 HSN:[['HSN_Code','HSN'],['Product_Desc','Description'],['uqc','UQC'],['qty','Total Quantity'],['grandTotal','Total Value'],['gstPercentage','Rate'],['taxableAmount','Taxable Value'],['sgstAmt','SGST'],['cgstAmt','CGST'],['igstAmt','IGST'],['cessAmount','Cess Amount']],
 IO:[['type','Type'],['partyName','Party'],['invoiceNo','Invoice No'],['date','Date'],['invoiceValue','Invoice Value'],['taxableValue','Taxable Value'],['cgstInput','CGST Input'],['sgstInput','SGST Input'],['igstInput','IGST Input'],['totalInput','Total Input'],['cgstOutput','CGST Output'],['sgstOutput','SGST Output'],['igstOutput','IGST Output'],['totalOutput','Total Output'],['availableGST','Available GST']],
 TAX:[['totalTaxInput','Total Tax Input'],['totalTaxOut','Total Tax Output'],['BalanceTax','BALANCE TAX']],
};
const numericKeys=new Set(['rate','taxableValue','cgst','sgst','igst','roundOff','grandTotal','invoiceValue','noteValue','igstAmount','cgstAmount','sgstAmount','qty','grandTotal','gstPercentage','taxableAmount','sgstAmt','cgstAmt','igstAmt','cessAmount','cgstInput','sgstInput','igstInput','totalInput','cgstOutput','sgstOutput','igstOutput','totalOutput','availableGST','totalTaxInput','totalTaxOut','BalanceTax']);

function Table({rows=[],cols,onInvoice}){
 const [q,setQ]=useState("");
 const filtered=useMemo(()=>{const t=q.trim().toLowerCase();if(!t)return rows;return rows.filter(r=>cols.some(([k])=>String(r?.[k]??'').toLowerCase().includes(t)));},[rows,cols,q]);
 return <div className="gst-old-table-card">
   <div className="gst-old-table-tools"><div className="gst-old-search"><Search size={14}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search rows"/></div><span>{filtered.length} rows</span></div>
   <div className="gst-old-table-wrap"><table className="gst-old-table"><thead><tr><th>#</th>{cols.map(([k,l])=><th key={k}>{l}</th>)}</tr></thead><tbody>
   {!filtered.length?<tr><td colSpan={cols.length+1} className="gst-empty">No records</td></tr>:filtered.map((r,i)=><tr key={r.rowId||r.id||`${i}-${r.invoiceNo||''}`}><td>{i+1}</td>{cols.map(([k])=><td key={k} className={numericKeys.has(k)?'num':''}>{k==='invoiceNo'&&onInvoice&&r.invoiceId?<button className="gst-link" onClick={()=>onInvoice(r)}>{text(r[k])}</button>:numericKeys.has(k)?money(r[k]):text(r[k])}</td>)}</tr>)}
   </tbody></table></div>
 </div>;
}
function Section({title,rows,cols,onInvoice,downloadCsv}){return <section className="gst-section"><div className="gst-section-head"><h3>{title}<span>{rows?.length||0}</span></h3>{downloadCsv&&<button className="gst-mini" onClick={()=>csvDownload(rows,`${title.replace(/\s+/g,'_')}.csv`)}>CSV</button>}</div><Table rows={rows} cols={cols} onInvoice={onInvoice}/></section>}
function StatGrid({items}){return <div className="gst-stat-grid">{items.map(([k,v])=><div className="gst-stat" key={k}><span>{k}</span><strong>{money(v)}</strong></div>)}</div>}

export default function GstReportsPage({initialReport="GSTR1"}){
 const [active,setActive]=useState(initialReport);
 const [fy,setFy]=useState(fyDefault());
 const [periodType,setPeriodType]=useState("FY"),[month,setMonth]=useState(4),[quarter,setQuarter]=useState(1),[half,setHalf]=useState(1),[customStart,setCustomStart]=useState(""),[customEnd,setCustomEnd]=useState("");
 const [data,setData]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const [g1Tab,setG1Tab]=useState("B2"),[ioMode,setIoMode]=useState("ALL");
 const range=useMemo(()=>periodRange(fy,periodType,month,quarter,half,customStart,customEnd),[fy,periodType,month,quarter,half,customStart,customEnd]);
 useEffect(()=>setActive(initialReport),[initialReport]);
 const query=()=>`financialYear=${encodeURIComponent(fy)}&startDate=${encodeURIComponent(range.startDate||'')}&endDate=${encodeURIComponent(range.endDate||'')}`;
 async function load(){setLoading(true);setError('');try{setData(await api(`/reports/gst/${active}?${query()}`));}catch(e){setData(null);setError(e.message);}finally{setLoading(false);}}
 useEffect(()=>{load();/* eslint-disable-next-line react-hooks/exhaustive-deps */},[active,fy,periodType,month,quarter,half,customStart,customEnd]);
 async function excel(){try{const {blob}=await apiBlob(`/reports/gst-export/${active}.xlsx?${query()}`);downloadBlob(blob,`${active}_${fy}.xlsx`);}catch(e){setError(e.message);}}
 async function openInvoice(row){try{const {blob}=await apiBlob(`/transactions/sales-invoices/${encodeURIComponent(row.invoiceId)}/pdf?financialYear=${encodeURIComponent(fy)}`);const u=URL.createObjectURL(blob);window.open(u,"_blank","noopener,noreferrer");setTimeout(()=>URL.revokeObjectURL(u),60000);}catch(e){setError(e.message);}}
 const print=()=>window.print();
 const ioRows=useMemo(()=>{const rows=data?.rows||[];if(ioMode==='ALL')return rows;return rows.filter(r=>r.type===ioMode);},[data,ioMode]);
 return <div className="gst-old-root">
 <style>{`
 .gst-old-root{padding:0 2px 24px}.gst-old-toolbar,.gst-old-tabs,.gst-subtabs{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.gst-old-tabs{margin-bottom:10px}.gst-old-tab,.gst-btn,.gst-mini{border:1px solid #dbe3ef;background:#fff;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer}.gst-old-tab.active{background:#2448d8;color:#fff;border-color:#2448d8}.gst-old-toolbar{background:#fff;border:1px solid #e4e8ef;border-radius:14px;padding:10px;margin-bottom:12px}.gst-field{display:flex;flex-direction:column;gap:3px}.gst-field label{font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase}.gst-field select,.gst-field input{height:34px;border:1px solid #dbe3ef;border-radius:9px;padding:0 9px}.gst-spacer{flex:1}.gst-btn{display:inline-flex;gap:6px;align-items:center}.gst-error{background:#fee2e2;color:#991b1b;border:1px solid #fecaca;padding:9px 12px;border-radius:10px;margin-bottom:10px;font-weight:700}.gst-loading{padding:28px;text-align:center;font-weight:800}.gst-section{margin:12px 0}.gst-section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.gst-section-head h3{font-size:15px;margin:0}.gst-section-head h3 span{margin-left:7px;background:#eef2ff;color:#3730a3;border-radius:999px;padding:2px 8px;font-size:11px}.gst-old-table-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}.gst-old-table-tools{display:flex;justify-content:space-between;align-items:center;padding:7px 9px;border-bottom:1px solid #eef2f7;font-size:12px;color:#64748b}.gst-old-search{display:flex;align-items:center;gap:5px}.gst-old-search input{border:0;outline:0;min-width:190px}.gst-old-table-wrap{overflow:auto}.gst-old-table{width:100%;border-collapse:collapse;min-width:980px}.gst-old-table th{background:#f4f7f6;padding:7px 8px;white-space:nowrap;font-size:11px;text-transform:uppercase}.gst-old-table td{padding:7px 8px;border-top:1px solid #eef2f7;font-size:12px;text-align:center}.gst-old-table td.num{text-align:right;font-variant-numeric:tabular-nums}.gst-empty{padding:22px!important;color:#64748b}.gst-link{border:0;background:transparent;color:#1d4ed8;text-decoration:underline;font-weight:700;cursor:pointer}.gst-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin:8px 0 12px}.gst-stat{border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:9px}.gst-stat span{display:block;color:#64748b;font-size:11px}.gst-stat strong{display:block;margin-top:4px}.gst-note{padding:9px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;color:#9a3412;font-size:12px;margin:8px 0}.gst-recon-ok{color:#166534}.gst-recon-bad{color:#991b1b}@media print{.gst-old-tabs,.gst-old-toolbar,.gst-old-table-tools,.gst-mini{display:none!important}.app-sidebar,.topbar{display:none!important}.gst-old-root{padding:0}.gst-old-table-card{break-inside:avoid}}
 `}</style>
 <div className="gst-old-tabs">{REPORTS.map(([id,label])=><button key={id} className={`gst-old-tab ${active===id?'active':''}`} onClick={()=>setActive(id)}>{label}</button>)}</div>
 <div className="gst-old-toolbar">
  <div className="gst-field"><label>Financial Year</label><select value={fy} onChange={e=>setFy(e.target.value)}>{[0,1,2,3,4].map(n=>{const y=fyStart(fyDefault())-n;return <option key={y} value={`${y}-${String((y+1)%100).padStart(2,'0')}`}>{y}-{String((y+1)%100).padStart(2,'0')}</option>})}</select></div>
  <div className="gst-field"><label>Filter Type</label><select value={periodType} onChange={e=>setPeriodType(e.target.value)}><option value="FY">Full FY</option><option value="MONTH">Month</option><option value="QUARTER">Quarter</option><option value="HALF">Half Year</option><option value="CUSTOM">Custom Date</option></select></div>
  {periodType==='MONTH'&&<div className="gst-field"><label>Month</label><select value={month} onChange={e=>setMonth(Number(e.target.value))}>{MONTHS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>}
  {periodType==='QUARTER'&&<div className="gst-field"><label>Quarter</label><select value={quarter} onChange={e=>setQuarter(Number(e.target.value))}>{[1,2,3,4].map(x=><option key={x} value={x}>Q{x}</option>)}</select></div>}
  {periodType==='HALF'&&<div className="gst-field"><label>Half</label><select value={half} onChange={e=>setHalf(Number(e.target.value))}><option value={1}>H1 (Apr-Sep)</option><option value={2}>H2 (Oct-Mar)</option></select></div>}
  {periodType==='CUSTOM'&&<><div className="gst-field"><label>Start Date</label><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}/></div><div className="gst-field"><label>End Date</label><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}/></div></>}
  <div className="gst-spacer"/><button className="gst-btn" onClick={load}><RefreshCw size={15}/>Refresh</button><button className="gst-btn" onClick={excel}><Download size={15}/>Excel</button><button className="gst-btn" onClick={print}><Printer size={15}/>Print / PDF</button>
 </div>
 {error&&<div className="gst-error">{error}</div>}{loading?<div className="gst-loading">Loading GST report…</div>:<>
 {active==='GSTR1'&&<><div className="gst-subtabs">{['B2','CDNR','CDNUR'].map(x=><button key={x} className={`gst-old-tab ${g1Tab===x?'active':''}`} onClick={()=>setG1Tab(x)}>{x==='B2'?'B2 (B2B / B2CL / B2CS)':x}</button>)}</div>{g1Tab==='B2'?<>{['B2B','B2CL','B2CS'].map(x=><Section key={x} title={x} rows={data?.sections?.[x]||[]} cols={COLS.GSTR1} onInvoice={openInvoice} downloadCsv/>)}</>:<Section title={g1Tab} rows={data?.sections?.[g1Tab]||[]} cols={COLS[g1Tab]} downloadCsv/>}</>}
 {active==='GSTR2B'&&<><StatGrid items={[["Invoice Value",data?.totals?.invoiceValue],["Taxable Value",data?.totals?.taxableValue],["IGST",data?.totals?.igst],["CGST",data?.totals?.cgst],["SGST",data?.totals?.sgst]]}/><Section title="GSTR 2B — B2B Purchases" rows={data?.rows||[]} cols={COLS.GSTR2B} downloadCsv/></>}
 {active==='GSTR3B'&&<><Section title="3.1 Nature of Supplies" rows={data?.natureOfSupplies||[]} cols={[["label","Nature of Supplies"],["taxableValue","Taxable Value"],["integratedTax","Integrated Tax"],["centralTax","Central Tax"],["stateTax","State Tax"],["cess","Cess"]]} downloadCsv/><div className="gst-note">Legacy-compatible behavior: this table follows the old DMS GSTR 3B structure. The old DMS kept the Eligible ITC table at zero, so V2 preserves that behavior here rather than inventing ITC eligibility rules.</div><Section title="4. Eligible ITC" rows={data?.eligibleITC||[]} cols={[["label","Details"],["taxableValue","Taxable Value"],["integratedTax","Integrated Tax"],["centralTax","Central Tax"],["stateTax","State Tax"],["cess","Cess"]]} downloadCsv/></>}
 {active==='HSN'&&<><Section title="Regular" rows={data?.regular||[]} cols={COLS.HSN} downloadCsv/><Section title="UnRegister" rows={data?.unregister||[]} cols={COLS.HSN} downloadCsv/><section className="gst-section"><div className="gst-section-head"><h3>HSN vs Sales Reconciliation</h3></div><Table rows={['taxable','cgst','sgst','igst','roundOff','grand'].map(k=>({metric:k.toUpperCase(),hsn:data?.reconciliation?.hsn?.[k],sales:data?.reconciliation?.sales?.[k],difference:Number(data?.reconciliation?.hsn?.[k]||0)-Number(data?.reconciliation?.sales?.[k]||0)}))} cols={[["metric","Metric"],["hsn","HSN Total"],["sales","Sales Total"],["difference","Difference"]]}/></section></>}
 {active==='INPUTOUTPUT'&&<><div className="gst-subtabs">{['ALL','INPUT','OUTPUT'].map(x=><button key={x} className={`gst-old-tab ${ioMode===x?'active':''}`} onClick={()=>setIoMode(x)}>{x==='ALL'?'All':'GST '+x}</button>)}</div><StatGrid items={[["Total Input",data?.totals?.totalInput],["Total Output",data?.totals?.totalOutput],["Available GST",data?.totals?.availableGST]]}/><Section title={`GST Input / Output — ${ioMode}`} rows={ioRows} cols={COLS.IO} downloadCsv/></>}
 {active==='TAX'&&<Section title="Tax Report" rows={data?.rows||[]} cols={COLS.TAX} downloadCsv/>}
 </>}
 </div>;
}
