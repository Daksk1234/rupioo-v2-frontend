import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Plus, RefreshCw, ScanLine, Trash2, Upload, X } from "lucide-react";
import { api } from "../lib/api.js";
import { fetchTransactionParties, partyGstin, partyOptionLabel } from "../lib/partyDirectory.js";

const round2 = (n) => Number((Number(n) || 0).toFixed(2));
const clean = (v) => String(v ?? "").trim();
const ymd = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? clean(v).slice(0, 10) : d.toISOString().slice(0, 10);
};
const fyForDate = (value) => {
  const d = value ? new Date(value) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const y = safe.getMonth() >= 3 ? safe.getFullYear() : safe.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
};
const emptyItem = () => ({ productId: "", name: "", hsnCode: "", qty: 1, unit: "", rate: 0, gstRate: 0, discountPct: 0, productMatches: [] });

async function fetchAllPaged(path, limit = 200) {
  const separator = path.includes("?") ? "&" : "?";
  const first = await api(`${path}${separator}page=1&limit=${limit}`);
  const firstItems = Array.isArray(first?.items) ? first.items : [];
  const pages = Math.max(1, Number(first?.meta?.pages || 1));
  if (pages <= 1) return firstItems;
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => api(`${path}${separator}page=${i + 2}&limit=${limit}`)));
  return [...firstItems, ...rest.flatMap((x) => Array.isArray(x?.items) ? x.items : [])];
}

