import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Trash2,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  PackagePlus,
  Upload,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EditMasterLink from "../components/EditMasterLink.jsx";
import BulkTools from "../components/BulkTools.jsx";
import ScanAndFill from "../components/ScanAndFill.jsx";
import CreateLookupButton, {
  getLookupEditId,
  isLookupCreate,
  notifyLookupCreated,
} from "../components/CreateLookupButton.jsx";
import { api } from "../lib/api.js";
import { isAdminUser } from "../lib/adminVisibility.js";

const blank = {
  sku: "",
  name: "",
  category: "",
  subCategory: "",
  warehouseId: "",
  hsnCode: "",
  hsnDescription: "",
  gstRate: 0,
  basicUnit: "PCS",
  packingUnit: "",
  qtyInBag: 1,
  openingStock: 0,
  openingRate: 0,
  averagePurchasePrice: 0,
  landedCost: 0,
  mrp: 0,
  salePrice: 0,
  minStockAlert: 0,
  minimumProfitPct: 3,
  barcode: "",
  barcodeSource: "",
  status: "ACTIVE",
};

const bulkFields = [
  { key: "sku", label: "SKU", example: "CUTLERY-SPOON-BIO-SPOON-160MM", noBulkEdit: true },
  { key: "name", label: "Product Name", example: "Bio Spoon 160mm", noBulkEdit: true },
  { key: "category", label: "Category", example: "Cutlery" },
  { key: "subCategory", label: "Sub Category", example: "Spoon" },
  { key: "hsnCode", label: "HSN / SAC", example: "39241090" },
  { key: "gstRate", label: "GST %", type: "number", example: "18" },
  { key: "basicUnit", label: "Basic Unit", example: "PCS" },
  { key: "packingUnit", label: "Packing Unit", example: "BAG" },
  { key: "qtyInBag", label: "Qty In Bag", type: "number", example: "100" },
  { key: "openingStock", label: "Opening Stock", type: "number", example: "1000" },
  { key: "openingRate", label: "Opening Rate", type: "number", example: "1.20" },
  {
    key: "averagePurchasePrice",
    label: "Average Purchase Price",
    type: "number",
    example: "1.20",
  },
  { key: "landedCost", label: "Landed Cost", type: "number", example: "1.30" },
  { key: "mrp", label: "MRP", type: "number", example: "2.00" },
  { key: "salePrice", label: "Default Sale Price", type: "number", example: "1.80" },
  { key: "minStockAlert", label: "Min Stock Alert", type: "number", example: "500" },
  {
    key: "minimumProfitPct",
    label: "Minimum Profit %",
    type: "number",
    example: "3",
  },
  { key: "barcode", label: "Barcode / GTIN", example: "8901234567890", noBulkEdit: true },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["ACTIVE", "INACTIVE"],
    example: "ACTIVE",
  },
];

const uploadQuickFields = [
  { key: "sku", label: "SKU", example: "CUTLERY-SPOON-BIO-SPOON-160MM" },
  { key: "name", label: "Product Name", example: "Bio Spoon 160mm" },
  { key: "category", label: "Category", example: "Cutlery" },
  { key: "subCategory", label: "Sub Category", example: "Spoon" },
  { key: "warehouseId", label: "Warehouse", example: "Main Warehouse" },
  { key: "hsnCode", label: "HSN / SAC", example: "39241090" },
  { key: "gstRate", label: "GST %", type: "number", example: "18" },
  { key: "basicUnit", label: "Basic Unit", example: "PCS" },
  { key: "packingUnit", label: "Packing Unit", example: "BAG" },
  { key: "qtyInBag", label: "Qty In Bag", type: "number", example: "100" },
  { key: "openingStock", label: "Opening Stock", type: "number", example: "1000" },
  { key: "openingRate", label: "Opening Rate", type: "number", example: "1.20" },
  { key: "mrp", label: "MRP", type: "number", example: "2.00" },
  { key: "salePrice", label: "Sale Price", type: "number", example: "1.80" },
  { key: "status", label: "Status", example: "ACTIVE" },
];

const csvEsc = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const saveCsvFile = (content, fileName) => {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
};

const normalizedHsn = (value) =>
  String(value || "")
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();

const EAN_L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const EAN_G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
const EAN_R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
const EAN_PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

function barcodeBits(rawValue) {
  const value = String(rawValue || "").replace(/\D/g, "");
  if (value.length === 13) {
    const first = Number(value[0]);
    const parity = EAN_PARITY[first];
    let bits = "101";
    for (let i = 1; i <= 6; i += 1) {
      const digit = Number(value[i]);
      bits += parity[i - 1] === "G" ? EAN_G[digit] : EAN_L[digit];
    }
    bits += "01010";
    for (let i = 7; i <= 12; i += 1) bits += EAN_R[Number(value[i])];
    return bits + "101";
  }

  // Compact fallback for internal/non EAN-13 identifiers. This is display-only.
  const text = String(rawValue || "");
  if (!text) return "";
  return `101${[...text].map((char) => Number(char.charCodeAt(0)).toString(2).padStart(8, "0")).join("0")}101`;
}

function MiniBarcode({ value }) {
  const text = String(value || "").trim();
  if (!text) return <span className="barcodeEmpty">—</span>;
  const bits = barcodeBits(text);
  const width = Math.max(bits.length, 1);
  return (
    <div className="productBarcodeCell" title={text}>
      <svg className="miniBarcodeSvg" viewBox={`0 0 ${width} 36`} preserveAspectRatio="none" role="img" aria-label={`Barcode ${text}`}>
        {bits.split("").map((bit, index) => bit === "1" ? (
          <rect key={index} x={index} y="0" width="1" height="30" rx="0.05" />
        ) : null)}
      </svg>
      <span>{text}</span>
    </div>
  );
}

