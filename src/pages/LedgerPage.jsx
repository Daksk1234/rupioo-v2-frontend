import React, { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileText,
  Mail,
  Printer,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { api, apiBlob } from "../lib/api.js";
import { accessForPath } from "../lib/permissionAccess.js";

const money = (value) => Number(value || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateOnly = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-GB");
};

const currentFinancialYear = () => {
  const selected = localStorage.getItem("financialYearSelected");
  if (selected) return selected;
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
};

const financialYearOptions = (selected) => {
  const start = Number(String(selected || currentFinancialYear()).split("-")[0]);
  const base = Number.isFinite(start) ? start : new Date().getFullYear();
  return Array.from({ length: 8 }, (_, index) => {
    const year = base - 4 + index;
    return `${year}-${String(year + 1).slice(-2)}`;
  });
};

const optionValue = (row) => `${row.entityType}|${row.entityId}`;
const parseOptionValue = (value) => {
  const [entityType, ...rest] = String(value || "").split("|");
  return { entityType, entityId: rest.join("|") };
};

const queryString = (params) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) query.set(key, value);
  });
  return query.toString();
};

const downloadBlob = async (path, fallbackName) => {
  const result = await apiBlob(path);
  const blob = result?.blob instanceof Blob ? result.blob : result;
  if (!(blob instanceof Blob)) throw new Error("Invalid file response");
  const disposition = String(result?.disposition || "");
  const match = disposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);
  const serverName = match ? decodeURIComponent(match[1].replace(/^\"|\"$/g, "")) : "";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = serverName || fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function LedgerPage({ page }) {
  const access = accessForPath(page?.path || "/dms/ledger");
  const [fy, setFy] = useState(currentFinancialYear());
  const [options, setOptions] = useState([]);
  const [optionSearch, setOptionSearch] = useState("");
  const [selectedValue, setSelectedValue] = useState("");
  const [filters, setFilters] = useState({ startDate: "", endDate: "" });
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("good");

  const selected = useMemo(() => parseOptionValue(selectedValue), [selectedValue]);
  const selectedOption = useMemo(
    () => options.find((row) => optionValue(row) === selectedValue) || null,
    [options, selectedValue],
  );

  const visibleOptions = useMemo(() => {
    const query = optionSearch.trim().toLowerCase();
    if (!query) return options;
    return options.filter((row) =>
      [row.name, row.accountType, row.accountCode, row.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [options, optionSearch]);

  const years = useMemo(() => financialYearOptions(fy), [fy]);

  const flash = (text, type = "good") => {
    setMessage(text);
    setMessageType(type);
  };

  const loadOptions = async () => {
    setOptionsLoading(true);
    try {
      const data = await api("/reports/ledger/options");
      setOptions(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      flash(error.message || "Unable to load ledger accounts", "bad");
      setOptions([]);
    } finally {
      setOptionsLoading(false);
    }
  };

  const loadStatement = async (overrides = {}) => {
    const nextValue = overrides.selectedValue ?? selectedValue;
    const entity = parseOptionValue(nextValue);
    if (!entity.entityId) {
      setStatement(null);
      return;
    }
    const nextFy = overrides.fy ?? fy;
    const nextFilters = overrides.filters ?? filters;
    setLoading(true);
    setMessage("");
    try {
      const qs = queryString({
        financialYear: nextFy,
        entityType: entity.entityType,
        entityId: entity.entityId,
        startDate: nextFilters.startDate,
        endDate: nextFilters.endDate,
      });
      const data = await api(`/reports/ledger/statement?${qs}`);
      setStatement(data);
    } catch (error) {
      setStatement(null);
      flash(error.message || "Unable to generate ledger", "bad");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const onEntityChange = (value) => {
    setSelectedValue(value);
    setFilters({ startDate: "", endDate: "" });
    setMessage("");
    loadStatement({ selectedValue: value, filters: { startDate: "", endDate: "" } });
  };

  const onFyChange = (value) => {
    setFy(value);
    localStorage.setItem("financialYearSelected", value);
    setFilters({ startDate: "", endDate: "" });
    if (selectedValue) loadStatement({ fy: value, filters: { startDate: "", endDate: "" } });
  };

  const fileQuery = () => queryString({
    financialYear: fy,
    entityType: selected.entityType,
    entityId: selected.entityId,
    startDate: filters.startDate,
    endDate: filters.endDate,
  });

  const exportExcel = async () => {
    if (!selected.entityId) return flash("Select a party/account first", "bad");
    try {
      await downloadBlob(
        `/reports/ledger/export.xlsx?${fileQuery()}`,
        `Ledger_${String(statement?.entity?.name || "Account").replace(/[^a-z0-9_-]+/gi, "_")}_${fy}.xlsx`,
      );
    } catch (error) {
      flash(error.message || "Excel download failed", "bad");
    }
  };

  const exportPdf = async () => {
    if (!selected.entityId) return flash("Select a party/account first", "bad");
    try {
      await downloadBlob(
        `/reports/ledger/pdf?${fileQuery()}`,
        `Ledger_${String(statement?.entity?.name || "Account").replace(/[^a-z0-9_-]+/gi, "_")}_${fy}.pdf`,
      );
    } catch (error) {
      flash(error.message || "PDF download failed", "bad");
    }
  };

  const sendMail = async () => {
    if (selected.entityType !== "PARTY" || !selected.entityId) {
      return flash("Email is available for customer/supplier ledgers only", "bad");
    }
    setSending(true);
    setMessage("");
    try {
      const result = await api("/reports/ledger/email", {
        method: "POST",
        body: JSON.stringify({
          financialYear: fy,
          entityType: selected.entityType,
          entityId: selected.entityId,
          startDate: filters.startDate,
          endDate: filters.endDate,
        }),
      });
      flash(`Ledger sent${result?.to ? ` to ${result.to}` : ""}.`, "good");
    } catch (error) {
      flash(error.message || "Unable to email ledger", "bad");
    } finally {
      setSending(false);
    }
  };

  const openInvoice = async (row) => {
    if (row?.sourceDocumentType !== "SALES_INVOICE" || !row?.sourceDocumentId) return;
    try {
      const result = await apiBlob(
        `/transactions/sales-invoices/${encodeURIComponent(row.sourceDocumentId)}/pdf?financialYear=${encodeURIComponent(fy)}`,
      );
      const blob = result?.blob instanceof Blob ? result.blob : result;
      if (!(blob instanceof Blob)) throw new Error("Invalid invoice PDF response");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      flash(error.message || "Unable to open invoice PDF", "bad");
    }
  };

  const summary = statement?.summary || {};
  const rows = statement?.rows || [];
  const company = statement?.company || {};
  const entity = statement?.entity || {};

  return (
    <>
      <style>{`
        .oldLedgerPanel{padding:16px 18px;}
        .oldLedgerToolbar{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
        .oldLedgerField{display:flex;flex-direction:column;gap:5px;min-width:150px;font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;}
        .oldLedgerField.party{min-width:310px;flex:1 1 360px;}
        .oldLedgerField input,.oldLedgerField select{height:38px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text);padding:0 10px;font:inherit;font-size:12px;font-weight:600;text-transform:none;letter-spacing:0;}
        .oldLedgerSearch{position:relative;display:flex;align-items:center;}
        .oldLedgerSearch svg{position:absolute;left:10px;width:15px;height:15px;color:var(--muted);}
        .oldLedgerSearch input{width:100%;padding-left:32px;}
        .oldLedgerSelectMeta{font-size:9px;color:var(--muted);font-weight:600;text-transform:none;letter-spacing:0;margin-top:2px;}
        .oldLedgerTitleRow{display:flex;align-items:center;gap:10px;margin:4px 0 10px;}
        .oldLedgerTitleRow strong{font-size:16px;}
        .oldLedgerCount{background:#eef2ff;color:#3730a3;font-weight:800;padding:5px 9px;border-radius:999px;font-size:10px;}
        .oldLedgerTableWrap{width:100%;overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);}
        .oldLedgerTable{width:100%;border-collapse:collapse;min-width:820px;}
        .oldLedgerTable th{background:#f4f7f6;color:#0f172a;font-weight:800;text-transform:uppercase;font-size:10px;letter-spacing:.03em;border:1px solid #dfe4e8;padding:7px 8px;text-align:center;white-space:nowrap;}
        .oldLedgerTable td{border:1px solid #e6eaed;padding:7px 8px;font-size:12px;color:var(--text);vertical-align:top;}
        .oldLedgerTable td:nth-child(1),.oldLedgerTable td:nth-child(3),.oldLedgerTable td:nth-child(4){text-align:center;white-space:nowrap;}
        .oldLedgerTable td:nth-child(5),.oldLedgerTable td:nth-child(6){text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
        .oldLedgerTable th:nth-child(2),.oldLedgerTable td:nth-child(2){width:42%;}
        .oldLedgerOpening td,.oldLedgerClosing td,.oldLedgerTotal td{font-weight:800;background:#fafafa;}
        .oldLedgerTotal td{background:#f1f5f9;}
        .oldLedgerVoucher{border:0;background:transparent;padding:0;color:#085bf5;text-decoration:underline;cursor:pointer;font:inherit;font-weight:700;}
        .oldLedgerVoucher:disabled{color:inherit;text-decoration:none;cursor:default;}
        .oldLedgerEmpty{padding:34px;text-align:center;color:var(--muted);font-size:12px;}
        .oldLedgerPrintHeader{display:none;text-align:center;margin-bottom:12px;}
        .oldLedgerPrintHeader h2{margin:4px 0;font-size:18px;}.oldLedgerPrintHeader p{margin:2px 0;font-size:10px;}.oldLedgerPrintHeader h3{margin:10px 0 4px;font-size:15px;}
        @media print{
          body *{visibility:hidden!important;}
          .oldLedgerPanel,.oldLedgerPanel *{visibility:visible!important;}
          .oldLedgerPanel{position:absolute;left:0;top:0;width:100%;padding:0!important;border:0!important;box-shadow:none!important;}
          .oldLedgerNoPrint{display:none!important;}
          .oldLedgerPrintHeader{display:block!important;}
          .oldLedgerTableWrap{overflow:visible;border:0;}
          .oldLedgerTable{min-width:0;font-size:9px;}
          .oldLedgerTable th,.oldLedgerTable td{font-size:9px;padding:4px 5px;}
          .oldLedgerTable thead{display:table-header-group;}
          .oldLedgerTable tr{page-break-inside:avoid;}
        }
      `}</style>
      <PageHeader
        title="Ledger"
        description="Old DMS-style party and account ledger with opening, closing, FY carry-forward and voucher details."
        actions={false}
      />
      {message && <div className={`resultBanner ${messageType === "bad" ? "bad" : "good"}`}>{message}</div>}
      <section className="panel oldLedgerPanel">
        <div className="oldLedgerNoPrint">
          <div className="oldLedgerTitleRow">
            <strong>Party Ledger</strong>
            <span className="oldLedgerCount">{rows.length}</span>
          </div>
          <div className="oldLedgerToolbar">
            <label className="oldLedgerField">
              Financial Year
              <select value={fy} onChange={(event) => onFyChange(event.target.value)}>
                {years.map((year) => <option key={year}>{year}</option>)}
              </select>
            </label>
            <label className="oldLedgerField party">
              Party / Account
              <div className="oldLedgerSearch">
                <Search />
                <input
                  value={optionSearch}
                  onChange={(event) => setOptionSearch(event.target.value)}
                  placeholder="Search customer, supplier, user, bank or ledger..."
                />
              </div>
              <select value={selectedValue} onChange={(event) => onEntityChange(event.target.value)} disabled={optionsLoading}>
                <option value="">{optionsLoading ? "Loading accounts..." : "Select Party / Account"}</option>
                {visibleOptions.map((row) => (
                  <option key={optionValue(row)} value={optionValue(row)}>
                    {row.name} • {row.accountType || "ACCOUNT"}{row.accountCode ? ` • ${row.accountCode}` : ""}
                  </option>
                ))}
              </select>
              {selectedOption && (
                <span className="oldLedgerSelectMeta">
                  {selectedOption.accountType || "Account"}{selectedOption.email ? ` • ${selectedOption.email}` : ""}
                </span>
              )}
            </label>
            <label className="oldLedgerField">
              Start Date
              <input type="date" value={filters.startDate} onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))} />
            </label>
            <label className="oldLedgerField">
              End Date
              <input type="date" value={filters.endDate} onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))} />
            </label>
            <button className="btn primary" onClick={() => loadStatement()} disabled={!selected.entityId || loading}>
              <RefreshCw /> {loading ? "Loading..." : "Apply"}
            </button>
            <button className="btn ghost" onClick={() => { const reset = { startDate: "", endDate: "" }; setFilters(reset); loadStatement({ filters: reset }); }} disabled={!selected.entityId || loading}>
              <RefreshCw /> Refresh
            </button>
            {access.download && (
              <button className="btn ghost" onClick={exportExcel} disabled={!selected.entityId || loading}>
                <Download /> Excel
              </button>
            )}
            {access.download && (
              <button className="btn ghost" onClick={exportPdf} disabled={!selected.entityId || loading}>
                <FileText /> PDF
              </button>
            )}
            {access.print && (
              <button className="btn ghost" onClick={() => window.print()} disabled={!selected.entityId}>
                <Printer /> Print
              </button>
            )}
            <button className="btn primary" onClick={sendMail} disabled={selected.entityType !== "PARTY" || !selected.entityId || sending} title="Email ledger PDF to selected customer/supplier">
              {sending ? <Send /> : <Mail />} {sending ? "Sending..." : "Send Mail"}
            </button>
          </div>
        </div>

        <div className="oldLedgerPrintHeader">
          <p><strong>THIS LEDGER IS GENERATED IN RUPIO SOFT</strong></p>
          <h2>{company.companyName || company.tradeName || "Company"}</h2>
          {company.registeredAddress && <p>{company.registeredAddress}</p>}
          {(company.email || company.mobile) && <p>{[company.email, company.mobile].filter(Boolean).join(" | ")}</p>}
          {company.gstin && <p>GSTIN: {company.gstin}</p>}
          <h3>{entity.name || "Party"} - Ledger ({statement?.financialYear || fy})</h3>
        </div>

        {!selected.entityId ? (
          <div className="oldLedgerEmpty">Select a party/account to view the ledger.</div>
        ) : loading ? (
          <div className="oldLedgerEmpty">Generating ledger...</div>
        ) : !statement ? (
          <div className="oldLedgerEmpty">No ledger data available.</div>
        ) : (
          <div className="oldLedgerTableWrap">
            <table className="oldLedgerTable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particular</th>
                  <th>Voucher Type</th>
                  <th>Voucher No</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                <tr className="oldLedgerOpening">
                  <td />
                  <td>Opening Balance ({statement.financialYear})</td>
                  <td />
                  <td />
                  <td>{summary.openingDebit ? money(summary.openingDebit) : ""}</td>
                  <td>{summary.openingCredit ? money(summary.openingCredit) : ""}</td>
                </tr>
                {rows.map((row, index) => {
                  const canOpenInvoice = row.sourceDocumentType === "SALES_INVOICE" && row.sourceDocumentId;
                  return (
                    <tr key={row.id || `${row.transactionId}-${index}`}>
                      <td>{dateOnly(row.date)}</td>
                      <td>{row.particular || entity.name || ""}</td>
                      <td>{row.voucherType || "-"}</td>
                      <td>
                        <button className="oldLedgerVoucher" disabled={!canOpenInvoice} onClick={() => openInvoice(row)} title={canOpenInvoice ? "Open Sales Invoice PDF" : ""}>
                          {row.voucherNo || "-"}
                        </button>
                      </td>
                      <td>{Number(row.debit || 0) ? money(row.debit) : ""}</td>
                      <td>{Number(row.credit || 0) ? money(row.credit) : ""}</td>
                    </tr>
                  );
                })}
                <tr className="oldLedgerClosing">
                  <td />
                  <td>Closing Balance</td>
                  <td />
                  <td />
                  <td>{summary.showOnDebit ? money(summary.closingDiff) : ""}</td>
                  <td>{summary.showOnCredit ? money(summary.closingDiff) : ""}</td>
                </tr>
                <tr className="oldLedgerTotal">
                  <td />
                  <td>Total</td>
                  <td />
                  <td />
                  <td>{money(summary.balancedTotal)}</td>
                  <td>{money(summary.balancedTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
