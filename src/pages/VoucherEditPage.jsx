import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, Save } from "lucide-react";
import { api } from "../lib/api.js";
import "../transaction-books.css";

// Use the accounting calendar day, never the viewer's local time zone.
const isoDate = (value) => {
  if (!value) return "";
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
};
const partyLabel = (p) =>
  `${p.name} • ${p.type}${p.subtype ? ` (${p.subtype})` : ""}${p.identifier ? ` • ${p.identifier}` : ""}`;
const yearFromDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

export default function VoucherEditPage() {
  const { kind, id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Kept internally to LOCATE the existing voucher in its original FY database.
  // It is not a field in the edit form; the edited date decides the destination.
  const lookupYear = params.get("fy") || "";
  const back = params.get("back") === "cash"
    ? "/dms/cashbook"
    : params.get("back") === "bank"
      ? "/dms/banking"
      : kind === "receipts" ? "/dms/receipts" : "/dms/payments";
  const info = kind === "receipts"
    ? { number: "receiptNo", party: "customerGlobalId" }
    : { number: "paymentNo", party: "partyGlobalId" };
  const [record, setRecord] = useState(null);
  const [sourceYear, setSourceYear] = useState("");
  const [parties, setParties] = useState([]);
  const [banks, setBanks] = useState([]);
  const [form, setForm] = useState({
    voucherNo: "", date: "", partyGlobalId: "", partyType: "", mode: "CASH",
    bankAccountId: "", amount: "", reference: "", remarks: "", reason: "",
  });
  const [partySearch, setPartySearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const destinationYear = yearFromDate(form.date);
  const isCash = form.mode === "CASH";
  const chosen = useMemo(
    () => parties.find((p) => String(p.id) === String(form.partyGlobalId) && (!form.partyType || p.type === form.partyType)),
    [parties, form.partyGlobalId, form.partyType],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setRecord(null);
      setError("");
      try {
        const [result, partyData] = await Promise.all([
          api(`/transactions/vouchers/${kind}/${encodeURIComponent(id)}/edit?financialYear=${encodeURIComponent(lookupYear)}`),
          api("/transactions/voucher-party-options"),
        ]);
        if (!active) return;
        const voucher = result.voucher;
        const available = Array.isArray(partyData) ? partyData : partyData.items || [];
        const originalPartyId = voucher[info.party] || "";
        const matched = available.find((p) => String(p.id) === String(originalPartyId));
        setParties(available);
        setSourceYear(result.financialYear || voucher.financialYear || lookupYear);
        setRecord(voucher);
        setPartySearch(matched ? partyLabel(matched) : voucher.partyNameSnapshot || originalPartyId);
        setForm({
          voucherNo: voucher[info.number] || "",
          date: isoDate(voucher.date),
          partyGlobalId: originalPartyId,
          partyType: voucher.partyType || matched?.type || "",
          mode: voucher.mode || "CASH",
          // Bank resolver accepts the bank account _id, loaded separately below.
          bankAccountId: voucher.bankAccountId || "",
          amount: String(voucher.amount ?? ""),
          reference: voucher.reference || "",
          remarks: voucher.remarks || "",
          reason: "",
        });
      } catch (e) {
        if (active) setError(e.message || "Could not load voucher");
      }
    };
    load();
    return () => { active = false; };
  }, [kind, id, lookupYear]);

  useEffect(() => {
    if (!record || !destinationYear) return;
    let active = true;
    api(`/banks?status=ACTIVE&financialYear=${encodeURIComponent(destinationYear)}&page=1&limit=200`)
      .then((data) => {
        if (!active) return;
        const available = data.items || [];
        setBanks(available);
        setForm((previous) => {
          const current = available.find((b) =>
            String(b._id) === String(previous.bankAccountId) ||
            String(b.bankAccountId) === String(previous.bankAccountId),
          );
          return { ...previous, bankAccountId: current?._id || previous.bankAccountId };
        });
      })
      .catch((e) => { if (active) setError(e.message || "Could not load bank accounts"); });
    return () => { active = false; };
  }, [destinationYear, record?._id]);

  const field = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setError("");
    setMessage("");
    const matched = parties.find((p) => partyLabel(p) === partySearch);
    const selectedParty = matched || chosen;
    if (!destinationYear) return setError("Enter a valid transaction date.");
    if (!selectedParty) return setError("Select the exact party from the master list.");
    if (!form.voucherNo.trim()) return setError("Enter a voucher number.");
    if (!form.reason.trim() || form.reason.trim().length < 5) return setError("Enter the reason for correcting this posted voucher.");
    if (!isCash && !form.bankAccountId) return setError("Select a bank account.");
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) return setError("Enter a valid amount greater than zero.");

    const changedYear = destinationYear !== sourceYear;
    if (!window.confirm(
      `Save correction to ${form.voucherNo}? This will update the voucher and both accounting journal entries` +
      (changedYear ? ` and move them to the year of ${form.date}` : "") + ".",
    )) return;
    setBusy(true);
    try {
      const result = await api(`/transactions/vouchers/${kind}/${encodeURIComponent(id)}/edit`, {
        method: "PUT",
        body: JSON.stringify({
          // Source year is not editable: only needed to find the original record.
          financialYear: sourceYear,
          version: record.updatedAt,
          voucherNo: form.voucherNo.trim(),
          date: form.date,
          partyGlobalId: selectedParty.id,
          partyType: selectedParty.type,
          mode: form.mode,
          bankAccountId: isCash ? "" : form.bankAccountId,
          amount: Number(form.amount),
          reference: form.reference,
          remarks: form.remarks,
          reason: form.reason,
        }),
      });
      if (result.balanceWarning) {
        setMessage(`Correction saved, but running balances need attention: ${result.balanceWarning}`);
      } else {
        navigate(back, { replace: true, state: { financialYear: result.financialYear } });
      }
    } catch (e) {
      setError(e.message || "Edit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="transactionPage transactionEntryFullPage">
      <div className="transactionSingleToolbar">
        <button type="button" className="btn ghost" onClick={() => navigate(back)}><ArrowLeft size={15} /> Back</button>
      </div>
      {error && <div className="resultBanner bad" role="alert">{error}</div>}
      {message && <div className="resultBanner good" role="status">{message}</div>}
      {!record ? (
        <section className="panel">{!error && <span><RefreshCw size={14} /> Loading posted voucher…</span>}</section>
      ) : (
        <section className="panel transactionLedgerPanel">
          <div className="financeSafetyNote">
            This correction updates the original voucher and its posted accounting entries together.
            Original values and your reason are retained in the audit trail. Imported statements,
            contra entries and OTP-controlled receipts must be corrected through their own workflows.
          </div>
          <div className="formGrid compactGrid">
            <label>Voucher Number *
              <input value={form.voucherNo} onChange={(e) => field("voucherNo", e.target.value)} maxLength={80} />
            </label>
            <label>Date *
              <input type="date" value={form.date} onChange={(e) => field("date", e.target.value)} />
            </label>
            <label>Mode *
              <select value={form.mode} onChange={(e) => field("mode", e.target.value)}>
                {["BANK", "CASH", "NEFT", "RTGS", "UPI", "CHEQUE"].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            <label className="wideField">Party Name *
              <input
                list="voucher-edit-parties"
                value={partySearch}
                onChange={(e) => {
                  setPartySearch(e.target.value);
                  const match = parties.find((p) => partyLabel(p) === e.target.value);
                  setForm((previous) => ({ ...previous, partyGlobalId: match?.id || "", partyType: match?.type || "" }));
                }}
                placeholder="Select user / customer / transporter"
              />
              <datalist id="voucher-edit-parties">
                {parties.map((party) => <option key={`${party.type}-${party.id}`} value={partyLabel(party)} />)}
              </datalist>
              <small>{chosen ? `Account: ${chosen.name} (${chosen.type})` : "Choose an existing master account."}</small>
            </label>
            {!isCash && (
              <label>Bank Account *
                <select value={form.bankAccountId} onChange={(e) => field("bankAccountId", e.target.value)}>
                  <option value="">Select Bank</option>
                  {banks.map((bank) => (
                    <option key={bank._id} value={bank._id}>
                      {bank.bankName} • {bank.accountNumber}{bank.isPrimary ? " • Primary" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>Amount *
              <input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => field("amount", e.target.value)} />
            </label>
            <label>Reference / UTR
              <input value={form.reference} onChange={(e) => field("reference", e.target.value)} />
            </label>
            <label className="wideField">Remarks
              <textarea rows={2} value={form.remarks} onChange={(e) => field("remarks", e.target.value)} />
            </label>
            <label className="wideField">Reason for correction *
              <input value={form.reason} onChange={(e) => field("reason", e.target.value)} placeholder="Why is this posted transaction being corrected?" />
            </label>
          </div>
          <div className="formActions">
            <button type="button" className="btn ghost" onClick={() => navigate(back)}>Cancel</button>
            <button type="button" className="btn primary" disabled={busy || !destinationYear || !form.voucherNo.trim() || !chosen || Number(form.amount) <= 0 || form.reason.trim().length < 5 || (!isCash && !form.bankAccountId)} onClick={save}>
              <Save size={15} /> {busy ? "Saving…" : "Save Correction"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
