import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrainCircuit, Users, Landmark, Upload, CheckCircle2, AlertTriangle, RefreshCw,
  BookOpenCheck, FileBarChart, FileText, LockKeyhole, Plus, Sparkles, Search,
  ChevronRight, IndianRupee, ShieldCheck, WandSparkles, Building2, X,
} from "lucide-react";
import { api } from "../lib/api.js";
import "../family-finance.css";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const pct = (v) => `${Math.round(Number(v || 0))}%`;
const todayFy = () => {
  const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String(y + 1).slice(-2)}`;
};
const fyOptions = () => {
  const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return Array.from({ length: 7 }, (_, i) => `${y - i}-${String(y - i + 1).slice(-2)}`);
};
const dateText = (v) => v ? new Date(v).toLocaleDateString("en-IN") : "—";
const cls = (...x) => x.filter(Boolean).join(" ");

const TABS = [
  ["OVERVIEW", "Family Dashboard", Users],
  ["ASSESSEES", "Assessees", ShieldCheck],
  ["BANKS", "Banks & Import", Landmark],
  ["REVIEW", "AI Review Queue", BrainCircuit],
  ["BOOKS", "Live Books", BookOpenCheck],
  ["HISTORY", "3-Year Migration", FileBarChart],
  ["ITR", "ITR Center", FileText],
];

function Score({ value = 0 }) {
  const tone = value >= 90 ? "good" : value >= 70 ? "warn" : "bad";
  return <span className={`pf-score ${tone}`}>{pct(value)}</span>;
}
function Status({ value }) {
  const t = String(value || "").toUpperCase();
  const tone = /APPROVED|AUTO_POSTED|MATCHED|FILED|LOCKED|ACTIVE/.test(t) ? "good" : /PENDING|SUGGESTED|REVIEW|READY/.test(t) ? "warn" : "neutral";
  return <span className={`pf-status ${tone}`}>{t.replaceAll("_", " ") || "—"}</span>;
}

export default function FamilyFinancePage() {
  const [tab, setTab] = useState("OVERVIEW");
  const [financialYear, setFinancialYear] = useState(todayFy());
  const [assessees, setAssessees] = useState([]);
  const [assesseeId, setAssesseeId] = useState("");
  const [dashboard, setDashboard] = useState({ rows: [], totals: {} });
  const [banks, setBanks] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [feed, setFeed] = useState([]);
  const [statements, setStatements] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [taxRecon, setTaxRecon] = useState(null);
  const [history, setHistory] = useState([]);
  const [taxDocs, setTaxDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [newAssessee, setNewAssessee] = useState({ displayName: "", legalName: "", entityType: "INDIVIDUAL", relation: "", pan: "", mobile: "", email: "", openingFinancialYear: todayFy() });
  const [newBank, setNewBank] = useState({ accountName: "", bankName: "", branchName: "", accountNumber: "", ifsc: "", accountType: "SAVINGS", openingBalance: "", openingBalanceType: "DR", openingBalanceDate: "" });
  const [reviewEdits, setReviewEdits] = useState({});

  const selected = useMemo(() => assessees.find((x) => x.assesseeId === assesseeId), [assessees, assesseeId]);
  const pendingFeed = useMemo(() => feed.filter((x) => ["PENDING", "SUGGESTED"].includes(x.reviewStatus)), [feed]);
  const filteredFeed = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pendingFeed.filter((x) => !q || `${x.narration} ${x.reference} ${x.suggestedLedgerName}`.toLowerCase().includes(q));
  }, [pendingFeed, query]);

  const run = useCallback(async (fn, success = "") => {
    setBusy(true); setError(""); setMessage("");
    try { const result = await fn(); if (success) setMessage(success); return result; }
    catch (e) { setError(e.message || String(e)); return null; }
    finally { setBusy(false); }
  }, []);

  const loadAssessees = useCallback(async () => {
    const rows = await api("/transactions/personal-finance/assessees");
    setAssessees(rows || []);
    setAssesseeId((old) => old || rows?.[0]?.assesseeId || "");
  }, []);
  const loadDashboard = useCallback(async () => {
    const data = await api(`/transactions/personal-finance/dashboard?financialYear=${encodeURIComponent(financialYear)}`);
    setDashboard(data || { rows: [], totals: {} });
  }, [financialYear]);
  const loadSelected = useCallback(async () => {
    if (!assesseeId) return;
    const base = `/transactions/personal-finance/assessees/${encodeURIComponent(assesseeId)}`;
    const [b, l, f, s, r, h, td, tr] = await Promise.all([
      api(`${base}/banks`), api(`${base}/ledgers`), api(`${base}/bank-feed?financialYear=${encodeURIComponent(financialYear)}&limit=700`),
      api(`${base}/statements?financialYear=${encodeURIComponent(financialYear)}`), api(`${base}/itr-readiness?financialYear=${encodeURIComponent(financialYear)}`),
      api(`${base}/historical`), api(`${base}/tax-documents`), api(`${base}/tax-reconciliation?financialYear=${encodeURIComponent(financialYear)}`),
    ]);
    setBanks(b || []); setLedgers(l || []); setFeed(f || []); setStatements(s || null); setReadiness(r || null); setHistory(h || []); setTaxDocs(td || []); setTaxRecon(tr || null);
  }, [assesseeId, financialYear]);

  useEffect(() => { run(async () => { await Promise.all([loadAssessees(), loadDashboard()]); }); }, [loadAssessees, loadDashboard, run]);
  useEffect(() => { if (assesseeId) run(loadSelected); }, [assesseeId, financialYear, loadSelected, run]);

  const refreshAll = () => run(async () => { await loadAssessees(); await loadDashboard(); if (assesseeId) await loadSelected(); }, "Data refreshed");

  const createAssessee = () => run(async () => {
    if (!newAssessee.displayName.trim()) throw new Error("Name is required");
    await api("/transactions/personal-finance/assessees", { method: "POST", body: JSON.stringify(newAssessee) });
    setNewAssessee({ displayName: "", legalName: "", entityType: "INDIVIDUAL", relation: "", pan: "", mobile: "", email: "", openingFinancialYear: financialYear });
    await loadAssessees(); await loadDashboard();
  }, "Assessee created");

  const addBank = () => run(async () => {
    if (!assesseeId) throw new Error("Select an assessee");
    if (!newBank.bankName.trim() || !newBank.accountNumber.trim()) throw new Error("Bank name and account number are required");
    await api(`/transactions/personal-finance/assessees/${assesseeId}/banks`, { method: "POST", body: JSON.stringify(newBank) });
    setNewBank({ accountName: "", bankName: "", branchName: "", accountNumber: "", ifsc: "", accountType: "SAVINGS", openingBalance: "", openingBalanceType: "DR", openingBalanceDate: "" });
    await loadSelected();
  }, "Bank account added");

  const importBankMaster = (e) => run(async () => {
    e.preventDefault();
    const form = e.currentTarget; const file = form.file.files?.[0];
    if (!file) throw new Error("Select bank master Excel/CSV");
    const fd = new FormData(); fd.append("file", file);
    await api("/transactions/personal-finance/banks/bulk-upload", { method: "POST", body: fd }); form.reset(); await loadAssessees(); await loadSelected(); await loadDashboard();
  }, "Bank master imported");

  const importBank = (e) => run(async () => {
    e.preventDefault();
    const form = e.currentTarget; const file = form.statement.files?.[0]; const bankAccountId = form.bankAccountId.value;
    if (!file || !bankAccountId) throw new Error("Select bank account and statement file");
    const fd = new FormData(); fd.append("statement", file); fd.append("assesseeId", assesseeId); fd.append("bankAccountId", bankAccountId);
    await api("/transactions/personal-finance/bank-import", { method: "POST", body: fd }); form.reset(); await loadSelected(); await loadDashboard();
  }, "Bank statement imported and classified");

  const aiClassify = () => run(async () => {
    await api(`/transactions/personal-finance/assessees/${assesseeId}/ai-classify`, { method: "POST", body: JSON.stringify({ deepAi: true, autoPost: true }) });
    await loadSelected(); await loadDashboard();
  }, "AI classification refreshed");

  const editFor = (row) => reviewEdits[row._id] || { ledgerId: row.suggestedLedgerId || "SYS-SUSPENSE", businessPct: row.suggestedBusinessPct ?? 100 };
  const setEdit = (id, patch) => setReviewEdits((x) => ({ ...x, [id]: { ...(x[id] || {}), ...patch } }));
  const approveFeed = (row) => run(async () => {
    const edit = editFor(row);
    await api(`/transactions/personal-finance/assessees/${assesseeId}/bank-feed/${row._id}/approve`, { method: "POST", body: JSON.stringify({ ledgerId: edit.ledgerId, businessPct: edit.businessPct, learnRule: true }) });
    await loadSelected(); await loadDashboard();
  }, "Transaction posted; AI rule learned");

  const uploadHistory = (e) => run(async () => {
    e.preventDefault(); const form = e.currentTarget; const file = form.document.files?.[0]; if (!file) throw new Error("Select a historical statement");
    const fd = new FormData(); fd.append("document", file); fd.append("assesseeId", assesseeId); fd.append("financialYear", form.financialYear.value); fd.append("statementType", form.statementType.value);
    await api("/transactions/personal-finance/historical/upload", { method: "POST", body: fd }); form.reset(); await loadSelected();
  }, "Historical statement extracted");

  const applyOpening = (row) => run(async () => {
    if (!window.confirm(`Apply ${row.financialYear} Balance Sheet as next-year opening balances?`)) return;
    await api(`/transactions/personal-finance/historical/${row.statementId}/apply-opening`, { method: "POST", body: JSON.stringify({}) }); await loadSelected(); await loadDashboard();
  }, "Opening balances created");

  const uploadTaxDoc = (e) => run(async () => {
    e.preventDefault(); const form = e.currentTarget; const file = form.document.files?.[0]; if (!file) throw new Error("Select a document");
    const fd = new FormData(); fd.append("document", file); fd.append("assesseeId", assesseeId); fd.append("financialYear", financialYear); fd.append("documentType", form.documentType.value); fd.append("assessmentYear", form.assessmentYear.value || "");
    await api("/transactions/personal-finance/tax-documents/upload", { method: "POST", body: fd }); form.reset(); await loadSelected();
  }, "Tax document uploaded and extracted");

  const lockYear = (status) => run(async () => {
    const reason = status === "REOPENED" ? window.prompt("Reason for reopening this year?") : "";
    if (status === "REOPENED" && !reason) return;
    await api(`/transactions/personal-finance/assessees/${assesseeId}/year-lock`, { method: "POST", body: JSON.stringify({ financialYear, status, reason }) });
    await loadSelected();
  }, `Financial year marked ${status}`);

  return <div className="pf-page">
    <div className="pf-hero">
      <div>
        <div className="pf-eyebrow"><BrainCircuit size={16}/> AI FAMILY OFFICE</div>
        <h1>Personal Accounts & ITR Intelligence</h1>
        <p>Live books for every individual/HUF: multi-bank AI classification, historical migration, Trading/P&amp;L/Balance Sheet, tax reconciliation and ITR readiness.</p>
      </div>
      <div className="pf-hero-actions">
        <select value={financialYear} onChange={(e) => setFinancialYear(e.target.value)}>{fyOptions().map((x) => <option key={x}>{x}</option>)}</select>
        <button className="pf-btn secondary" onClick={refreshAll} disabled={busy}><RefreshCw size={16}/> Refresh</button>
      </div>
    </div>

    {(message || error) && <div className={cls("pf-alert", error ? "error" : "success")}><span>{error || message}</span><button onClick={() => { setError(""); setMessage(""); }}><X size={16}/></button></div>}

    <div className="pf-tabs">{TABS.map(([key, label, Icon]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}><Icon size={16}/>{label}{key === "REVIEW" && pendingFeed.length > 0 && <b>{pendingFeed.length}</b>}</button>)}</div>

    {tab !== "OVERVIEW" && tab !== "ASSESSEES" && <div className="pf-context">
      <div><span>Working on</span><select value={assesseeId} onChange={(e) => setAssesseeId(e.target.value)}>{assessees.map((a) => <option key={a.assesseeId} value={a.assesseeId}>{a.displayName} • {a.entityType}</option>)}</select></div>
      <div className="pf-context-meta">{selected?.pan ? `PAN ${selected.pan}` : "PAN pending"} · FY {financialYear}</div>
    </div>}

    {tab === "OVERVIEW" && <>
      <div className="pf-kpis">
        <div><Landmark/><span>Family Bank Balance</span><strong>{money(dashboard.totals?.bankBalance)}</strong></div>
        <div><IndianRupee/><span>Investments</span><strong>{money(dashboard.totals?.investments)}</strong></div>
        <div><Building2/><span>Property</span><strong>{money(dashboard.totals?.property)}</strong></div>
        <div><ShieldCheck/><span>Consolidated Net Worth</span><strong>{money(dashboard.totals?.netWorth)}</strong></div>
        <div className={dashboard.totals?.pendingReview ? "attention" : ""}><BrainCircuit/><span>AI Review Pending</span><strong>{dashboard.totals?.pendingReview || 0}</strong></div>
      </div>
      <section className="pf-card">
        <div className="pf-card-head"><div><h2>Family Financial Position</h2><p>Tax books stay legally separate; this view is management-only consolidation.</p></div><button className="pf-btn" onClick={() => setTab("ASSESSEES")}><Plus size={16}/> Add Assessee</button></div>
        <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Assessee</th><th>Type</th><th>Banks</th><th>Bank</th><th>Investments</th><th>Property</th><th>YTD Profit</th><th>Net Worth</th><th>ITR Ready</th><th>Review</th></tr></thead><tbody>{(dashboard.rows || []).map((r) => <tr key={r.assesseeId} onClick={() => { setAssesseeId(r.assesseeId); setTab("ITR"); }} className="clickable"><td><strong>{r.name}</strong><small>{r.pan || "PAN pending"}</small></td><td>{r.entityType}</td><td>{r.bankAccounts}</td><td>{money(r.bankBalance)}</td><td>{money(r.investments)}</td><td>{money(r.property)}</td><td>{money(r.netProfit)}</td><td><strong>{money(r.netWorth)}</strong></td><td><Score value={r.itrReadiness}/></td><td>{r.pendingReview ? <span className="pf-badge warn">{r.pendingReview}</span> : <CheckCircle2 className="ok" size={18}/>}</td></tr>)}</tbody></table></div>
      </section>
      <div className="pf-ai-banner"><WandSparkles/><div><strong>AI operating rule</strong><p>Approved recurring patterns can auto-post at very high confidence. New, tax-sensitive or ambiguous transactions always stay in Review Queue.</p></div></div>
    </>}

    {tab === "ASSESSEES" && <div className="pf-grid two">
      <section className="pf-card"><div className="pf-card-head"><div><h2>Assessee Master</h2><p>Individuals and legally separate HUFs remain independent books.</p></div></div>
        <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Name</th><th>Relation</th><th>Type</th><th>PAN</th><th>Status</th><th></th></tr></thead><tbody>{assessees.map((a) => <tr key={a.assesseeId}><td><strong>{a.displayName}</strong><small>{a.email || a.mobile || a.assesseeId}</small></td><td>{a.relation || "—"}</td><td>{a.entityType}</td><td>{a.pan || "—"}</td><td><Status value={a.status}/></td><td><button className="pf-icon-btn" onClick={() => { setAssesseeId(a.assesseeId); setTab("BANKS"); }}><ChevronRight size={18}/></button></td></tr>)}</tbody></table></div>
      </section>
      <section className="pf-card form-card"><h2>Add Individual / HUF</h2><div className="pf-form-grid">
        <label>Name<input value={newAssessee.displayName} onChange={(e) => setNewAssessee({ ...newAssessee, displayName: e.target.value })}/></label>
        <label>Legal Name<input value={newAssessee.legalName} onChange={(e) => setNewAssessee({ ...newAssessee, legalName: e.target.value })}/></label>
        <label>Entity Type<select value={newAssessee.entityType} onChange={(e) => setNewAssessee({ ...newAssessee, entityType: e.target.value })}><option>INDIVIDUAL</option><option>HUF</option><option>OTHER</option></select></label>
        <label>Relationship<input value={newAssessee.relation} onChange={(e) => setNewAssessee({ ...newAssessee, relation: e.target.value })} placeholder="Self / Spouse / Father / Mother"/></label>
        <label>PAN<input value={newAssessee.pan} onChange={(e) => setNewAssessee({ ...newAssessee, pan: e.target.value.toUpperCase() })}/></label>
        <label>Mobile<input value={newAssessee.mobile} onChange={(e) => setNewAssessee({ ...newAssessee, mobile: e.target.value })}/></label>
        <label>Email<input value={newAssessee.email} onChange={(e) => setNewAssessee({ ...newAssessee, email: e.target.value })}/></label>
        <label>Opening FY<select value={newAssessee.openingFinancialYear} onChange={(e) => setNewAssessee({ ...newAssessee, openingFinancialYear: e.target.value })}>{fyOptions().map((x) => <option key={x}>{x}</option>)}</select></label>
      </div><button className="pf-btn full" onClick={createAssessee} disabled={busy}><Plus size={16}/> Create Assessee & Default Ledgers</button></section>
    </div>}

    {tab === "BANKS" && <>
      <div className="pf-grid two">
        <section className="pf-card"><div className="pf-card-head"><div><h2>Bank Accounts</h2><p>Unlimited accounts per assessee. Each bank has its own ledger.</p></div></div>
          <div className="pf-bank-list">{banks.map((b) => <div className="pf-bank" key={b.accountId}><Landmark/><div><strong>{b.accountName || b.bankName}</strong><span>{b.bankName} · {b.accountNumberMasked}</span><small>{b.ifsc || "IFSC not entered"} · {b.accountType}</small></div><div><b>{money(b.currentBalanceSnapshot)}</b><small>{b.currentBalanceAsOf ? `as on ${dateText(b.currentBalanceAsOf)}` : `${b.statementImportCount || 0} import(s)`}</small></div></div>)}{!banks.length && <div className="pf-empty">Add the first bank account for this assessee.</div>}</div>
        </section>
        <section className="pf-card form-card"><h2>Add Bank Account</h2><div className="pf-form-grid compact">
          <label>Account Name<input value={newBank.accountName} onChange={(e) => setNewBank({ ...newBank, accountName: e.target.value })}/></label><label>Bank Name<input value={newBank.bankName} onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })}/></label>
          <label>Account Number<input value={newBank.accountNumber} onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })}/></label><label>IFSC<input value={newBank.ifsc} onChange={(e) => setNewBank({ ...newBank, ifsc: e.target.value.toUpperCase() })}/></label>
          <label>Type<select value={newBank.accountType} onChange={(e) => setNewBank({ ...newBank, accountType: e.target.value })}><option>SAVINGS</option><option>CURRENT</option><option>OD</option><option>CC</option><option>LOAN</option></select></label><label>Opening Balance<input type="number" value={newBank.openingBalance} onChange={(e) => setNewBank({ ...newBank, openingBalance: e.target.value })}/></label>
          <label>Opening Side<select value={newBank.openingBalanceType} onChange={(e) => setNewBank({ ...newBank, openingBalanceType: e.target.value })}><option>DR</option><option>CR</option></select></label><label>Opening Date<input type="date" value={newBank.openingBalanceDate} onChange={(e) => setNewBank({ ...newBank, openingBalanceDate: e.target.value })}/></label>
        </div><button className="pf-btn full" onClick={addBank}><Plus size={16}/> Add Bank</button></section>
      </div>
      <section className="pf-card import-card"><div><Upload size={24}/><h2>Bulk Bank Account Master</h2><p>One Excel/CSV can create or update bank accounts across all family assessees. Columns can include Assessee/Name/PAN, Bank Name, Account Number, IFSC, Account Type, Opening Balance, Opening Side and Opening Date.</p></div><form onSubmit={importBankMaster}><input name="file" type="file" accept=".xlsx,.xls,.csv" required/><button className="pf-btn secondary" disabled={busy}><Upload size={16}/> Import Bank Master</button></form></section>
      <section className="pf-card import-card"><div><Upload size={24}/><h2>Bulk Bank Statement Import</h2><p>Excel/CSV imports locally. PDF/image statements use AI document reading. Duplicate rows are ignored automatically.</p></div><form onSubmit={importBank}><select name="bankAccountId" required defaultValue=""><option value="">Select Bank Account</option>{banks.map((b) => <option key={b.accountId} value={b.accountId}>{b.accountName || b.bankName} · {b.accountNumberMasked}</option>)}</select><input name="statement" type="file" accept=".xlsx,.xls,.csv,.pdf,image/*" required/><button className="pf-btn" disabled={busy}><Sparkles size={16}/> Import + AI Classify</button></form></section>
    </>}

    {tab === "REVIEW" && <section className="pf-card">
      <div className="pf-card-head"><div><h2>AI Review Queue</h2><p>Approve, correct once, and the engine learns the recurring narration pattern.</p></div><div className="pf-head-actions"><div className="pf-search"><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search narration..."/></div><button className="pf-btn" onClick={aiClassify} disabled={busy}><BrainCircuit size={16}/> Deep AI + Auto-post trusted rules</button></div></div>
      <div className="pf-review-summary"><span><b>{pendingFeed.length}</b> pending</span><span><b>{feed.filter((x) => x.reviewStatus === "AUTO_POSTED").length}</b> auto-posted</span><span><b>{feed.filter((x) => x.reviewStatus === "APPROVED").length}</b> reviewed</span></div>
      <div className="pf-table-wrap"><table className="pf-table review"><thead><tr><th>Date</th><th>Bank Narration</th><th>Amount</th><th>AI Suggestion</th><th>Confidence</th><th>Final Ledger</th><th>Business %</th><th></th></tr></thead><tbody>{filteredFeed.map((r) => { const edit = editFor(r); return <tr key={r._id}><td>{dateText(r.date)}</td><td><strong>{r.narration || "—"}</strong><small>{r.reference || r.suggestedClassification || ""}</small></td><td className={r.credit ? "credit" : "debit"}>{r.credit ? `+${money(r.credit)}` : `-${money(r.debit)}`}</td><td><strong>{r.suggestedLedgerName || "Review"}</strong><small>{r.aiExplanation || ""}</small></td><td><Score value={(r.aiConfidence || 0) * 100}/></td><td><select value={edit.ledgerId} onChange={(e) => setEdit(r._id, { ledgerId: e.target.value })}>{ledgers.map((l) => <option key={l.ledgerId} value={l.ledgerId}>{l.name}</option>)}</select></td><td><input className="pct-input" type="number" min="0" max="100" value={edit.businessPct} onChange={(e) => setEdit(r._id, { businessPct: e.target.value })}/></td><td><button className="pf-btn tiny" onClick={() => approveFeed(r)}><CheckCircle2 size={15}/> Approve</button></td></tr>; })}{!filteredFeed.length && <tr><td colSpan="8"><div className="pf-empty good"><CheckCircle2/> No transactions waiting for review.</div></td></tr>}</tbody></table></div>
    </section>}

    {tab === "BOOKS" && statements && <>
      <div className="pf-kpis books"><div><span>Gross Profit</span><strong>{money(statements.trading?.grossProfit)}</strong></div><div><span>Net Profit</span><strong>{money(statements.pnl?.netProfit)}</strong></div><div><span>Total Assets</span><strong>{money(statements.balanceSheet?.totalAssets)}</strong></div><div><span>Capital</span><strong>{money(statements.balanceSheet?.capital)}</strong></div><div className={Math.abs(statements.balanceSheet?.difference || 0) > 1 ? "attention" : ""}><span>BS Difference</span><strong>{money(statements.balanceSheet?.difference)}</strong></div></div>
      <div className="pf-grid two statement-grid">
        <StatementCard title="Trading Account" rows={statements.trading?.rows || []} netLabel="Gross Profit" netValue={statements.trading?.grossProfit}/>
        <StatementCard title="Profit & Loss" rows={statements.pnl?.rows || []} netLabel="Net Profit" netValue={statements.pnl?.netProfit}/>
      </div>
      <div className="pf-grid two statement-grid"><BalanceColumn title="Assets" rows={statements.balanceSheet?.assets || []} total={statements.balanceSheet?.totalAssets}/><BalanceColumn title="Liabilities & Capital" rows={[...(statements.balanceSheet?.liabilities || []), { name: "Adjusted Capital", amount: statements.balanceSheet?.capital }]} total={statements.balanceSheet?.totalLiabilities}/></div>
      <section className="pf-card"><div className="pf-card-head"><div><h2>Trial Balance</h2><p>Every live journal rolls up here in real time.</p></div></div><div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Ledger</th><th>Group</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{(statements.trialBalance || []).map((r) => <tr key={r.ledgerId}><td>{r.ledgerName}</td><td>{r.group || r.nature}</td><td>{r.debit ? money(r.debit) : ""}</td><td>{r.credit ? money(r.credit) : ""}</td></tr>)}</tbody></table></div></section>
    </>}

    {tab === "HISTORY" && <div className="pf-grid history-layout">
      <section className="pf-card"><div className="pf-card-head"><div><h2>3-Year Financial History</h2><p>Upload old Balance Sheet, Trading, P&amp;L or Trial Balance. AI extracts lines and preserves the source document.</p></div></div><div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>FY</th><th>Statement</th><th>Lines</th><th>Engine</th><th>Status</th><th></th></tr></thead><tbody>{history.map((h) => <tr key={h.statementId}><td>{h.financialYear}</td><td>{h.statementType.replaceAll("_", " ")}</td><td>{h.items?.length || 0}</td><td>{h.extractionEngine}</td><td><Status value={h.status}/></td><td>{h.statementType === "BALANCE_SHEET" && h.status !== "APPLIED" && <button className="pf-btn tiny" onClick={() => applyOpening(h)}>Create Next FY Opening</button>}</td></tr>)}</tbody></table></div></section>
      <section className="pf-card form-card"><h2>Import Historical Statement</h2><form className="pf-upload-form" onSubmit={uploadHistory}><label>Financial Year<select name="financialYear" defaultValue={financialYear}>{fyOptions().map((x) => <option key={x}>{x}</option>)}</select></label><label>Statement Type<select name="statementType"><option>BALANCE_SHEET</option><option>TRADING</option><option>PNL</option><option>TRIAL_BALANCE</option></select></label><label>PDF / Image / Excel<input name="document" type="file" accept=".xlsx,.xls,.csv,.pdf,image/*" required/></label><button className="pf-btn"><Sparkles size={16}/> AI Extract</button></form><div className="pf-tip"><AlertTriangle size={18}/><span>Review extracted historical balances before applying a Balance Sheet as next-year opening balances.</span></div></section>
    </div>}

    {tab === "ITR" && <>
      <div className="pf-grid itr-top">
        <section className="pf-card readiness"><div className="readiness-ring"><strong>{readiness?.overall || 0}%</strong><span>ITR Ready</span></div><div className="readiness-body"><h2>{selected?.displayName}</h2><p>FY {financialYear} · Continuous filing readiness</p><div className="score-grid">{Object.entries(readiness?.scores || {}).map(([k, v]) => <div key={k}><span>{k.replaceAll(/([A-Z])/g, " $1")}</span><Score value={v}/></div>)}</div></div></section>
        <section className="pf-card"><div className="pf-card-head"><div><h2>AIS / 26AS Reconciliation</h2><p>Reported information compared with live books.</p></div></div><div className="recon-box"><div><span>Book Income</span><strong>{money(taxRecon?.bookIncome)}</strong></div><div><span>Reported Docs</span><strong>{money(taxRecon?.reportedIncome)}</strong></div><div><span>Difference</span><strong>{money(taxRecon?.difference)}</strong></div><div><span>Reported TDS</span><strong>{money(taxRecon?.reportedTds)}</strong></div><Status value={taxRecon?.status}/></div></section>
      </div>
      <div className="pf-grid two">
        <section className="pf-card"><div className="pf-card-head"><div><h2>AI Filing Exceptions</h2><p>Resolve these before filing.</p></div></div><div className="issue-list">{(readiness?.issues || []).map((i) => <div key={i.code} className={`issue ${i.severity.toLowerCase()}`}><AlertTriangle size={18}/><div><strong>{i.code.replaceAll("_", " ")}</strong><span>{i.text}</span></div></div>)}{!(readiness?.issues || []).length && <div className="pf-empty good"><CheckCircle2/> No filing exception detected.</div>}</div></section>
        <section className="pf-card form-card"><h2>Upload Tax / Investment Document</h2><form className="pf-upload-form" onSubmit={uploadTaxDoc}><label>Document Type<select name="documentType"><option>AIS</option><option>26AS</option><option>FORM16</option><option>FORM16A</option><option>TAX_CHALLAN</option><option>LOAN_STATEMENT</option><option>DEMAT</option><option>CAPITAL_GAIN</option><option>PROPERTY</option><option>INSURANCE</option><option>OTHER</option></select></label><label>Assessment Year<input name="assessmentYear" placeholder="2027-28"/></label><label>PDF / Image / Excel<input name="document" type="file" accept=".xlsx,.xls,.csv,.pdf,image/*" required/></label><button className="pf-btn"><BrainCircuit size={16}/> Scan + Reconcile</button></form></section>
      </div>
      <section className="pf-card"><div className="pf-card-head"><div><h2>Document Vault</h2><p>Every extracted figure stays linked to its original source.</p></div><div className="pf-head-actions"><button className="pf-btn secondary" onClick={() => lockYear("READY")}><CheckCircle2 size={16}/> Mark Ready</button><button className="pf-btn secondary" onClick={() => lockYear("LOCKED")}><LockKeyhole size={16}/> Lock FY</button><button className="pf-btn ghost" onClick={() => lockYear("REOPENED")}>Reopen</button></div></div><div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Date</th><th>Type</th><th>File</th><th>FY</th><th>Engine</th><th>Items</th><th>Status</th></tr></thead><tbody>{taxDocs.map((d) => <tr key={d.documentId}><td>{dateText(d.createdAt)}</td><td>{d.documentType}</td><td>{d.fileName}</td><td>{d.financialYear}</td><td>{d.extractionEngine}</td><td>{d.items?.length || 0}</td><td><Status value={d.status}/></td></tr>)}</tbody></table></div></section>
    </>}

    {busy && <div className="pf-busy"><RefreshCw className="spin"/> Processing…</div>}
  </div>;
}

function StatementCard({ title, rows, netLabel, netValue }) {
  return <section className="pf-card statement"><div className="pf-card-head"><h2>{title}</h2></div><div className="statement-lines">{rows.map((r) => <div key={r.ledgerId}><span>{r.name}</span><b>{money(Math.abs((r.debit || 0) - (r.credit || 0)))}</b></div>)}<div className="statement-total"><span>{netLabel}</span><strong>{money(netValue)}</strong></div></div></section>;
}
function BalanceColumn({ title, rows, total }) {
  return <section className="pf-card statement"><div className="pf-card-head"><h2>{title}</h2></div><div className="statement-lines">{rows.map((r, i) => <div key={r.ledgerId || i}><span>{r.name || r.ledgerName}</span><b>{money(r.amount)}</b></div>)}<div className="statement-total"><span>Total</span><strong>{money(total)}</strong></div></div></section>;
}
