import React, { useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, Banknote, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { api } from "../lib/api.js";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (v) => (v ? new Date(v).toLocaleString("en-IN") : "—");

export default function SalespersonCashControl({ financialYear }) {
  const [data, setData] = useState({ movements: [], dayClosings: [], creditHolds: [], admin: false });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    if (!financialYear) return;
    setLoading(true);
    setError("");
    try {
      const result = await api(`/sales-app/cash/verification-inbox?financialYear=${encodeURIComponent(financialYear)}`);
      setData(result || { movements: [], dayClosings: [], creditHolds: [], admin: false });
    } catch (e) {
      setError(e.message || "Unable to load field cash controls");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [financialYear]);

  const run = async (path, body, success) => {
    setError("");
    setMessage("");
    try {
      await api(path, { method: "PATCH", body: JSON.stringify(body) });
      setMessage(success);
      await load();
    } catch (e) {
      setError(e.message || "Action failed");
    }
  };

  const verifyMovement = async (row, action) => {
    let remarks = "";
    if (action === "REJECT") remarks = window.prompt("Reason for rejection:", "") || "";
    if (action === "REJECT" && !remarks.trim()) return;
    if (action === "APPROVE" && !window.confirm(`Verify ${row.type === "BANK_DEPOSIT" ? "bank deposit" : "cash handover"} of ${money(row.amount)}?`)) return;
    await run(
      `/sales-app/cash/movements/${row._id}/verify?financialYear=${encodeURIComponent(financialYear)}`,
      { action, remarks },
      action === "APPROVE" ? "Cash movement verified." : "Cash movement rejected.",
    );
  };

  const reviewClosing = async (row, action) => {
    let remarks = "";
    if (action === "REJECT") remarks = window.prompt("Reason for sending this closing back:", "") || "";
    if (action === "REJECT" && !remarks.trim()) return;
    if (action === "APPROVE") remarks = window.prompt("Approval remark (optional):", "") || "";
    await run(
      `/sales-app/cash/day-closings/${row._id}/review?financialYear=${encodeURIComponent(financialYear)}`,
      { action, remarks },
      action === "APPROVE" ? "Day-closing variance approved and adjusted." : "Day closing returned for correction.",
    );
  };

  const decideCredit = async (row, action) => {
    const remarks = window.prompt(`${action === "APPROVE" ? "Approval" : "Rejection"} remark (optional):`, "") || "";
    if (!window.confirm(`${action === "APPROVE" ? "Approve" : "Reject"} credit-held order ${row.orderNo}?`)) return;
    await run(
      `/sales-app/orders/${row._id}/credit-decision?financialYear=${encodeURIComponent(financialYear)}`,
      { action, remarks },
      action === "APPROVE" ? "Credit-held order approved." : "Credit-held order rejected.",
    );
  };

  const pendingCount = (data.movements?.length || 0) + (data.dayClosings?.length || 0) + (data.creditHolds?.length || 0);

  return (
    <section className="panel" style={{ marginBottom: 14 }}>
      <div className="panelHead">
        <div>
          <h3 style={{ margin: 0 }}>Sales Person Cash & Credit Control</h3>
          <p style={{ margin: "4px 0 0" }}>Verify physical cash custody, bank deposits, day-closing differences and credit-limit exceptions.</p>
        </div>
        <button className="btn ghost" onClick={load} disabled={loading}><RefreshCw size={15} />{loading ? "Loading…" : "Refresh"}</button>
      </div>

      {message && <div className="resultBanner good">{message}</div>}
      {error && <div className="resultBanner bad">{error}</div>}

      <div className="financeUnifiedStrip" style={{ marginTop: 12 }}>
        <div><WalletCards size={18} /><span><small>Pending Cash</small><strong>{data.movements?.length || 0}</strong></span></div>
        <div><AlertTriangle size={18} /><span><small>Closing Review</small><strong>{data.dayClosings?.length || 0}</strong></span></div>
        <div><ShieldCheck size={18} /><span><small>Credit Holds</small><strong>{data.creditHolds?.length || 0}</strong></span></div>
        <div><BadgeCheck size={18} /><span><small>Total Attention</small><strong>{pendingCount}</strong></span></div>
      </div>

      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <h4>Cash Handover / Bank Deposit Verification</h4>
        <table className="statementReviewTable">
          <thead><tr><th>Date</th><th>Sales Person</th><th>Type</th><th>Amount</th><th>Receiver / Bank</th><th>Reference</th><th>Action</th></tr></thead>
          <tbody>
            {(data.movements || []).map((row) => <tr key={row._id}>
              <td>{dateTime(row.date)}</td><td>{row.salespersonNameSnapshot || "—"}</td><td>{String(row.type || "").replaceAll("_", " ")}</td><td><strong>{money(row.amount)}</strong></td>
              <td>{row.type === "BANK_DEPOSIT" ? row.bankNameSnapshot : row.recipientName || "—"}</td><td>{row.reference || row.proofReference || "—"}</td>
              <td><div className="rowActions"><button className="btn primary" onClick={() => verifyMovement(row, "APPROVE")}>Verify</button><button className="btn ghost" onClick={() => verifyMovement(row, "REJECT")}>Reject</button></div></td>
            </tr>)}
            {!data.movements?.length && <tr><td colSpan="7">No pending cash movement verification.</td></tr>}
          </tbody>
        </table>
      </div>

      {data.admin && <div style={{ overflowX: "auto", marginTop: 18 }}>
        <h4>Day Closing Shortage / Excess Review</h4>
        <table className="statementReviewTable">
          <thead><tr><th>Date</th><th>Sales Person</th><th>Expected</th><th>Declared</th><th>Variance</th><th>Reason</th><th>Action</th></tr></thead>
          <tbody>
            {(data.dayClosings || []).map((row) => <tr key={row._id}>
              <td>{row.dayKey || dateTime(row.closingDate)}</td><td>{row.salespersonNameSnapshot || "—"}</td><td>{money(row.expectedClosing)}</td><td>{money(row.declaredClosing)}</td>
              <td><strong>{row.varianceType} {money(Math.abs(Number(row.variance || 0)))}</strong></td><td>{row.remarks || "—"}</td>
              <td><div className="rowActions"><button className="btn primary" onClick={() => reviewClosing(row, "APPROVE")}>Approve</button><button className="btn ghost" onClick={() => reviewClosing(row, "REJECT")}>Return</button></div></td>
            </tr>)}
            {!data.dayClosings?.length && <tr><td colSpan="7">No day-closing variance is waiting for review.</td></tr>}
          </tbody>
        </table>
      </div>}

      {data.admin && <div style={{ overflowX: "auto", marginTop: 18 }}>
        <h4>Credit Limit Hold</h4>
        <table className="statementReviewTable">
          <thead><tr><th>Date</th><th>Order</th><th>Customer</th><th>Order Value</th><th>Credit Limit</th><th>Exceeded By</th><th>Action</th></tr></thead>
          <tbody>
            {(data.creditHolds || []).map((row) => <tr key={row._id}>
              <td>{dateTime(row.date)}</td><td>{row.orderNo}</td><td>{row.customerNameSnapshot || "—"}</td><td>{money(row.grandTotal)}</td><td>{money(row.creditControl?.creditLimit)}</td><td><strong>{money(row.creditControl?.exceededBy)}</strong></td>
              <td><div className="rowActions"><button className="btn primary" onClick={() => decideCredit(row, "APPROVE")}>Approve</button><button className="btn ghost" onClick={() => decideCredit(row, "REJECT")}>Reject</button></div></td>
            </tr>)}
            {!data.creditHolds?.length && <tr><td colSpan="7">No sales order is waiting on credit-limit approval.</td></tr>}
          </tbody>
        </table>
      </div>}

      <div className="financeSafetyNote" style={{ marginTop: 14 }}><Banknote size={15} /> Cash handover changes custody only; bank deposit and approved shortage/excess post the corresponding V2 accounting entries.</div>
    </section>
  );
}
