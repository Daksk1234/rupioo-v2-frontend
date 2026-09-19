import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingBasket,
  Trash2,
  X,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EditMasterLink from "../components/EditMasterLink.jsx";
import CreateLookupButton from "../components/CreateLookupButton.jsx";
import { api, getUser } from "../lib/api.js";
import { fetchTransactionParties, partyGstin, partyOptionLabel } from "../lib/partyDirectory.js";
import { buildInvoiceTaxSummary, calculateOldDmsLanded, computeInvoiceAdjustments } from "../lib/invoiceAdjustments.js";

const round2 = (n) => Number((Number(n) || 0).toFixed(2));
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ymd = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
};
const currentFY = () => {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
};
const buildFinancialYears = (count = 10) => {
  const start = Number(currentFY().slice(0,4));
  return Array.from({ length: count }, (_, i) => { const y=start-i; return `${y}-${String((y+1)%100).padStart(2,"0")}`; });
};
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fyMonthOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
const invoiceLandedPrice = (invoice) => {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  let qty = 0;
  let value = 0;
  items.forEach((item) => {
    const itemQty = Math.max(0, Number(item?.qty || 0));
    const landed = Math.max(0, Number(item?.landedCostSnapshot ?? item?.effectiveRate ?? item?.rate ?? 0));
    qty += itemQty;
    value += itemQty * landed;
  });
  return qty > 0 ? round2(value / qty) : 0;
};
const landedPriceBreakdown = (invoice) => (Array.isArray(invoice?.items) ? invoice.items : [])
  .map((item) => `${item?.nameSnapshot || "Product"}: ${money(item?.landedCostSnapshot ?? item?.effectiveRate ?? item?.rate ?? 0)}`)
  .join("\n");

const newRow = () => ({
  productId: "",
  productName: "",
  warehouseName: "",
  hsnCode: "",
  grossUnit: "",
  grossQty: 1,
  qty: 1,
  netUnit: "PCS",
  qtyInBag: 1,
  gstRate: 0,
  rate: 0,
  taxable: 0,
  tax: 0,
  lineTotal: 0,
});

const MASTER_KEY = "rupio_sales_invoice_adjustment_masters_v1";
const DEFAULT_MASTERS = [
  { id: "disc-scheme", type: "Discount", title: "Scheme Discount", method: "Percentage", value: 0, active: true },
  { id: "disc-cash", type: "Discount", title: "Cash Discount", method: "Percentage", value: 0, active: true },
  { id: "disc-monthly", type: "Discount", title: "Monthly Offer Discount", method: "Percentage", value: 0, active: true },
  { id: "charge-freight", type: "Charges", title: "Freight", method: "Amount", value: 0, active: true },
  { id: "charge-packing", type: "Charges", title: "Packing Charges", method: "Amount", value: 0, active: true },
  { id: "charge-handling", type: "Charges", title: "Handling Charges", method: "Amount", value: 0, active: true },
];
const readMasters = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MASTER_KEY) || "null");
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {}
  return DEFAULT_MASTERS;
};
const writeMasters = (rows) => {
  try { window.localStorage.setItem(MASTER_KEY, JSON.stringify(rows)); } catch {}
};
const newAdjustment = (type, master) => ({
  id: `${type}-${Date.now()}-${Math.random()}`,
  masterId: master?.id || "",
  type,
  title: master?.title || type,
  method: master?.method || "Amount",
  value: Number(master?.value || 0),
});
async function fetchAllPaged(path, limit = 100) {
  const separator = path.includes("?") ? "&" : "?";
  const first = await api(`${path}${separator}page=1&limit=${limit}`);
  const firstItems = Array.isArray(first?.items) ? first.items : [];
  const pages = Math.max(1, Number(first?.meta?.pages || 1));
  if (pages <= 1) return firstItems;
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => api(`${path}${separator}page=${i + 2}&limit=${limit}`)));
  return [...firstItems, ...rest.flatMap((x) => Array.isArray(x?.items) ? x.items : [])];
}

