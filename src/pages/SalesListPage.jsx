import React, { useMemo, useState } from "react";
import { api } from "../lib/api.js";
import "../sales-list.css";

// EXACT column order from the user's attached sales list.xlsx.
const COLUMNS = [
  { key: "gstNumber", label: "GST Number", editable: true, placeholder: "GST Number" },
  { key: "partyName", label: "Party Name", editable: false, placeholder: "Auto fill from GST number" },
  { key: "invoiceNumber", label: "Invoice Number", editable: true, placeholder: "Invoice Number" },
  { key: "date", label: "Date", editable: true, placeholder: "DD/MM/YYYY" },
  { key: "products", label: "Product(s)", editable: true, placeholder: "Product(s)" },
  { key: "hsns", label: "HSN(s)", editable: true, placeholder: "HSN(s)" },
  { key: "taxRates", label: "Tax Rate(s)", editable: true, placeholder: "Tax Rate(s)" },
  { key: "quantities", label: "Quantity(s)", editable: true, placeholder: "Quantity(s)" },
  { key: "basicPrices", label: "Basic Price(s)", editable: false, placeholder: "Auto calculated" },
  { key: "basicTotal", label: "Basic Total", editable: false, placeholder: "Auto calculated", money: true },
  { key: "taxablePrice", label: "Taxable Price", editable: false, placeholder: "Auto calculated", money: true },
  { key: "cgst", label: "CGST", editable: false, placeholder: "Auto calculated", money: true },
  { key: "sgst", label: "SGST", editable: false, placeholder: "Auto calculated", money: true },
  { key: "igst", label: "IGST", editable: false, placeholder: "Auto calculated", money: true },
  { key: "grandTotal", label: "Grand Total", editable: false, placeholder: "Auto calculated", money: true },
];

const blankRow = () => ({
  gstNumber: "",
  partyName: "",
  invoiceNumber: "",
  date: "",
  products: "",
  hsns: "",
  taxRates: "",
  quantities: "",
  basicPrices: "",
  basicTotal: "",
  taxablePrice: "",
  cgst: "",
  sgst: "",
  igst: "",
  grandTotal: "",
  status: "INPUT",
  error: "",
});

