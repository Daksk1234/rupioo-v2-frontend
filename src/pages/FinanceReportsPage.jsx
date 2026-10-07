import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateOnly = (v) => v ? new Date(v).toLocaleDateString("en-IN") : "-";
const upper = (v) => String(v || "").trim().toUpperCase();
const MONTHS = ["ALL MONTHS","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC","JAN","FEB","MAR"];

function downloadCsv(name, columns, rows) {
  const esc = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
  const lines = [columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => columns.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(","))];
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

function Summary({ items }) {
  return <div className="finSummary">{items.map((x) => <div className="finSummaryCard" key={x.label}><span>{x.label}</span><strong>{x.value}</strong></div>)}</div>;
}
function Select({ label, value, onChange, children }) {
  return <label className="finFilter"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{children}</select></label>;
}
function TextFilter({ value, onChange }) { return <label className="finFilter finSearch"><span>SEARCH</span><input value={value} onChange={(e)=>onChange(e.target.value)} placeholder="SEARCH..." /></label>; }
function Table({ columns, rows, empty="NO DATA FOUND" }) {
  return <div className="finTableWrap"><table className="finTable"><thead><tr>{columns.map((c)=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r,i)=><tr key={r.id || `${r.partyId || r.receiptNo || r.ratio || r.name || i}-${i}`}>{columns.map((c)=><td key={c.key} className={c.num ? "num" : ""}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>) : <tr><td colSpan={columns.length} className="finEmpty">{empty}</td></tr>}</tbody></table></div>;
}

const reportApi = {
  CREDIT_EXPOSURE: "/reports/finance/customer-credit-exposure",
  RECEIPT_BOUNCE: "/reports/finance/receipt-bounce",
  CASH_FLOW: "/reports/finance/cash-flow",
  FUND_FLOW: "/reports/finance/fund-flow",
  WORKING_CAPITAL: "/reports/finance/working-capital",
  RATIO_ANALYSIS: "/reports/finance/ratio-analysis",
};

export default function FinanceReportsPage({ reportType }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [fy, setFy] = useState("");
  const needsFy = reportType !== "CREDIT_EXPOSURE";
  useEffect(() => {
    let live = true; setLoading(true); setError("");
    const qs = needsFy && fy ? `?financialYear=${encodeURIComponent(fy)}` : "";
    api(`${reportApi[reportType]}${qs}`).then((res) => { if (!live) return; setData(res); if (needsFy && !fy && res?.financialYear) setFy(res.financialYear); }).catch((e)=>live&&setError(e.message||"REPORT LOAD FAILED")).finally(()=>live&&setLoading(false));
    return () => { live = false; };
  }, [reportType, fy, needsFy]);

  if (loading && !data) return <div className="finState">LOADING REPORT...</div>;
  if (error && !data) return <div className="finState finError">{error}</div>;
  return <div className="financeReportPage">
    <style>{`
      .financeReportPage{display:flex;flex-direction:column;gap:12px}.finToolbar{display:flex;gap:8px;align-items:end;flex-wrap:wrap;padding:10px;border:1px solid var(--border,#e5e7eb);border-radius:10px;background:var(--surface,#fff)}
      .finFilter{display:flex;flex-direction:column;gap:4px;min-width:150px}.finFilter span{font-size:10px;font-weight:800;color:var(--muted,#64748b)}.finFilter select,.finFilter input{height:34px;border:1px solid var(--border,#d1d5db);border-radius:7px;background:var(--surface,#fff);color:inherit;padding:0 9px;font:inherit;font-size:12px}.finSearch{min-width:220px;flex:1}.finBtn{height:34px;border:1px solid var(--border,#d1d5db);background:var(--surface,#fff);border-radius:7px;padding:0 12px;font:inherit;font-size:11px;font-weight:800;cursor:pointer}
      .finSummary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.finSummaryCard{border:1px solid var(--border,#e5e7eb);border-radius:9px;background:var(--surface,#fff);padding:10px;display:flex;flex-direction:column;gap:4px}.finSummaryCard span{font-size:10px;font-weight:800;color:var(--muted,#64748b)}.finSummaryCard strong{font-size:16px}
      .finSection{border:1px solid var(--border,#e5e7eb);border-radius:10px;background:var(--surface,#fff);overflow:hidden}.finSectionTitle{padding:9px 11px;border-bottom:1px solid var(--border,#e5e7eb);font-size:11px;font-weight:900}.finReceiptTabs{display:flex;gap:6px;flex-wrap:wrap;padding:8px;border:1px solid var(--border,#e5e7eb);border-radius:10px;background:var(--surface,#fff)}.finReceiptTabs button{border:1px solid var(--border,#d1d5db);background:var(--surface,#fff);color:inherit;border-radius:7px;padding:8px 14px;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.finReceiptTabs button.active{background:var(--primary,#1d4ed8);border-color:var(--primary,#1d4ed8);color:#fff}.finTableWrap{overflow:auto;max-width:100%}.finTable{width:100%;border-collapse:collapse;white-space:nowrap;font-size:11px}.finTable th{position:sticky;top:0;z-index:1;background:var(--surface-2,#f8fafc);font-size:10px;text-align:left;padding:8px;border-bottom:1px solid var(--border,#e5e7eb)}.finTable td{padding:7px 8px;border-bottom:1px solid var(--border,#eef2f7)}.finTable td.num,.finTable th.num{text-align:right}.finTable tr:last-child td{border-bottom:0}.finEmpty,.finState{text-align:center;padding:35px;color:var(--muted,#64748b);font-weight:800}.finError{color:#b91c1c}.finBadge{display:inline-block;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:900;border:1px solid currentColor}.finBadge.bad{color:#b91c1c}.finBadge.warn{color:#b45309}.finBadge.ok{color:#047857}.finPositive{color:#047857;font-weight:800}.finNegative{color:#b91c1c;font-weight:800}
      @media(max-width:700px){.finFilter,.finSearch{min-width:100%;width:100%}.finToolbar{align-items:stretch}.finBtn{width:100%}}
    `}</style>
    {needsFy && <div className="finToolbar"><Select label="FINANCIAL YEAR" value={fy} onChange={setFy}>{(data?.meta?.financialYears || [fy]).filter(Boolean).map((x)=><option key={x} value={x}>{x}</option>)}</Select></div>}
    {reportType === "CREDIT_EXPOSURE" && <CreditExposure data={data}/>} 
    {reportType === "RECEIPT_BOUNCE" && <ReceiptBounce data={data}/>} 
    {reportType === "CASH_FLOW" && <CashFlow data={data}/>} 
    {reportType === "FUND_FLOW" && <FundFlow data={data}/>} 
    {reportType === "WORKING_CAPITAL" && <WorkingCapital data={data}/>} 
    {reportType === "RATIO_ANALYSIS" && <RatioAnalysis data={data}/>} 
  </div>;
}

function CreditExposure({ data }) {
  const [risk,setRisk]=useState("ALL"),[salesperson,setSalesperson]=useState("ALL"),[territory,setTerritory]=useState("ALL"),[search,setSearch]=useState("");
  const rows=useMemo(()=>(data?.rows||[]).filter(r=>(risk==="ALL"||r.risk===risk)&&(salesperson==="ALL"||r.salespersonId===salesperson)&&(territory==="ALL"||r.territory===territory)&&(!search||upper(`${r.partyName} ${r.salespersonName} ${r.territory}`).includes(upper(search)))),[data,risk,salesperson,territory,search]);
  const cols=[
    {key:"partyName",label:"PARTY NAME"},{key:"salespersonName",label:"SALES PERSON"},{key:"territory",label:"TERRITORY"},
    {key:"creditLimit",label:"CREDIT LIMIT",num:true,render:r=>money(r.creditLimit),csv:r=>r.creditLimit},{key:"creditPeriod",label:"CREDIT PERIOD",num:true,render:r=>`${r.creditPeriod} DAYS`},{key:"dueDays",label:"DUE DAYS",num:true},
    {key:"receivable",label:"RECEIVABLE",num:true,render:r=>money(r.receivable),csv:r=>r.receivable},{key:"pendingOrders",label:"PENDING ORDERS",num:true,render:r=>money(r.pendingOrders),csv:r=>r.pendingOrders},
    {key:"exposure",label:"TOTAL EXPOSURE",num:true,render:r=>money(r.exposure),csv:r=>r.exposure},{key:"available",label:"AVAILABLE CREDIT",num:true,render:r=><span className={r.available<0?"finNegative":""}>{money(r.available)}</span>,csv:r=>r.available},
    {key:"lockStatus",label:"LOCK STATUS",render:r=><span className={`finBadge ${r.lockStatus==="LOCKED"?"bad":"ok"}`}>{r.lockStatus}</span>},{key:"risk",label:"RISK",render:r=><span className={`finBadge ${["OVER LIMIT","OVERDUE"].includes(r.risk)?"bad":r.risk==="HIGH"?"warn":"ok"}`}>{r.risk}</span>},
  ];
  return <><div className="finToolbar"><Select label="RISK" value={risk} onChange={setRisk}>{["ALL","NORMAL","HIGH","OVERDUE","OVER LIMIT"].map(x=><option key={x}>{x}</option>)}</Select><Select label="SALES PERSON" value={salesperson} onChange={setSalesperson}><option value="ALL">ALL</option>{(data?.meta?.salespersons||[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</Select><Select label="TERRITORY" value={territory} onChange={setTerritory}><option value="ALL">ALL</option>{(data?.meta?.territories||[]).map(x=><option key={x} value={x}>{x}</option>)}</Select><TextFilter value={search} onChange={setSearch}/><button className="finBtn" onClick={()=>downloadCsv("Customer_Credit_Exposure",cols,rows)}>DOWNLOAD CSV</button></div>
    <Summary items={[{label:"CUSTOMERS",value:rows.length},{label:"RECEIVABLE",value:money(rows.reduce((s,r)=>s+r.receivable,0))},{label:"PENDING ORDERS",value:money(rows.reduce((s,r)=>s+r.pendingOrders,0))},{label:"TOTAL EXPOSURE",value:money(rows.reduce((s,r)=>s+r.exposure,0))},{label:"OVER LIMIT",value:rows.filter(r=>r.risk==="OVER LIMIT").length}]}/><div className="finSection"><div className="finSectionTitle">CUSTOMER CREDIT EXPOSURE</div><Table columns={cols} rows={rows}/></div></>;
}

function ReceiptBounce({ data }) {
  const [tab,setTab]=useState("ISSUED"),[party,setParty]=useState("ALL"),[bank,setBank]=useState("ALL"),[month,setMonth]=useState("ALL MONTHS"),[search,setSearch]=useState("");

  const eventDate=(r)=>tab==="CLEARED"?r.clearanceDate:tab==="BOUNCED"?r.bounceDate:(r.issueDate||r.depositDate);
  const rows=useMemo(()=>(data?.rows||[]).filter(r=>{
    const inTab=tab==="ISSUED"?["ISSUED","DEPOSITED"].includes(r.status):r.status===tab;
    const d=eventDate(r),m=d?upper(new Date(d).toLocaleString("en-IN",{month:"short",timeZone:"UTC"})):"";
    return inTab&&(party==="ALL"||(r.partyId||r.partyName)===party)&&(bank==="ALL"||(r.bankAccountId||r.bank)===bank)&&(month==="ALL MONTHS"||m===month)&&(!search||upper(`${r.partyName} ${r.chequeNumber} ${r.bank} ${r.accountNumber} ${r.receiptNo}`).includes(upper(search)));
  }),[data,tab,party,bank,month,search]);

  const common=[
    {key:"partyName",label:"PARTY NAME"},
    {key:"chequeNumber",label:"CHEQUE NUMBER"},
    {key:"amount",label:"AMOUNT",num:true,render:r=>money(r.amount),csv:r=>r.amount},
    {key:"bank",label:"BANK NAME"},
    {key:"accountNumber",label:"ACCOUNT NUMBER"},
  ];
  const statusCol={key:"status",label:"STATUS",render:r=><span className={`finBadge ${r.status==="BOUNCED"?"bad":r.status==="CLEARED"?"ok":"warn"}`}>{r.status}</span>};
  const cols=tab==="ISSUED"?[
    {key:"issueDate",label:"ISSUE DATE",render:r=>dateOnly(r.issueDate),csv:r=>r.issueDate?new Date(r.issueDate).toISOString().slice(0,10):""},
    {key:"depositDate",label:"DATE OF DEPOSIT",render:r=>dateOnly(r.depositDate),csv:r=>r.depositDate?new Date(r.depositDate).toISOString().slice(0,10):""},
    ...common,statusCol,
  ]:tab==="CLEARED"?[
    {key:"issueDate",label:"ISSUE DATE",render:r=>dateOnly(r.issueDate),csv:r=>r.issueDate?new Date(r.issueDate).toISOString().slice(0,10):""},
    {key:"depositDate",label:"DATE OF DEPOSIT",render:r=>dateOnly(r.depositDate),csv:r=>r.depositDate?new Date(r.depositDate).toISOString().slice(0,10):""},
    {key:"clearanceDate",label:"DATE OF CLEARANCE",render:r=>dateOnly(r.clearanceDate),csv:r=>r.clearanceDate?new Date(r.clearanceDate).toISOString().slice(0,10):""},
    ...common,statusCol,
  ]:[
    {key:"issueDate",label:"ISSUE DATE",render:r=>dateOnly(r.issueDate),csv:r=>r.issueDate?new Date(r.issueDate).toISOString().slice(0,10):""},
    {key:"depositDate",label:"DATE OF DEPOSIT",render:r=>dateOnly(r.depositDate),csv:r=>r.depositDate?new Date(r.depositDate).toISOString().slice(0,10):""},
    {key:"bounceDate",label:"BOUNCE DATE",render:r=>dateOnly(r.bounceDate),csv:r=>r.bounceDate?new Date(r.bounceDate).toISOString().slice(0,10):""},
    ...common,statusCol,
  ];

  const total=rows.reduce((s,r)=>s+Number(r.amount||0),0);
  return <>
    <div className="finReceiptTabs">
      {[["ISSUED","ISSUED / DEPOSITED"],["CLEARED","CLEARED"],["BOUNCED","BOUNCED"]].map(([key,label])=><button key={key} type="button" className={tab===key?"active":""} onClick={()=>setTab(key)}>{label}</button>)}
    </div>
    <div className="finToolbar">
      <Select label="PARTY" value={party} onChange={setParty}><option value="ALL">ALL</option>{(data?.meta?.parties||[]).map(x=><option key={x.id||x.name} value={x.id||x.name}>{x.name}</option>)}</Select>
      <Select label="BANK" value={bank} onChange={setBank}><option value="ALL">ALL</option>{(data?.meta?.banks||[]).map(x=><option key={x.id} value={x.id}>{x.name}{x.accountNumber?` - ${x.accountNumber}`:""}</option>)}</Select>
      <Select label="MONTH" value={month} onChange={setMonth}>{MONTHS.map(x=><option key={x}>{x}</option>)}</Select>
      <TextFilter value={search} onChange={setSearch}/>
      <button className="finBtn" onClick={()=>downloadCsv(`Cheque_${tab}`,cols,rows)}>DOWNLOAD CSV</button>
    </div>
    <Summary items={[
      {label:tab==="ISSUED"?"ISSUED / DEPOSITED":tab,value:rows.length},
      {label:"AMOUNT",value:money(total)},
      {label:"TOTAL CHEQUES",value:data?.totals?.cheques||0},
      {label:"CLEARED AMOUNT",value:money(data?.totals?.cleared)},
      {label:"BOUNCED AMOUNT",value:money(data?.totals?.bounced)},
    ]}/>
    <div className="finSection"><div className="finSectionTitle">CHEQUE {tab==="ISSUED"?"ISSUED / DEPOSITED":tab} REPORT</div><Table columns={cols} rows={rows}/></div>
  </>;
}

function CashFlow({data}) {
  const monthCols=[{key:"month",label:"MONTH"},{key:"inflow",label:"INFLOW",num:true,render:r=>money(r.inflow),csv:r=>r.inflow},{key:"outflow",label:"OUTFLOW",num:true,render:r=>money(r.outflow),csv:r=>r.outflow},{key:"net",label:"NET CASH FLOW",num:true,render:r=><span className={r.net>=0?"finPositive":"finNegative"}>{money(r.net)}</span>,csv:r=>r.net},{key:"closing",label:"CLOSING CASH/BANK",num:true,render:r=>money(r.closing),csv:r=>r.closing}];
  const catCols=[{key:"category",label:"TRANSACTION TYPE"},{key:"transactions",label:"TRANSACTIONS",num:true},{key:"inflow",label:"INFLOW",num:true,render:r=>money(r.inflow),csv:r=>r.inflow},{key:"outflow",label:"OUTFLOW",num:true,render:r=>money(r.outflow),csv:r=>r.outflow},{key:"net",label:"NET",num:true,render:r=>money(r.net),csv:r=>r.net}];
  return <><div className="finToolbar"><button className="finBtn" onClick={()=>downloadCsv("Cash_Flow",monthCols,data?.rows||[])}>DOWNLOAD CSV</button></div><Summary items={[{label:"OPENING CASH/BANK",value:money(data?.totals?.opening)},{label:"TOTAL INFLOW",value:money(data?.totals?.inflow)},{label:"TOTAL OUTFLOW",value:money(data?.totals?.outflow)},{label:"NET CASH FLOW",value:money(data?.totals?.net)},{label:"CLOSING CASH/BANK",value:money(data?.totals?.closing)}]}/><div className="finSection"><div className="finSectionTitle">MONTH-WISE CASH FLOW</div><Table columns={monthCols} rows={data?.rows||[]}/></div><div className="finSection"><div className="finSectionTitle">CASH FLOW BY TRANSACTION TYPE</div><Table columns={catCols} rows={data?.categories||[]}/></div></>;
}
function FundFlow({data}) { const cols=[{key:"name",label:"COMPONENT"},{key:"type",label:"TYPE"},{key:"opening",label:"OPENING",num:true,render:r=>money(r.opening),csv:r=>r.opening},{key:"closing",label:"CLOSING",num:true,render:r=>money(r.closing),csv:r=>r.closing},{key:"change",label:"CHANGE",num:true,render:r=>money(r.change),csv:r=>r.change},{key:"source",label:"SOURCE OF FUNDS",num:true,render:r=>money(r.source),csv:r=>r.source},{key:"use",label:"USE OF FUNDS",num:true,render:r=>money(r.use),csv:r=>r.use}]; return <><div className="finToolbar"><button className="finBtn" onClick={()=>downloadCsv("Fund_Flow",cols,data?.rows||[])}>DOWNLOAD CSV</button></div><Summary items={[{label:"SOURCES",value:money(data?.totals?.sources)},{label:"USES",value:money(data?.totals?.uses)},{label:"NET FUND FLOW",value:money(data?.totals?.netFundFlow)},{label:"WORKING CAPITAL CHANGE",value:money(data?.totals?.workingCapitalChange)}]}/><div className="finSection"><div className="finSectionTitle">FUND FLOW / CHANGES IN WORKING CAPITAL</div><Table columns={cols} rows={data?.rows||[]}/></div></>; }
function WorkingCapital({data}) { const cols=[{key:"name",label:"COMPONENT"},{key:"type",label:"TYPE"},{key:"opening",label:"OPENING",num:true,render:r=>money(r.opening),csv:r=>r.opening},{key:"closing",label:"CLOSING",num:true,render:r=>money(r.closing),csv:r=>r.closing},{key:"change",label:"CHANGE",num:true,render:r=><span className={r.change>=0?"finPositive":"finNegative"}>{money(r.change)}</span>,csv:r=>r.change}]; return <><div className="finToolbar"><button className="finBtn" onClick={()=>downloadCsv("Working_Capital",cols,data?.rows||[])}>DOWNLOAD CSV</button></div><Summary items={[{label:"OPENING CURRENT ASSETS",value:money(data?.totals?.openingAssets)},{label:"OPENING CURRENT LIABILITIES",value:money(data?.totals?.openingLiabilities)},{label:"CLOSING CURRENT ASSETS",value:money(data?.totals?.closingAssets)},{label:"CLOSING CURRENT LIABILITIES",value:money(data?.totals?.closingLiabilities)},{label:"CLOSING WORKING CAPITAL",value:money(data?.totals?.closingWorkingCapital)}]}/><div className="finSection"><div className="finSectionTitle">WORKING CAPITAL</div><Table columns={cols} rows={data?.rows||[]}/></div></>; }
function RatioAnalysis({data}) { const cols=[{key:"ratio",label:"RATIO"},{key:"value",label:"VALUE",num:true,render:r=>r.value==null?"N/A":r.unit==="₹"?money(r.value):`${Number(r.value).toLocaleString("en-IN",{maximumFractionDigits:2})}${r.unit==="%"?"%":r.unit==="DAYS"?" DAYS":r.unit==="x"?" x":""}`,csv:r=>r.value},{key:"formula",label:"FORMULA"},{key:"note",label:"WHAT IT SHOWS"}]; return <><div className="finToolbar"><button className="finBtn" onClick={()=>downloadCsv("Ratio_Analysis",cols,data?.rows||[])}>DOWNLOAD CSV</button></div><Summary items={[{label:"CURRENT ASSETS",value:money(data?.base?.currentAssets)},{label:"CURRENT LIABILITIES",value:money(data?.base?.currentLiabilities)},{label:"SALES",value:money(data?.base?.sales)},{label:"PURCHASES",value:money(data?.base?.purchases)},{label:"RECEIPTS",value:money(data?.base?.receipts)}]}/><div className="finSection"><div className="finSectionTitle">RATIO ANALYSIS</div><Table columns={cols} rows={data?.rows||[]}/></div></>; }
