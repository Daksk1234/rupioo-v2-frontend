import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, getUser } from "../lib/api.js";
import "../transaction-books.css";

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const validDate = (v) => {
  const s = String(v || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) || /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (!m) return false;
  const iso = /^\d{4}/.test(s);
  const [year, month, day] = (iso ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]]).map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && year <= 2100 && d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
};

/** One contra voucher posts exactly one double-entry journal affecting both books. */
export default function ContraEntryPage() {
  const navigate = useNavigate();
  const [banks, setBanks] = useState([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [direction, setDirection] = useState("DEPOSIT");
  const [date, setDate] = useState(localToday());
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [posted, setPosted] = useState(false);
  // Stable reference across failed/retried requests; protects accidental re-posts.
  const [contraNo, setContraNo] = useState(() =>
    `CTR-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`);

  useEffect(() => {
    let active = true;
    api("/banks?status=ACTIVE&page=1&limit=200").then((data) => {
      if (!active) return;
      const items = data.items || [];
      setBanks(items);
      const mainNumber = String(getUser()?.companyProfile?.bankDetails?.accountNumber || "").replace(/\s/g, "");
      const main = items.find((b) => b.isPrimary) || items.find((b) => String(b.accountNumber || "").replace(/\s/g, "") === mainNumber) || items[0];
      if (main) setBankAccountId(main.bankAccountId);
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);

  const submit = async () => {
    setError("");
    setSuccess("");
    if (posted) return;
    if (!validDate(date)) return setError("Enter a real date in DD-MM-YYYY or YYYY-MM-DD format.");
    if (!bankAccountId) return setError("Select a company bank account.");
    if (!(Number(amount) > 0) || !Number.isFinite(Number(amount))) return setError("Enter a valid positive amount.");
    setBusy(true);
    try {
      const result = await api("/transactions/contra", {
        method: "POST",
        body: JSON.stringify({ contraNo, direction, date, amount: Number(amount), bankAccountId, remarks, reference }),
      });
      setPosted(true);
      setSuccess(`Contra ${result.contraNo || contraNo} posted in both Cashbook and Bank Book.${result.balanceWarning ? " Bank balance refresh: " + result.balanceWarning : ""}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const another = () => {
    setPosted(false); setAmount(""); setRemarks(""); setReference(""); setSuccess(""); setError("");
    setContraNo(`CTR-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`);
  };

  return <div className="transactionPage transactionEntryFullPage">
    <div className="transactionSingleToolbar">
      <button type="button" className="btn ghost" onClick={() => navigate("/dms/banking")}><ArrowLeft size={15}/> Back to Bank</button>
      <span className="transactionDialogMode">Cash / Bank Contra</span>
    </div>
    {error && <div className="resultBanner bad" role="alert">{error}</div>}
    {success && <div className="resultBanner good" role="status">{success}</div>}
    <section className="panel transactionLedgerPanel">
      <div className="transactionLineTableScroll"><table className="transactionLineTable">
        <thead><tr><th>Date *</th><th>Direction *</th><th>Bank Account *</th><th>Amount *</th><th>Bank Reference</th><th>Remarks</th></tr></thead>
        <tbody><tr>
          <td><input aria-label="Contra date" value={date} onChange={e => setDate(e.target.value)} disabled={posted} placeholder="DD-MM-YYYY"/></td>
          <td><select aria-label="Contra direction" value={direction} disabled={posted} onChange={e => setDirection(e.target.value)}>
            <option value="DEPOSIT">Cash → Bank (Deposit)</option>
            <option value="WITHDRAWAL">Bank → Cash (Withdrawal)</option>
          </select></td>
          <td><select aria-label="Contra bank account" value={bankAccountId} disabled={posted} onChange={e => setBankAccountId(e.target.value)}>
            <option value="">Select Account</option>
            {banks.map(b => <option key={b._id} value={b.bankAccountId}>{b.bankName} · {b.accountNumber}{b.isPrimary ? " · Main" : ""}</option>)}
          </select></td>
          <td><input aria-label="Contra amount" type="number" min="0.01" step="0.01" value={amount} disabled={posted} onChange={e => setAmount(e.target.value)}/></td>
          <td><input aria-label="Bank reference" value={reference} disabled={posted} onChange={e => setReference(e.target.value)} placeholder="Slip/UTR (optional)"/></td>
          <td><input aria-label="Remarks" value={remarks} disabled={posted} onChange={e => setRemarks(e.target.value)}/></td>
        </tr></tbody>
      </table></div>
      <div className="transactionLineActions">
        <span>Own-account transfer only. Does not create income or expense. Reconcile the matching uploaded bank-statement row rather than posting it again.</span>
        {posted
          ? <><button className="btn ghost" onClick={() => navigate("/dms/cashbook")}>View Cashbook</button><button className="btn primary" onClick={another}>Create Another Contra</button></>
          : <button className="btn primary" disabled={busy} onClick={submit}><ArrowRightLeft size={15}/>{busy ? "Posting…" : "Post Contra"}</button>}
      </div>
    </section>
  </div>;
}
