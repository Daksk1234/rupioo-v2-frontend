import React from "react";
import { LockKeyhole, ShieldCheck, Landmark } from "lucide-react";
import { Link } from "react-router-dom";

// Navigation discovery is not permission to access cheque data.
export default function ChequeControlAccessNotice() {
  return (
    <section className="panel" style={{ maxWidth: 850, margin: "18px auto", padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <LockKeyhole size={21} aria-hidden="true" />
        <strong>Cheque Controlling System — Permission Required</strong>
      </div>
      <p>Company Issued and Company Received are installed, but the company's active Plan Group has not granted Cheque Controlling System View. The registers remain protected until permission is assigned.</p>
      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <ShieldCheck size={18} aria-hidden="true" />
          <span><strong>MASTER:</strong> Open Groups, select the group assigned to this company's plan, and enable <strong>Transaction → Cheque Controlling System → View</strong> (plus Create/Edit/Download as needed). If a Department permission ceiling is configured, enable it there too.</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Landmark size={18} aria-hidden="true" />
          <span><strong>DMS:</strong> In Roles &amp; Permissions, grant cheque permissions to the relevant staff roles, then sign out and back in to refresh access.</span>
        </div>
      </div>
      <p style={{ fontSize: 12, opacity: 0.8, marginTop: 18 }}>Company Superadmin banking access displays this setup screen only. It does not grant access to cheque records or cheque operations.</p>
      <div style={{ marginTop: 16 }}><Link to="/dms/banking" className="btn ghost">Back to Bank Book</Link></div>
    </section>
  );
}
