import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RefreshCw, Search, UploadCloud, X } from "lucide-react";
import { api } from "../lib/api.js";

const clean = (value) => String(value ?? "").trim();
const upper = (value) => clean(value).toUpperCase();
const normalize = (value) => upper(value).replace(/[^A-Z0-9]+/g, " ").trim();
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function v2WarehouseId(rows = []) {
  const key = (value) => upper(value).replace(/[^A-Z0-9]+/g, " ").trim();
  const exact = rows.find((w) => ["V2", "V2 WAREHOUSE", "WAREHOUSE V2"].includes(key(w.title)) || ["V2", "V2 WAREHOUSE", "WAREHOUSE V2"].includes(key(w.reference)));
  if (exact) return String(exact._id || "");
  const like = rows.find((w) => /(^| )V2( |$)/.test(key(w.title)) || /(^| )V2( |$)/.test(key(w.reference)));
  if (like) return String(like._id || "");
  return rows.length === 1 ? String(rows[0]._id || "") : "";
}

function customerLabel(row) {
  if (!row) return "";
  return [upper(row.name), upper(row.gstin), upper(row.code)].filter(Boolean).join(" • ");
}

function productLabel(row) {
  if (!row) return "";
  const meta = [row.sku ? `SKU ${upper(row.sku)}` : "", `GST ${Number(row.gstRate || 0).toFixed(2)}%`, `STOCK ${Number(row.stock || 0)}`].filter(Boolean).join(" • ");
  return `${upper(row.name)}${meta ? ` • ${meta}` : ""}`;
}

function filterOptions(options, query, fields, selectedId, limit = 50) {
  const q = normalize(query);
  const selected = options.find((x) => String(x.id) === String(selectedId || ""));
  let rows = options;
  if (q) {
    rows = options.filter((row) => fields.some((field) => normalize(row[field]).includes(q)));
  }
  rows = rows.slice(0, limit);
  if (selected && !rows.some((x) => String(x.id) === String(selected.id))) rows = [selected, ...rows];
  return rows;
}

