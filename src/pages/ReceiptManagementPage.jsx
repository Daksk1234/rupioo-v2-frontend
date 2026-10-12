import React, { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, Search } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { api, getUser } from "../lib/api.js";
import { currentFinancialYear, financialYearOptions } from "../lib/financialYear.js";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateOnly = (v) => v ? new Date(v).toLocaleDateString("en-IN") : "—";
const upper = (v) => String(v || "").trim().toUpperCase();
const badgeClass = (value) => upper(value) === "VERIFIED" || upper(value) === "POSTED" || upper(value) === "COMPLETED" ? "ok" : upper(value).includes("PENDING") || upper(value).includes("WAITING") ? "warn" : "neutral";
const paymentLabel = (r) => {
  const mode = upper(r?.mode);
  const type = upper(r?.receiptType);
  if (mode === "BANK" && type) return `BANK • ${type}`;
  return type && type !== mode ? `${mode || "—"} • ${type}` : (mode || type || "—");
};

export default function ReceiptManagementPage() {
  const user = getUser();
  const years = financialYearOptions(user, { count: 10, extra: [currentFinancialYear()] });
  const [fy, setFy] = useState(currentFinancialYear());
  const [tab, setTab] = useState("LIST");
  const [receipts, setReceipts] = useState([]);
  const [pending, setPending] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [otpBusy, setOtpBusy] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [all, waiting] = await Promise.all([
        api(`/transactions/receipts?financialYear=${encodeURIComponent(fy)}&page=1&limit=200`),
        api(`/transactions/receipts/salesperson-pending?financialYear=${encodeURIComponent(fy)}&kind=GENERAL`),
      ]);
      setReceipts(all?.items || []);
      setPending(waiting?.items || []);
    } catch (e) { setError(e.message || "Unable to load receipts"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [fy]);

  const rows = useMemo(() => {
    const source = tab === "PENDING" ? pending : receipts;
    const query = upper(q);
    if (!query) return source;
    return source.filter((r) => upper(`${r.receiptNo} ${r.partyNameSnapshot} ${r.amount} ${r.mode} ${r.receiptType} ${r.collectedBySalespersonNameSnapshot} ${r.createdByNameSnapshot} ${r.status}`).includes(query));
  }, [tab, pending, receipts, q]);

  const seeOtp = async (r) => {
    try {
      setOtpBusy(String(r._id));
      const d = await api(`/transactions/receipts/${encodeURIComponent(r._id || r.receiptNo)}/cashier-otp?financialYear=${encodeURIComponent(fy)}`);
      window.alert(`CASHIER OTP: ${d.otp || "—"}\n\nRECEIPT: ${d.receiptNo || r.receiptNo}\nPARTY: ${d.partyName || r.partyNameSnapshot || "—"}\nAMOUNT: ${money(d.amount || r.amount)}${d.expiresAt ? `\nEXPIRES: ${new Date(d.expiresAt).toLocaleString("en-IN")}` : ""}`);
    } catch (e) { window.alert(e.message || "Unable to load cashier OTP"); }
    finally { setOtpBusy(""); }
  };

  return <div className="receiptMgmtPage">
    <style>{`
      .receiptMgmtPage{display:flex;flex-direction:column;gap:12px}.receiptTabs{display:flex;gap:7px;flex-wrap:wrap}.receiptTabs button{border:1px solid var(--border,#d1d5db);background:var(--surface,#fff);border-radius:8px;padding:9px 16px;font-size:11px;font-weight:900;cursor:pointer}.receiptTabs button.active{background:var(--primary,#1d4ed8);color:#fff;border-color:var(--primary,#1d4ed8)}
      .receiptToolbar{display:flex;gap:8px;align-items:end;flex-wrap:wrap;padding:10px;border:1px solid var(--border,#e5e7eb);border-radius:10px;background:var(--surface,#fff)}.receiptToolbar label{display:flex;flex-direction:column;gap:4px;font-size:10px;font-weight:900;color:var(--muted,#64748b)}.receiptToolbar select,.receiptToolbar input{height:35px;border:1px solid var(--border,#d1d5db);border-radius:7px;background:var(--surface,#fff);padding:0 9px;color:inherit}.receiptSearch{min-width:260px;flex:1}.receiptBtn{height:35px;border:1px solid var(--border,#d1d5db);background:var(--surface,#fff);border-radius:7px;padding:0 11px;font-size:10px;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:5px}.receiptBtn:disabled{opacity:.5;cursor:not-allowed}
      .receiptTableWrap{overflow:auto;border:1px solid var(--border,#e5e7eb);border-radius:10px;background:var(--surface,#fff)}.receiptTable{width:100%;border-collapse:collapse;white-space:nowrap;font-size:11px}.receiptTable th{background:var(--surface-2,#f8fafc);font-size:10px;text-align:left;padding:9px;border-bottom:1px solid var(--border,#e5e7eb)}.receiptTable td{padding:9px;border-bottom:1px solid var(--border,#eef2f7)}.receiptTable tr:last-child td{border-bottom:0}.receiptAmount{font-weight:900;text-align:right}.receiptBadge{display:inline-block;padding:3px 7px;border-radius:999px;border:1px solid currentColor;font-size:9px;font-weight:900}.receiptBadge.ok{color:#047857}.receiptBadge.warn{color:#b45309}.receiptBadge.neutral{color:#64748b}.receiptState{padding:35px;text-align:center;color:var(--muted,#64748b);font-weight:800}
    `}</style>
    <PageHeader title="Receipts" description="All company receipts plus salesperson cash/UPI receipts waiting for cashier OTP verification. Cheques continue in Receipt & Bounce." />
    <div className="receiptTabs">
      <button className={tab === "LIST" ? "active" : ""} onClick={() => setTab("LIST")}>RECEIPTS LIST</button>
      <button className={tab === "PENDING" ? "active" : ""} onClick={() => setTab("PENDING")}>PENDING RECEIPTS ({pending.length})</button>
    </div>
    <div className="receiptToolbar">
      <label>FINANCIAL YEAR<select value={fy} onChange={(e) => setFy(e.target.value)}>{years.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
      <label className="receiptSearch">SEARCH<div style={{position:"relative"}}><Search size={15} style={{position:"absolute",left:9,top:10}}/><input style={{width:"100%",paddingLeft:30}} value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Receipt / party / salesperson / mode" /></div></label>
      <button className="receiptBtn" onClick={load}><RefreshCw size={14}/>REFRESH</button>
    </div>
    {error ? <div className="resultBanner bad">{error}</div> : null}
    <div className="receiptTableWrap">
      {loading ? <div className="receiptState">LOADING RECEIPTS...</div> : <table className="receiptTable"><thead><tr>
        <th>RECEIPT NO.</th><th>DATE</th><th>PARTY</th><th style={{textAlign:"right"}}>AMOUNT</th><th>PAYMENT MODE</th><th>MADE BY</th><th>CUSTOMER OTP</th><th>CASHIER OTP</th><th>STATUS</th>{tab === "PENDING" ? <th>ACTION</th> : null}
      </tr></thead><tbody>{rows.length ? rows.map((r) => <tr key={r._id || r.receiptNo}>
        <td><strong>{r.receiptNo || "—"}</strong></td><td>{dateOnly(r.date)}</td><td>{r.partyNameSnapshot || r.customerGlobalId || "—"}</td><td className="receiptAmount">{money(r.amount)}</td><td>{paymentLabel(r)}{r.chequeNumber ? ` • ${r.chequeNumber}` : ""}</td><td>{r.collectedBySalespersonNameSnapshot || r.createdByNameSnapshot || "—"}</td>
        <td><span className={`receiptBadge ${badgeClass(r.customerOtpStatus || "NOT_REQUIRED")}`}>{upper(r.customerOtpStatus || "NOT_REQUIRED").replaceAll("_"," ")}</span></td>
        <td><span className={`receiptBadge ${badgeClass(r.cashierOtpStatus || "NOT_REQUIRED")}`}>{upper(r.cashierOtpStatus || "NOT_REQUIRED").replaceAll("_"," ")}</span></td>
        <td><span className={`receiptBadge ${badgeClass(r.status)}`}>{upper(r.status || "—").replaceAll("_"," ")}</span></td>
        {tab === "PENDING" ? <td><button className="receiptBtn" disabled={otpBusy === String(r._id)} onClick={() => seeOtp(r)}><Eye size={14}/>{otpBusy === String(r._id) ? "LOADING..." : "SEE OTP"}</button></td> : null}
      </tr>) : <tr><td colSpan={tab === "PENDING" ? 10 : 9} className="receiptState">NO RECEIPTS FOUND</td></tr>}</tbody></table>}
    </div>
  </div>;
}
