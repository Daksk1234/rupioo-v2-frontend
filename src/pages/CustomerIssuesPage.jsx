import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Save } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { api } from "../lib/api.js";

const date = (v) => v ? new Date(v).toLocaleString("en-IN") : "—";
const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const statusChoices = {
  tickets: ["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED", "CLOSED"],
  damage: ["SUBMITTED", "IN_REVIEW", "APPROVED", "PARTIAL", "REJECTED", "CLOSED"],
};
export default function CustomerIssuesPage({ initialTab = "tickets" }) {
  const [tab, setTab] = useState(initialTab);
  const [rows, setRows] = useState({ tickets: [], damage: [] });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [a, b] = await Promise.all([api("/customer-app-admin/tickets"), api("/customer-app-admin/damage-claims")]);
      setRows({ tickets: a?.items || [], damage: b?.items || [] });
    } catch (e) { setError(e.message || "Unable to load customer issues"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setTab(initialTab); setFilter("ALL"); }, [initialTab]);
  const filtered = useMemo(() => (rows[tab] || []).filter((x) => {
    const q = [x.customerName, x.globalCustomerId, x.ticketNo, x.claimNo, x.invoiceNo, x.referenceNo, x.subject, x.type, x.notes, x.status].join(" ").toLowerCase();
    return q.includes(search.trim().toLowerCase()) && (filter === "ALL" || x.status === filter);
  }), [rows, tab, search, filter]);
  const edit = (id, patch) => setDrafts(v => ({ ...v, [id]: { ...v[id], ...patch } }));
  const save = async (item) => {
    const id = item._id, changes = drafts[id] || {};
    setBusy(id); setError("");
    try {
      await api(`/customer-app-admin/${tab === "tickets" ? "tickets" : "damage-claims"}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(changes) });
      setDrafts(v => { const next = { ...v }; delete next[id]; return next; });
      await load();
    } catch (e) { setError(e.message || "Could not save changes"); }
    finally { setBusy(""); }
  };
  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <PageHeader title="Customer Complaints & Damaged Goods" description="Superadmin view of complaints and damage claims from every customer in this company." />
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className={`btn ${tab === "tickets" ? "primary" : ""}`} onClick={() => { setTab("tickets"); setFilter("ALL"); }}>Complaints ({rows.tickets.length})</button>
      <button className={`btn ${tab === "damage" ? "primary" : ""}`} onClick={() => { setTab("damage"); setFilter("ALL"); }}>Damaged Goods ({rows.damage.length})</button>
      <button className="btn" onClick={load}><RefreshCw size={14}/> Refresh</button>
    </div>
    <div className="panel" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: 12 }}>
      <Search size={17}/><input aria-label="Search customer issue" style={{ flex: 1, minWidth: 210 }} placeholder="Customer, ticket, invoice, order or receipt..." value={search} onChange={e => setSearch(e.target.value)}/>
      <select aria-label="Filter status" value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">All statuses</option>{statusChoices[tab].map(s => <option value={s} key={s}>{s.replaceAll("_", " ")}</option>)}</select>
    </div>
    {error && <div className="resultBanner bad">{error}</div>}
    {loading ? <div className="panel" style={{ padding: 25 }}>Loading...</div> : <div style={{ overflowX: "auto" }} className="panel"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead><tr>{["Reference / Date", "Customer", "Type / Invoice", "Issue Details", "Status", "Superadmin Resolution", "Action"].map(h => <th key={h} style={{ padding: 10, borderBottom: "1px solid var(--border,#ddd)", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
      <tbody>{filtered.map(x => { const d = drafts[x._id] || {}; const ticket = tab === "tickets"; return <tr key={x._id}>
        <td style={{ padding: 10, verticalAlign: "top" }}><strong>{ticket ? x.ticketNo : x.claimNo}</strong><div>{date(x.createdAt)}</div></td>
        <td style={{ padding: 10, verticalAlign: "top" }}><strong>{x.customerName || x.globalCustomerId}</strong><div style={{ fontSize: 10 }}>{x.globalCustomerId}</div></td>
        <td style={{ padding: 10, verticalAlign: "top" }}>{ticket ? x.type : "DAMAGED GOODS"}<div>{ticket ? x.referenceNo || "No linked item" : x.invoiceNo}</div></td>
        <td style={{ padding: 10, minWidth: 195, verticalAlign: "top" }}><strong>{ticket ? x.subject : `${(x.items || []).length} damaged product(s)`}</strong><div>{ticket ? x.description : x.notes}</div>{!ticket && (x.items || []).map((y,i) => <div key={i}>{y.productName} · {y.damagedQty}/{y.billedQty} damaged</div>)}{!ticket && <div>{(x.images || []).length} photo(s)</div>}</td>
        <td style={{ padding: 10, verticalAlign: "top" }}><select value={d.status ?? x.status} onChange={e => edit(x._id, { status: e.target.value })}>{statusChoices[tab].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></td>
        <td style={{ padding: 10, verticalAlign: "top" }}><textarea style={{ minWidth: 165, width: "100%" }} rows={2} aria-label="Resolution" value={d.resolution ?? x.resolution ?? ""} onChange={e => edit(x._id, { resolution: e.target.value })}/>{!ticket && <label style={{ display: "block" }}>Approved amount <input type="number" min="0" step="0.01" style={{ width: 125 }} value={d.approvedAmount ?? x.approvedAmount ?? 0} onChange={e => edit(x._id, { approvedAmount: Number(e.target.value) })}/></label>}</td>
        <td style={{ padding: 10, verticalAlign: "top" }}><button className="btn primary" disabled={busy === x._id || !drafts[x._id]} onClick={() => save(x)}><Save size={14}/> Save</button></td>
      </tr>; })}{!filtered.length && <tr><td colSpan="7" style={{ padding: 30, textAlign: "center" }}>No matching {tab === "tickets" ? "complaints" : "damage claims"}.</td></tr>}</tbody>
    </table></div>}
  </div>;
}
