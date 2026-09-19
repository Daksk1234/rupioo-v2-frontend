import React, { useEffect, useState } from "react";
import { getMasterMailOverview } from "../../services/smartMailApi";

export default function MailConnectionsMaster() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { try { const r = await getMasterMailOverview(); setRows(r.rows || []); } finally { setLoading(false); } })(); }, []);
  return <div style={{ padding: 18 }}>
    <h2 style={{ marginBottom: 4 }}>Superadmin Email Connections</h2>
    <div style={{ color: "#64748b", marginBottom: 14 }}>MASTER can see health only. OAuth tokens and SMTP secrets are never shown here.</div>
    <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
        <thead><tr style={{ background: "#f8fafc" }}>{["Database / Company","Email","Provider","Connection","Pending","Failed","Last Healthy","Last Error"].map(x => <th key={x} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #e5e7eb" }}>{x}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan="8" style={{ padding: 20, textAlign: "center" }}>Loading...</td></tr> : rows.map(r => <tr key={r.database}>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{r.database}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{r.email || "—"}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{r.provider || "—"}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9", fontWeight: 800, color: r.connectionStatus === "connected" ? "#059669" : "#dc2626" }}>{r.connectionStatus || "not connected"}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{r.pending || 0}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{r.failed || 0}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9" }}>{r.lastHealthAt ? new Date(r.lastHealthAt).toLocaleString() : "—"}</td>
          <td style={{ padding: 9, borderBottom: "1px solid #f1f5f9", maxWidth: 280 }}>{r.lastError || ""}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