export default function SalesInvoiceBulkUpload({ warehouses = [], onPosted }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [tolerance, setTolerance] = useState(0.5);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [partyMappings, setPartyMappings] = useState({});
  const [productMappings, setProductMappings] = useState({});
  const [partySearch, setPartySearch] = useState({});
  const [productSearch, setProductSearch] = useState({});
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setWarehouseId((current) => current || v2WarehouseId(warehouses));
  }, [open, warehouses]);

  const customerOptions = preview?.customerOptions || [];
  const productOptions = preview?.productOptions || [];
  const cashId = preview?.cashCustomerId || "";
  const officeAssetId = preview?.officeAssetProductId || "";
  const validCount = Number(preview?.validInvoices || 0);
  const invalidCount = Number(preview?.invalidInvoices || 0);
  const mappingMode = preview?.mode === "MANUAL_MAPPING" || Boolean(preview?.mappingRequired);
  const canLoad = Boolean(file && !busy);

  const selectedCustomers = useMemo(() => new Map(customerOptions.map((row) => [String(row.id), row])), [customerOptions]);
  const selectedProducts = useMemo(() => new Map(productOptions.map((row) => [String(row.id), row])), [productOptions]);

  const mappedPartyCount = useMemo(() => (preview?.uniqueParties || []).filter((row) => partyMappings[row.key]).length, [preview, partyMappings]);
  const mappedProductCount = useMemo(() => (preview?.uniqueProducts || []).filter((row) => productMappings[row.key]).length, [preview, productMappings]);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setMsg("");
    setPartyMappings({});
    setProductMappings({});
    setPartySearch({});
    setProductSearch({});
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const downloadTemplate = () => {
    setMsg("");
    try {
      const base = String(import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      const a = document.createElement("a");
      a.href = `${base}/RUPIO_SALES_INVOICE_BULK_TEMPLATE.xlsx`;
      a.download = "RUPIO_SALES_INVOICE_BULK_TEMPLATE.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMsg("TEMPLATE DOWNLOADED.");
    } catch (error) {
      setMsg(upper(error.message || "TEMPLATE DOWNLOAD FAILED"));
    }
  };

  const mappingPayload = () => ({ parties: partyMappings, products: productMappings });

  const formFor = ({ validateMappings = false } = {}) => {
    const body = new FormData();
    body.append("file", file);
    body.append("defaultWarehouseId", warehouseId);
    body.append("totalTolerance", String(Number(tolerance || 0)));
    body.append("validateMappings", validateMappings ? "1" : "0");
    body.append("mappingJson", JSON.stringify(mappingPayload()));
    return body;
  };

  const loadXlsFields = async () => {
    if (!canLoad) return;
    setBusy(true);
    setMsg("");
    setResult(null);
    try {
      const data = await api("/transactions/sales-invoices/bulk-preview", { method: "POST", body: formFor({ validateMappings: false }) });
      setPreview(data);
      const initialPartySearch = {};
      for (const row of data.uniqueParties || []) initialPartySearch[row.key] = upper(row.partyName || row.gstin || "");
      const initialProductSearch = {};
      for (const row of data.uniqueProducts || []) initialProductSearch[row.key] = upper(row.productName || "");
      setPartySearch(initialPartySearch);
      setProductSearch(initialProductSearch);
      setPartyMappings({});
      setProductMappings({});
      setMsg(`${Number(data.receivedRows || 0)} XLS ROW(S) LOADED. MAP ${Number(data.uniqueParties?.length || 0)} PARTY VALUE(S) AND ${Number(data.uniqueProducts?.length || 0)} PRODUCT VALUE(S).`);
    } catch (error) {
      setPreview(null);
      setMsg(upper(error.message || "XLS LOAD FAILED"));
    } finally {
      setBusy(false);
    }
  };

  const validateMappedData = async () => {
    if (!file || !warehouseId || busy) return;
    setBusy(true);
    setMsg("");
    setResult(null);
    try {
      const data = await api("/transactions/sales-invoices/bulk-preview", { method: "POST", body: formFor({ validateMappings: true }) });
      setPreview(data);
      setMsg(`${Number(data.validInvoices || 0)} INVOICE(S) READY. ${Number(data.invalidInvoices || 0)} NEED REVIEW.`);
    } catch (error) {
      setMsg(upper(error.message || "VALIDATION FAILED"));
    } finally {
      setBusy(false);
    }
  };

  const postValid = async () => {
    if (!file || !validCount || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const data = await api("/transactions/sales-invoices/bulk-upload", { method: "POST", body: formFor({ validateMappings: true }) });
      setResult(data);
      setMsg(`${Number(data.posted || 0)} SALES INVOICE(S) POSTED. ${Number(data.failed || 0)} FAILED. ${Number(data.skipped || 0)} SKIPPED.`);
      if (Number(data.posted || 0) > 0 && onPosted) await onPosted();
      if (Number(data.posted || 0) > 0) {
        const refreshed = await api("/transactions/sales-invoices/bulk-preview", { method: "POST", body: formFor({ validateMappings: true }) }).catch(() => null);
        if (refreshed) setPreview(refreshed);
      }
    } catch (error) {
      setMsg(upper(error.message || "BULK POSTING FAILED"));
    } finally {
      setBusy(false);
    }
  };

  const setParty = (key, value) => {
    setPartyMappings((current) => ({ ...current, [key]: value }));
    setPreview((current) => current ? { ...current, mode: "MANUAL_MAPPING", mappingRequired: true, validInvoices: 0 } : current);
    setResult(null);
  };

  const setProduct = (key, value) => {
    setProductMappings((current) => ({ ...current, [key]: value }));
    setPreview((current) => current ? { ...current, mode: "MANUAL_MAPPING", mappingRequired: true, validInvoices: 0 } : current);
    setResult(null);
  };

  const setAllUnmappedPartyCash = () => {
    if (!cashId) return;
    setPartyMappings((current) => {
      const next = { ...current };
      for (const row of preview?.uniqueParties || []) if (!next[row.key]) next[row.key] = cashId;
      return next;
    });
  };

  const setAllUnmappedProductsOfficeAsset = () => {
    if (!officeAssetId) return;
    setProductMappings((current) => {
      const next = { ...current };
      for (const row of preview?.uniqueProducts || []) if (!next[row.key]) next[row.key] = officeAssetId;
      return next;
    });
  };

  const summary = useMemo(() => ({
    rows: Number(preview?.receivedRows || 0),
    invoices: Array.isArray(preview?.invoices) ? preview.invoices.length : 0,
  }), [preview]);

  const rawHeaders = preview?.rawHeaders || [];
  const rawRows = preview?.rawRows || [];

  return (
    <>
      <button type="button" className="btn ghost bulkInvoiceScanTrigger" onClick={() => setOpen(true)} title="BULK SALES INVOICE XLS UPLOAD">
        <FileSpreadsheet size={15} /> BULK XLS UPLOAD
      </button>

      {open && <div className="modalOverlay scanFillOverlay"><section className="panel modalPanel bulkInvoiceScanModal">
        <div className="formTitle">
          <div><h3><FileSpreadsheet size={19} /> SALES INVOICE BULK XLS - MANUAL MASTER MAPPING</h3><span>LOAD XLS EXACTLY AS-IS → MANUALLY SEARCH PARTY BY NAME/GST → MANUALLY SEARCH PRODUCT FROM V2 → VALIDATE → POST.</span></div>
          <button className="iconBtn" type="button" onClick={close}><X /></button>
        </div>

        <div className="bulkInvoiceScanTopbar">
          <button type="button" className="btn ghost" onClick={downloadTemplate} disabled={busy}><Download size={15} /> DOWNLOAD TEMPLATE</button>
          <label className="bulkInvoiceFilePicker"><UploadCloud size={16} /><span>{file?.name ? upper(file.name) : "SELECT XLS / XLSX / CSV"}</span><input ref={fileRef} hidden type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setResult(null); setPartyMappings({}); setProductMappings({}); setMsg(""); }} /></label>
          <label><span>DEFAULT WAREHOUSE (REQUIRED FOR VALIDATE/POST)</span><select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPreview(null); }}><option value="">SELECT WAREHOUSE</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{upper(w.title || w.reference || "WAREHOUSE")}</option>)}</select></label>
          <label><span>TOTAL TOLERANCE ₹</span><input type="number" min="0" max="10" step="0.01" value={tolerance} onChange={(e) => { setTolerance(Math.max(0, Number(e.target.value || 0))); }} /></label>
          <button type="button" className="btn primary" disabled={!canLoad} onClick={loadXlsFields}><RefreshCw size={14} /> {busy ? "LOADING..." : "1. LOAD XLS AS-IS"}</button>
          {(file || preview) && <button type="button" className="btn ghost" onClick={reset} disabled={busy}>CLEAR</button>}
        </div>

        <div className="bulkInvoiceValidation">
          <b>MANUAL SAFE MODE:</b>
          <span>NO PARTY AUTO-MATCH</span><span>NO PRODUCT AUTO-MATCH</span><span>UNMAPPED PARTY → CASH ON VALIDATION</span><span>UNMAPPED PRODUCT → BLOCKED</span><span>SAME XLS NAME MAPS ONCE FOR ALL ROWS</span><span>ALL OTHER XLS VALUES ARE COPIED</span>
        </div>

        {msg && <div className={`resultBanner ${/READY|POSTED|DOWNLOADED|LOADED/i.test(msg) && !/FAILED|NEED REVIEW/i.test(msg) ? "good" : "bad"}`}>{msg}</div>}

        {preview && <>
          <div className="bulkInvoiceSummary">
            <span>{summary.rows} XLS ROWS</span><span>{summary.invoices} INVOICES</span>
            <b>{mappedPartyCount}/{Number(preview.uniqueParties?.length || 0)} PARTY MAPPED</b>
            <b>{mappedProductCount}/{Number(preview.uniqueProducts?.length || 0)} PRODUCT MAPPED</b>
            {!mappingMode && <><b>{validCount} READY</b><em>{invalidCount} NEED REVIEW</em></>}
          </div>

          {!!preview.rowErrors?.length && <div className="bulkInvoiceValidation"><b>FILE ERRORS:</b>{preview.rowErrors.map((e, i) => <span key={`${e.row}-${i}`}>ROW {e.row}: {upper(e.error)}</span>)}</div>}

          {!!rawRows.length && <section className="panel" style={{ marginTop: 12, padding: 12 }}>
            <div className="formTitle" style={{ marginBottom: 8 }}>
              <div><h3>1. XLS DATA LOADED AS-IS</h3><span>FIRST REVIEW THE EXACT VALUES READ FROM THE FILE. NOTHING IS MATCHED TO A DATABASE ID AT THIS STAGE.</span></div>
              <strong>{rawRows.length} ROW(S)</strong>
            </div>
            <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
              <table>
                <thead><tr><th>ROW</th>{rawHeaders.map((header) => <th key={header}>{header}</th>)}</tr></thead>
                <tbody>{rawRows.map((row) => <tr key={row.rowNo}><td><b>{row.rowNo}</b></td>{rawHeaders.map((header) => <td key={`${row.rowNo}-${header}`}>{upper(row.values?.[header] ?? "")}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </section>}

          <section className="panel" style={{ marginTop: 12, padding: 12 }}>
            <div className="formTitle" style={{ marginBottom: 8 }}><div><h3>PARTY MAPPING</h3><span>SEARCH THE LIVE CUSTOMER MASTER BY PARTY NAME OR GSTIN. ONE SELECTION APPLIES TO ALL SAME XLS PARTY ENTRIES.</span></div><button type="button" className="btn ghost" disabled={!cashId} onClick={setAllUnmappedPartyCash}>SET ALL UNMAPPED TO CASH</button></div>
            <div style={{ overflowX: "auto" }}><table><thead><tr><th>XLS PARTY</th><th>XLS GST NO</th><th>INVOICES</th><th>SEARCH V2 PARTY / GST</th><th>SELECTED V2 PARTY</th><th>QUICK</th></tr></thead><tbody>
              {(preview.uniqueParties || []).map((source) => {
                const selectedId = partyMappings[source.key] || "";
                const selected = selectedCustomers.get(String(selectedId));
                const query = partySearch[source.key] ?? source.partyName ?? source.gstin ?? "";
                const options = filterOptions(customerOptions, query, ["name", "gstin", "code"], selectedId);
                return <tr key={source.key}>
                  <td><b>{upper(source.partyName || "—")}</b></td><td>{upper(source.gstin || "—")}</td><td>{source.invoiceCount}</td>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Search size={14} /><input value={query} onChange={(e) => setPartySearch((current) => ({ ...current, [source.key]: e.target.value }))} placeholder="TYPE PARTY NAME OR GST" /></div></td>
                  <td><select value={selectedId} onChange={(e) => setParty(source.key, e.target.value)}><option value="">NOT SELECTED - WILL USE CASH</option>{options.map((row) => <option key={row.id} value={row.id}>{customerLabel(row)}</option>)}</select>{selected && <small>{customerLabel(selected)}</small>}</td>
                  <td><button type="button" className="btn ghost" disabled={!cashId} onClick={() => setParty(source.key, cashId)}>CASH</button></td>
                </tr>;
              })}
            </tbody></table></div>
          </section>

          <section className="panel" style={{ marginTop: 12, padding: 12 }}>
            <div className="formTitle" style={{ marginBottom: 8 }}><div><h3>PRODUCT MAPPING</h3><span>SEARCH THE LIVE V2 PRODUCT MASTER. ONE SELECTION APPLIES TO EVERY SAME XLS PRODUCT NAME.</span></div><button type="button" className="btn ghost" disabled={!officeAssetId} onClick={setAllUnmappedProductsOfficeAsset}>OFFICE ASSET FOR ALL UNMAPPED</button></div>
            <div style={{ overflowX: "auto" }}><table><thead><tr><th>XLS PRODUCT</th><th>ROWS</th><th>SEARCH V2 PRODUCT</th><th>SELECTED V2 PRODUCT</th><th>QUICK</th></tr></thead><tbody>
              {(preview.uniqueProducts || []).map((source) => {
                const selectedId = productMappings[source.key] || "";
                const selected = selectedProducts.get(String(selectedId));
                const query = productSearch[source.key] ?? source.productName ?? "";
                const options = filterOptions(productOptions, query, ["name", "sku"], selectedId);
                return <tr key={source.key}>
                  <td><b>{upper(source.productName)}</b></td><td>{source.rowCount}</td>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Search size={14} /><input value={query} onChange={(e) => setProductSearch((current) => ({ ...current, [source.key]: e.target.value }))} placeholder="TYPE PRODUCT NAME OR SKU" /></div></td>
                  <td><select value={selectedId} onChange={(e) => setProduct(source.key, e.target.value)}><option value="">SELECT V2 PRODUCT</option>{options.map((row) => <option key={row.id} value={row.id}>{productLabel(row)}</option>)}</select>{selected && <small>{productLabel(selected)}</small>}</td>
                  <td><button type="button" className="btn ghost" disabled={!officeAssetId} onClick={() => setProduct(source.key, officeAssetId)}>OFFICE ASSET</button></td>
                </tr>;
              })}
            </tbody></table></div>
          </section>

          <div className="formActions" style={{ marginTop: 12 }}>
            <button type="button" className="btn primary" disabled={busy || !file || !warehouseId} onClick={validateMappedData}><CheckCircle2 size={15} /> {busy ? "VALIDATING..." : "2. VALIDATE SELECTED MAPPINGS"}</button>
          </div>

          <div className="bulkInvoiceCards">
            {(preview.invoices || []).map((invoice, index) => {
              const mappedParty = selectedCustomers.get(String(partyMappings[invoice.partyMappingKey] || invoice.customerGlobalId || ""));
              return <article key={invoice.key || `${invoice.invoiceNo}-${index}`} className={`bulkInvoiceCard ${!mappingMode && invoice.valid ? "ready" : "needsReview"}`}>
                <div className="bulkInvoiceCardHead">
                  {!mappingMode && invoice.valid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span><b>{index + 1}. INVOICE {upper(invoice.invoiceNo)} • {upper(invoice.partyNameInput || invoice.gstin || "CASH")}</b><small>{invoice.date} • FY {invoice.financialYear || "—"}</small></span>
                  <strong className={!mappingMode && invoice.valid ? "scanReady" : "scanNeeds"}>{mappingMode ? "MAPPING" : invoice.valid ? "READY" : `${invoice.errors?.length || 0} CHECK(S)`}</strong>
                </div>
                <div className="bulkInvoiceCardBody">
                  <div className="bulkInvoiceHeaderGrid">
                    <label><span>XLS PARTY</span><input readOnly value={upper(invoice.partyNameInput || "")} /></label>
                    <label><span>XLS GST NO</span><input readOnly value={upper(invoice.gstin || "")} /></label>
                    <label><span>SELECTED PARTY</span><input readOnly value={upper(invoice.customerName || mappedParty?.name || "CASH IF UNMAPPED")} /></label>
                    <label><span>DATE</span><input readOnly value={invoice.date || ""} /></label>
                    <label><span>INVOICE NO</span><input readOnly value={upper(invoice.invoiceNo)} /></label>
                    <label><span>XLS INVOICE TOTAL</span><input readOnly value={money(invoice.expectedTotal)} /></label>
                    <label><span>BILL DISCOUNT</span><input readOnly value={money(invoice.billDiscount)} /></label>
                    <label><span>OTHER CHARGES</span><input readOnly value={money(invoice.otherCharges)} /></label>
                    <label><span>XLS WAREHOUSE</span><input readOnly value={upper(invoice.warehouseInput || "DEFAULT V2 WAREHOUSE")} /></label>
                    <label><span>REMARKS</span><input readOnly value={upper(invoice.remarks || "")} /></label>
                    {!mappingMode && <><label><span>V2 CALCULATED TOTAL</span><input readOnly value={money(invoice.calculatedTotal)} /></label><label><span>DIFFERENCE</span><input readOnly value={money(invoice.difference)} /></label><label><span>TAXABLE</span><input readOnly value={money(invoice.taxableTotal)} /></label><label><span>GST</span><input readOnly value={money(invoice.taxTotal)} /></label><label><span>ROUND OFF</span><input readOnly value={money(invoice.roundOff)} /></label></>}
                  </div>
                  <div className="bulkInvoiceItems"><table><thead><tr><th>#</th><th>XLS PRODUCT</th><th>SELECTED V2 PRODUCT</th><th>QNTY</th><th>BASIC SALE PRICE</th><th>DISC %</th><th>GST %</th><th>STOCK</th></tr></thead><tbody>{(invoice.items || []).map((item, itemIndex) => {
                    const selected = selectedProducts.get(String(productMappings[item.productMappingKey] || item.productId || ""));
                    return <tr key={`${item.rowNo}-${itemIndex}`}><td>{itemIndex + 1}</td><td>{upper(item.productName)}</td><td>{upper(item.matchedProduct || selected?.name || "NOT SELECTED")}</td><td>{item.qty}</td><td>{money(item.basicSalePrice)}</td><td>{Number(item.discountPct || 0).toFixed(2)}%</td><td>{Number(item.gstRate ?? selected?.gstRate ?? 0).toFixed(2)}%</td><td>{item.matched ? Number(item.availableStock || 0) : selected ? Number(selected.stock || 0) : "—"}</td></tr>;
                  })}</tbody></table></div>
                  {!!invoice.warnings?.length && <div className="bulkInvoiceValidation"><b>WARNINGS:</b>{invoice.warnings.map((x, i) => <span key={i}>{upper(x)}</span>)}</div>}
                  {!!invoice.errors?.length && <div className="bulkInvoiceValidation"><b>BLOCKED:</b>{invoice.errors.map((x, i) => <span key={i}>{upper(x)}</span>)}</div>}
                </div>
              </article>;
            })}
          </div>
        </>}

        {result && <div className="bulkInvoiceValidation"><b>POSTING RESULT:</b>{(result.results || []).map((x, i) => <span key={`${x.invoiceNo}-${i}`}>{upper(x.invoiceNo)}: {upper(x.status)}{x.errors?.length ? ` - ${upper(x.errors.join(" / "))}` : ""}</span>)}</div>}

        <div className="formActions bulkInvoiceActions">
          <button type="button" className="btn ghost" onClick={close}>CLOSE</button>
          <button type="button" className="btn primary" disabled={busy || !validCount || mappingMode} onClick={postValid}><CheckCircle2 size={15} />{busy ? "PROCESSING..." : `3. POST VALID INVOICES (${validCount})`}</button>
          {preview && !mappingMode && invalidCount > 0 && <span className="oldDmsEmpty">INVALID INVOICES ARE NEVER POSTED. CHANGE THE MAPPING AND VALIDATE AGAIN.</span>}
        </div>
      </section></div>}
    </>
  );
}
