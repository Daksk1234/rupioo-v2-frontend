import React, { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, Search } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import FinancialEntryPage from "./FinancialEntryPage.jsx";
import { api, getUser } from "../lib/api.js";
import { currentFinancialYear, financialYearOptions } from "../lib/financialYear.js";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateOnly = (v) => v ? new Date(v).toLocaleDateString("en-IN") : "—";
const upper = (v) => String(v || "").trim().toUpperCase();
const label = (v) => upper(v || "—").replaceAll("_", " ");
const paymentStatus = (r) => upper(r.collectionSource) !== "SALESPERSON_APP" ? (upper(r.status)==="POSTED"?"PAID":"UNPAID") : (upper(r.cashierOtpStatus)==="VERIFIED" && upper(r.status)==="POSTED" ? "PAID":"UNPAID");
const badgeClass = (v) => ["VERIFIED", "POSTED", "COMPLETED", "RECEIVED"].includes(upper(v)) ? "ok" : /PENDING|WAITING|ISSUE/.test(upper(v)) ? "warn" : "neutral";
const paymentLabel = (r) => {
  const mode = upper(r?.mode), type = upper(r?.receiptType);
  return mode === "BANK" && type ? `BANK • ${type}` : type && type !== mode ? `${mode || "—"} • ${type}` : (mode || type || "—");
};
const matchSearch = (query, ...values) => !query || upper(values.join(" ")).includes(query);

