import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api, getUser } from "../lib/api.js";
import { localToday } from "../lib/financialYear.js";
import "../sales-with-product.css";

const today = localToday;
const clean = (value) => String(value ?? "").trim();
const upper = (value) => clean(value).toUpperCase();
const money = (value) => Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decimal = (value) => {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (value) => Number((Number(value || 0)).toFixed(2));
let rowSeed = 0;

const financialYearFromDate = (dateValue) => {
  const value = clean(dateValue);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return "";
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
};

const draftStorageKey = () => {
  const user = getUser() || {};
  const tenant = clean(user.tenantKey || user.tenantId || sessionStorage.getItem("rupioo_tenant_id") || "tenant");
  const identity = clean(user._id || user.id || user.email || user.username || "user");
  return `rupioo:sales-with-product:draft:${tenant}:${identity}`;
};

const serializableRows = (rows) => rows.map(({ lookupBusy, error, ...row }) => ({ ...row }));
const readLocalDraft = (storageKey) => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    const source = Array.isArray(parsed) ? parsed : parsed?.rows;
    return { rows: Array.isArray(source) ? source : [], updatedAt: parsed?.updatedAt || "" };
  } catch {
    return { rows: [], updatedAt: "" };
  }
};
const writeLocalDraft = (storageKey, rows) => {
  const updatedAt = new Date().toISOString();
  window.localStorage.setItem(storageKey, JSON.stringify({ rows: serializableRows(rows), updatedAt }));
  return updatedAt;
};

const blankRow = (copy = {}) => ({
  id: `swp-${Date.now()}-${++rowSeed}`,
  date: copy.date || today(),
  invoiceNo: copy.invoiceNo || "",
  customerName: copy.customerName || "",
  customerGlobalId: copy.customerGlobalId || "",
  gstin: copy.gstin || "",
  productName: "",
  productId: "",
  sku: "",
  hsn: "",
  qty: "",
  unit: "",
  unitOptions: [],
  rate: "",
  discountPct: "",
  basicAmount: 0,
  groupBasicTotal: 0,
  taxable: 0,
  gstRate: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
  productTotal: 0,
  invoiceTotal: 0,
  warehouseId: "",
  warehouseName: "",
  salespersonId: copy.salespersonId || "",
  salespersonName: copy.salespersonName || "",
  gstType: copy.gstType || "CGST_SGST",
  cashCustomer: Boolean(copy.cashCustomer),
  lookupBusy: false,
  error: "",
});

const restoreDraftRow = (source = {}) => ({
  ...blankRow(source),
  ...source,
  id: clean(source.id) || `swp-${Date.now()}-${++rowSeed}`,
  unitOptions: Array.isArray(source.unitOptions) ? source.unitOptions : [],
  lookupBusy: false,
  error: clean(source.error),
});

const hasMeaningfulData = (row) => Boolean(
  clean(row.invoiceNo) || clean(row.gstin) || clean(row.productName) || clean(row.qty) || clean(row.rate)
);

const invoiceGroupKey = (row) => {
  const date = clean(row.date);
  const invoiceNo = upper(row.invoiceNo);
  const gstin = upper(row.gstin);
  if (!date || !invoiceNo) return `ROW:${row.id}`;
  return `${date}|${invoiceNo}|${gstin}`;
};

const calculateRows = (source) => {
  const lines = source.map((row) => {
    const qty = Math.max(0, decimal(row.qty));
    const rate = Math.max(0, decimal(row.rate));
    const discountPct = Math.min(100, Math.max(0, decimal(row.discountPct)));
    const basicAmount = round2(qty * rate);
    const taxable = round2(basicAmount * (1 - discountPct / 100));
    const gstRate = Math.max(0, decimal(row.gstRate));
    const tax = round2(taxable * gstRate / 100);
    const isIgst = upper(row.gstType) === "IGST";
    return {
      ...row,
      basicAmount,
      taxable,
      cgst: isIgst ? 0 : round2(tax / 2),
      sgst: isIgst ? 0 : round2(tax / 2),
      igst: isIgst ? tax : 0,
      productTotal: round2(taxable + tax),
    };
  });

  const totals = new Map();
  lines.forEach((row) => {
    const key = invoiceGroupKey(row);
    const current = totals.get(key) || { basic: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, grand: 0 };
    current.basic = round2(current.basic + Number(row.basicAmount || 0));
    current.taxable = round2(current.taxable + Number(row.taxable || 0));
    current.cgst = round2(current.cgst + Number(row.cgst || 0));
    current.sgst = round2(current.sgst + Number(row.sgst || 0));
    current.igst = round2(current.igst + Number(row.igst || 0));
    current.grand = round2(current.grand + Number(row.productTotal || 0));
    totals.set(key, current);
  });

  return lines.map((row) => {
    const total = totals.get(invoiceGroupKey(row)) || {};
    return { ...row, groupBasicTotal: total.basic || 0, invoiceTotal: total.grand || 0 };
  });
};

