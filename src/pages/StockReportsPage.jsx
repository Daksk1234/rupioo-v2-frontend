import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getUser } from "../lib/api.js";
import { currentFinancialYear, financialYearOptions } from "../lib/financialYear.js";

const REPORT_TITLES = {
  ALL_IN_ONE: "ALL IN ONE STOCK",
  OPENING: "OPENING STOCK",
  INWARD: "INWARD STOCK",
  OUTWARD: "OUTWARD STOCK",
  CLOSING: "CLOSING STOCK",
  LOW_STOCK: "LOW STOCK",
  OVERDUE: "OVERDUE STOCK",
  DEAD_STOCK: "DEAD STOCK",
};

const ALERT_TYPES = new Set(["LOW_STOCK", "OVERDUE", "DEAD_STOCK"]);
const money = (value) => Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (value) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const dateText = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const BASE_COLUMNS = [
  ["warehouse", "WAREHOUSE"],
  ["productName", "PRODUCT NAME"],
  ["category", "CATEGORY"],
  ["subCategory", "SUBCATEGORY"],
  ["hsn", "HSN"],
];

const TYPE_COLUMNS = {
  OPENING: [
    ...BASE_COLUMNS,
    ["lastOpeningSaleQty", "LAST SALE QTY", "qty"],
    ["lastOpeningSaleRate", "LAST SALE RATE", "money"],
    ["openingRate", "OPENING RATE", "money"],
    ["openingQty", "OPENING QTY", "qty"],
    ["openingTotal", "OPENING TOTAL", "money"],
  ],
  INWARD: [
    ...BASE_COLUMNS,
    ["lastPurchaseQty", "LAST PURCHASE QTY", "qty"],
    ["lastPurchaseRate", "LAST PURCHASE RATE", "money"],
    ["inwardQty", "INWARD QTY", "qty"],
    ["inwardRate", "INWARD RATE", "money"],
    ["inwardTotal", "INWARD TOTAL", "money"],
  ],
  OUTWARD: [
    ...BASE_COLUMNS,
    ["lastSaleQty", "LAST SALE QTY", "qty"],
    ["lastSaleRate", "LAST SALE RATE", "money"],
    ["outwardQty", "OUTWARD QTY", "qty"],
    ["outwardRate", "OUTWARD RATE", "money"],
    ["outwardTotal", "OUTWARD TOTAL", "money"],
  ],
  CLOSING: [
    ...BASE_COLUMNS,
    ["lastSaleQty", "LAST SALE QTY", "qty"],
    ["lastSaleRate", "LAST SALE RATE", "money"],
    ["closingRate", "CLOSING RATE", "money"],
    ["closingQty", "CLOSING QTY", "qty"],
    ["closingTotal", "CLOSING TOTAL", "money"],
  ],
};

function valueOf(row, key, type) {
  if (type === "money") return money(row?.[key]);
  if (type === "qty") return qty(row?.[key]);
  return row?.[key] || "—";
}

