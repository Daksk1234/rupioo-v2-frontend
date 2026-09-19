import React, { useEffect, useState } from "react";
import { getCurrentDatabase, getMailOutbox, retryOutboxMail } from "../../services/smartMailApi";

export default function MailOutbox() {
  const database = getCurrentDatabase();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const load = async () => {
    setLoading(true);
    try { const res = await getMailOutbox(database, { status: filter, limit: 150 }); setRows(res.rows || []); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filter]);

  return <div style={{ padding: 18 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div><h2 style={{ margin: 0 }}>Email Outbox</h2><div style={{ color: "#64748b" }}>Sent, queued and failed company emails.</div></div>
      <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ height: 38, border: "1px solid #cbd5e1", borderRadius: 7, padding: "0 10px" }}>
        <option value="">All</option><option value="sent">Sent</option><option value="queued">Queued</option><option value="retry">Retrying</option><option value="failed">Failed</option>
      </select>
    </div>
    <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 850 }}>
        <thead><tr style={{ background: "#f8fafc" }}>{["Date","Type","To","Subject","Status","Attempts","Error","Action"].map(x => <th key={x} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #e5e7eb" }}>{x}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan="8" style={{ padding: 20, textAlign: "center" }}>Loading...</td></tr> : rows.length ? rows.map(r => <tr key={r._id}>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{new Date(r.createdAt).toLocaleString()}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{r.type}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{(r.to || []).join(", ")}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{r.subject}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9", fontWeight: 800, color: r.status === "sent" ? "#059669" : r.status === "failed" ? "#dc2626" : "#d97706" }}>{r.status}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{r.attemptCount || 0}/{r.maxAttempts || 12}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9", maxWidth: 260 }}>{r.lastError || ""}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{["failed","retry"].includes(r.status) ? <button onClick={async () => { await retryOutboxMail(database, r._id); await load(); }}>Retry</button> : "—"}</td>
        </tr>) : <tr><td colSpan="8" style={{ padding: 20, textAlign: "center" }}>No email records found.</td></tr>}</tbody>
      </table>
    </div>
  </div>;
}