export default function ReceiptManagementPage() {
  const user = getUser();
  const years = financialYearOptions(user, { count: 10, extra: [currentFinancialYear()] });
  const [fy, setFy] = useState(currentFinancialYear());
  const [tab, setTab] = useState("LIST");
  const [receipts, setReceipts] = useState([]);
  const [pending, setPending] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [otpBusy, setOtpBusy] = useState("");
  const [now, setNow] = useState(Date.now());

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [all, waiting, bundles] = await Promise.all([
        api(`/transactions/receipts?financialYear=${encodeURIComponent(fy)}&page=1&limit=200`),
        api(`/transactions/receipts/salesperson-pending?financialYear=${encodeURIComponent(fy)}&kind=GENERAL`),
        api(`/transactions/cashier/handovers?financialYear=${encodeURIComponent(fy)}&status=PENDING`),
      ]);
      setReceipts(all?.items || []);
      setPending(waiting?.items || []);
      setHandovers(bundles?.items || []);
      setNow(Date.now());
    } catch (e) { setError(e.message || "Unable to load receipts"); }
    finally { if (!silent) setLoading(false); }
  };
  useEffect(() => { load(); }, [fy]);
  useEffect(() => {
    if (tab !== "PENDING") return;
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, [tab]);

  // Receipts in a cashier handover already have ONE batch OTP. Never show a
  // second per-receipt OTP or duplicate those receipts in the legacy list.
  const linkedReceiptIds = useMemo(() => new Set(handovers.flatMap(h => (h.receiptBreakdown || []).flatMap(r => [String(r.receiptId || ""), String(r.receiptNo || "")]))), [handovers]);
  const legacyPending = useMemo(() => pending.filter(r => !linkedReceiptIds.has(String(r._id || "")) && !linkedReceiptIds.has(String(r.receiptNo || ""))), [pending, linkedReceiptIds]);
  const pendingCount = legacyPending.length + handovers.reduce((n, h) => n + (h.receiptBreakdown || []).length, 0);
  const filteredHandovers = useMemo(() => {
    const query = upper(q);
    return handovers.filter(h => matchSearch(query, h.movementNo, h.salespersonName, h.cashierName,
      ...(h.receiptBreakdown || []).flatMap(r => [r.receiptNo, r.customerNameSnapshot, r.amount, r.mode, r.receiptType])));
  }, [handovers, q]);
  const filteredLegacy = useMemo(() => legacyPending.filter(r => matchSearch(upper(q), r.receiptNo, r.partyNameSnapshot, r.amount, r.mode, r.receiptType, r.collectedBySalespersonNameSnapshot)), [legacyPending, q]);
  const filteredReceipts = useMemo(() => receipts.filter(r => matchSearch(upper(q), r.receiptNo, r.partyNameSnapshot, r.amount, r.mode, r.receiptType, r.collectedBySalespersonNameSnapshot, r.createdByNameSnapshot, r.status)), [receipts, q]);
  const singles = filteredHandovers.filter(h => (h.receiptBreakdown || []).length === 1);
  const bundles = filteredHandovers.filter(h => (h.receiptBreakdown || []).length > 1);

  const seeOtp = async (r) => {
    try {
      setOtpBusy(String(r._id));
      const d = await api(`/transactions/receipts/${encodeURIComponent(r._id || r.receiptNo)}/cashier-otp?financialYear=${encodeURIComponent(fy)}`);
      window.alert(`CASHIER OTP: ${d.otp || "—"}\n\nRECEIPT: ${d.receiptNo || r.receiptNo}\nPARTY: ${d.partyName || r.partyNameSnapshot || "—"}\nAMOUNT: ${money(d.amount || r.amount)}${d.expiresAt ? `\nEXPIRES: ${new Date(d.expiresAt).toLocaleString("en-IN")}` : ""}`);
    } catch (e) { window.alert(e.message || "Unable to load cashier OTP"); }
    finally { setOtpBusy(""); }
  };
  const refreshBatchOtp = async (handover) => {
    const key = `refresh:${handover._id}`;
    setOtpBusy(key);
    try {
      await api(`/transactions/cashier/handovers/${encodeURIComponent(handover._id)}/otp/refresh`, {
        method: "POST", body: JSON.stringify({ financialYear: fy }),
      });
      await load({ silent: true });
    } catch (e) { window.alert(e.message || "Unable to refresh handover OTP"); }
    finally { setOtpBusy(""); }
  };
  const batchOtp = (h) => {
    if (h.handoverOtpStatus === "VERIFIED") return <span className="receiptBadge ok">OTP VERIFIED</span>;
    if (h.handoverOtpStatus !== "PENDING") return <span className="receiptBadge neutral">{label(h.handoverOtpStatus)}</span>;
    const expired = h.handoverOtpExpiresAt && new Date(h.handoverOtpExpiresAt).getTime() <= now;
    if (expired || !h.handoverOtp) return <div className="batchOtp"><span className="receiptBadge warn">{expired ? "OTP EXPIRED" : "OTP UNAVAILABLE"}</span><button className="receiptBtn" disabled={otpBusy === `refresh:${h._id}`} onClick={() => refreshBatchOtp(h)}><RefreshCw size={13}/>{otpBusy === `refresh:${h._id}` ? "GENERATING..." : "GENERATE NEW OTP"}</button></div>;
    return <div className="batchOtp"><span className="otpCode">CASHIER OTP: {h.handoverOtp}</span><span className="otpExpiry">EXPIRES {new Date(h.handoverOtpExpiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></div>;
  };

  return <div className="receiptMgmtPage">
    <style>{`
      .receiptMgmtPage{display:flex;flex-direction:column;gap:12px}.receiptTabs{display:flex;gap:7px;flex-wrap:wrap}.receiptTabs button{border:1px solid var(--border,#d1d5db);background:var(--surface,#fff);border-radius:8px;padding:9px 16px;font-size:11px;font-weight:900;cursor:pointer}.receiptTabs button.active{background:var(--primary,#1d4ed8);color:#fff;border-color:var(--primary,#1d4ed8)}
      .receiptToolbar{display:flex;gap:8px;align-items:end;flex-wrap:wrap;padding:10px;border:1px solid var(--border,#e5e7eb);border-radius:10px;background:var(--surface,#fff)}.receiptToolbar label{display:flex;flex-direction:column;gap:4px;font-size:10px;font-weight:900;color:var(--muted,#64748b)}.receiptToolbar select,.receiptToolbar input{height:35px;border:1px solid var(--border,#d1d5db);border-radius:7px;background:var(--surface,#fff);padding:0 9px;color:inherit}.receiptSearch{min-width:260px;flex:1}.receiptBtn{height:35px;border:1px solid var(--border,#d1d5db);background:var(--surface,#fff);border-radius:7px;padding:0 11px;font-size:10px;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:5px}.receiptBtn:disabled{opacity:.5;cursor:not-allowed}
      .receiptTableWrap{overflow:auto;border:1px solid var(--border,#d1d5db);border-radius:10px;background:var(--surface,#fff)}.receiptTable{width:100%;border-collapse:collapse;white-space:nowrap;font-size:11px}.receiptTable th{background:var(--surface-2,#f8fafc);font-size:10px;text-align:left;padding:9px;border-bottom:1px solid var(--border,#e5e7eb)}.receiptTable td{padding:9px;border-bottom:1px solid var(--border,#eef2f7)}.receiptTable tr:last-child td{border-bottom:0}.receiptAmount{font-weight:900;text-align:right}.receiptBadge{display:inline-block;padding:3px 7px;border-radius:999px;border:1px solid currentColor;font-size:9px;font-weight:900}.receiptBadge.ok{color:#047857}.receiptBadge.warn{color:#b45309}.receiptBadge.neutral{color:#64748b}.receiptState{padding:35px;text-align:center;color:var(--muted,#64748b);font-weight:800}
      .receiptSection{font-size:12px;font-weight:900;margin:5px 0;color:var(--text,#1e293b)}.receiptBatch{background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:10px;overflow:hidden;margin-bottom:10px}.receiptBatchHead{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px;background:var(--surface-2,#f8fafc)}.receiptBatchHead strong{font-size:13px}.receiptBatchMeta{font-size:10px;color:var(--muted,#64748b);margin-top:4px}.receiptBatchTotal{font-size:15px;font-weight:900;margin-left:auto}.receiptBatchBody{padding:0 12px 12px}.receiptBatchTotals{display:flex;flex-wrap:wrap;gap:18px;padding:9px 0;font-size:11px;font-weight:800}.batchOtp{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.otpCode{padding:7px 10px;border:1px solid #f59e0b;border-radius:8px;background:#fffbeb;color:#92400e;font-size:13px;font-weight:900;letter-spacing:.5px}.otpExpiry{font-size:10px;color:var(--muted,#64748b);font-weight:800}.receiptPendingNote{font-size:11px;color:var(--muted,#64748b);margin:2px 0 8px}.receiptSingleOtp{min-width:190px}.receiptBatchTitleRow{display:flex;align-items:center;justify-content:space-between;gap:12px}.receiptEmpty{padding:30px;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:10px;color:var(--muted,#64748b)}
    `}</style>
    {tab === "PENDING" && <PageHeader title="Pending Receipts" description="Cashier OTPs and salesperson handover bundles are managed here; direct receipts are created from the Receipts List tab." />}
    <div className="receiptTabs">
      <button className={tab === "LIST" ? "active" : ""} onClick={() => setTab("LIST")}>RECEIPTS LIST</button>
      <button className={tab === "PENDING" ? "active" : ""} onClick={() => setTab("PENDING")}>PENDING RECEIPTS ({pendingCount})</button>
    </div>
    {tab === "PENDING" && <div className="receiptToolbar">
      <label>FINANCIAL YEAR<select value={fy} onChange={(e) => setFy(e.target.value)}>{years.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
      <label className="receiptSearch">SEARCH<div style={{position:"relative"}}><Search size={15} style={{position:"absolute",left:9,top:10}}/><input style={{width:"100%",paddingLeft:30}} value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Receipt / party / salesperson / bundle / mode" /></div></label>
      <button className="receiptBtn" onClick={() => load()}><RefreshCw size={14}/>REFRESH</button>
    </div>}
    {tab === "PENDING" && error ? <div className="resultBanner bad">{error}</div> : null}
    {tab === "LIST" ? <FinancialEntryPage type="receipts" /> : loading ? <div className="receiptState">LOADING RECEIPTS...</div> :
      <>
        <p className="receiptPendingNote">The DMS user reads the OTP below and gives it to the salesperson. Cashier OTP marks receipts paid after salesperson verification. Cashier → Pending Handover remains responsible for recording the physical handover separately. Cash denominations apply only to the CASH portion.</p>
        {bundles.length > 0 && <section><div className="receiptSection">MULTI-RECEIPT BUNDLES ({bundles.length})</div>
          {bundles.map(h => {
            const rows = h.receiptBreakdown || [];
            const open = expanded[h._id] !== false;
            return <div className="receiptBatch" key={h._id}>
              <div className="receiptBatchHead"><div><strong>BUNDLE {h.movementNo}</strong><div className="receiptBatchMeta">{rows.length} RECEIPTS • {h.salespersonName || "—"} • {dateOnly(h.date)}</div></div><span className={`receiptBadge ${badgeClass(h.handoverWorkflowStatus)}`}>{label(h.handoverWorkflowStatus)}</span><div className="receiptBatchTotal">{money(h.amount)}</div>{batchOtp(h)}<button className="receiptBtn" onClick={() => setExpanded(x => ({...x, [h._id]: !open}))}>{open ? "HIDE" : "VIEW"} RECEIPTS ({rows.length})</button></div>
              {open && <div className="receiptBatchBody"><div className="receiptBatchTotals"><span>CASH: {money(h.cashAmount)}</span><span>BANK: {money(h.bankAmount)}</span><span>RECEIVER: {h.cashierName || "—"}</span></div>
                <div className="receiptTableWrap"><table className="receiptTable"><thead><tr><th>RECEIPT NO.</th><th>PARTY</th><th>PAYMENT MODE</th><th style={{textAlign:"right"}}>AMOUNT</th></tr></thead><tbody>{rows.map(r => <tr key={r.receiptId || r.receiptNo}><td><strong>{r.receiptNo || "—"}</strong></td><td>{r.customerNameSnapshot || "—"}</td><td>{paymentLabel(r)}</td><td className="receiptAmount">{money(r.amount)}</td></tr>)}</tbody></table></div>
              </div>}
            </div>;
          })}
        </section>}
        {(singles.length > 0 || filteredLegacy.length > 0) && <section><div className="receiptSection">INDIVIDUAL PENDING RECEIPTS ({singles.length + filteredLegacy.length})</div>
          <div className="receiptTableWrap"><table className="receiptTable"><thead><tr><th>RECEIPT NO.</th><th>DATE</th><th>PARTY</th><th style={{textAlign:"right"}}>AMOUNT</th><th>PAYMENT MODE</th><th>MADE BY</th><th>STATUS</th><th>CASHIER OTP</th></tr></thead><tbody>
            {singles.map(h => {const r = h.receiptBreakdown[0]; return <tr key={h._id}><td><strong>{r.receiptNo || "—"}</strong></td><td>{dateOnly(h.date)}</td><td>{r.customerNameSnapshot || "—"}</td><td className="receiptAmount">{money(r.amount)}</td><td>{paymentLabel(r)}</td><td>{h.salespersonName || "—"}</td><td><span className={`receiptBadge ${badgeClass(h.handoverWorkflowStatus)}`}>{label(h.handoverWorkflowStatus)}</span></td><td className="receiptSingleOtp">{batchOtp(h)}</td></tr>;})}
            {filteredLegacy.map(r => <tr key={r._id || r.receiptNo}><td><strong>{r.receiptNo || "—"}</strong></td><td>{dateOnly(r.date)}</td><td>{r.partyNameSnapshot || r.customerGlobalId || "—"}</td><td className="receiptAmount">{money(r.amount)}</td><td>{paymentLabel(r)}</td><td>{r.collectedBySalespersonNameSnapshot || r.createdByNameSnapshot || "—"}</td><td><span className={`receiptBadge ${badgeClass(r.status)}`}>{label(r.status)}</span></td><td><button className="receiptBtn" disabled={otpBusy === String(r._id)} onClick={() => seeOtp(r)}><Eye size={14}/>{otpBusy === String(r._id) ? "LOADING..." : "SEE OTP"}</button></td></tr>)}
          </tbody></table></div>
        </section>}
        {!bundles.length && !singles.length && !filteredLegacy.length && <div className="receiptEmpty">NO PENDING RECEIPTS OR HANDOVER BUNDLES FOR THIS FINANCIAL YEAR.</div>}
      </>}
  </div>;
}