function StockFilters({ reportType, filters, setFilters, meta }) {
  const user = getUser();
  const years = financialYearOptions(user, { count: 10, extra: [filters.financialYear, ...(meta.financialYears || [])] });
  const isAll = reportType === "ALL_IN_ONE";
  const isAlert = ALERT_TYPES.has(reportType);
  const products = meta.products || [];
  const subCategories = useMemo(() => {
    const values = products
      .filter((p) => !filters.category || p.category === filters.category)
      .map((p) => p.subCategory)
      .filter(Boolean);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }, [products, filters.category]);

  const update = (key, value) => setFilters((old) => ({
    ...old,
    [key]: value,
    ...(key === "category" ? { subCategory: "" } : {}),
  }));

  return <div className="stockFilters">
    {(!isAlert || reportType === "LOW_STOCK") && <label>FINANCIAL YEAR
      <select value={filters.financialYear} onChange={(e) => update("financialYear", e.target.value)}>
        {years.map((fy) => <option key={fy} value={fy}>{fy}</option>)}
      </select>
    </label>}

    {!isAll && <>
      <label>CATEGORY
        <select value={filters.category} onChange={(e) => update("category", e.target.value)}>
          <option value="">ALL CATEGORIES</option>
          {(meta.categories || []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label>SUBCATEGORY
        <select value={filters.subCategory} onChange={(e) => update("subCategory", e.target.value)}>
          <option value="">ALL SUBCATEGORIES</option>
          {subCategories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
    </>}

    <label>WAREHOUSE
      <select value={filters.warehouseId} onChange={(e) => update("warehouseId", e.target.value)}>
        <option value="">ALL WAREHOUSES</option>
        {(meta.warehouses || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>

    {(isAll || isAlert) && <label>PRODUCT NAME
      <select value={filters.productId} onChange={(e) => update("productId", e.target.value)}>
        <option value="">ALL PRODUCTS</option>
        {(meta.products || []).map((item) => <option key={item.id} value={item.id}>{item.name}{item.hsn ? ` • ${item.hsn}` : ""}</option>)}
      </select>
    </label>}

    {reportType === "LOW_STOCK" && <label>ALERT
      <select value={filters.alertStatus} onChange={(e) => update("alertStatus", e.target.value)}>
        <option value="">ALL ALERTS</option>
        <option value="LOW">LOW</option>
        <option value="NEAR LOW">NEAR LOW</option>
      </select>
    </label>}

    {["OVERDUE", "DEAD_STOCK"].includes(reportType) && <label>LAST MOVEMENT
      <select value={filters.movementType} onChange={(e) => update("movementType", e.target.value)}>
        <option value="">ALL</option>
        <option value="PURCHASE">PURCHASE</option>
        <option value="SALE">SALE</option>
        <option value="NEVER">NEVER MOVED</option>
      </select>
    </label>}
  </div>;
}

function StandardTable({ reportType, rows, totals }) {
  const columns = TYPE_COLUMNS[reportType] || TYPE_COLUMNS.OPENING;
  const totalKey = reportType === "OPENING"
    ? ["openingQty", "openingTotal"]
    : reportType === "INWARD"
      ? ["inwardQty", "inwardTotal"]
      : reportType === "OUTWARD"
        ? ["outwardQty", "outwardTotal"]
        : ["closingQty", "closingTotal"];

  return <div className="stockTableWrap">
    <table className="stockTable">
      <thead><tr>{columns.map(([key, label, type]) => <th key={key} className={type ? "num" : ""}>{label}</th>)}</tr></thead>
      <tbody>
        {rows.map((row) => <tr key={row.id}>
          {columns.map(([key, , type]) => <td key={key} className={type ? "num" : ""}>{valueOf(row, key, type)}</td>)}
        </tr>)}
        {rows.length ? <tr className="stockTotalRow">
          {columns.map(([key], index) => {
            if (index === 0) return <td key={key}><b>TOTAL</b></td>;
            if (key === totalKey[0]) return <td key={key} className="num"><b>{qty(totals?.[key])}</b></td>;
            if (key === totalKey[1]) return <td key={key} className="num"><b>{money(totals?.[key])}</b></td>;
            return <td key={key}></td>;
          })}
        </tr> : null}
      </tbody>
    </table>
  </div>;
}

function AllInOneTable({ rows, totals }) {
  return <div className="stockTableWrap">
    <table className="stockTable allInOneStockTable">
      <thead>
        <tr>
          <th colSpan={3}>PRODUCT INFORMATION</th><th colSpan={3} className="stockOpeningCell">OPENING</th><th colSpan={3} className="stockInwardCell">INWARD</th><th colSpan={3} className="stockPendingCell">PENDING</th><th colSpan={3} className="stockOutwardCell">OUTWARD</th><th colSpan={3} className="stockClosingCell">CLOSING</th>
        </tr>
        <tr>
          <th>WAREHOUSE</th><th>NAME</th><th>HSN</th>
          {["stockOpeningCell", "stockInwardCell", "stockPendingCell", "stockOutwardCell", "stockClosingCell"].flatMap((cellClass, index) => [<th key={`${index}-q`} className={`num ${cellClass}`}>QTY</th>, <th key={`${index}-r`} className={`num ${cellClass}`}>RATE</th>, <th key={`${index}-t`} className={`num ${cellClass}`}>TOTAL</th>])}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => <tr key={row.id}>
          <td>{row.warehouse || "—"}</td><td><b>{row.productName || "—"}</b></td><td>{row.hsn || "—"}</td>
          <td className="num stockOpeningCell">{qty(row.openingQty)}</td><td className="num stockOpeningCell">{money(row.openingRate)}</td><td className="num stockOpeningCell">{money(row.openingTotal)}</td>
          <td className="num stockInwardCell">{qty(row.inwardQty)}</td><td className="num stockInwardCell">{money(row.inwardRate)}</td><td className="num stockInwardCell">{money(row.inwardTotal)}</td>
          <td className="num stockPendingCell">{qty(row.pendingQty)}</td><td className="num stockPendingCell">{money(row.pendingRate)}</td><td className="num stockPendingCell">{money(row.pendingTotal)}</td>
          <td className="num stockOutwardCell">{qty(row.outwardQty)}</td><td className="num stockOutwardCell">{money(row.outwardRate)}</td><td className="num stockOutwardCell">{money(row.outwardTotal)}</td>
          <td className="num stockClosingCell">{qty(row.closingQty)}</td><td className="num stockClosingCell">{money(row.closingRate)}</td><td className="num stockClosingCell">{money(row.closingTotal)}</td>
        </tr>)}
        {rows.length ? <tr className="stockTotalRow">
          <td><b>TOTAL</b></td><td></td><td></td>
          <td className="num stockOpeningCell"><b>{qty(totals.openingQty)}</b></td><td className="stockOpeningCell"></td><td className="num stockOpeningCell"><b>{money(totals.openingTotal)}</b></td>
          <td className="num stockInwardCell"><b>{qty(totals.inwardQty)}</b></td><td className="stockInwardCell"></td><td className="num stockInwardCell"><b>{money(totals.inwardTotal)}</b></td>
          <td className="num stockPendingCell"><b>{qty(totals.pendingQty)}</b></td><td className="stockPendingCell"></td><td className="num stockPendingCell"><b>{money(totals.pendingTotal)}</b></td>
          <td className="num stockOutwardCell"><b>{qty(totals.outwardQty)}</b></td><td className="stockOutwardCell"></td><td className="num stockOutwardCell"><b>{money(totals.outwardTotal)}</b></td>
          <td className="num stockClosingCell"><b>{qty(totals.closingQty)}</b></td><td className="stockClosingCell"></td><td className="num stockClosingCell"><b>{money(totals.closingTotal)}</b></td>
        </tr> : null}
      </tbody>
    </table>
  </div>;
}

function LowStockTable({ rows, onOrderNow }) {
  return <div className="stockTableWrap">
    <table className="stockTable stockAlertTable">
      <thead><tr>
        <th>WAREHOUSE</th><th>PRODUCT NAME</th><th>HSN</th><th>LAST PURCHASE PARTY NAME</th><th className="num">LAST PURCHASE PARTY RATE</th><th className="num">LOW STOCK</th><th className="num">CURRENT STOCK</th><th>ORDER NOW</th>
      </tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id} className={row.lowStockStatus === "LOW" ? "stockDangerRow" : "stockWarnRow"}>
        <td>{row.warehouse || "—"}</td><td><b>{row.productName || "—"}</b></td><td>{row.hsn || "—"}</td><td>{row.lastPurchasePartyName || "—"}</td><td className="num">{money(row.lastPurchasePartyRate)}</td><td className="num"><b>{qty(row.lowStock)}</b></td><td className="num"><b>{qty(row.currentStock)}</b></td><td><button type="button" className="stockOrderBtn" onClick={() => onOrderNow(row)}>ORDER NOW</button></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function AgeingAlertTable({ reportType, rows, meta }) {
  const isDead = reportType === "DEAD_STOCK";
  const limit = isDead ? Number(meta.deadStockDays || 180) : Number(meta.stockOverdueDays || 60);
  return <div className="stockTableWrap">
    <table className="stockTable stockAgeTable">
      <thead><tr>
        <th>WAREHOUSE</th><th>PRODUCT NAME</th><th>CATEGORY</th><th>SUBCATEGORY</th><th>HSN</th><th className="num">CURRENT STOCK</th><th className="num">CURRENT RATE</th><th className="num">STOCK VALUE</th><th>LAST MOVEMENT</th><th>LAST PURCHASE</th><th>LAST SALE</th><th>LAST PURCHASE PARTY</th><th className="num">INACTIVE DAYS</th><th className="num">{isDead ? "DEAD STOCK DAYS" : "OVERDUE DAYS"}</th>
      </tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>
        <td>{row.warehouse || "—"}</td><td><b>{row.productName || "—"}</b></td><td>{row.category || "—"}</td><td>{row.subCategory || "—"}</td><td>{row.hsn || "—"}</td><td className="num"><b>{qty(row.currentStock)}</b></td><td className="num">{money(row.closingRate)}</td><td className="num">{money(row.closingTotal)}</td><td>{row.lastMovementType || "NEVER"}</td><td>{dateText(row.lastPurchaseDate)}</td><td>{dateText(row.lastSaleDate)}</td><td>{row.lastPurchasePartyName || "—"}</td><td className="num"><b>{Number(row.inactiveDays || 0)}</b></td><td className="num">{limit}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

export default function StockReportsPage({ reportType = "ALL_IN_ONE" }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    financialYear: currentFinancialYear(),
    category: "",
    subCategory: "",
    warehouseId: "",
    productId: "",
    alertStatus: "",
    movementType: "",
  });
  const [data, setData] = useState({ rows: [], totals: {}, meta: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isAlert = ALERT_TYPES.has(reportType);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ reportType, financialYear: filters.financialYear });
    if (reportType === "ALL_IN_ONE") {
      if (filters.warehouseId) params.set("warehouseId", filters.warehouseId);
      if (filters.productId) params.set("productId", filters.productId);
    } else {
      if (filters.category) params.set("category", filters.category);
      if (filters.subCategory) params.set("subCategory", filters.subCategory);
      if (filters.warehouseId) params.set("warehouseId", filters.warehouseId);
      if (isAlert && filters.productId) params.set("productId", filters.productId);
      if (reportType === "LOW_STOCK" && filters.alertStatus) params.set("alertStatus", filters.alertStatus);
      if (["OVERDUE", "DEAD_STOCK"].includes(reportType) && filters.movementType) params.set("movementType", filters.movementType);
    }
    setLoading(true);
    setError("");
    const endpoint = isAlert ? "/reports/stock-alerts" : "/reports/stock-analysis";
    api(`${endpoint}?${params.toString()}`)
      .then((result) => { if (active) setData(result || { rows: [], totals: {}, meta: {} }); })
      .catch((err) => { if (active) setError(err.message || "Unable to load stock report"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reportType, filters.financialYear, filters.category, filters.subCategory, filters.warehouseId, filters.productId, filters.alertStatus, filters.movementType, isAlert]);

  const orderNow = (row) => {
    const params = new URLSearchParams({ create: "1", financialYear: filters.financialYear, prefillProductId: String(row.id || "") });
    if (row.lastPurchasePartyGlobalId) params.set("prefillSupplierGlobalId", row.lastPurchasePartyGlobalId);
    if (Number(row.lastPurchasePartyRate || 0) > 0) params.set("prefillRate", String(Number(row.lastPurchasePartyRate)));
    navigate(`/dms/purchase-invoices?${params.toString()}`);
  };

  const rows = data.rows || [];
  const limitText = reportType === "OVERDUE"
    ? ` • ${Number(data.meta?.stockOverdueDays || 60)} DAY RULE`
    : reportType === "DEAD_STOCK"
      ? ` • ${Number(data.meta?.deadStockDays || 180)} DAY RULE`
      : "";

  return <>
    <style>{`
      .stockReportPage{display:flex;flex-direction:column;gap:9px;padding:9px;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:10px}
      .stockReportTitle{display:flex;align-items:center;justify-content:space-between;gap:8px}.stockReportTitle b{font-size:12px}.stockReportTitle span{font-size:9px;color:#64748b}
      .stockFilters{display:flex;align-items:end;gap:7px;flex-wrap:wrap;padding:7px;background:#f8fafc;border-radius:8px}.stockFilters label{display:flex;flex-direction:column;gap:4px;font-size:9px;font-weight:800;color:#64748b}.stockFilters select{height:33px;min-width:145px;border:1px solid var(--border,#dfe4ea);border-radius:7px;background:var(--surface,#fff);color:inherit;padding:0 8px;font:inherit;font-size:11px}
      .stockTableWrap{overflow:auto;border:1px solid var(--border,#e5e7eb);border-radius:8px;background:var(--surface,#fff)}.stockTable{width:100%;border-collapse:collapse;min-width:1100px;font-size:10px}.stockTable th{position:sticky;top:0;z-index:1;background:#f8fafc;padding:7px 6px;border-bottom:1px solid var(--border,#e5e7eb);text-align:left;white-space:nowrap;font-size:9px}.stockTable td{padding:7px 6px;border-top:1px solid #eef2f7;white-space:nowrap}.stockTable .num{text-align:right;font-variant-numeric:tabular-nums}.stockTotalRow td{font-weight:900;background:#f8fafc;border-top:2px solid #dbe3ed}.allInOneStockTable{min-width:1750px}.allInOneStockTable thead tr:first-child th{text-align:center;background:#eef2f7;border-right:1px solid #dbe3ed}.allInOneStockTable .stockOpeningCell{background:#dbeafe}.allInOneStockTable .stockInwardCell{background:#dcfce7}.allInOneStockTable .stockPendingCell{background:#fef9c3}.allInOneStockTable .stockOutwardCell{background:#fee2e2}.allInOneStockTable .stockClosingCell{background:#ffedd5}.allInOneStockTable tbody tr:hover .stockOpeningCell{background:#bfdbfe}.allInOneStockTable tbody tr:hover .stockInwardCell{background:#bbf7d0}.allInOneStockTable tbody tr:hover .stockPendingCell{background:#fef08a}.allInOneStockTable tbody tr:hover .stockOutwardCell{background:#fecaca}.allInOneStockTable tbody tr:hover .stockClosingCell{background:#fed7aa}.stockAlertTable{min-width:1080px}.stockAgeTable{min-width:1500px}.stockDangerRow td{background:#fff7f7}.stockWarnRow td{background:#fffdf3}.stockOrderBtn{border:0;border-radius:7px;padding:7px 10px;font:inherit;font-size:9px;font-weight:900;cursor:pointer;background:var(--primary,#1d4ed8);color:#fff}.stockMsg{padding:10px;border:1px solid #fed7aa;background:#fff7ed;border-radius:8px;font-size:10px}.stockEmpty{padding:32px;text-align:center;color:#64748b;font-size:10px}
      @media(max-width:760px){.stockFilters{flex-wrap:nowrap;overflow-x:auto}.stockFilters label{flex:0 0 auto}.stockReportPage{padding:7px}}
    `}</style>
    <div className="stockReportPage">
      <div className="stockReportTitle"><b>{REPORT_TITLES[reportType] || "STOCK REPORT"}{limitText}</b><span>{rows.length} PRODUCTS</span></div>
      <StockFilters reportType={reportType} filters={filters} setFilters={setFilters} meta={data.meta || {}} />
      {error ? <div className="stockMsg">{error}</div> : null}
      {loading ? <div className="stockEmpty">LOADING STOCK DATA...</div>
        : rows.length === 0 ? <div className="stockEmpty">NO PRODUCTS FOUND FOR SELECTED FILTERS</div>
          : reportType === "ALL_IN_ONE"
            ? <AllInOneTable rows={rows} totals={data.totals || {}} />
            : reportType === "LOW_STOCK"
              ? <LowStockTable rows={rows} onOrderNow={orderNow} />
              : ["OVERDUE", "DEAD_STOCK"].includes(reportType)
                ? <AgeingAlertTable reportType={reportType} rows={rows} meta={data.meta || {}} />
                : <StandardTable reportType={reportType} rows={rows} totals={data.totals || {}} />}
    </div>
  </>;
}