export default function ProductPage() {
  const admin = isAdminUser();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(blank);
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [hsnSuggestions, setHsnSuggestions] = useState([]);
  const [hsnSuggestOpen, setHsnSuggestOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [hsnMsg, setHsnMsg] = useState("");
  const [hsnLoading, setHsnLoading] = useState(false);
  const [identifierLoading, setIdentifierLoading] = useState(false);
  const [identifierMsg, setIdentifierMsg] = useState("");
  const [skuManual, setSkuManual] = useState(false);
  const [barcodeManual, setBarcodeManual] = useState(false);
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });

  const [bulkReviewOpen, setBulkReviewOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState(1);
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkSummary, setBulkSummary] = useState(null);
  const [bulkApplyField, setBulkApplyField] = useState("");
  const [bulkApplyValue, setBulkApplyValue] = useState("");
  const [expandedBulkRows, setExpandedBulkRows] = useState([]);

  const hsnLookupSeq = useRef(0);
  const bulkUploadInput = useRef(null);
  const identifierSeq = useRef(0);
  const skuManualRef = useRef(false);
  const barcodeManualRef = useRef(false);

  const load = async (next = page) => {
    try {
      const data = await api(
        `/products?q=${encodeURIComponent(q)}&page=${next}&limit=50`,
      );
      setRows(data.items || []);
      setMeta(
        data.meta || {
          page: next,
          pages: 1,
          total: (data.items || []).length,
        },
      );
      setPage(data.meta?.page || next);
    } catch (error) {
      setMsg(error.message);
    }
  };

  const loadMasters = () =>
    Promise.all([
      api("/catalog/units?limit=200&status=ACTIVE"),
      api("/catalog/categories?limit=200"),
      api("/modules/dms/warehouses?status=ACTIVE&limit=200").catch(() => ({ items: [] })),
    ])
      .then(([unitData, categoryData, warehouseData]) => {
        setUnits(unitData.items || []);
        setCategories(categoryData.items || []);
        setWarehouses(Array.isArray(warehouseData) ? warehouseData : (warehouseData.items || []));
      })
      .catch(() => {});

  useEffect(() => {
    load(1);
    loadMasters();
  }, []);

  const currentCategory = useMemo(
    () =>
      categories.find(
        (item) => item.name === form.category || item.code === form.category,
      ),
    [categories, form.category],
  );

  const unitNameByCode = useMemo(
    () => new Map(units.map((unit) => [String(unit.code || "").toUpperCase(), unit.name || unit.code])),
    [units],
  );
  const unitByCode = useMemo(
    () => new Map(units.map((unit) => [String(unit.code || "").toUpperCase(), unit])),
    [units],
  );
  const visibleBulkFields = useMemo(
    () => admin ? bulkFields : bulkFields.filter((field) => field.key !== "minimumProfitPct"),
    [admin],
  );

  const open = (row) => {
    const editing = Boolean(row);
    setEdit(row || null);
    setForm(
      row
        ? {
            ...blank,
            ...row,
            basicUnit: row.basicUnit || row.unit || "PCS",
          }
        : { ...blank },
    );
    setSkuManual(editing);
    setBarcodeManual(editing);
    skuManualRef.current = editing;
    barcodeManualRef.current = editing;
    setIdentifierMsg("");
    setHsnMsg("");
    setShow(true);
  };

  useEffect(() => {
    const lookupEditId = getLookupEditId();
    if (lookupEditId) {
      (async () => {
        try {
          let product = null;
          try {
            const direct = await api(`/products/${lookupEditId}`);
            product = direct?.item || direct?.product || direct;
          } catch {
            const list = await api(`/products?page=1&limit=500`);
            product = (list?.items || []).find((item) => String(item._id) === String(lookupEditId));
          }
          if (!product?._id) throw new Error("Selected product could not be loaded for editing");
          open(product);
        } catch (error) {
          setMsg(error.message);
        }
      })();
    } else if (isLookupCreate()) open(null);
  }, []);

  const applyHsn = (hsn) => {
    if (!hsn) return;
    const code = normalizedHsn(hsn.code);
    setForm((current) => ({
      ...current,
      hsnCode: code,
      hsnDescription: String(hsn.description || "").trim(),
      gstRate: Number(hsn.gstRate || 0),
    }));
    setHsnSuggestions([]);
    setHsnSuggestOpen(false);
    setHsnMsg("HSN/SAC selected from MASTER. Full description and GST loaded.");
  };

  const searchHsn = async (rawValue) => {
    const q = normalizedHsn(rawValue);
    const seq = ++hsnLookupSeq.current;
    if (!q) {
      setHsnSuggestions([]);
      setHsnSuggestOpen(false);
      setHsnMsg("");
      return;
    }
    setHsnLoading(true);
    try {
      const rows = await api(`/reference/hsn?q=${encodeURIComponent(q)}&limit=40`);
      if (seq !== hsnLookupSeq.current) return;
      const list = Array.isArray(rows) ? rows : (rows?.items || []);
      setHsnSuggestions(list);
      setHsnSuggestOpen(true);
      setHsnMsg(list.length ? `${list.length} matching HSN/SAC description${list.length === 1 ? "" : "s"}` : "No matching HSN/SAC found");
    } catch (error) {
      if (seq !== hsnLookupSeq.current) return;
      setHsnSuggestions([]);
      setHsnSuggestOpen(false);
      setHsnMsg(error.message || "HSN/SAC search failed");
    } finally {
      if (seq === hsnLookupSeq.current) setHsnLoading(false);
    }
  };

  const lookupHsn = async (rawCode) => {
    const code = normalizedHsn(rawCode);
    if (!code) return;
    setHsnLoading(true);
    try {
      const hsn = await api(`/reference/hsn/${encodeURIComponent(code)}`);
      applyHsn(hsn);
    } catch (error) {
      setHsnMsg(error.message || "Select an HSN/SAC from the matching list");
    } finally {
      setHsnLoading(false);
    }
  };

  useEffect(() => {
    const q = normalizedHsn(form.hsnCode);
    if (!q) {
      setHsnSuggestions([]);
      setHsnSuggestOpen(false);
      return;
    }
    const exactSelected = hsnSuggestions.some((row) => normalizedHsn(row.code) === q && form.hsnDescription);
    if (exactSelected) return;
    const timer = setTimeout(() => searchHsn(q), 220);
    return () => clearTimeout(timer);
  }, [form.hsnCode]);

  const requestIdentifiers = async ({ forceSku = false, forceBarcode = false } = {}) => {
    const name = String(form.name || "").trim();
    if (!name) {
      setIdentifierMsg("Enter Product Name to auto-generate SKU and Barcode / GTIN");
      return;
    }

    const seq = ++identifierSeq.current;
    setIdentifierLoading(true);
    setIdentifierMsg("Generating SKU and Barcode / GTIN...");

    try {
      const params = new URLSearchParams({
        name,
        category: form.category || "",
        subCategory: form.subCategory || "",
        hsnCode: form.hsnCode || "",
      });
      if (edit?._id) params.set("excludeProductId", edit._id);

      const result = await api(`/products/suggest-identifiers?${params.toString()}`);
      if (seq !== identifierSeq.current) return;

      setForm((current) => ({
        ...current,
        ...(forceSku || !skuManualRef.current ? { sku: result?.sku || current.sku } : {}),
        ...(forceBarcode || !barcodeManualRef.current
          ? {
              barcode: result?.barcode || current.barcode,
              barcodeSource: result?.barcodeSource || "",
            }
          : {}),
      }));

      const source = result?.barcodeSource;
      setIdentifierMsg(
        source === "MASTER_GTIN"
          ? "SKU generated and an AVAILABLE MASTER GTIN selected."
          : source === "MASTER_BARCODE"
            ? "SKU generated and an AVAILABLE MASTER barcode selected."
            : "SKU generated. No MASTER GTIN was available, so an internal EAN-13 was generated.",
      );
    } catch (error) {
      if (seq !== identifierSeq.current) return;
      setIdentifierMsg(error.message || "Unable to generate product identifiers");
    } finally {
      if (seq === identifierSeq.current) setIdentifierLoading(false);
    }
  };

  useEffect(() => {
    if (edit || !String(form.name || "").trim()) return;
    if (skuManual && barcodeManual) return;

    const timer = setTimeout(() => requestIdentifiers(), 450);
    return () => clearTimeout(timer);
  }, [
    edit,
    form.category,
    form.subCategory,
    form.name,
    form.hsnCode,
    skuManual,
    barcodeManual,
  ]);

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    try {
      if (!form.warehouseId) throw new Error("Warehouse is required for Product");
      if (form.hsnCode && !form.hsnDescription) {
        throw new Error("Enter a valid HSN/SAC available in MASTER");
      }

      const body = {
        ...form,
        qtyInBag: Number(form.qtyInBag || 1),
        openingStock: Number(form.openingStock || 0),
        openingRate: Number(form.openingRate || 0),
        averagePurchasePrice: Number(
          form.averagePurchasePrice || form.openingRate || 0,
        ),
        landedCost: Number(form.landedCost || form.openingRate || 0),
        mrp: Number(form.mrp || 0),
        salePrice: Number(form.salePrice || form.mrp || 0),
        gstRate: Number(form.gstRate || 0),
        minStockAlert: Number(form.minStockAlert || 0),
        ...(admin ? { minimumProfitPct: Number(form.minimumProfitPct || 0) } : {}),
      };

      const saved = await api(edit ? `/products/${edit._id}` : "/products", {
        method: edit ? "PUT" : "POST",
        body: JSON.stringify(body),
      });

      setMsg(edit ? "Product updated" : "Product created");
      setShow(false);
      await load();

      if (isLookupCreate() || getLookupEditId()) {
        notifyLookupCreated("product", {
          id: saved?._id || edit?._id,
          name: saved?.name || form.name,
          sku: saved?.sku || form.sku,
        });
      }
    } catch (error) {
      setMsg(error.message);
    }
  };

  const applyProductScan = (values) => {
    const wh = warehouses.find((w) => String(w.name || w.warehouseName || "").trim().toLowerCase() === String(values.warehouseName || "").trim().toLowerCase());
    setForm((f) => ({...f,...Object.fromEntries(Object.entries(values).filter(([k])=>k!=="warehouseName"&&k!=="items")),warehouseId:wh?._id||f.warehouseId}));
  };

  const del = async (row, { closeEditor = false } = {}) => {
    if (!row?._id) return;
    if (!confirm(`Delete ${row.name}? This is allowed only when the product is not used in any transaction.`)) return;
    try {
      await api(`/products/${row._id}`, { method: "DELETE" });
      if (closeEditor) setShow(false);
      setMsg(`${row.name || "Product"} deleted`);
      await load();
    } catch (error) {
      setMsg(error.message);
    }
  };

  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const toggleAll = (checked, ids) =>
    setSelected((current) =>
      checked
        ? [...new Set([...current, ...ids])]
        : current.filter((value) => !ids.includes(value)),
    );

  const closeBulkReview = () => {
    setBulkReviewOpen(false);
    setBulkStep(1);
    setBulkRows([]);
    setBulkError("");
    setBulkSummary(null);
    setBulkApplyField("");
    setBulkApplyValue("");
    setExpandedBulkRows([]);
    if (bulkUploadInput.current) bulkUploadInput.current.value = "";
  };

  const downloadProductTemplate = () => {
    const fields = [
      ...uploadQuickFields,
      { key: "averagePurchasePrice", label: "Average Purchase Price", example: "1.20" },
      { key: "landedCost", label: "Landed Cost", example: "1.30" },
      { key: "minStockAlert", label: "Min Stock Alert", example: "500" },
      ...(admin ? [{ key: "minimumProfitPct", label: "Minimum Profit %", example: "3" }] : []),
      { key: "barcode", label: "Barcode / GTIN", example: "8901234567890" },
    ];
    const header = fields.map((field) => csvEsc(field.label)).join(",");
    const sample = fields.map((field) => csvEsc(field.example || "")).join(",");
    saveCsvFile(`${header}\n${sample}\n`, "dms-products-two-stage-template.csv");
  };

  const previewProductFile = async (file) => {
    if (!file) return;
    setBulkBusy(true);
    setBulkError("");
    setBulkSummary(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await api("/products/bulk-preview", { method: "POST", body: fd });
      const incoming = (data.rows || []).map((row, index) => ({
        ...blank,
        ...row,
        _clientKey: `${row._uploadRow || index + 2}-${Date.now()}-${index}`,
        basicUnit: row.basicUnit || "PCS",
        qtyInBag: row.qtyInBag ?? 1,
        minimumProfitPct: row.minimumProfitPct ?? 3,
        status: row.status || "ACTIVE",
      }));
      setBulkRows(incoming);
      setBulkStep(1);
      setExpandedBulkRows(incoming[0]?._clientKey ? [incoming[0]._clientKey] : []);
      setBulkReviewOpen(true);
    } catch (error) {
      setBulkError(error.message || "Unable to preview product file");
      setBulkReviewOpen(true);
    } finally {
      setBulkBusy(false);
      if (bulkUploadInput.current) bulkUploadInput.current.value = "";
    }
  };

  const updateBulkRow = (index, key, value) => {
    setBulkRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const next = { ...row, [key]: value, error: "" };
      if (key === "category" && value !== row.category) next.subCategory = "";
      if (key === "hsnCode") {
        next.hsnCode = normalizedHsn(value);
        next.hsnDescription = "";
      }
      if (key === "openingStock") next.currentStock = Number(value || 0);
      if (key === "openingRate") {
        const numeric = Number(value || 0);
        next.lastPurchasePrice = numeric;
        if (!Number(next.averagePurchasePrice || 0)) next.averagePurchasePrice = numeric;
        if (!Number(next.landedCost || 0)) next.landedCost = numeric;
      }
      return next;
    }));
  };

  const removeBulkRow = (index) => {
    setBulkRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const toggleBulkRow = (key) => {
    setExpandedBulkRows((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );
  };

  const applyBulkValueToAll = () => {
    if (!bulkApplyField) return;
    const numericKeys = new Set([
      "gstRate", "qtyInBag", "openingStock", "openingRate", "averagePurchasePrice",
      "landedCost", "mrp", "salePrice", "minStockAlert", "minimumProfitPct",
    ]);
    const nextValue = numericKeys.has(bulkApplyField) && bulkApplyValue !== ""
      ? Number(bulkApplyValue)
      : bulkApplyValue;
    setBulkRows((current) => current.map((row) => ({ ...row, [bulkApplyField]: nextValue, error: "" })));
  };

  const verifyBulkHsn = async (index) => {
    const row = bulkRows[index];
    const code = normalizedHsn(row?.hsnCode);
    if (!code) {
      updateBulkRow(index, "hsnDescription", "");
      return;
    }
    setBulkBusy(true);
    setBulkError("");
    try {
      const hsn = await api(`/reference/hsn/${encodeURIComponent(code)}`);
      setBulkRows((current) => current.map((item, rowIndex) => rowIndex === index ? {
        ...item,
        hsnCode: normalizedHsn(hsn?.code || code),
        hsnDescription: String(hsn?.description || ""),
        gstRate: Number(hsn?.gstRate || 0),
        error: "",
      } : item));
    } catch (error) {
      setBulkRows((current) => current.map((item, rowIndex) => rowIndex === index ? {
        ...item,
        hsnDescription: "",
        error: error.message || "HSN/SAC not found in MASTER",
      } : item));
    } finally {
      setBulkBusy(false);
    }
  };

  const generateBulkIdentifiers = async (index) => {
    const row = bulkRows[index];
    if (!String(row?.name || "").trim()) {
      setBulkError("Enter Product Name before generating SKU / Barcode");
      return;
    }
    setBulkBusy(true);
    setBulkError("");
    try {
      const params = new URLSearchParams({
        name: row.name || "",
        category: row.category || "",
        subCategory: row.subCategory || "",
        hsnCode: row.hsnCode || "",
      });
      const result = await api(`/products/suggest-identifiers?${params.toString()}`);
      setBulkRows((current) => current.map((item, rowIndex) => rowIndex === index ? {
        ...item,
        sku: result?.sku || item.sku,
        barcode: result?.barcode || item.barcode,
        barcodeSource: result?.barcodeSource || item.barcodeSource,
        error: "",
      } : item));
    } catch (error) {
      setBulkError(error.message || "Unable to generate product identifiers");
    } finally {
      setBulkBusy(false);
    }
  };

  const commitBulkProducts = async () => {
    if (!bulkRows.length) return;
    setBulkBusy(true);
    setBulkError("");
    setBulkSummary(null);
    try {
      const cleanRows = bulkRows.map(({ _clientKey, ...row }) => row);
      const data = await api("/products/bulk-commit", {
        method: "POST",
        body: JSON.stringify({ rows: cleanRows }),
      });
      setBulkSummary(data);
      await load(1);
      if (Array.isArray(data.rejectedRows) && data.rejectedRows.length) {
        const rejected = data.rejectedRows.map((row, index) => ({
          ...blank,
          ...row,
          _clientKey: `${row._uploadRow || index + 2}-rejected-${Date.now()}-${index}`,
        }));
        setBulkRows(rejected);
        setBulkStep(2);
        setExpandedBulkRows(rejected.map((row) => row._clientKey));
        setBulkError(`${data.rejectedRows.length} product(s) still need correction. Successfully imported products were saved.`);
      } else {
        setMsg(`${data.inserted || 0} inserted • ${data.updated || 0} updated${data.unchanged ? ` • ${data.unchanged} unchanged` : ""}`);
        closeBulkReview();
      }
    } catch (error) {
      setBulkError(error.message || "Product import failed");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Products"
        onAdd={() => open(null)}
        addLabel="Create Product"
      />

      {msg && <div className="resultBanner good">{msg}</div>}

      <div className="bulkActionBar" style={{ marginBottom: 10 }}>
        <div className="bulkActionLeft">
          <strong>Product Bulk Upload</strong>
          <span className="tableSubText">2-step review: quick grid → full expandable product forms → final import</span>
        </div>
        <div className="bulkActionRight">
          <button className="btn ghost" type="button" onClick={downloadProductTemplate}>
            <Download size={15} /> Template
          </button>
          <button className="btn ghost" type="button" disabled={bulkBusy} onClick={() => bulkUploadInput.current?.click()}>
            <Upload size={15} /> {bulkBusy ? "Reading..." : "Bulk Upload — Review First"}
          </button>
          <input
            ref={bulkUploadInput}
            hidden
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => previewProductFile(event.target.files?.[0])}
          />
        </div>
      </div>

      <BulkTools
        endpoint="/products"
        fields={visibleBulkFields}
        allowUpload={false}
        editFields={visibleBulkFields.filter((field) => !field.noBulkEdit)}
        selectedIds={selected}
        onClear={() => setSelected([])}
        onDone={() => load()}
        templateName="dms-products-full-template.csv"
      />

      {bulkReviewOpen && (
        <div className="modalOverlay">
          <section className="panel modalPanel extraWideModal" style={{ maxWidth: "96vw", width: "1500px", maxHeight: "94vh", overflow: "auto" }}>
            <div className="formTitle">
              <div>
                <h3><Upload size={19} /> Product Bulk Upload — Step {bulkStep} of 2</h3>
                <span>
                  {bulkStep === 1
                    ? "Quick review only. Blank cells are allowed here; nothing has been saved yet."
                    : "Open each product and review the full Create Product form. Final Import is the only step that writes to the database."}
                </span>
              </div>
              <button className="iconBtn" type="button" onClick={closeBulkReview}><X /></button>
            </div>

            {bulkError && <div className="resultBanner bad"><AlertTriangle size={16} />{bulkError}</div>}
            {bulkSummary && (
              <div className={`resultBanner ${bulkSummary.invalid ? "bad" : "good"}`}>
                <CheckCircle2 size={16} />
                {bulkSummary.inserted || 0} inserted • {bulkSummary.updated || 0} updated
                {bulkSummary.unchanged ? ` • ${bulkSummary.unchanged} unchanged` : ""}
                {bulkSummary.invalid ? ` • ${bulkSummary.invalid} need correction` : ""}
              </div>
            )}

            {bulkStep === 1 ? (
              <>
                <div className="sectionHeader" style={{ marginTop: 12 }}>
                  <div>
                    <h3>Step 1 — Quick Spreadsheet Preview</h3>
                    <span className="tableSubText">{bulkRows.length} product(s). Empty boxes are okay; continue to Step 2 whenever you are ready.</span>
                  </div>
                </div>

                <div className="panel" style={{ padding: 12, marginBottom: 12 }}>
                  <div className="formGrid" style={{ alignItems: "end" }}>
                    <label>
                      Apply Field To All Rows
                      <select value={bulkApplyField} onChange={(event) => { setBulkApplyField(event.target.value); setBulkApplyValue(""); }}>
                        <option value="">Select field</option>
                        {uploadQuickFields.filter((field) => !["sku", "name"].includes(field.key)).map((field) => (
                          <option key={field.key} value={field.key}>{field.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Value
                      {bulkApplyField === "warehouseId" ? (
                        <select value={bulkApplyValue} onChange={(event) => setBulkApplyValue(event.target.value)}>
                          <option value="">Select Warehouse</option>
                          {warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.title || warehouse.reference || warehouse.name || "Warehouse"}</option>)}
                        </select>
                      ) : bulkApplyField === "status" ? (
                        <select value={bulkApplyValue} onChange={(event) => setBulkApplyValue(event.target.value)}>
                          <option value="">Select Status</option><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option>
                        </select>
                      ) : (
                        <input value={bulkApplyValue} onChange={(event) => setBulkApplyValue(event.target.value)} placeholder="Value for every uploaded product" />
                      )}
                    </label>
                    <button className="btn ghost" type="button" disabled={!bulkApplyField} onClick={applyBulkValueToAll}>Apply To All</button>
                  </div>
                </div>

                <div className="tableWrap" style={{ maxHeight: "58vh", overflow: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ position: "sticky", left: 0, zIndex: 3, background: "var(--panel,#fff)" }}>#</th>
                        {uploadQuickFields.map((field) => <th key={field.key} style={{ minWidth: field.key === "name" ? 220 : 135 }}>{field.label}</th>)}
                        <th>Review</th>
                        <th>Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row, index) => (
                        <tr key={row._clientKey || index}>
                          <td style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--panel,#fff)" }}>{index + 1}</td>
                          {uploadQuickFields.map((field) => (
                            <td key={field.key}>
                              {field.key === "warehouseId" ? (
                                <select value={row.warehouseId || ""} onChange={(event) => updateBulkRow(index, field.key, event.target.value)}>
                                  <option value="">—</option>
                                  {row.warehouseId && !warehouses.some((warehouse) => String(warehouse._id) === String(row.warehouseId)) && <option value={row.warehouseId}>{row.warehouseId}</option>}
                                  {warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.title || warehouse.reference || warehouse.name || "Warehouse"}</option>)}
                                </select>
                              ) : field.key === "status" ? (
                                <select value={row.status || "ACTIVE"} onChange={(event) => updateBulkRow(index, field.key, event.target.value)}>
                                  <option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option>
                                </select>
                              ) : (
                                <input
                                  type={field.type === "number" ? "number" : "text"}
                                  value={row[field.key] ?? ""}
                                  onChange={(event) => updateBulkRow(index, field.key, field.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)}
                                />
                              )}
                            </td>
                          ))}
                          <td>
                            <StatusBadge status={(row._issues?.length || row.error) ? "Incomplete — can continue" : "Ready"} />
                            {(row._issues?.length > 0 || row.error) && <small className="tableSubText">{row.error || row._issues?.join(" • ")}</small>}
                          </td>
                          <td><button className="iconBtn" type="button" onClick={() => removeBulkRow(index)} title="Remove from this import"><Trash2 size={15} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="formActions" style={{ marginTop: 14 }}>
                  <button className="btn ghost" type="button" onClick={closeBulkReview}>Cancel</button>
                  <button className="btn primary" type="button" disabled={!bulkRows.length} onClick={() => { setBulkStep(2); if (!expandedBulkRows.length && bulkRows[0]?._clientKey) setExpandedBulkRows([bulkRows[0]._clientKey]); }}>
                    Continue To Full Product Forms ({bulkRows.length})
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="sectionHeader" style={{ marginTop: 12 }}>
                  <div>
                    <h3>Step 2 — Full Product Form Review</h3>
                    <span className="tableSubText">Every product uses the same fields as Create Product. Expand, review and edit before Final Import.</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn ghost" type="button" onClick={() => setExpandedBulkRows(bulkRows.map((row) => row._clientKey))}>Expand All</button>
                    <button className="btn ghost" type="button" onClick={() => setExpandedBulkRows([])}>Collapse All</button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  {bulkRows.map((row, index) => {
                    const expanded = expandedBulkRows.includes(row._clientKey);
                    const rowCategory = categories.find((item) => item.name === row.category || item.code === row.category);
                    const rowSubCategories = (rowCategory?.subcategories || []).filter((item) => item.status !== "INACTIVE");
                    return (
                      <section key={row._clientKey || index} className="panel" style={{ padding: 0, overflow: "hidden" }}>
                        <button
                          type="button"
                          onClick={() => toggleBulkRow(row._clientKey)}
                          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", border: 0, background: "transparent", cursor: "pointer", textAlign: "left" }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <strong>{index + 1}. {row.name || "Unnamed Product"}</strong>
                            <div className="tableSubText">SKU: {row.sku || "Auto on import"} • {row.category || "No category"} • HSN: {row.hsnCode || "—"} • Warehouse: {warehouses.find((warehouse) => String(warehouse._id) === String(row.warehouseId))?.title || warehouses.find((warehouse) => String(warehouse._id) === String(row.warehouseId))?.reference || "Pending"}</div>
                            {row.error && <small style={{ color: "#b91c1c" }}>{row.error}</small>}
                          </div>
                          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {expanded && (
                          <div style={{ padding: "0 16px 16px" }}>
                            <div className="sectionLabel">1. Product Identity</div>
                            <div className="formGrid">
                              <label>SKU
                                <div className="lookupSelectRow">
                                  <input value={row.sku || ""} onChange={(event) => updateBulkRow(index, "sku", event.target.value.toUpperCase())} placeholder="Auto: Category-SubCategory-Product Name" />
                                  <button className="btn ghost" type="button" disabled={bulkBusy || !row.name} onClick={() => generateBulkIdentifiers(index)}>Auto</button>
                                </div>
                              </label>
                              <label>Product Name *<input value={row.name || ""} onChange={(event) => updateBulkRow(index, "name", event.target.value)} /></label>
                              <label>Category
                                <select value={row.category || ""} onChange={(event) => updateBulkRow(index, "category", event.target.value)}>
                                  <option value="">Select Category</option>
                                  {row.category && !categories.some((category) => category.name === row.category || category.code === row.category) && <option value={row.category}>{row.category}</option>}
                                  {categories.filter((category) => category.status !== "INACTIVE").map((category) => <option key={category._id} value={category.name}>{category.name}</option>)}
                                </select>
                              </label>
                              <label>Sub Category
                                <select value={row.subCategory || ""} onChange={(event) => updateBulkRow(index, "subCategory", event.target.value)}>
                                  <option value="">Select Sub Category</option>
                                  {row.subCategory && !rowSubCategories.some((item) => item.name === row.subCategory) && <option value={row.subCategory}>{row.subCategory}</option>}
                                  {rowSubCategories.map((item, subIndex) => <option key={`${item.name}-${subIndex}`} value={item.name}>{item.name}</option>)}
                                </select>
                              </label>
                              <label>Warehouse *
                                <select value={row.warehouseId || ""} onChange={(event) => updateBulkRow(index, "warehouseId", event.target.value)}>
                                  <option value="">Select Warehouse</option>
                                  {warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.title || warehouse.reference || warehouse.name || "Warehouse"}</option>)}
                                </select>
                              </label>
                              <label>Barcode / GTIN
                                <div className="lookupSelectRow">
                                  <input value={row.barcode || ""} onChange={(event) => updateBulkRow(index, "barcode", event.target.value.trim())} placeholder="Auto-generated / allocated" />
                                  <button className="btn ghost" type="button" disabled={bulkBusy || !row.name} onClick={() => generateBulkIdentifiers(index)}>Auto</button>
                                </div>
                              </label>
                              <label>Status
                                <select value={row.status || "ACTIVE"} onChange={(event) => updateBulkRow(index, "status", event.target.value)}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select>
                              </label>
                            </div>

                            <div className="sectionLabel">2. Unit & Packing</div>
                            <div className="formGrid">
                              <label>Basic Unit *
                                <select value={row.basicUnit || "PCS"} onChange={(event) => updateBulkRow(index, "basicUnit", event.target.value)}>
                                  <option value="PCS">PCS</option>
                                  {row.basicUnit && row.basicUnit !== "PCS" && !units.some((unit) => unit.code === row.basicUnit) && <option value={row.basicUnit}>{row.basicUnit}</option>}
                                  {units.map((unit) => <option key={unit._id} value={unit.code}>{unit.code} — {unit.name}</option>)}
                                </select>
                              </label>
                              <label>Packing Unit
                                <select value={row.packingUnit || ""} onChange={(event) => updateBulkRow(index, "packingUnit", event.target.value)}>
                                  <option value="">None</option>
                                  {row.packingUnit && !units.some((unit) => unit.code === row.packingUnit) && <option value={row.packingUnit}>{row.packingUnit}</option>}
                                  {units.map((unit) => <option key={unit._id} value={unit.code}>{unit.name || unit.code}</option>)}
                                </select>
                              </label>
                              <label>Quantity in Bag / Pack<input type="number" min="0" value={row.qtyInBag ?? ""} onChange={(event) => updateBulkRow(index, "qtyInBag", event.target.value === "" ? "" : Number(event.target.value))} /></label>
                              <label>Min Stock Alert<input type="number" value={row.minStockAlert ?? ""} onChange={(event) => updateBulkRow(index, "minStockAlert", event.target.value === "" ? "" : Number(event.target.value))} /></label>
                            </div>

                            <div className="sectionLabel">3. Tax</div>
                            <div className="formGrid">
                              <label>HSN / SAC
                                <div className="lookupSelectRow">
                                  <input value={row.hsnCode || ""} onChange={(event) => updateBulkRow(index, "hsnCode", event.target.value)} placeholder="Type full HSN/SAC" />
                                  <button className="btn ghost" type="button" disabled={bulkBusy || !row.hsnCode} onClick={() => verifyBulkHsn(index)}>Verify</button>
                                </div>
                              </label>
                              <label className="wideField">HSN Description<textarea rows="3" value={row.hsnDescription || ""} readOnly placeholder="Verify HSN to load full description" /></label>
                              <label>GST Rate %<input type="number" min="0" max="100" step="0.01" value={row.gstRate ?? ""} onChange={(event) => updateBulkRow(index, "gstRate", event.target.value === "" ? "" : Number(event.target.value))} /></label>
                            </div>

                            <div className="sectionLabel">4. Stock & Purchase Cost</div>
                            <div className="formGrid">
                              <label>Opening Stock<input type="number" value={row.openingStock ?? ""} onChange={(event) => updateBulkRow(index, "openingStock", event.target.value === "" ? "" : Number(event.target.value))} /></label>
                              <label>Opening Rate<input type="number" step="0.01" value={row.openingRate ?? ""} onChange={(event) => updateBulkRow(index, "openingRate", event.target.value === "" ? "" : Number(event.target.value))} /></label>
                              <label>Last Purchase Price<input type="number" value={row.lastPurchasePrice ?? 0} readOnly /></label>
                              <label>Average Purchase Price<input type="number" step="0.01" value={row.averagePurchasePrice ?? ""} onChange={(event) => updateBulkRow(index, "averagePurchasePrice", event.target.value === "" ? "" : Number(event.target.value))} /></label>
                              <label>Landed Cost<input type="number" step="0.01" value={row.landedCost ?? ""} onChange={(event) => updateBulkRow(index, "landedCost", event.target.value === "" ? "" : Number(event.target.value))} /></label>
                              <label>Current Stock<input type="number" value={row.currentStock ?? row.openingStock ?? 0} readOnly /></label>
                            </div>

                            <div className="sectionLabel">5. {admin ? "Selling & Profit" : "Selling"}</div>
                            <div className="formGrid">
                              <label>MRP<input type="number" step="0.01" value={row.mrp ?? ""} onChange={(event) => updateBulkRow(index, "mrp", event.target.value === "" ? "" : Number(event.target.value))} /></label>
                              <label>Default Sale Price<input type="number" step="0.01" value={row.salePrice ?? ""} onChange={(event) => updateBulkRow(index, "salePrice", event.target.value === "" ? "" : Number(event.target.value))} /></label>
                              {admin && <label>Minimum Profit %<input type="number" value={row.minimumProfitPct ?? ""} onChange={(event) => updateBulkRow(index, "minimumProfitPct", event.target.value === "" ? "" : Number(event.target.value))} /></label>}
                            </div>

                            <details style={{ marginTop: 12 }}>
                              <summary><strong>Original Uploaded Row</strong> — read-only source data</summary>
                              <div className="formGrid" style={{ marginTop: 10 }}>
                                {Object.entries(row._original || {}).map(([key, value]) => (
                                  <label key={key}>{key}<input value={String(value ?? "")} readOnly /></label>
                                ))}
                              </div>
                            </details>

                            <div className="formActions" style={{ marginTop: 12 }}>
                              <button className="btn danger" type="button" onClick={() => removeBulkRow(index)}><Trash2 size={15} /> Remove This Product</button>
                            </div>
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>

                <div className="formActions" style={{ marginTop: 14, position: "sticky", bottom: 0, background: "var(--panel,#fff)", paddingTop: 10 }}>
                  <button className="btn ghost" type="button" disabled={bulkBusy} onClick={() => setBulkStep(1)}>Back To Quick Preview</button>
                  <button className="btn primary" type="button" disabled={bulkBusy || !bulkRows.length} onClick={commitBulkProducts}>
                    {bulkBusy ? "Importing..." : `Final Import (${bulkRows.length} Product${bulkRows.length === 1 ? "" : "s"})`}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {show && (
        <div className="modalOverlay">
          <section className="panel modalPanel extraWideModal productEditor">
            <div className="formTitle">
              <div>
                <h3>
                  <PackagePlus size={19} />
                  {edit ? "Edit Product" : "Create Product"}
                </h3>
                <span>
                  Build the product master once — warehouse, HSN, units, barcode and costing stay connected everywhere.
                </span>
              </div>
              <div className="formTitleActions"><ScanAndFill documentType="PRODUCT" targetPath="/dms/products" onApply={applyProductScan}/><button className="iconBtn" onClick={() => setShow(false)}><X /></button></div>
            </div>

            <div className="sectionLabel">1. Product Identity</div>
            <div className="formGrid">
              <label>
                SKU *
                <div className="lookupSelectRow">
                  <input
                    value={form.sku}
                    onChange={(event) => {
                      setSkuManual(true);
                      skuManualRef.current = true;
                      setField("sku", event.target.value.toUpperCase());
                    }}
                    placeholder="Auto: Category-SubCategory-Product Name"
                  />
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={identifierLoading || !form.name}
                    onClick={() => {
                      setSkuManual(false);
                      skuManualRef.current = false;
                      requestIdentifiers({ forceSku: true });
                    }}
                  >
                    Auto
                  </button>
                </div>
                <small>Auto logic: Category + Sub Category + Product Name. You can edit it.</small>
              </label>

              <label>
                Product Name *
                <input value={form.name} onChange={(event) => setField("name", event.target.value)} />
              </label>

              <label>
                Category
                <div className="lookupSelectRow">
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value,
                        subCategory: "",
                      }))
                    }
                  >
                    <option value="">Select Category</option>
                    {categories
                      .filter((category) => category.status !== "INACTIVE")
                      .map((category) => (
                        <option key={category._id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                  <CreateLookupButton
                    to="/dms/product-categories"
                    label="Create"
                    resource="category"
                    selectedValue={categories.find((category) => category.name === form.category || category.code === form.category)?._id || ""}
                    onReturn={loadMasters}
                  />
                </div>
              </label>

              <label>
                Sub Category
                <div className="lookupSelectRow">
                  <select
                    value={form.subCategory}
                    onChange={(event) => setField("subCategory", event.target.value)}
                  >
                    <option value="">Select Sub Category</option>
                    {(currentCategory?.subcategories || [])
                      .filter((subCategory) => subCategory.status !== "INACTIVE")
                      .map((subCategory, index) => (
                        <option key={index} value={subCategory.name}>
                          {subCategory.name}
                        </option>
                      ))}
                  </select>
                  <CreateLookupButton
                    to="/dms/product-categories"
                    label="Create"
                    resource="category"
                    selectedValue={currentCategory?._id || ""}
                    onReturn={loadMasters}
                    title="Create Category / Sub Category"
                  />
                </div>
              </label>

              <label>
                Warehouse *
                <select value={form.warehouseId || ""} onChange={(event) => setField("warehouseId", event.target.value)}>
                  <option value="">Select Warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse._id} value={warehouse._id}>
                      {warehouse.title || warehouse.reference || warehouse.name || "Warehouse"}
                    </option>
                  ))}
                </select>
                <small>Default warehouse used to divide and report this product stock.</small>
              </label>

              <label>
                Barcode / GTIN
                <div className="lookupSelectRow">
                  <input
                    value={form.barcode || ""}
                    onChange={(event) => {
                      setBarcodeManual(true);
                      barcodeManualRef.current = true;
                      setForm((current) => ({
                        ...current,
                        barcode: event.target.value.trim(),
                        barcodeSource: "MANUAL",
                      }));
                    }}
                    placeholder="Auto-generated / allocated"
                  />
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={identifierLoading || !form.name}
                    onClick={() => {
                      setBarcodeManual(false);
                      barcodeManualRef.current = false;
                      requestIdentifiers({ forceBarcode: true });
                    }}
                  >
                    Auto
                  </button>
                </div>
                <small>
                  MASTER available GTIN/barcode is preferred. Otherwise DMS creates an internal
                  EAN-13. Replace it with your official GS1 GTIN when required.
                </small>
              </label>

              <label>
                Status
                <select value={form.status} onChange={(event) => setField("status", event.target.value)}>
                  <option>ACTIVE</option>
                  <option>INACTIVE</option>
                </select>
                {identifierMsg && <small>{identifierLoading ? "Generating..." : identifierMsg}</small>}
              </label>
            </div>

            <div className="sectionLabel">2. Unit & Packing</div>
            <div className="formGrid">
              <label>
                Basic Unit *
                <div className="lookupSelectRow">
                  <select
                    value={form.basicUnit}
                    onChange={(event) => setField("basicUnit", event.target.value)}
                  >
                    <option value="PCS">PCS</option>
                    {units.map((unit) => (
                      <option key={unit._id} value={unit.code}>
                        {unit.code} — {unit.name}
                      </option>
                    ))}
                  </select>
                  <CreateLookupButton
                    to="/dms/units"
                    label="Create"
                    resource="unit"
                    selectedValue={units.find((unit) => String(unit.code) === String(form.basicUnit))?._id || ""}
                    onReturn={loadMasters}
                  />
                </div>
              </label>

              <label>
                Packing Unit
                <div className="lookupSelectRow">
                  <select
                    value={form.packingUnit || ""}
                    onChange={(event) => setField("packingUnit", event.target.value)}
                  >
                    <option value="">None</option>
                    {units.map((unit) => (
                      <option key={unit._id} value={unit.code}>
                        {unit.name || unit.code}
                      </option>
                    ))}
                  </select>
                  <CreateLookupButton
                    to="/dms/units"
                    label="Create"
                    resource="unit"
                    selectedValue={units.find((unit) => String(unit.code) === String(form.packingUnit))?._id || ""}
                    onReturn={loadMasters}
                  />
                </div>
              </label>

              <label>
                Quantity in Bag / Pack
                <input
                  type="number"
                  min="0"
                  value={form.qtyInBag}
                  onChange={(event) => setField("qtyInBag", Number(event.target.value))}
                />
                <small>Example: 100 PCS in 1 BAG</small>
              </label>

              <label>
                Min Stock Alert
                <input
                  type="number"
                  value={form.minStockAlert}
                  onChange={(event) => setField("minStockAlert", Number(event.target.value))}
                />
              </label>
            </div>

            <div className="sectionLabel">3. Tax</div>
            <div className="formGrid">
              <label className="hsnSmartField">
                HSN / SAC
                <div className="hsnSmartInput">
                  <input
                    value={form.hsnCode || ""}
                    inputMode="numeric"
                    autoComplete="off"
                    onFocus={() => form.hsnCode && setHsnSuggestOpen(true)}
                    onChange={(event) => {
                      const code = normalizedHsn(event.target.value);
                      setForm((current) => ({ ...current, hsnCode: code, hsnDescription: "", gstRate: 0 }));
                    }}
                    placeholder="Type 44, 4411 or full HSN"
                  />
                  {hsnLoading && <span className="hsnMiniLoader">…</span>}
                </div>
                {hsnSuggestOpen && hsnSuggestions.length > 0 && (
                  <div className="hsnSuggestionList">
                    {hsnSuggestions.map((hsn) => (
                      <button key={`${hsn.code}-${hsn._id || ""}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyHsn(hsn)}>
                        <strong>{hsn.code}</strong>
                        <span>{hsn.description || "No description"}</span>
                        <small>GST {Number(hsn.gstRate || 0)}%</small>
                      </button>
                    ))}
                  </div>
                )}
                <small className="hsnLookupHint">Type from the first digits. Example: 44 shows all HSN descriptions beginning with 44; keep typing to narrow the list.</small>
              </label>

              <label className="wideField">
                HSN Description
                <textarea
                  className="hsnDescriptionBox"
                  rows="3"
                  value={form.hsnDescription || ""}
                  readOnly
                  placeholder="Full HSN description will appear here"
                />
                {hsnMsg && (
                  <small
                    className="hsnLookupHint"
                    style={{ color: form.hsnDescription ? "#15803d" : "#b91c1c" }}
                  >
                    {hsnMsg}
                  </small>
                )}
              </label>

              <label>
                GST Rate %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={Number(form.gstRate || 0)}
                  onChange={(event) => setField("gstRate", Number(event.target.value))}
                />
                <small className="hsnLookupHint">
                  Auto-filled from HSN MASTER, but editable if a notified/product-specific rate
                  needs correction.
                </small>
              </label>
            </div>

            <div className="sectionLabel">4. Stock & Purchase Cost</div>
            <div className="formGrid">
              <label>
                Opening Stock
                <input
                  type="number"
                  value={form.openingStock}
                  onChange={(event) => setField("openingStock", Number(event.target.value))}
                />
              </label>
              <label>
                Opening Rate
                <input
                  type="number"
                  step="0.01"
                  value={form.openingRate}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setForm((current) => ({
                      ...current,
                      openingRate: value,
                      ...(!edit && !current.averagePurchasePrice
                        ? { averagePurchasePrice: value }
                        : {}),
                      ...(!edit && !current.landedCost ? { landedCost: value } : {}),
                    }));
                  }}
                />
              </label>
              <label>
                Last Purchase Price
                <input type="number" value={Number(form.lastPurchasePrice || 0)} readOnly />
              </label>
              <label>
                Average Purchase Price
                <input
                  type="number"
                  value={Number(form.averagePurchasePrice || 0)}
                  readOnly={Boolean(edit)}
                  onChange={(event) =>
                    setField("averagePurchasePrice", Number(event.target.value))
                  }
                />
                <small>Auto-updated by Purchase Invoice</small>
              </label>
              <label>
                Landed Cost
                <input
                  type="number"
                  step="0.01"
                  value={form.landedCost}
                  onChange={(event) => setField("landedCost", Number(event.target.value))}
                />
                <small>Auto-updated by Purchase Invoice</small>
              </label>
              <label>
                Current Stock
                <input
                  type="number"
                  value={Number(form.currentStock ?? form.openingStock ?? 0)}
                  readOnly
                />
              </label>
            </div>

            <div className="sectionLabel">5. {admin ? "Selling & Profit" : "Selling"}</div>
            <div className="formGrid">
              <label>
                MRP
                <input
                  type="number"
                  step="0.01"
                  value={form.mrp}
                  onChange={(event) => setField("mrp", Number(event.target.value))}
                />
              </label>
              <label>
                Default Sale Price
                <input
                  type="number"
                  step="0.01"
                  value={form.salePrice}
                  onChange={(event) => setField("salePrice", Number(event.target.value))}
                />
              </label>
              {admin && <label>
                Minimum Profit %
                <input
                  type="number"
                  value={form.minimumProfitPct}
                  onChange={(event) =>
                    setField("minimumProfitPct", Number(event.target.value))
                  }
                />
              </label>}
            </div>

            <div className="formActions productEditorActions">
              {edit && (
                <button className="btn danger productDeleteBtn" type="button" onClick={() => del(edit, { closeEditor: true })}>
                  <Trash2 size={16} />
                  Delete Product
                </button>
              )}
              <div className="productEditorMainActions">
                <button className="btn ghost" onClick={() => setShow(false)}>
                  Cancel
                </button>
                <button
                  className="btn primary"
                  disabled={
                    !form.sku ||
                    !form.name ||
                    !form.basicUnit ||
                    !form.warehouseId ||
                    (form.hsnCode && !form.hsnDescription)
                  }
                  onClick={save}
                >
                  {edit ? "Update Product" : "Save Product"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <section className="panel">
        <div className="toolbar">
          <div className="searchBox">
            <Search />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onKeyDown={(event) =>
                event.key === "Enter" && (setSelected([]), load(1))
              }
              placeholder="Search SKU, product, category, HSN or barcode..."
            />
          </div>
          <button className="btn ghost" onClick={() => load()}>
            <RefreshCw />
            Refresh
          </button>
          <div className="recordCount">{meta.total || 0} records</div>
        </div>

        <DataTable
          selectable
          selectedIds={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          mobileCards
          stickyFirstColumn
          columns={[
            { key: "name", label: "Product", render: (row) => <EditMasterLink onClick={() => open(row)}>{row.name || "—"}</EditMasterLink> },
            { key: "sku", label: "SKU" },
            {
              key: "category",
              label: "Category",
              render: (row) => (
                <>
                  <strong>{row.category || "—"}</strong>
                  <small className="tableSubText">{row.subCategory || ""}</small>
                </>
              ),
            },
            {
              key: "hsn",
              label: "HSN / GST",
              render: (row) => (
                <div className="productHsnCell">
                  <strong>{row.hsnCode || "—"}</strong>
                  {row.hsnCode && <span>{Number(row.gstRate || 0)}%</span>}
                </div>
              ),
            },
            {
              key: "barcode",
              label: "Barcode / GTIN",
              render: (row) => <MiniBarcode value={row.barcode} />,
            },
            {
              key: "pack",
              label: "Pack",
              render: (row) => {
                const basicCode = String(row.basicUnit || row.unit || "").toUpperCase();
                const packCode = String(row.packingUnit || "").toUpperCase();
                const basicUnit = unitByCode.get(basicCode);
                const packUnit = unitByCode.get(packCode);
                return <span className="masterInlineLinks">
                  {row.packingUnit && <>{row.qtyInBag || 1}{" "}</>}
                  <EditMasterLink to="/dms/units" id={basicUnit?._id} resource="unit">{basicUnit?.name || row.basicUnit || row.unit || "—"}</EditMasterLink>
                  {row.packingUnit && <> / <EditMasterLink to="/dms/units" id={packUnit?._id} resource="unit">{packUnit?.name || unitNameByCode.get(packCode) || row.packingUnit}</EditMasterLink></>}
                </span>;
              },
            },
            {
              key: "stock",
              label: "Stock",
              render: (row) =>
                `${Number(row.currentStock ?? row.openingStock ?? 0).toLocaleString("en-IN")} ${row.basicUnit || row.unit}`,
            },
            {
              key: "avg",
              label: "Avg Purchase",
              render: (row) => `₹${Number(row.averagePurchasePrice || 0).toFixed(2)}`,
            },
            {
              key: "landedCost",
              label: "Landed",
              render: (row) => `₹${Number(row.landedCost || 0).toFixed(2)}`,
            },
            {
              key: "mrp",
              label: "MRP",
              render: (row) => `₹${Number(row.mrp || 0).toFixed(2)}`,
            },
            ...(admin ? [{
              key: "profit",
              label: "Profit Health",
              render: (row) => (
                <StatusBadge
                  value={`${row.pricing?.color || "BLUE"} ${Number(
                    row.pricing?.profitPct || 0,
                  ).toFixed(1)}%`}
                />
              ),
            }] : []),
          ]}
          rows={rows}
        />

        <div className="paginationBar">
          <span>
            Page {meta.page || page} of {Math.max(1, meta.pages || 1)} • {meta.total || 0}{" "}
            records
          </span>
          <div>
            <button
              className="btn ghost"
              disabled={(meta.page || page) <= 1}
              onClick={() => {
                setSelected([]);
                load((meta.page || page) - 1);
              }}
            >
              <ChevronLeft size={15} />
              Previous
            </button>
            <button
              className="btn ghost"
              disabled={(meta.page || page) >= (meta.pages || 1)}
              onClick={() => {
                setSelected([]);
                load((meta.page || page) + 1);
              }}
            >
              Next
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