export default function PurchaseInvoicePage({ embedded = false, batchIndex = 1, batchKey = "", registerBatchSave: registerBatchSaveProp = null, onRemoveInvoice = null } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = embedded ? "" : (searchParams.get("edit") || "");
  const isEdit = Boolean(editId);
  const createMode = embedded ? true : (searchParams.get("create") === "1" || isEdit);

  const [products, setProducts] = useState([]);
  const [parties, setParties] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [rows, setRows] = useState([newRow()]);
  const [fy, setFy] = useState(searchParams.get("financialYear") || currentFY());
  const [listFy, setListFy] = useState("ALL");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [periodType, setPeriodType] = useState("YEARLY");
  const [selectedMonth, setSelectedMonth] = useState(fyMonthOrder[new Date().getMonth() >= 3 ? new Date().getMonth() - 3 : new Date().getMonth() + 9] || "April");
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [selectedHalf, setSelectedHalf] = useState("H1");
  const [monthOpen, setMonthOpen] = useState({});
  const [batchOpen, setBatchOpen] = useState(true);
  const [extraInvoiceKeys, setExtraInvoiceKeys] = useState([]);
  const [batchSaving, setBatchSaving] = useState(false);
  const batchSaveRefs = useRef(new Map());
  const registerBatchSave = useCallback((key, fn) => {
    if (!key) return;
    if (typeof fn === "function") batchSaveRefs.current.set(key, fn);
    else batchSaveRefs.current.delete(key);
  }, []);
  const addMoreInvoice = useCallback(() => {
    if (embedded) return;
    setExtraInvoiceKeys((list) => [...list, `purchase-batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`]);
  }, [embedded]);
  const removeExtraInvoice = useCallback((key) => {
    batchSaveRefs.current.delete(key);
    setExtraInvoiceKeys((list) => list.filter((item) => item !== key));
  }, []);

  const [adjustmentMasters, setAdjustmentMasters] = useState(() => readMasters());
  const [selectedAdjustmentMaster, setSelectedAdjustmentMaster] = useState({ Discount: "", Charges: "" });
  const [adjustments, setAdjustments] = useState([]);
  const [adjustmentMasterEditor, setAdjustmentMasterEditor] = useState(null);

  const [header, setHeader] = useState({
    invoiceNo: "",
    date: new Date().toISOString().slice(0, 10),
    supplierName: "",
    supplierGstin: "",
    supplierGlobalId: "",
    purchaseType: "GST",
    transportationCost: 0,
    labourCost: 0,
    localFreight: 0,
    miscellaneousCost: 0,
    remarks: "",
  });

  const setH = (key, value) => setHeader((h) => ({ ...h, [key]: value }));

  const recalc = (row) => {
    const qty = Number(row.qty || 0);
    const rate = Number(row.rate || 0);
    const taxable = round2(qty * rate);
    const tax = round2(taxable * Number(row.gstRate || 0) / 100);
    return {
      ...row,
      grossQty: Number(row.qtyInBag || 0) > 0 ? round2(qty / Number(row.qtyInBag || 1)) : qty,
      taxable,
      tax,
      lineTotal: round2(taxable + tax),
    };
  };

  const load = async () => {
    try {
      const invoiceYears = !createMode ? (listFy === "ALL" ? buildFinancialYears(10) : [listFy]) : [fy];
      const invoicePromise = Promise.all(invoiceYears.map((year) =>
        fetchAllPaged(`/transactions/purchase-invoices?financialYear=${encodeURIComponent(year)}`, 100).catch(() => [])
      )).then((groups) => groups.flat());
      const [p, partyList, inv] = await Promise.all([
        fetchAllPaged("/products?status=ACTIVE", 100),
        fetchTransactionParties(200),
        invoicePromise,
      ]);
      setProducts(p);
      setParties(partyList);
      setInvoices(inv);
    } catch (e) {
      setMsg(e.message || "Could not load purchase invoice data");
    }
  };

  const loadInvoiceForEdit = async () => {
    if (!editId) return;
    try {
      const inv = await api(`/transactions/purchase-invoices/${encodeURIComponent(editId)}?financialYear=${encodeURIComponent(fy)}`);
      setHeader({
        invoiceNo: inv.invoiceNo || "",
        date: ymd(inv.date) || new Date().toISOString().slice(0, 10),
        supplierName: inv.supplierNameSnapshot || "",
        supplierGstin: inv.supplierGstinSnapshot || "",
        supplierGlobalId: inv.supplierGlobalId || "",
        purchaseType: inv.purchaseType || "GST",
        transportationCost: Number(inv.transportationCost || 0),
        labourCost: Number(inv.labourCost || 0),
        localFreight: Number(inv.localFreight || 0),
        miscellaneousCost: Number(inv.miscellaneousCost || 0),
        remarks: inv.remarks || "",
      });
      const mappedRows = (Array.isArray(inv.items) && inv.items.length ? inv.items : [newRow()]).map((item) => recalc({
        ...newRow(),
        productId: String(item.productId || ""),
        productName: item.nameSnapshot || "",
        warehouseName: "",
        hsnCode: item.hsnSnapshot || "",
        grossUnit: item.packingUnit || item.unit || "PCS",
        grossQty: Number(item.grossQty ?? (Number(item.qtyInBag || 0) > 0 ? Number(item.qty || 0) / Number(item.qtyInBag || 1) : item.qty || 0)),
        qty: Number(item.qty || 0),
        netUnit: item.unit || "PCS",
        qtyInBag: Number(item.qtyInBag || 1) || 1,
        gstRate: Number(item.gstRateSnapshot || 0),
        rate: Number(item.rate ?? item.effectiveRate ?? 0),
      }));
      setRows(mappedRows);
      const restored = [];
      if (Number(inv.billDiscount || 0) > 0) restored.push(newAdjustment("Discount", { id: `existing-discount-${inv._id}`, title: "Bill Discount", method: "Amount", value: Number(inv.billDiscount || 0) }));
      if (Number(inv.otherCharges || 0) > 0) restored.push(newAdjustment("Charges", { id: `existing-charge-${inv._id}`, title: "Other Charges", method: "Amount", value: Number(inv.otherCharges || 0) }));
      setAdjustments(restored);
      setSelectedAdjustmentMaster({ Discount: "", Charges: "" });
      setMsg("");
    } catch (e) {
      setMsg(e.message || "Could not load purchase invoice for editing");
    }
  };

  useEffect(() => { load(); }, [fy, listFy, createMode]);
  useEffect(() => { loadInvoiceForEdit(); }, [editId, fy]);
  useEffect(() => {
    if (!isEdit || !products.length) return;
    setRows((list) => list.map((row) => {
      const product = products.find((p) => String(p._id) === String(row.productId));
      if (!product) return row;
      return {
        ...row,
        warehouseName: product.warehouseName || product.warehouse?.name || product.warehouse?.warehouseName || row.warehouseName || "",
        productName: row.productName || product.name || "",
      };
    }));
  }, [products, isEdit]);

  const selectSupplier = async (id) => {
    const party = parties.find((x) => String(x.globalCustomerId) === String(id));
    if (!party) {
      setHeader((h) => ({ ...h, supplierGlobalId: "", supplierName: "", supplierGstin: "" }));
      return;
    }

    const base = {
      supplierGlobalId: party.globalCustomerId,
      supplierName: party.localName || party.legalName || "",
      supplierGstin: partyGstin(party),
    };
    setHeader((h) => ({ ...h, ...base }));

    if (!base.supplierGstin) {
      try {
        const detail = await api(`/customers/${encodeURIComponent(party.globalCustomerId)}`);
        const gstin = partyGstin({ ...party, ...detail?.company, global: detail?.global });
        if (gstin) setHeader((h) => h.supplierGlobalId === party.globalCustomerId ? { ...h, supplierGstin: gstin } : h);
      } catch {}
    }
  };

  const selectProduct = (index, id) => {
    const p = products.find((x) => String(x._id) === String(id));
    if (!p) return;
    const qtyInBag = Number(p.qtyInBag || 1) || 1;
    const rate = Number(p.lastPurchasePrice || p.averagePurchasePrice || p.openingRate || 0);
    setRows((list) => list.map((row, i) => i === index ? recalc({
      ...row,
      productId: p._id,
      productName: p.name || "",
      warehouseName: p.warehouseName || p.warehouse?.name || p.warehouse?.warehouseName || "",
      hsnCode: p.hsnCode || p.hsn || "",
      grossUnit: p.packingUnitName || p.packingUnit || p.secondaryUnit || p.basicUnit || p.unit || "PCS",
      netUnit: p.basicUnit || p.unit || p.primaryUnit || "PCS",
      qtyInBag,
      qty: qtyInBag,
      grossQty: 1,
      gstRate: Number(p.gstRate || p.GSTRate || 0),
      rate,
    }) : row));
  };

  const changeRow = (index, key, value) => setRows((list) => list.map((row, i) => i === index ? recalc({ ...row, [key]: value }) : row));
  const changeGross = (index, gross) => setRows((list) => list.map((row, i) => i === index ? recalc({ ...row, grossQty: gross, qty: round2(Number(gross || 0) * Number(row.qtyInBag || 1)) }) : row));
  const changeBasicTotal = (index, total) => setRows((list) => list.map((row, i) => {
    if (i !== index) return row;
    const qty = Number(row.qty || 0);
    const rate = qty > 0 ? Number(total || 0) / qty : 0;
    return recalc({ ...row, rate: round2(rate) });
  }));

  const baseTotal = useMemo(() => round2(rows.reduce((s, r) => s + Number(r.taxable || 0), 0)), [rows]);
  const adjustmentCalc = useMemo(
    () => computeInvoiceAdjustments(baseTotal, adjustments),
    [adjustments, baseTotal],
  );

  const taxSummary = useMemo(
    () => buildInvoiceTaxSummary(
      rows,
      adjustmentCalc.discountTotal,
      adjustmentCalc.chargesTotal,
      "IGST",
    ),
    [rows, adjustmentCalc.discountTotal, adjustmentCalc.chargesTotal],
  );

  const totals = useMemo(() => ({
    lineSubtotal: baseTotal,
    discountTotal: adjustmentCalc.discountTotal,
    chargesTotal: adjustmentCalc.chargesTotal,
    taxable: taxSummary.taxableTotal,
    tax: taxSummary.taxTotal,
    gross: taxSummary.gross,
    roundOff: taxSummary.roundOff,
    grand: taxSummary.grand,
  }), [baseTotal, adjustmentCalc, taxSummary]);

  const landedCalc = useMemo(() => calculateOldDmsLanded(rows, header, adjustmentCalc.taxable), [
    rows,
    adjustmentCalc.taxable,
    header.transportationCost,
    header.labourCost,
    header.localFreight,
    header.miscellaneousCost,
  ]);

  const mastersFor = (type) => adjustmentMasters.filter((x) => x.type === type && x.active !== false);
  const chooseAdjustmentMaster = (type, id) => {
    setSelectedAdjustmentMaster((x) => ({ ...x, [type]: id }));
    const master = adjustmentMasters.find((x) => x.id === id && x.type === type);
    if (master) setAdjustments((list) => {
      if (list.some((row) => String(row.masterId || "") === String(master.id))) return list;
      return [...list, newAdjustment(type, master)];
    });
  };
  const removeAdjustment = (row) => {
    setAdjustments((list) => list.filter((x) => x.id !== row.id));
    setSelectedAdjustmentMaster((selected) =>
      String(selected?.[row.type] || "") === String(row.masterId || "")
        ? { ...selected, [row.type]: "" }
        : selected,
    );
  };
  const openAdjustmentMasterEditor = (type, id = "") => {
    const current = adjustmentMasters.find((x) => x.id === id && x.type === type);
    setAdjustmentMasterEditor(current ? { ...current } : { id: "", type, title: "", method: type === "Discount" ? "Percentage" : "Amount", value: 0, active: true });
  };
  const saveAdjustmentMaster = () => {
    const name = String(adjustmentMasterEditor?.title || "").trim();
    if (!name) return;
    const item = { ...adjustmentMasterEditor, title: name, id: adjustmentMasterEditor.id || `${adjustmentMasterEditor.type.toLowerCase()}-${Date.now()}` };
    const next = adjustmentMasters.some((x) => x.id === item.id)
      ? adjustmentMasters.map((x) => x.id === item.id ? item : x)
      : [...adjustmentMasters, item];
    setAdjustmentMasters(next);
    writeMasters(next);
    setSelectedAdjustmentMaster((x) => ({ ...x, [item.type]: item.id }));
    setAdjustments((list) => {
      const exists = list.some((row) => String(row.masterId || "") === String(item.id));
      if (!exists) return [...list, newAdjustment(item.type, item)];
      return list.map((row) => String(row.masterId || "") === String(item.id)
        ? { ...row, title: item.title, method: item.method, value: Number(item.value || 0) }
        : row);
    });
    setAdjustmentMasterEditor(null);
  };

  const hsnSummary = taxSummary.rows;

  const post = async ({ stayOnCreate = embedded } = {}) => {
    if (!header.supplierGlobalId || !header.supplierName.trim()) { setMsg("Select a supplier / party"); return false; }
    if (rows.some((r) => !r.productId || Number(r.qty || 0) <= 0)) { setMsg("Complete every product row"); return false; }
    setLoading(true);
    try {
      const inv = await api(isEdit ? `/transactions/purchase-invoices/${encodeURIComponent(editId)}` : "/transactions/purchase-invoices", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify({
          ...header,
          financialYear: fy,
          billDiscount: totals.discountTotal,
          otherCharges: totals.chargesTotal,
          landedCharges: landedCalc.totalExpense,
          landedTax: landedCalc.landedTax,
          landedExpensePercentage: landedCalc.expensePercentage,
          maxGstPercentage: 0,
          items: rows.map((r, index) => ({
            productId: r.productId,
            qty: Number(r.qty),
            rate: Number(r.rate),
            discountPct: 0,
            gstRate: Number(r.gstRate),
            landedRate: Number(landedCalc.itemRates[index]?.landedRate || r.rate || 0),
          })),
        }),
      });
      setMsg(`Purchase Invoice ${inv.invoiceNo} ${isEdit ? "updated" : "posted"}. Stock, accounting and landed cost updated.`);
      setRows([newRow()]);
      setAdjustments([]);
      setSelectedAdjustmentMaster({ Discount: "", Charges: "" });
      setHeader({ invoiceNo: "", date: new Date().toISOString().slice(0, 10), supplierName: "", supplierGstin: "", supplierGlobalId: "", purchaseType: "GST", transportationCost: 0, labourCost: 0, localFreight: 0, miscellaneousCost: 0, remarks: "" });
      await load();
      if (!stayOnCreate) setSearchParams({ financialYear: fy });
      return true;
    } catch (e) {
      setMsg(e.message || "Purchase invoice could not be posted");
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!embedded || !registerBatchSaveProp || !batchKey) return undefined;
    registerBatchSaveProp(batchKey, () => post({ stayOnCreate: true }));
    return () => registerBatchSaveProp(batchKey, null);
  });

  const submitAllInvoices = async () => {
    if (embedded || isEdit) return;
    setBatchSaving(true);
    let success = 0;
    let failed = 0;
    const ownOk = await post({ stayOnCreate: true });
    ownOk ? success++ : failed++;
    for (const key of extraInvoiceKeys) {
      const fn = batchSaveRefs.current.get(key);
      if (!fn) { failed++; continue; }
      const ok = await fn();
      ok ? success++ : failed++;
    }
    setBatchSaving(false);
    if (!failed) {
      setExtraInvoiceKeys([]);
      setMsg(`${success} Purchase Invoices posted successfully`);
      setSearchParams({ financialYear: fy });
      await load();
    } else {
      setMsg(`${success} invoice(s) posted. ${failed} invoice(s) need correction. Open the invoice block showing an error.`);
    }
  };

  const openEdit = (invoice) => {
    setMsg("");
    setSearchParams({ financialYear: fy, edit: String(invoice._id) });
  };

  const deleteInvoice = async (invoice) => {
    if (!invoice?._id) return;
    const yes = window.confirm(`Delete Purchase Invoice ${invoice.invoiceNo || ""}? Stock and accounting will be reversed.`);
    if (!yes) return;
    try {
      setLoading(true);
      await api(`/transactions/purchase-invoices/${encodeURIComponent(invoice._id)}?financialYear=${encodeURIComponent(fy)}`, { method: "DELETE" });
      setMsg(`Purchase Invoice ${invoice.invoiceNo || ""} deleted. Stock and accounting reversed.`);
      await load();
    } catch (e) {
      setMsg(e.message || "Purchase invoice could not be deleted");
    } finally {
      setLoading(false);
    }
  };

  const partyMap = useMemo(() => new Map(parties.map((p) => [String(p.globalCustomerId || ""), p])), [parties]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((row) => {
      const d = new Date(row.date || row.createdAt || 0);
      const month = Number.isNaN(d.getTime()) ? "" : monthNames[d.getMonth()];
      const fyIndex = fyMonthOrder.indexOf(month);
      let periodMatch = true;
      if (periodType === "MONTHLY") periodMatch = month === selectedMonth;
      if (periodType === "QUARTERLY") periodMatch = selectedQuarter === "Q1" ? fyIndex >= 0 && fyIndex <= 2 : selectedQuarter === "Q2" ? fyIndex >= 3 && fyIndex <= 5 : selectedQuarter === "Q3" ? fyIndex >= 6 && fyIndex <= 8 : fyIndex >= 9 && fyIndex <= 11;
      if (periodType === "HALF_YEARLY") periodMatch = selectedHalf === "H1" ? fyIndex >= 0 && fyIndex <= 5 : fyIndex >= 6 && fyIndex <= 11;
      if (!periodMatch) return false;
      if (!q) return true;
      return [row.invoiceNo, row.supplierNameSnapshot, row.supplierGstinSnapshot, row.purchaseType].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [invoices, search, periodType, selectedMonth, selectedQuarter, selectedHalf]);

  const messageIsSuccess = /posted|updated|deleted/i.test(msg);

  const downloadPurchaseCsv = () => {
    const head = ["Invoice No.","Date","Supplier / Party","User Name","GSTIN","Taxable","GST","Landed Price","Grand Total","Status","Financial Year"];
    const lines = filteredInvoices.map((r) => [
      r.invoiceNo || "", ymd(r.date || r.createdAt), r.partyNameDisplay || r.supplierNameSnapshot || "",
      r.userNameDisplay || r.createdByNameSnapshot || "", r.supplierGstinSnapshot || "", Number(r.taxableTotal || r.subtotal || 0).toFixed(2),
      Number(r.taxTotal || 0).toFixed(2), Number(invoiceLandedPrice(r) || 0).toFixed(2), Number(r.grandTotal || 0).toFixed(2), r.status || "", r.financialYear || ""
    ]);
    const csv=[head,...lines].map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`Purchase_Invoices_${listFy}.csv`;a.click();URL.revokeObjectURL(url);
  };

  const groupedByMonth = useMemo(() => {
    const groups = new Map();
    filteredInvoices.forEach((row) => {
      const d = new Date(row.date || row.createdAt || 0);
      const month = Number.isNaN(d.getTime()) ? "Unknown" : monthNames[d.getMonth()];
      const rowFy = row.financialYear || fy;
      const key = listFy === "ALL" ? `${rowFy}__${month}` : month;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      const [afy, am] = a[0].includes("__") ? a[0].split("__") : [listFy, a[0]];
      const [bfy, bm] = b[0].includes("__") ? b[0].split("__") : [listFy, b[0]];
      if (afy !== bfy) return Number(bfy?.slice(0,4)||0)-Number(afy?.slice(0,4)||0);
      return fyMonthOrder.indexOf(am) - fyMonthOrder.indexOf(bm);
    });
  }, [filteredInvoices, listFy, fy]);

  if (!createMode) {
    return <>
      <PageHeader title="Purchase Invoice" description="Old-DMS style purchase invoice list" actions={false} />
      {msg && <div className={`resultBanner ${messageIsSuccess ? "good" : "bad"}`}>{msg}</div>}
      <section className="panel oldDmsSalesList oldDmsPurchaseList">
        <div className="oldDmsListToolbar">
          <div className="oldDmsSearch"><Search size={14}/><input placeholder="Search invoice / supplier" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <label><span>FY</span><select value={listFy} onChange={(e) => setListFy(e.target.value)}><option value="ALL">All Financial Years</option>{buildFinancialYears(10).map((x)=><option key={x} value={x}>{x}</option>)}</select></label>
          <label><span>View</span><select value={periodType} onChange={(e) => setPeriodType(e.target.value)}><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="HALF_YEARLY">Half Yearly</option><option value="YEARLY">Yearly</option></select></label>
          {periodType === "MONTHLY" && <label><span>Month</span><select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>{fyMonthOrder.map((m) => <option key={m}>{m}</option>)}</select></label>}
          {periodType === "QUARTERLY" && <label><span>Quarter</span><select value={selectedQuarter} onChange={(e) => setSelectedQuarter(e.target.value)}><option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option></select></label>}
          {periodType === "HALF_YEARLY" && <label><span>Half</span><select value={selectedHalf} onChange={(e) => setSelectedHalf(e.target.value)}><option value="H1">H1</option><option value="H2">H2</option></select></label>}
          <button className="oldDmsIconAction" title="Refresh" onClick={load}><RefreshCw size={14}/></button>
          <button className="oldDmsIconAction" title="Export CSV" onClick={downloadPurchaseCsv}><Download size={14}/></button>
          <button className="oldDmsCreateIcon" title="Create Purchase Invoice" onClick={() => { const createFy = listFy === "ALL" ? currentFY() : listFy; setFy(createFy); setSearchParams({ financialYear: createFy, create: "1" }); }}><Plus size={16}/></button>
        </div>
        <div className="oldDmsPeriodSummary"><span>{filteredInvoices.length} invoices</span><b>{money(filteredInvoices.reduce((s, r) => s + Number(r.grandTotal || 0), 0))}</b></div>
        {periodType === "YEARLY" ? groupedByMonth.map(([month, list]) => {
          const open = monthOpen[month] !== false;
          return <div className="oldDmsMonthGroup" key={month}><button className="oldDmsMonthHead" onClick={() => setMonthOpen((x) => ({ ...x, [month]: !open }))}>{open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}<b>{month.includes("__") ? `${month.split("__")[1]} • FY ${month.split("__")[0]}` : month}</b><span>{list.length}</span><strong>{money(list.reduce((s, r) => s + Number(r.grandTotal || 0), 0))}</strong></button>{open && <PurchaseListTable rows={list} onEdit={openEdit} onDelete={deleteInvoice} partyMap={partyMap}/>}</div>;
        }) : <PurchaseListTable rows={filteredInvoices} onEdit={openEdit} onDelete={deleteInvoice} partyMap={partyMap}/>} 
      </section>
    </>;
  }

  const batchMode = !embedded && !isEdit && extraInvoiceKeys.length > 0;
  const createForm = <>
    {!embedded && <PageHeader title={isEdit ? "Edit Purchase Invoice" : "Create Purchase Invoice"} description="Old DMS flow with responsive V2 posting" actions={false} />}
    {msg && <div className={`resultBanner ${messageIsSuccess ? "good" : "bad"}`}>{msg}</div>}
    <section className="panel oldDmsInvoiceComposer oldDmsPurchaseComposer">
      <div className="oldDmsInvoiceTop">
        <div className="invoiceTitle"><ShoppingBasket size={18}/><div><h3>{isEdit ? "Edit Purchase Invoice" : "Purchase Invoice"}</h3><span>Old DMS entry flow • current V2 stock and purchase averages</span></div></div>
        {embedded ? (onRemoveInvoice && <button className="oldDmsBackBtn" onClick={onRemoveInvoice}>Remove Invoice</button>) : <button className="oldDmsBackBtn" onClick={() => setSearchParams({ financialYear: fy })}>Back</button>}
      </div>

      <div className="oldDmsTopLine oldDmsPurchaseMeta">
        <label><span>FY</span><input readOnly value={fy}/></label>
        <label className="od-wide"><span>Supplier / Party *</span><div className="lookupSelectRow"><select value={header.supplierGlobalId} onChange={(e) => selectSupplier(e.target.value)}><option value="">Select Supplier / Party</option>{parties.map((party) => <option key={party.globalCustomerId} value={party.globalCustomerId}>{partyOptionLabel(party)}</option>)}</select><CreateLookupButton to="/dms/customers" label="Create" resource="customer" selectedValue={header.supplierGlobalId} onReturn={load}/></div></label>
        <label><span>Invoice No.</span><input readOnly={isEdit} value={header.invoiceNo} onChange={(e) => setH("invoiceNo", e.target.value)} placeholder="Auto if blank"/></label>
        <label><span>Date</span><input type="date" value={header.date} onChange={(e) => setH("date", e.target.value)}/></label>
        <label><span>GSTIN</span><input readOnly value={header.supplierGstin}/></label>
        <label><span>Type</span><select value={header.purchaseType} onChange={(e) => setH("purchaseType", e.target.value)}><option>GST</option><option>NON_GST</option><option>IMPORT</option></select></label>
      </div>

      <div className="oldDmsProductArea oldDmsPurchaseProductArea">
        {rows.map((r, i) => <div className="oldDmsProductRow oldDmsPurchaseProductRow" key={i}>
          <label className="od-product"><span>Product *</span><div className="lookupSelectRow"><select value={r.productId} onChange={(e) => selectProduct(i, e.target.value)}><option value="">Select Product</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select><CreateLookupButton to="/dms/products" label="Create" resource="product" selectedValue={r.productId} onReturn={load}/></div></label>
          <label><span>Warehouse</span><input readOnly value={r.warehouseName || "-"}/></label>
          <label><span>HSN</span><input readOnly value={r.hsnCode || ""}/></label>
          <label><span>Gross Unit</span><input readOnly value={r.grossUnit || r.netUnit || ""}/></label>
          <label><span>Gross Qty</span><input type="number" step="0.001" value={r.grossQty} onChange={(e) => changeGross(i, Number(e.target.value))}/></label>
          <label><span>Net Qty</span><input type="number" step="0.001" min="0" value={r.qty} onChange={(e) => changeRow(i, "qty", Number(e.target.value))}/></label>
          <label><span>Net Unit</span><input readOnly value={r.netUnit || ""}/></label>
          <label><span>Tax %</span><input type="number" step="0.01" value={r.gstRate} onChange={(e) => changeRow(i, "gstRate", Number(e.target.value))}/></label>
          <label><span>Basic Price</span><input type="number" step="0.01" value={r.rate} onChange={(e) => changeRow(i, "rate", Number(e.target.value))}/></label>
          <label><span>Basic Total</span><input type="number" step="0.01" value={r.taxable} onChange={(e) => changeBasicTotal(i, Number(e.target.value))}/></label>
          <label><span>Landed Price</span><input readOnly value={landedCalc.itemRates[i]?.landedRate ?? r.rate ?? 0}/></label>
          <button className="oldDmsRemoveBtn" disabled={rows.length === 1} onClick={() => setRows((list) => list.filter((_, x) => x !== i))} title="Remove Product"><Trash2 size={14}/></button>
        </div>)}
        <button className="oldDmsAddRowBtn" onClick={() => setRows((list) => [...list, newRow()])} title="Add Product"><Plus size={16}/></button>
      </div>

      <div className="oldDmsAdjustHead oldDmsAdjustMasterHead oldDmsAdjustmentOneRow">
        <b className="oldDmsAdjustTitle">Discount / Charges</b>
        {["Discount", "Charges"].map((type) => {
          const selectedId = selectedAdjustmentMaster[type] || "";
          return <div className={`oldDmsAdjustmentInline oldDmsAdjustmentInline${type}`} key={type}>
            <span className="oldDmsAdjustmentInlineLabel">{type}</span>
            <select value={selectedId} onChange={(e) => chooseAdjustmentMaster(type, e.target.value)}><option value="">Select {type}</option>{mastersFor(type).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select>
            <button type="button" className="lookupCreateBtn" onClick={() => openAdjustmentMasterEditor(type)} title={`Create ${type}`}><Plus size={14}/></button>
            {selectedId && <button type="button" className="lookupEditBtn" onClick={() => openAdjustmentMasterEditor(type, selectedId)} title={`Edit selected ${type}`}><Pencil size={13}/></button>}
          </div>;
        })}
      </div>

      {!!adjustments.length && <div className="oldDmsAdjustTableWrap"><table className="oldDmsAdjustTable"><thead><tr><th>#</th><th>Type</th><th>Title</th><th>Method</th><th>% / Amount</th><th>Applied</th><th></th></tr></thead><tbody>{adjustmentCalc.applied.map((a, i) => <tr key={a.id}><td>{i+1}</td><td><b>{a.type}</b></td><td>{a.title}</td><td><select value={a.method} onChange={(e) => setAdjustments((list) => list.map((x) => x.id === a.id ? { ...x, method: e.target.value } : x))}><option>Amount</option><option>Percentage</option></select></td><td><input type="number" step="0.01" value={a.value} onChange={(e) => setAdjustments((list) => list.map((x) => x.id === a.id ? { ...x, value: Number(e.target.value) } : x))}/></td><td>{money(a.applied)}</td><td><button className="oldDmsRemoveBtn" onClick={() => removeAdjustment(a)}><Trash2 size={13}/></button></td></tr>)}</tbody></table></div>}

      {adjustmentMasterEditor && <div className="modalOverlay oldDmsAdjustmentMasterModal"><section className="panel modalPanel"><div className="formTitle"><div><h3>{adjustmentMasterEditor.id ? "Edit" : "Create"} {adjustmentMasterEditor.type}</h3></div><button className="iconBtn" type="button" onClick={() => setAdjustmentMasterEditor(null)}><X/></button></div><div className="formGrid oldDmsAdjustmentMasterForm"><label>Name<input autoFocus value={adjustmentMasterEditor.title} onChange={(e) => setAdjustmentMasterEditor((x) => ({ ...x, title: e.target.value }))}/></label><label>Default Method<select value={adjustmentMasterEditor.method} onChange={(e) => setAdjustmentMasterEditor((x) => ({ ...x, method: e.target.value }))}><option>Amount</option><option>Percentage</option></select></label><label>Default Value<input type="number" step="0.01" value={adjustmentMasterEditor.value} onChange={(e) => setAdjustmentMasterEditor((x) => ({ ...x, value: Number(e.target.value) }))}/></label></div><div className="formActions"><button className="btn ghost" onClick={() => setAdjustmentMasterEditor(null)}>Cancel</button><button className="btn primary" disabled={!String(adjustmentMasterEditor.title || "").trim()} onClick={saveAdjustmentMaster}>Save</button></div></section></div>}

      <div className="oldDmsInvoiceFoot oldDmsPurchaseFoot">
        <div className="oldDmsHsnBlock">
          <div className="oldDmsMiniFields oldDmsLandedCostGrid">
            <label><span>Transportation</span><input type="number" min="0" step="0.01" value={header.transportationCost} onChange={(e) => setH("transportationCost", Number(e.target.value))}/></label>
            <label><span>Labour</span><input type="number" min="0" step="0.01" value={header.labourCost} onChange={(e) => setH("labourCost", Number(e.target.value))}/></label>
            <label><span>Local Freight</span><input type="number" min="0" step="0.01" value={header.localFreight} onChange={(e) => setH("localFreight", Number(e.target.value))}/></label>
            <label><span>Miscellaneous</span><input type="number" min="0" step="0.01" value={header.miscellaneousCost} onChange={(e) => setH("miscellaneousCost", Number(e.target.value))}/></label>
            <label><span>Landed %</span><input readOnly value={`${landedCalc.expensePercentage}%`}/></label>
            <label><span>Landed Total</span><input readOnly value={landedCalc.totalExpense}/></label>
            <label className="od-remarks"><span>Remarks</span><input value={header.remarks} onChange={(e) => setH("remarks", e.target.value)}/></label>
          </div>
          {!!hsnSummary.length && <div className="oldDmsHsnWrap"><table><thead><tr><th>HSN</th><th>Taxable Value</th><th>GST %</th><th>GST</th><th>Total</th></tr></thead><tbody>{hsnSummary.map((h) => <tr key={`${h.hsn}-${h.rate}-${h.isCharge ? "charge" : "item"}`}><td>{h.hsn}</td><td>{money(h.taxable)}</td><td>{h.rate}%</td><td>{money(h.tax)}</td><td>{money(h.total)}</td></tr>)}<tr className="od-hsn-total"><td>TOTAL (Pre-Round)</td><td>{money(totals.taxable)}</td><td></td><td>{money(totals.tax)}</td><td>{money(totals.gross)}</td></tr><tr><td colSpan="4">ROUND OFF</td><td>{money(totals.roundOff)}</td></tr><tr className="od-hsn-grand"><td colSpan="4">GRAND TOTAL</td><td>{money(totals.grand)}</td></tr></tbody></table></div>}
        </div>
        <div className="oldDmsTotals"><div><span>Basic Total</span><b>{money(totals.lineSubtotal)}</b></div><div><span>Discount Total</span><b>{money(totals.discountTotal)}</b></div><div><span>Charges Total</span><b>{money(totals.chargesTotal)}</b></div><div><span>Taxable Value</span><b>{money(totals.taxable)}</b></div><div><span>GST</span><b>{money(totals.tax)}</b></div><div><span>Round Off</span><b>{money(totals.roundOff)}</b></div><div><span>Landed Cost Total</span><b>{money(landedCalc.totalExpense)}</b></div><div className="grand"><span>Invoice Total</span><b>{money(totals.grand)}</b></div>{!(embedded || batchMode) && <button className="oldDmsSubmitBtn" disabled={loading} onClick={() => post()}>{loading ? (isEdit ? "Updating..." : "Posting...") : (isEdit ? "Update Purchase Invoice" : "Create Purchase Invoice")}</button>}{(embedded || batchMode) && <div className="oldDmsEmpty">This invoice will be posted with <b>Submit All Invoices</b>.</div>}</div>
      </div>
    </section>
  </>;

  if (embedded) {
    return <div className="oldDmsMonthGroup">
      <button type="button" className="oldDmsMonthHead" onClick={() => setBatchOpen((open) => !open)}>
        {batchOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
        <b>Purchase Invoice {batchIndex}</b>
        <span>{header.supplierName || "New invoice"}</span>
        <strong>{money(totals.grand)}</strong>
        {onRemoveInvoice && <span className="oldDmsTableActions" onClick={(e) => e.stopPropagation()}><button type="button" className="oldDmsTableActionBtn danger" title="Remove Invoice" onClick={onRemoveInvoice}><Trash2 size={13}/></button></span>}
      </button>
      {batchOpen && createForm}
    </div>;
  }

  return <>
    {batchMode && <div className="oldDmsMonthGroup"><button type="button" className="oldDmsMonthHead" onClick={() => setBatchOpen((open) => !open)}>{batchOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}<b>Purchase Invoice 1</b><span>{header.supplierName || "New invoice"}</span><strong>{money(totals.grand)}</strong></button></div>}
    {(!batchMode || batchOpen) && createForm}
    {!isEdit && extraInvoiceKeys.map((key, index) => <PurchaseInvoicePage key={key} embedded batchIndex={index + 2} batchKey={key} registerBatchSave={registerBatchSave} onRemoveInvoice={() => removeExtraInvoice(key)} />)}
    {!isEdit && <div className="formActions" style={{ justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
      <button type="button" className="btn ghost" onClick={addMoreInvoice}><Plus size={15}/> Add More Invoices</button>
      {batchMode && <button type="button" className="btn primary" disabled={batchSaving} onClick={submitAllInvoices}>{batchSaving ? "Submitting..." : `Submit All Invoices (${extraInvoiceKeys.length + 1})`}</button>}
    </div>}
  </>;
}

function purchaseTaxSplit(r) {
  const items = Array.isArray(r?.items) ? r.items : [];
  const direct = {
    cgst: items.reduce((s,x)=>s+Number(x?.cgst||0),0),
    sgst: items.reduce((s,x)=>s+Number(x?.sgst||0),0),
    igst: items.reduce((s,x)=>s+Number(x?.igst||0),0),
  };
  if (direct.cgst || direct.sgst || direct.igst) return direct;
  const tax = Number(r?.taxTotal || 0);
  const gstin = String(r?.supplierGstinSnapshot || "");
  const companyGstin = String(getUser()?.companyProfile?.gstin || "");
  const inter = gstin.slice(0,2) && companyGstin.slice(0,2) && gstin.slice(0,2) !== companyGstin.slice(0,2);
  return inter ? {cgst:0,sgst:0,igst:tax} : {cgst:tax/2,sgst:tax/2,igst:0};
}

function PurchaseListTable({ rows, onEdit, onDelete, partyMap }) {
  return <div className="oldDmsInvoiceTableWrap"><table className="oldDmsInvoiceTable oldDmsPurchaseLegacyTable"><thead><tr><th>S.No</th><th>Status</th><th>Invoice No.</th><th>Date</th><th>Contact</th><th>Company</th><th>Owner</th><th>User Name</th><th>Builty No.</th><th>Packages</th><th>Vehicle No.</th><th>IGST</th><th>CGST</th><th>SGST</th><th>Additional Charges</th><th>Amount</th><th>Charges</th><th>Round Off</th><th>Landed Price</th><th>Grand Total</th><th>Actions</th></tr></thead><tbody>{!rows.length && <tr><td colSpan="21" className="oldDmsEmpty">No purchase invoices in this period.</td></tr>}{rows.map((r,i) => {
    const party = partyMap?.get(String(r.supplierGlobalId || "")) || {};
    const tax = purchaseTaxSplit(r);
    const contact = party.contactNumber || party.mobileNumber || party.phone || "-";
    const owner = party.ownerName || party.contactPerson || "-";
    return <tr key={r._id || r.invoiceNo}><td>{i+1}</td><td><StatusBadge value={r.status || "POSTED"}/></td><td><button className="tableClickLink" onClick={() => onEdit?.(r)}>{r.invoiceNo || "-"}</button></td><td>{ymd(r.date)}</td><td>{contact}</td><td><EditMasterLink to="/dms/customers" id={r.supplierGlobalId} resource="customer">{r.partyNameDisplay || r.supplierNameSnapshot || "Supplier"}</EditMasterLink></td><td>{owner}</td><td>{r.userNameDisplay || r.createdByNameSnapshot || "—"}</td><td>{r.builtyNumber || r.BuiltyNumber || r.biltyNo || "-"}</td><td>{r.noOfPackages || r.NoOfPackage || "-"}</td><td>{r.vehicleNo || r.vehicleNumber || "-"}</td><td>{money(tax.igst)}</td><td>{money(tax.cgst)}</td><td>{money(tax.sgst)}</td><td>{money(r.landedCharges || 0)}</td><td>{money(r.subtotal || 0)}</td><td>{money(r.otherCharges || 0)}</td><td>{money(r.roundOff || 0)}</td><td><b title={landedPriceBreakdown(r) || "Landed price"}>{Array.isArray(r.items) && r.items.length > 1 ? `Avg ${money(invoiceLandedPrice(r))}` : money(invoiceLandedPrice(r))}</b></td><td><b>{money(r.grandTotal || 0)}</b></td><td><div className="oldDmsTableActions"><button type="button" className="oldDmsTableActionBtn" title="Edit Purchase Invoice" onClick={() => onEdit?.(r)}><Pencil size={13}/></button><button type="button" className="oldDmsTableActionBtn danger" title="Delete Purchase Invoice" onClick={() => onDelete?.(r)}><Trash2 size={13}/></button></div></td></tr>;
  })}</tbody></table></div>;
}