export default function BulkInvoiceScan({ type = "SALES", onPosted }) {
  const isSales = String(type).toUpperCase() === "SALES";
  const documentType = isSales ? "SALES_INVOICE" : "PURCHASE_INVOICE";
  const targetPath = isSales ? "/dms/sales-invoices" : "/dms/purchase-invoices";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState("");
  const [records, setRecords] = useState([]);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const fileRef = useRef(null);

  const loadMasters = async () => {
    try {
      const [partyRows, productRows, wh] = await Promise.all([
        fetchTransactionParties(200),
        fetchAllPaged("/products?status=ACTIVE", 200),
        isSales ? api("/modules/dms/warehouses?status=ACTIVE&limit=200").catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      ]);
      setParties(partyRows);
      setProducts(productRows);
      const warehouseRows = Array.isArray(wh) ? wh : (wh?.items || []);
      setWarehouses(warehouseRows);
      if (isSales && warehouseRows.length === 1) setDefaultWarehouseId(String(warehouseRows[0]._id || ""));
    } catch (e) {
      setMsg(e.message || "Could not load invoice masters");
    }
  };

  useEffect(() => {
    if (open) loadMasters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const findParty = (values = {}) => {
    const id = clean(values[isSales ? "customerGlobalId" : "supplierGlobalId"]);
    if (id) return parties.find((p) => String(p.globalCustomerId) === id) || null;
    const gstin = clean(values[isSales ? "customerGstin" : "supplierGstin"]).toUpperCase();
    if (gstin) {
      const byGst = parties.find((p) => partyGstin(p).toUpperCase() === gstin);
      if (byGst) return byGst;
    }
    const name = clean(values[isSales ? "customerName" : "supplierName"]).toLowerCase();
    return name ? parties.find((p) => clean(p.localName || p.legalName).toLowerCase() === name) || null : null;
  };

  const findProduct = (item = {}) => {
    if (item.productId) return products.find((p) => String(p._id) === String(item.productId)) || null;
    const sku = clean(item.sku).toLowerCase();
    if (sku) {
      const bySku = products.find((p) => clean(p.sku).toLowerCase() === sku);
      if (bySku) return bySku;
    }
    const name = clean(item.name).toLowerCase();
    return name ? products.find((p) => clean(p.name).toLowerCase() === name) || null : null;
  };

  const normalizeRecord = (result, file, index) => {
    const values = { ...(result?.extraction?.values || {}) };
    const suggestedParty = findParty(values);
    const normalizedItems = (Array.isArray(result?.extraction?.items) ? result.extraction.items : []).map((raw) => {
      const p = findProduct(raw);
      return {
        ...emptyItem(),
        ...raw,
        productId: p?._id || raw.productId || "",
        name: p?.name || raw.name || "",
        hsnCode: raw.hsnCode || p?.hsnCode || "",
        unit: raw.unit || p?.basicUnit || p?.unit || "",
        gstRate: Number(raw.gstRate ?? p?.gstRate ?? 0),
        rate: Number(raw.rate || 0),
        qty: Number(raw.qty || 0),
        discountPct: Number(raw.discountPct || 0),
      };
    });
    const partyId = suggestedParty?.globalCustomerId || values[isSales ? "customerGlobalId" : "supplierGlobalId"] || "";
    const partyName = suggestedParty?.localName || suggestedParty?.legalName || values[isSales ? "customerName" : "supplierName"] || "";
    const gstin = partyGstin(suggestedParty) || values[isSales ? "customerGstin" : "supplierGstin"] || "";
    const warehouseId = isSales ? (values.warehouseId || defaultWarehouseId || (warehouses.length === 1 ? String(warehouses[0]._id) : "")) : "";
    return {
      key: `${Date.now()}-${index}-${Math.random()}`,
      fileName: file.name,
      scanId: result.scanId,
      fileId: result.fileId,
      engine: result?.extraction?.engine || "",
      open: true,
      posted: false,
      postedInvoiceNo: "",
      error: "",
      warnings: result?.extraction?.warnings || [],
      values: {
        ...values,
        invoiceNo: clean(values.invoiceNo),
        date: ymd(values.date) || new Date().toISOString().slice(0, 10),
        partyId,
        partyName,
        gstin,
        warehouseId,
        billDiscount: Number(values.billDiscount || 0),
        otherCharges: Number(values.otherCharges || 0),
        transportationCost: Number(values.transportationCost || 0),
        labourCost: Number(values.labourCost || 0),
        localFreight: Number(values.localFreight || 0),
        miscellaneousCost: Number(values.miscellaneousCost || 0),
        taxableValue: Number(values.taxableValue || 0),
        invoiceValue: Number(values.invoiceValue || 0),
        cgstAmount: Number(values.cgstAmount || 0),
        sgstAmount: Number(values.sgstAmount || 0),
        igstAmount: Number(values.igstAmount || 0),
        roundOff: Number(values.roundOff || 0),
      },
      items: normalizedItems.length ? normalizedItems : [emptyItem()],
    };
  };

  const scanFiles = async (files) => {
    const list = Array.from(files || []).slice(0, 40);
    if (!list.length) return;
    setBusy(true);
    setMsg(`Scanning 0 of ${list.length} invoices…`);
    const next = [];
    for (let i = 0; i < list.length; i += 1) {
      const file = list[i];
      try {
        setMsg(`Scanning ${i + 1} of ${list.length}: ${file.name}`);
        const body = new FormData();
        body.append("document", file);
        body.append("documentType", documentType);
        const result = await api("/document-ai/extract", { method: "POST", body });
        next.push(normalizeRecord(result, file, i));
      } catch (e) {
        next.push({
          key: `${Date.now()}-${i}-${Math.random()}`,
          fileName: file.name,
          scanId: "",
          fileId: "",
          engine: "",
          open: true,
          posted: false,
          postedInvoiceNo: "",
          error: e.message || "Scan failed",
          warnings: [],
          values: { invoiceNo: "", date: new Date().toISOString().slice(0, 10), partyId: "", partyName: "", gstin: "", warehouseId: defaultWarehouseId, billDiscount: 0, otherCharges: 0, transportationCost: 0, labourCost: 0, localFreight: 0, miscellaneousCost: 0 },
          items: [emptyItem()],
        });
      }
    }
    setRecords(next);
    setBusy(false);
    setMsg(`Scanned ${next.filter((x) => !x.error).length} of ${list.length}. Review before posting.`);
  };

  const updateRecord = (key, updater) => setRecords((list) => list.map((r) => r.key === key ? (typeof updater === "function" ? updater(r) : { ...r, ...updater }) : r));
  const setValue = (key, field, value) => updateRecord(key, (r) => ({ ...r, error: "", values: { ...r.values, [field]: value } }));
  const setItem = (key, index, field, value) => updateRecord(key, (r) => ({ ...r, error: "", items: r.items.map((item, i) => i === index ? { ...item, [field]: value } : item) }));

  const selectParty = (recordKey, partyId) => {
    const party = parties.find((p) => String(p.globalCustomerId) === String(partyId));
    updateRecord(recordKey, (r) => ({
      ...r,
      error: "",
      values: {
        ...r.values,
        partyId: partyId || "",
        partyName: party?.localName || party?.legalName || "",
        gstin: partyGstin(party),
      },
    }));
  };

  const selectProduct = (recordKey, itemIndex, productId) => {
    const p = products.find((x) => String(x._id) === String(productId));
    updateRecord(recordKey, (r) => ({
      ...r,
      error: "",
      items: r.items.map((item, i) => i === itemIndex ? {
        ...item,
        productId: productId || "",
        name: p?.name || item.name || "",
        hsnCode: p?.hsnCode || item.hsnCode || "",
        unit: p?.basicUnit || p?.unit || item.unit || "",
        gstRate: Number(item.gstRate || p?.gstRate || 0),
      } : item),
    }));
  };

  const errorsFor = (record) => {
    const errors = [];
    if (record.error && !record.scanId) errors.push(record.error);
    if (!clean(record.values.invoiceNo)) errors.push("Invoice No. required");
    if (!record.values.date) errors.push("Invoice Date required");
    if (!record.values.partyId) errors.push(`${isSales ? "Customer" : "Supplier"} must be matched`);
    if (isSales && !record.values.warehouseId) errors.push("Warehouse required");
    if (!record.items.length) errors.push("At least one product required");
    record.items.forEach((item, i) => {
      if (!item.productId) errors.push(`Row ${i + 1}: select product`);
      if (Number(item.qty || 0) <= 0) errors.push(`Row ${i + 1}: qty must be > 0`);
      if (Number(item.rate || 0) < 0) errors.push(`Row ${i + 1}: rate is invalid`);
    });
    return errors;
  };

  const readyCount = useMemo(() => records.filter((r) => !r.posted && errorsFor(r).length === 0).length, [records]);
  const postedCount = useMemo(() => records.filter((r) => r.posted).length, [records]);

  const postRecord = async (record) => {
    const financialYear = fyForDate(record.values.date);
    const common = {
      invoiceNo: clean(record.values.invoiceNo),
      date: record.values.date,
      financialYear,
      billDiscount: Number(record.values.billDiscount || 0),
      otherCharges: Number(record.values.otherCharges || 0),
      remarks: record.values.remarks || `Bulk Scan & Fill • ${record.fileName}`,
    };
    if (isSales) {
      const items = record.items.map((item) => {
        const gst = Number(item.gstRate || 0);
        const basic = Number(item.rate || 0);
        return {
          productId: item.productId,
          qty: Number(item.qty || 0),
          mrp: Number(item.mrp || 0),
          basicRate: basic,
          saleRate: round2(basic * (1 + gst / 100)),
          discountPct: Number(item.discountPct || 0),
          gradeDiscountPct: 0,
          gstRate: gst,
        };
      });
      return api("/transactions/sales-invoices", {
        method: "POST",
        body: JSON.stringify({
          ...common,
          importSource: "SCAN_FILL",
          customerGlobalId: record.values.partyId,
          warehouseId: record.values.warehouseId,
          orderNo: record.values.orderNo || "",
          arn: record.values.arn || "",
          noOfPackages: Number(record.values.noOfPackages || 0),
          items,
        }),
      });
    }
    return api("/transactions/purchase-invoices", {
      method: "POST",
      body: JSON.stringify({
        ...common,
        supplierGlobalId: record.values.partyId,
        supplierName: record.values.partyName,
        supplierGstin: record.values.gstin,
        purchaseType: "GST",
        transportationCost: Number(record.values.transportationCost || 0),
        labourCost: Number(record.values.labourCost || 0),
        localFreight: Number(record.values.localFreight || 0),
        miscellaneousCost: Number(record.values.miscellaneousCost || 0),
        items: record.items.map((item) => ({
          productId: item.productId,
          qty: Number(item.qty || 0),
          rate: Number(item.rate || 0),
          discountPct: Number(item.discountPct || 0),
          gstRate: Number(item.gstRate || 0),
        })),
      }),
    });
  };

  const postReady = async () => {
    if (!records.length) return;
    setPosting(true);
    setMsg("");
    let success = 0;
    for (const record of records) {
      if (record.posted) continue;
      const validation = errorsFor(record);
      if (validation.length) {
        updateRecord(record.key, { error: validation[0], open: true });
        continue;
      }
      try {
        const saved = await postRecord(record);
        if (record.scanId) {
          await api(`/document-ai/scans/${encodeURIComponent(record.scanId)}/review`, {
            method: "POST",
            body: JSON.stringify({ status: "IMPORTED_TO_INVOICE", values: record.values, items: record.items, targetPath }),
          }).catch(() => null);
        }
        success += 1;
        updateRecord(record.key, { posted: true, postedInvoiceNo: saved?.invoiceNo || record.values.invoiceNo, error: "", open: false });
      } catch (e) {
        updateRecord(record.key, { error: e.message || "Invoice could not be posted", open: true });
      }
    }
    setPosting(false);
    setMsg(`${success} invoice${success === 1 ? "" : "s"} posted. ${records.length - postedCount - success} still need review/correction.`);
    if (success) onPosted?.();
  };

  const reset = () => {
    setRecords([]);
    setMsg("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return <>
    <button type="button" className="btn ghost bulkInvoiceScanTrigger" onClick={() => setOpen(true)} title={`Bulk scan ${isSales ? "sales" : "purchase"} invoices`}><ScanLine size={15}/>Bulk Scan</button>
    {open && <div className="modalOverlay scanFillOverlay"><section className="panel modalPanel bulkInvoiceScanModal">
      <div className="formTitle"><div><h3><ScanLine size={19}/>Bulk {isSales ? "Sales" : "Purchase"} Invoice Scan</h3><span>Old-DMS text PDFs are read locally without an OpenAI key. Upload → auto-read → review → post.</span></div><button className="iconBtn" type="button" onClick={() => setOpen(false)}><X/></button></div>

      <div className="bulkInvoiceScanTopbar">
        <label className="bulkInvoiceFilePicker"><Upload size={16}/><span>Select invoices</span><input ref={fileRef} hidden type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" onChange={(e) => scanFiles(e.target.files)}/></label>
        {isSales && <label><span>Default Warehouse</span><select value={defaultWarehouseId} onChange={(e) => setDefaultWarehouseId(e.target.value)}><option value="">Choose warehouse</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.title || w.reference || "Warehouse"}</option>)}</select></label>}
        <button type="button" className="btn ghost" onClick={loadMasters}><RefreshCw size={14}/>Refresh Masters</button>
        {!!records.length && <button type="button" className="btn ghost" onClick={reset}>Clear Batch</button>}
      </div>

      {busy && <div className="scanWorking"><span className="spinnerDot"/>{msg}</div>}
      {!busy && msg && <div className={`resultBanner ${/posted|scanned/i.test(msg) ? "good" : "bad"}`}>{msg}</div>}

      {!!records.length && <div className="bulkInvoiceSummary"><span>{records.length} scanned</span><b>{readyCount} ready</b><strong>{postedCount} posted</strong><em>{records.length - readyCount - postedCount} need review</em></div>}

      <div className="bulkInvoiceCards">
        {records.map((record, index) => {
          const validation = errorsFor(record);
          return <article key={record.key} className={`bulkInvoiceCard ${record.posted ? "posted" : validation.length ? "needsReview" : "ready"}`}>
            <button type="button" className="bulkInvoiceCardHead" onClick={() => updateRecord(record.key, (r) => ({ ...r, open: !r.open }))}>
              {record.open ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}<span><b>{index + 1}. {record.fileName}</b><small>{record.values.invoiceNo || "Invoice no. pending"} • {record.values.partyName || "Party pending"} • {record.values.date || "Date pending"}{record.engine ? ` • ${record.engine === "OLD_DMS_PDF" ? "Local PDF Reader" : record.engine}` : ""}</small></span>
              {record.posted ? <strong className="scanPosted"><CheckCircle2 size={14}/>Posted {record.postedInvoiceNo}</strong> : validation.length ? <strong className="scanNeeds"><AlertTriangle size={14}/>{validation.length} check{validation.length === 1 ? "" : "s"}</strong> : <strong className="scanReady"><CheckCircle2 size={14}/>Ready</strong>}
            </button>
            {record.open && <div className="bulkInvoiceCardBody">
              {record.error && <div className="resultBanner bad">{record.error}</div>}
              {!!record.warnings.length && <div className="scanWarnings"><AlertTriangle size={15}/><div>{record.warnings.map((w, i) => <div key={i}>{w}</div>)}</div></div>}
              <div className="bulkInvoiceHeaderGrid">
                <label><span>Invoice No. *</span><input value={record.values.invoiceNo || ""} onChange={(e) => setValue(record.key, "invoiceNo", e.target.value)}/></label>
                <label><span>Invoice Date *</span><input type="date" value={record.values.date || ""} onChange={(e) => setValue(record.key, "date", e.target.value)}/><small>FY {fyForDate(record.values.date)}</small></label>
                <label className="wide"><span>{isSales ? "Customer" : "Supplier"} *</span><select value={record.values.partyId || ""} onChange={(e) => selectParty(record.key, e.target.value)}><option value="">Select party</option>{parties.map((p) => <option key={p.globalCustomerId} value={p.globalCustomerId}>{partyOptionLabel(p)}</option>)}</select></label>
                <label><span>GSTIN</span><input value={record.values.gstin || ""} onChange={(e) => setValue(record.key, "gstin", e.target.value.toUpperCase())}/></label>
                {isSales && <label><span>Warehouse *</span><select value={record.values.warehouseId || ""} onChange={(e) => setValue(record.key, "warehouseId", e.target.value)}><option value="">Select warehouse</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.title || w.reference || "Warehouse"}</option>)}</select></label>}
                {isSales && <label><span>Order No.</span><input value={record.values.orderNo || ""} onChange={(e) => setValue(record.key, "orderNo", e.target.value)}/></label>}
                <label><span>Bill Discount</span><input type="number" step="0.01" value={record.values.billDiscount || 0} onChange={(e) => setValue(record.key, "billDiscount", Number(e.target.value))}/></label>
                <label><span>Other Charges</span><input type="number" step="0.01" value={record.values.otherCharges || 0} onChange={(e) => setValue(record.key, "otherCharges", Number(e.target.value))}/></label>
                <label><span>Scanned Taxable / Basic Value</span><input readOnly value={Number(record.values.taxableValue || 0).toFixed(2)}/></label>
                <label><span>Scanned Invoice Value</span><input readOnly value={Number(record.values.invoiceValue || 0).toFixed(2)}/></label>
                <label><span>Scanned GST</span><input readOnly value={(Number(record.values.cgstAmount || 0)+Number(record.values.sgstAmount || 0)+Number(record.values.igstAmount || 0)).toFixed(2)}/></label>
                <label><span>Scanned Round Off</span><input readOnly value={Number(record.values.roundOff || 0).toFixed(2)}/></label>
                {!isSales && <><label><span>Transportation</span><input type="number" step="0.01" value={record.values.transportationCost || 0} onChange={(e) => setValue(record.key, "transportationCost", Number(e.target.value))}/></label><label><span>Labour</span><input type="number" step="0.01" value={record.values.labourCost || 0} onChange={(e) => setValue(record.key, "labourCost", Number(e.target.value))}/></label><label><span>Local Freight</span><input type="number" step="0.01" value={record.values.localFreight || 0} onChange={(e) => setValue(record.key, "localFreight", Number(e.target.value))}/></label><label><span>Misc.</span><input type="number" step="0.01" value={record.values.miscellaneousCost || 0} onChange={(e) => setValue(record.key, "miscellaneousCost", Number(e.target.value))}/></label></>}
                <label className="wide"><span>Remarks</span><textarea value={record.values.remarks || ""} onChange={(e) => setValue(record.key, "remarks", e.target.value)}/></label>
              </div>

              <div className="bulkInvoiceItems"><table><thead><tr><th>#</th><th>Product *</th><th>HSN</th><th>Qty *</th><th>Unit</th><th>{isSales ? "Basic Rate" : "Purchase Rate"} *</th><th>GST %</th><th>Disc %</th><th></th></tr></thead><tbody>{record.items.map((item, itemIndex) => <tr key={itemIndex}><td>{itemIndex + 1}</td><td><select value={item.productId || ""} onChange={(e) => selectProduct(record.key, itemIndex, e.target.value)}><option value="">Select product</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}{p.sku ? ` • ${p.sku}` : ""}</option>)}</select>{!item.productId && item.name && <small>Scanned: {item.name}</small>}</td><td><input value={item.hsnCode || ""} onChange={(e) => setItem(record.key, itemIndex, "hsnCode", e.target.value)}/></td><td><input type="number" step="0.001" value={item.qty || 0} onChange={(e) => setItem(record.key, itemIndex, "qty", Number(e.target.value))}/></td><td><input value={item.unit || ""} onChange={(e) => setItem(record.key, itemIndex, "unit", e.target.value)}/></td><td><input type="number" step="0.01" value={item.rate || 0} onChange={(e) => setItem(record.key, itemIndex, "rate", Number(e.target.value))}/></td><td><input type="number" step="0.01" value={item.gstRate || 0} onChange={(e) => setItem(record.key, itemIndex, "gstRate", Number(e.target.value))}/></td><td><input type="number" step="0.01" value={item.discountPct || 0} onChange={(e) => setItem(record.key, itemIndex, "discountPct", Number(e.target.value))}/></td><td><button type="button" className="iconBtn" disabled={record.items.length === 1} onClick={() => updateRecord(record.key, (r) => ({ ...r, items: r.items.filter((_, i) => i !== itemIndex) }))}><Trash2 size={13}/></button></td></tr>)}</tbody></table><button type="button" className="btn ghost bulkInvoiceAddLine" onClick={() => updateRecord(record.key, (r) => ({ ...r, items: [...r.items, emptyItem()] }))}><Plus size={14}/>Add Product</button></div>

              {!!validation.length && <div className="bulkInvoiceValidation"><b>Before posting:</b>{validation.map((x, i) => <span key={i}>{x}</span>)}</div>}
            </div>}
          </article>;
        })}
      </div>

      <div className="formActions bulkInvoiceActions"><button type="button" className="btn ghost" onClick={() => setOpen(false)}>Close</button><button type="button" className="btn primary" disabled={posting || !records.some((r) => !r.posted)} onClick={postReady}><CheckCircle2 size={15}/>{posting ? "Posting…" : `Post Ready Invoices (${readyCount})`}</button></div>
    </section></div>}
  </>;
}