const money = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function SalesListPage() {
  const [rows, setRows] = useState([blankRow()]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const errors = useMemo(
    () => rows.map((row, index) => ({ row: index + 1, error: row.error })).filter((item) => item.error),
    [rows],
  );

  const patchRow = (index, changes) => {
    setRows((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...changes } : row
    )));
  };

  const calculateRow = async (index, sourceRow = null) => {
    const row = sourceRow || rows[index];
    if (!row) return;

    const gstNumber = String(row.gstNumber || "").trim().toUpperCase();
    if (!gstNumber) {
      patchRow(index, {
        partyName: "",
        basicPrices: "",
        basicTotal: "",
        taxablePrice: "",
        cgst: "",
        sgst: "",
        igst: "",
        grandTotal: "",
        status: "INPUT",
        error: "",
      });
      return;
    }

    if (gstNumber.length !== 15) {
      patchRow(index, { status: "INPUT", error: "GST Number must contain 15 characters." });
      return;
    }

    patchRow(index, { status: "CALCULATING", error: "" });
    try {
      const result = await api("/transactions/sales-list/preview", {
        method: "POST",
        body: JSON.stringify({
          gstNumber,
          invoiceNumber: row.invoiceNumber,
          date: row.date,
          products: row.products,
          hsns: row.hsns,
          taxRates: row.taxRates,
          quantities: row.quantities,
        }),
      });

      patchRow(index, {
        gstNumber,
        partyName: result?.partyName || "",
        basicPrices: result?.basicPrices || "",
        basicTotal: result?.incomplete ? "" : Number(result?.basicTotal || 0),
        taxablePrice: result?.incomplete ? "" : Number(result?.taxablePrice || 0),
        cgst: result?.incomplete ? "" : Number(result?.cgst || 0),
        sgst: result?.incomplete ? "" : Number(result?.sgst || 0),
        igst: result?.incomplete ? "" : Number(result?.igst || 0),
        grandTotal: result?.incomplete ? "" : Number(result?.grandTotal || 0),
        status: result?.incomplete ? "INPUT" : "READY",
        error: "",
      });
    } catch (error) {
      patchRow(index, {
        status: "ERROR",
        error: error?.message || "Could not calculate row from DMS data.",
      });
    }
  };

  const updateEditable = (index, key, value) => {
    const nextValue = key === "gstNumber" ? String(value || "").toUpperCase() : value;
    const current = rows[index] || blankRow();
    const nextRow = {
      ...current,
      [key]: nextValue,
      status: "INPUT",
      error: "",
    };

    // Any manual-input change invalidates calculated cells until recalculation.
    if (key !== "gstNumber") {
      nextRow.basicPrices = "";
      nextRow.basicTotal = "";
      nextRow.taxablePrice = "";
      nextRow.cgst = "";
      nextRow.sgst = "";
      nextRow.igst = "";
      nextRow.grandTotal = "";
    } else if (String(nextValue).trim().length !== 15) {
      nextRow.partyName = "";
      nextRow.basicPrices = "";
      nextRow.basicTotal = "";
      nextRow.taxablePrice = "";
      nextRow.cgst = "";
      nextRow.sgst = "";
      nextRow.igst = "";
      nextRow.grandTotal = "";
    }

    setRows((currentRows) => currentRows.map((row, rowIndex) => (
      rowIndex === index ? nextRow : row
    )));

    // Party Name must auto-fill as soon as the complete GST number is entered.
    if (key === "gstNumber" && String(nextValue).trim().length === 15) {
      window.setTimeout(() => calculateRow(index, nextRow), 0);
    }
  };

  const calculateAll = async (sourceRows = rows) => {
    setBusy(true);
    setMessage("");
    for (let index = 0; index < sourceRows.length; index += 1) {
      const row = sourceRows[index];
      const hasData = [row.gstNumber, row.invoiceNumber, row.date, row.products, row.hsns, row.taxRates, row.quantities]
        .some((value) => String(value || "").trim());
      if (hasData) await calculateRow(index, row);
    }
    setBusy(false);
  };

  const addMore = () => setRows((current) => [...current, blankRow()]);

  return (
    <div className="sl-page">
      <div className="sl-topbar">
        <div>
          <h1>Sales List</h1>
          <p>Exact column structure of the attached XLS. Blank XLS columns are editable; instruction/calculation columns are locked.</p>
        </div>
        <div className="sl-actions">
          <button type="button" onClick={addMore}>+ Add More</button>
          <button type="button" onClick={() => calculateAll()} disabled={busy}>
            {busy ? "Calculating..." : "Recalculate All"}
          </button>
        </div>
      </div>

      {message ? <div className="sl-message">{message}</div> : null}

      <div className="sl-table-wrap">
        <table className="sl-table">
          <thead>
            <tr>
              {COLUMNS.map((column) => <th key={column.key}>{column.label}</th>)}
            </tr>
            <tr className="sl-instruction-row">
              {COLUMNS.map((column) => (
                <th key={`${column.key}-instruction`}>
                  {column.editable
                    ? "Editable"
                    : column.key === "partyName"
                      ? "Auto fill from GST number"
                      : "Auto calculated for all products"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`sales-list-row-${index}`}
                className={row.status === "ERROR" ? "sl-row-error" : ""}
                title={row.error || ""}
              >
                {COLUMNS.map((column) => (
                  <td key={`${index}-${column.key}`}>
                    {column.editable ? (
                      <input
                        className="sl-input"
                        type="text"
                        value={row[column.key] ?? ""}
                        placeholder={column.placeholder}
                        onChange={(event) => updateEditable(index, column.key, event.target.value)}
                        onBlur={() => calculateRow(index)}
                      />
                    ) : (
                      <div className={`sl-readonly ${column.money ? "number" : ""}`}>
                        {column.money ? money(row[column.key]) : (row[column.key] || column.placeholder)}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {errors.length ? (
        <div className="sl-errors">
          {errors.map((item) => (
            <div key={`error-${item.row}`}><b>Row {item.row}:</b> {item.error}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