function ReadOnlyBox({ value, moneyValue = false, title = "" }) {
  return <div className="swp-readonly" title={title || String(value ?? "")}>{moneyValue ? `₹${money(value)}` : (value || "—")}</div>;
}

export default function SalesWithProductPage() {
  const [rows, setRows] = useState(() => calculateRows([blankRow()]));
  const [productOptions, setProductOptions] = useState({});
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftStatus, setDraftStatus] = useState("Loading saved draft…");
  const [draftUpdatedAt, setDraftUpdatedAt] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [creatingKeys, setCreatingKeys] = useState(() => new Set());
  const [creatingAll, setCreatingAll] = useState(false);
  const [uploading, setUploading] = useState(false);
  const productTimers = useRef({});
  const draftTimer = useRef(null);
  const saveSequence = useRef(0);
  const uploadInput = useRef(null);
  const storageKey = draftStorageKey();

  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach((row, index) => {
      const key = invoiceGroupKey(row);
      if (!map.has(key)) map.set(key, { key, rows: [], indexes: [] });
      map.get(key).rows.push(row);
      map.get(key).indexes.push(index);
    });
    return [...map.values()];
  }, [rows]);

  const groupByKey = useMemo(() => new Map(groups.map((group) => [group.key, group])), [groups]);
  const lastIndexByGroup = useMemo(() => {
    const out = new Map();
    groups.forEach((group) => out.set(group.key, Math.max(...group.indexes)));
    return out;
  }, [groups]);

  const removeRowsWhoseInvoiceExists = async (sourceRows) => {
    const wanted = new Map();
    sourceRows.forEach((row) => {
      const invoiceNo = upper(row.invoiceNo);
      const financialYear = financialYearFromDate(row.date);
      if (!invoiceNo || !financialYear) return;
      if (!wanted.has(financialYear)) wanted.set(financialYear, new Set());
      wanted.get(financialYear).add(invoiceNo);
    });
    if (!wanted.size) return sourceRows;

    const found = new Set();
    for (const [financialYear, pendingSet] of wanted.entries()) {
      let page = 1;
      let pages = 1;
      while (page <= pages && pendingSet.size) {
        const result = await api(`/transactions/sales-invoices?financialYear=${encodeURIComponent(financialYear)}&page=${page}&limit=100`);
        const items = Array.isArray(result?.items) ? result.items : [];
        items.forEach((invoice) => {
          const invoiceNo = upper(invoice?.invoiceNo);
          if (pendingSet.has(invoiceNo)) {
            found.add(`${financialYear}|${invoiceNo}`);
            pendingSet.delete(invoiceNo);
          }
        });
        pages = Math.max(1, Number(result?.meta?.pages || 1));
        page += 1;
      }
    }

    return sourceRows.filter((row) => {
      const invoiceNo = upper(row.invoiceNo);
      const financialYear = financialYearFromDate(row.date);
      return !found.has(`${financialYear}|${invoiceNo}`);
    });
  };

  useEffect(() => {
    let active = true;
    const stored = readLocalDraft(storageKey);
    const restored = stored.rows.length ? stored.rows.map(restoreDraftRow) : [blankRow()];
    setRows(calculateRows(restored));
    setDraftUpdatedAt(stored.updatedAt || "");
    setDraftStatus(stored.rows.length ? "Local draft loaded" : "Local draft ready");
    setDraftLoaded(true);
    if (stored.rows.length) {
      removeRowsWhoseInvoiceExists(restored).then((remaining) => {
        if (!active || remaining.length === restored.length) return;
        const next = remaining.length ? remaining : [blankRow()];
        setRows(calculateRows(next));
        const updatedAt = writeLocalDraft(storageKey, remaining);
        setDraftUpdatedAt(updatedAt);
        setDraftStatus(`${restored.length - remaining.length} converted row(s) cleared • Saved locally`);
      }).catch(() => {});
    }
    return () => {
      active = false;
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [storageKey]);

  useEffect(() => {
    if (!draftLoaded) return undefined;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    const sequence = ++saveSequence.current;
    setDraftStatus("Saving locally…");
    draftTimer.current = setTimeout(() => {
      if (sequence !== saveSequence.current) return;
      try {
        const meaningful = rows.filter(hasMeaningfulData);
        const updatedAt = writeLocalDraft(storageKey, meaningful);
        setDraftUpdatedAt(updatedAt);
        setDraftStatus("Saved in this browser");
      } catch (error) {
        setDraftStatus(`Local draft not saved: ${error?.message || "Browser storage unavailable"}`);
      }
    }, 250);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [rows, draftLoaded, storageKey]);

  const updateRows = (updater) => setRows((current) => calculateRows(typeof updater === "function" ? updater(current) : updater));
  const patchRow = (id, patch) => updateRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));

  const insertAfter = (index) => {
    updateRows((current) => {
      const next = [...current];
      const above = current[index] || {};
      next.splice(index + 1, 0, blankRow({
        date: above.date,
        invoiceNo: above.invoiceNo,
        gstin: above.gstin,
        customerName: above.customerName,
        customerGlobalId: above.customerGlobalId,
        salespersonId: above.salespersonId,
        salespersonName: above.salespersonName,
        gstType: above.gstType,
        cashCustomer: above.cashCustomer,
      }));
      return next;
    });
  };

  const resolveLookup = async (id, override = {}) => {
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    const gstin = upper(override.gstin ?? row.gstin).replace(/\s+/g, "").slice(0, 15);
    const productId = clean(override.productId ?? row.productId);
    const productName = clean(override.productName ?? row.productName);
    patchRow(id, { lookupBusy: true, error: "" });
    try {
      const result = await api("/transactions/sales-with-products/resolve-row", {
        method: "POST",
        body: JSON.stringify({ gstin, productId, productName }),
      });
      const customer = result?.customer || {};
      const product = result?.product || null;
      const patch = {
        lookupBusy: false,
        error: "",
        gstin,
        customerName: customer.name || "CASH",
        customerGlobalId: customer.globalCustomerId || "",
        cashCustomer: Boolean(customer.cash),
        salespersonId: customer.salespersonId || "",
        salespersonName: customer.salespersonName || "",
        gstType: result?.gstType || "CGST_SGST",
      };
      if (product) {
        patch.productId = product.id || "";
        patch.productName = product.name || productName;
        patch.sku = product.sku || "";
        patch.hsn = product.hsn || "";
        patch.gstRate = Number(product.gstRate || 0);
        patch.unitOptions = Array.isArray(product.units) ? product.units : [];
        patch.unit = (Array.isArray(product.units) && product.units.includes(row.unit)) ? row.unit : (product.defaultUnit || product.units?.[0] || "");
        patch.warehouseId = product.warehouseId || "";
        patch.warehouseName = product.warehouseName || "";
      }
      patchRow(id, patch);
    } catch (error) {
      patchRow(id, { lookupBusy: false, error: error?.message || "Could not resolve customer/product from DMS." });
    }
  };

  const handleGstin = (id, value) => {
    const gstin = upper(value).replace(/\s+/g, "").slice(0, 15);
    patchRow(id, { gstin, customerName: gstin.length === 15 ? "Looking up…" : "", error: "" });
    if (gstin.length === 15) resolveLookup(id, { gstin });
  };

  const fetchProductOptions = (id, text) => {
    const value = clean(text);
    patchRow(id, { productName: text, productId: "", sku: "", hsn: "", gstRate: 0, unit: "", unitOptions: [], warehouseId: "", warehouseName: "", error: "" });
    if (productTimers.current[id]) clearTimeout(productTimers.current[id]);
    if (value.length < 1) {
      setProductOptions((current) => ({ ...current, [id]: [] }));
      return;
    }
    productTimers.current[id] = setTimeout(async () => {
      try {
        const result = await api(`/products?q=${encodeURIComponent(value)}&status=ACTIVE&limit=30`);
        setProductOptions((current) => ({ ...current, [id]: Array.isArray(result?.items) ? result.items : [] }));
      } catch {
        setProductOptions((current) => ({ ...current, [id]: [] }));
      }
    }, 220);
  };

  const selectProduct = (row, typedName) => {
    const value = clean(typedName).toLowerCase();
    const options = productOptions[row.id] || [];
    const selected = options.find((product) => clean(product.name).toLowerCase() === value)
      || options.find((product) => clean(product.sku).toLowerCase() === value);
    if (selected) resolveLookup(row.id, { productId: String(selected._id), productName: selected.name });
    else if (typedName) resolveLookup(row.id, { productName: typedName });
  };

  const validateGroup = (group) => {
    const items = group.rows.filter(hasMeaningfulData);
    if (!items.length) return "Invoice group is blank";
    const first = items[0];
    if (!clean(first.date)) return "Date is required";
    if (!clean(first.invoiceNo)) return "Invoice No. is required";
    if (!first.customerGlobalId) return "Customer is not resolved yet. Enter a valid GSTIN or let it resolve to CASH.";
    const customerIds = new Set(items.map((row) => clean(row.customerGlobalId)).filter(Boolean));
    if (customerIds.size !== 1) return "All rows in one invoice must resolve to the same customer";
    const warehouses = new Set(items.map((row) => clean(row.warehouseId)).filter(Boolean));
    if (warehouses.size !== 1) return "All products in one invoice must resolve to the same warehouse";
    if (items.some((row) => !row.productId)) return "Resolve every product from Product Master";
    if (items.some((row) => decimal(row.qty) <= 0)) return "Quantity must be greater than zero on every product row";
    if (items.some((row) => decimal(row.rate) <= 0)) return "Rate must be greater than zero on every product row";
    const taxTypes = new Set(items.map((row) => upper(row.gstType || "CGST_SGST")));
    if (taxTypes.size !== 1) return "Tax mode is inconsistent inside this invoice";
    return "";
  };

  const buildInvoicePayload = (group) => {
    const items = group.rows.filter(hasMeaningfulData);
    const first = items[0];
    const financialYear = financialYearFromDate(first.date);
    return {
      importSource: "QUICK_ENTRY",
      // Bulk historical import: create the invoice even when stock is short and
      // transporter assignment is incomplete. Negative stock intentionally exposes
      // the shortage until the corresponding purchase invoices are uploaded.
      allowNegativeStock: true,
      skipTransporterValidation: true,
      invoiceNo: clean(first.invoiceNo),
      date: first.date,
      financialYear,
      customerGlobalId: first.customerGlobalId,
      warehouseId: first.warehouseId,
      assignedTo: first.salespersonId || "",
      gstType: first.gstType || "CGST_SGST",
      roundGrandTotal: false,
      remarks: "Created from List of Sales with Product",
      items: items.map((row) => ({
        productId: row.productId,
        qty: decimal(row.qty),
        saleRate: decimal(row.rate),
        basicRate: decimal(row.rate),
        discountPct: decimal(row.discountPct),
        gstRate: decimal(row.gstRate),
        unit: row.unit || "",
      })),
    };
  };

  const removeGroupFromGrid = (key) => {
    updateRows((current) => {
      const next = current.filter((row) => invoiceGroupKey(row) !== key);
      return next.length ? next : [blankRow()];
    });
    setSelectedIds((current) => {
      const next = new Set(current);
      const group = groupByKey.get(key);
      (group?.rows || []).forEach((row) => next.delete(row.id));
      return next;
    });
  };

  const createInvoice = async (key, { silent = false } = {}) => {
    const group = groupByKey.get(key);
    if (!group) return { ok: false, error: "Invoice group not found" };
    const validation = validateGroup(group);
    if (validation) {
      if (!silent) setActionMessage(`${clean(group.rows[0]?.invoiceNo) || "Invoice"}: ${validation}`);
      return { ok: false, error: validation };
    }
    setCreatingKeys((current) => new Set(current).add(key));
    try {
      const invoice = await api("/transactions/sales-invoices/bulk-import", {
        method: "POST",
        body: JSON.stringify(buildInvoicePayload(group)),
      });
      removeGroupFromGrid(key);
      if (!silent) setActionMessage(`Sales Invoice ${invoice?.invoiceNo || group.rows[0].invoiceNo} created successfully.`);
      return { ok: true, invoice };
    } catch (error) {
      const message = error?.message || "Could not create invoice";
      if (!silent) setActionMessage(`${clean(group.rows[0]?.invoiceNo) || "Invoice"}: ${message}`);
      return { ok: false, error: message };
    } finally {
      setCreatingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const createAllInvoices = async () => {
    const meaningfulGroups = groups.filter((group) => group.rows.some(hasMeaningfulData));
    if (!meaningfulGroups.length) {
      setActionMessage("There are no invoice rows to create.");
      return;
    }

    const invoiceNoOwners = new Map();
    for (const group of meaningfulGroups) {
      const row = group.rows[0];
      const invoiceNo = upper(row.invoiceNo);
      const owner = `${clean(row.date)}|${upper(row.gstin)}`;
      if (invoiceNo && invoiceNoOwners.has(invoiceNo) && invoiceNoOwners.get(invoiceNo) !== owner) {
        setActionMessage(`Invoice No. ${row.invoiceNo} is used for more than one Date/GST combination. Correct it before Create All.`);
        return;
      }
      if (invoiceNo) invoiceNoOwners.set(invoiceNo, owner);
    }

    setCreatingAll(true);
    let created = 0;
    const failures = [];
    for (const group of meaningfulGroups) {
      const result = await createInvoice(group.key, { silent: true });
      if (result.ok) created += 1;
      else failures.push(`${clean(group.rows[0]?.invoiceNo) || "Invoice"}: ${result.error}`);
    }
    setCreatingAll(false);
    setActionMessage(failures.length
      ? `${created} invoice(s) created. ${failures.length} failed: ${failures.slice(0, 3).join(" | ")}${failures.length > 3 ? " …" : ""}`
      : `${created} invoice(s) created successfully.`);
  };

  const toggleSelected = (id) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => setSelectedIds((current) => current.size === rows.length ? new Set() : new Set(rows.map((row) => row.id)));

  const bulkDelete = () => {
    if (!selectedIds.size) {
      setActionMessage("Select one or more rows to delete.");
      return;
    }
    if (!window.confirm(`Delete ${selectedIds.size} selected row(s) from this local working sheet?`)) return;
    updateRows((current) => {
      const next = current.filter((row) => !selectedIds.has(row.id));
      return next.length ? next : [blankRow()];
    });
    setActionMessage(`${selectedIds.size} row(s) deleted.`);
    setSelectedIds(new Set());
  };

  const handleBulkUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setActionMessage("Reading and resolving Excel rows…");
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api("/transactions/sales-with-products/import-preview", { method: "POST", body: form });
      const imported = Array.isArray(result?.rows) ? result.rows.map((row) => restoreDraftRow({ ...row, id: `swp-${Date.now()}-${++rowSeed}` })) : [];
      if (!imported.length) throw new Error("No usable rows found in the workbook");

      // IMPORTANT: repeated Date + Invoice No. + GSTIN rows are NOT separate invoices.
      // They are the equivalent of using "+ Add More" for another product line.
      // Keep those rows together so buildInvoicePayload() sends all of them in one items[].
      const groupedImported = [];
      const importedGroups = new Map();
      imported.forEach((row) => {
        const key = invoiceGroupKey(row);
        if (!importedGroups.has(key)) importedGroups.set(key, []);
        importedGroups.get(key).push(row);
      });
      importedGroups.forEach((productRows) => groupedImported.push(...productRows));

      updateRows((current) => {
        const keep = current.filter(hasMeaningfulData);
        return [...keep, ...groupedImported];
      });
      const errorCount = groupedImported.filter((row) => row.error).length;
      const invoiceCount = Number(result?.invoiceCount || importedGroups.size || 0);
      const multiProductInvoices = [...importedGroups.values()].filter((productRows) => productRows.length > 1).length;
      setActionMessage(`${groupedImported.length} product row(s) loaded as ${invoiceCount} invoice(s)${multiProductInvoices ? `; ${multiProductInvoices} invoice(s) contain multiple products and were joined using Add More logic` : ""}${errorCount ? `; ${errorCount} row(s) need correction` : " and resolved"}.`);
    } catch (error) {
      setActionMessage(error?.message || "Could not read the Excel file");
    } finally {
      setUploading(false);
      if (uploadInput.current) uploadInput.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/templates/List_of_Sales_with_Product_Bulk_Template.xlsx";
    link.download = "List_of_Sales_with_Product_Bulk_Template.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="swp-page swp-entry-page">
      <div className="swp-head">
        <div>
          <h1>List of Sales with Product</h1>
          <p>Same Date + Invoice No. + GSTIN = one invoice. Each matching row becomes one product line.</p>
        </div>
        <div className={`swp-draft-state ${draftStatus.startsWith("Local draft not saved") ? "is-error" : ""}`}>
          <b>{draftStatus}</b>
          <span>{draftUpdatedAt ? `Last saved ${new Date(draftUpdatedAt).toLocaleString("en-IN")}` : "Stored only in this browser until invoice creation."}</span>
        </div>
      </div>

      <div className="swp-toolbar">
        <button type="button" className="swp-primary" onClick={createAllInvoices} disabled={creatingAll}>{creatingAll ? "Creating Invoices…" : "Create All Invoices"}</button>
        <button type="button" onClick={() => uploadInput.current?.click()} disabled={uploading}>{uploading ? "Uploading…" : "Bulk Upload XLS"}</button>
        <input ref={uploadInput} type="file" accept=".xlsx,.xls" hidden onChange={(e) => handleBulkUpload(e.target.files?.[0])} />
        <button type="button" onClick={downloadTemplate}>Download Bulk Template</button>
        <button type="button" className="swp-danger" onClick={bulkDelete} disabled={!selectedIds.size}>Bulk Delete{selectedIds.size ? ` (${selectedIds.size})` : ""}</button>
        <span className="swp-toolbar-note">Smart grouping: Date + Invoice No. + GSTIN</span>
      </div>

      {actionMessage ? <div className="swp-action-message">{actionMessage}</div> : null}

      <div className="swp-rule-strip">
        <span><b>Customer:</b> GST match from Customer Master; otherwise CASH</span>
        <span><b>Basic Total:</b> sum of Qty × Rate for all product rows in the invoice</span>
        <span><b>Tax:</b> GST from Product Master; CGST+SGST / IGST from party location</span>
        <span><b>Draft:</b> localStorage until invoice is successfully created</span>
      </div>

      <div className="swp-table-wrap swp-entry-wrap">
        <table className="swp-table swp-entry-table swp-smart-table">
          <thead>
            <tr>
              <th className="swp-select-col"><input type="checkbox" checked={rows.length > 0 && selectedIds.size === rows.length} onChange={toggleAll} /></th>
              <th>Date</th><th>Invoice No.</th><th>Customer</th><th>GSTIN</th><th>Product</th><th>SKU</th><th>HSN</th>
              <th className="num">Qty</th><th>Unit</th><th className="num">Rate</th><th className="num">Discount %</th>
              <th className="num">Basic Total</th><th className="num">Taxable Value</th><th className="num">GST %</th>
              <th className="num">CGST</th><th className="num">SGST</th><th className="num">IGST</th><th className="num">Product Total</th>
              <th className="num">Invoice Total</th><th>Warehouse</th><th>Salesperson</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const key = invoiceGroupKey(row);
              const group = groupByKey.get(key);
              const isGroupEnd = lastIndexByGroup.get(key) === index;
              const groupBasic = group?.rows?.[0]?.groupBasicTotal || row.groupBasicTotal;
              const groupTaxable = round2((group?.rows || [row]).reduce((sum, item) => sum + Number(item.taxable || 0), 0));
              const groupCgst = round2((group?.rows || [row]).reduce((sum, item) => sum + Number(item.cgst || 0), 0));
              const groupSgst = round2((group?.rows || [row]).reduce((sum, item) => sum + Number(item.sgst || 0), 0));
              const groupIgst = round2((group?.rows || [row]).reduce((sum, item) => sum + Number(item.igst || 0), 0));
              return (
                <Fragment key={row.id}>
                  <tr className={row.error ? "swp-row-error" : ""}>
                    <td className="swp-select-col"><input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelected(row.id)} /></td>
                    <td><input className="swp-cell-input swp-date" type="date" value={row.date} onChange={(e) => patchRow(row.id, { date: e.target.value })} /></td>
                    <td><input className="swp-cell-input swp-invoice-input" type="text" value={row.invoiceNo} onChange={(e) => patchRow(row.id, { invoiceNo: e.target.value })} placeholder="Invoice no." /></td>
                    <td><ReadOnlyBox value={row.lookupBusy && !row.customerName ? "Looking up…" : row.customerName} title={row.cashCustomer ? "GST not found in Customer Master; treated as CASH" : "Customer fetched from Customer Master"} /></td>
                    <td><input className="swp-cell-input swp-gst" type="text" maxLength={15} value={row.gstin} onChange={(e) => handleGstin(row.id, e.target.value)} onBlur={() => resolveLookup(row.id)} placeholder="GST No." /></td>
                    <td className="swp-product-cell">
                      <input className="swp-cell-input swp-product-input" type="text" list={`swp-products-${row.id}`} value={row.productName} onChange={(e) => fetchProductOptions(row.id, e.target.value)} onBlur={(e) => selectProduct(row, e.target.value)} placeholder="Type product" />
                      <datalist id={`swp-products-${row.id}`}>{(productOptions[row.id] || []).map((product) => <option key={product._id} value={product.name}>{[product.sku, product.hsnCode].filter(Boolean).join(" • ")}</option>)}</datalist>
                    </td>
                    <td><ReadOnlyBox value={row.sku} /></td><td><ReadOnlyBox value={row.hsn} /></td>
                    <td><input className="swp-cell-input swp-num-input" type="text" inputMode="decimal" value={row.qty} onChange={(e) => patchRow(row.id, { qty: e.target.value })} placeholder="0" /></td>
                    <td><select className="swp-cell-input swp-unit" value={row.unit} onChange={(e) => patchRow(row.id, { unit: e.target.value })} disabled={!row.unitOptions.length}>{!row.unitOptions.length ? <option value="">—</option> : null}{row.unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></td>
                    <td><input className="swp-cell-input swp-num-input" type="text" inputMode="decimal" value={row.rate} onChange={(e) => patchRow(row.id, { rate: e.target.value })} placeholder="0.00" /></td>
                    <td><input className="swp-cell-input swp-num-input" type="text" inputMode="decimal" value={row.discountPct} onChange={(e) => patchRow(row.id, { discountPct: e.target.value })} placeholder="0" /></td>
                    <td className="num"><ReadOnlyBox value={groupBasic} moneyValue /></td>
                    <td className="num"><ReadOnlyBox value={row.taxable} moneyValue /></td><td className="num"><ReadOnlyBox value={`${Number(row.gstRate || 0)}%`} /></td>
                    <td className="num"><ReadOnlyBox value={row.cgst} moneyValue /></td><td className="num"><ReadOnlyBox value={row.sgst} moneyValue /></td><td className="num"><ReadOnlyBox value={row.igst} moneyValue /></td>
                    <td className="num"><ReadOnlyBox value={row.productTotal} moneyValue /></td><td className="num"><ReadOnlyBox value={row.invoiceTotal} moneyValue /></td>
                    <td><ReadOnlyBox value={row.warehouseName} /></td><td><ReadOnlyBox value={row.salespersonName || (row.cashCustomer ? "CASH" : "—")} /></td>
                  </tr>
                  {row.error ? <tr className="swp-message-row"><td colSpan="22">{row.error}</td></tr> : null}
                  <tr className="swp-add-row"><td colSpan="22"><button type="button" className="swp-add-below" onClick={() => insertAfter(index)}>+ Add More Below This Row</button></td></tr>
                  {isGroupEnd && group?.rows?.some(hasMeaningfulData) ? (
                    <tr className="swp-group-summary-row">
                      <td colSpan="22">
                        <div className="swp-group-summary">
                          <div><b>Invoice:</b> {clean(row.invoiceNo) || "Not entered"} <span>• {group.rows.length} product row(s)</span></div>
                          <div className="swp-group-values">
                            <span>Basic ₹{money(groupBasic)}</span><span>Taxable ₹{money(groupTaxable)}</span><span>CGST ₹{money(groupCgst)}</span><span>SGST ₹{money(groupSgst)}</span><span>IGST ₹{money(groupIgst)}</span><b>Total ₹{money(row.invoiceTotal)}</b>
                          </div>
                          <button type="button" className="swp-create-one" onClick={() => createInvoice(key)} disabled={creatingKeys.has(key) || creatingAll}>{creatingKeys.has(key) ? "Creating…" : "Create Invoice"}</button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
