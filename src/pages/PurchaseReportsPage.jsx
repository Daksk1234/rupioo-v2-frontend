import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, SlidersHorizontal } from "lucide-react";
import { api, apiBlob, getUser } from "../lib/api.js";
import { currentFinancialYear, financialYearOptions } from "../lib/financialYear.js";

const VIEW_OPTIONS = [
  ["YEARLY", "YEARLY"],
  ["HALF_YEARLY", "HALF YEARLY"],
  ["QUARTERLY", "QUARTERLY"],
  ["MONTHLY", "MONTHLY"],
  ["DATE_WISE", "DATE WISE"],
];

const MONTHS = [
  [4, "APRIL"], [5, "MAY"], [6, "JUNE"], [7, "JULY"], [8, "AUGUST"], [9, "SEPTEMBER"],
  [10, "OCTOBER"], [11, "NOVEMBER"], [12, "DECEMBER"], [1, "JANUARY"], [2, "FEBRUARY"], [3, "MARCH"],
];

const SUMMARY_COLUMNS = [
  { key: "date", label: "DATE", width: 105, render: (row) => formatDate(row.date) },
  { key: "number", label: "INVOICE NUMBER", width: 150, render: (row) => <b>{row.number || "—"}</b> },
  { key: "partyName", label: "PARTY NAME", width: 220 },
  { key: "district", label: "TERRITORY", width: 150 },
  { key: "userName", label: "PURCHASE USER", width: 170 },
  { key: "noOfProducts", label: "NO. OF PRODUCTS", number: true },
  { key: "cgst", label: "CGST", money: true },
  { key: "sgst", label: "SGST", money: true },
  { key: "igst", label: "IGST", money: true },
  { key: "basicAmount", label: "BASIC AMOUNT", money: true },
  { key: "taxableAmount", label: "TAXABLE AMOUNT", money: true },
  { key: "grandTotal", label: "GRAND TOTAL", money: true },
];

const PARTY_PRODUCT_COLUMNS = [
  { key: "date", label: "DATE", width: 105, render: (row) => formatDate(row.date) },
  { key: "number", label: "INVOICE NUMBER", width: 145, render: (row) => <b>{row.number || "—"}</b> },
  { key: "partyName", label: "PARTY NAME", width: 210 },
  { key: "district", label: "TERRITORY", width: 150 },
  { key: "userName", label: "PURCHASE USER", width: 170 },
  { key: "productName", label: "PRODUCT NAME", width: 220 },
  { key: "productHsn", label: "PRODUCT HSN", width: 110 },
  { key: "quantity", label: "QUANTITY", number: true },
  { key: "basicRate", label: "BASIC RATE", money: true },
  { key: "cgst", label: "CGST", money: true },
  { key: "sgst", label: "SGST", money: true },
  { key: "igst", label: "IGST", money: true },
  { key: "basicTotal", label: "BASIC TOTAL", money: true },
  { key: "discount", label: "DISCOUNT", money: true },
  { key: "charges", label: "CHARGES", money: true },
  { key: "taxableTotal", label: "TAXABLE TOTAL", money: true },
  { key: "roundOff", label: "ROUND OFF", money: true },
  { key: "grandTotal", label: "GRAND TOTAL", money: true },
];

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function groupRows(rows, key) {
  const map = new Map();
  for (const row of rows || []) {
    const value = row[key] || "UNASSIGNED";
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return [...map.entries()];
}

function hasSpecificDataFilter(filters = {}) {
  return [
    "partyType",
    "partyId",
    "productId",
    "taxType",
    "salespersonId",
    "userId",
    "district",
  ].some((key) => Boolean(filters[key]));
}

function canUseExpandableRows(filters = {}) {
  return filters.view === "YEARLY" && !hasSpecificDataFilter(filters);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function FilterBar({ state, setState, meta, showDistrict = false, showDownloads = false, onDownload, busy }) {
  const user = getUser();
  const years = financialYearOptions(user, { count: 10, extra: [state.financialYear] });
  const set = (key, value) => setState((old) => ({ ...old, [key]: value }));

  return <div className="srFilters">
    <label>FINANCIAL YEAR
      <select value={state.financialYear} onChange={(e) => set("financialYear", e.target.value)}>
        {years.map((fy) => <option key={fy}>{fy}</option>)}
      </select>
    </label>

    <label>VIEW
      <select value={state.view} onChange={(e) => {
        const nextView = e.target.value;
        const now = new Date();
        const startYear = Number(String(state.financialYear).slice(0, 4));
        const dateDefault = Number.isFinite(startYear) ? `${startYear}-04-01` : "";
        setState((old) => ({
          ...old,
          view: nextView,
          period: nextView === "HALF_YEARLY"
            ? "H1"
            : nextView === "QUARTERLY"
              ? "Q1"
              : nextView === "MONTHLY"
                ? String(now.getMonth() + 1)
                : "",
          ...(nextView === "DATE_WISE" ? { dateFrom: old.dateFrom || dateDefault, dateTo: old.dateTo || dateDefault } : {}),
        }));
      }}>
        {VIEW_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>

    {state.view === "HALF_YEARLY" ? <label>HALF
      <select value={state.period || "H1"} onChange={(e) => set("period", e.target.value)}>
        <option value="H1">APR - SEP</option><option value="H2">OCT - MAR</option>
      </select>
    </label> : null}

    {state.view === "QUARTERLY" ? <label>QUARTER
      <select value={state.period || "Q1"} onChange={(e) => set("period", e.target.value)}>
        <option value="Q1">Q1 APR-JUN</option><option value="Q2">Q2 JUL-SEP</option><option value="Q3">Q3 OCT-DEC</option><option value="Q4">Q4 JAN-MAR</option>
      </select>
    </label> : null}

    {state.view === "MONTHLY" ? <label>MONTH
      <select value={state.period} onChange={(e) => set("period", e.target.value)}>
        {MONTHS.map(([value, label]) => <option key={value} value={String(value)}>{label}</option>)}
      </select>
    </label> : null}

    {state.view === "DATE_WISE" ? <>
      <label>FROM<input type="date" value={state.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} /></label>
      <label>TO<input type="date" value={state.dateTo} onChange={(e) => set("dateTo", e.target.value)} /></label>
    </> : null}

    <label>PARTY TYPE
      <select value={state.partyType} onChange={(e) => set("partyType", e.target.value)}>
        <option value="">ALL PARTY TYPES</option>
        <option value="REGULAR">REGULAR</option>
        <option value="UNREGISTER">UNREGISTER</option>
      </select>
    </label>

    <label>PARTY
      <select value={state.partyId || ""} onChange={(e) => set("partyId", e.target.value)}>
        <option value="">ALL PARTIES</option>
        {(meta.parties || []).map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
      </select>
    </label>

    <label>PRODUCT
      <select value={state.productId || ""} onChange={(e) => set("productId", e.target.value)}>
        <option value="">ALL PRODUCTS</option>
        {(meta.products || []).map((product) => <option key={product.id} value={product.id}>{product.name}{product.hsn ? ` • ${product.hsn}` : ""}</option>)}
      </select>
    </label>

    <label>TAX TYPE
      <select value={state.taxType || ""} onChange={(e) => set("taxType", e.target.value)}>
        <option value="">ALL TAX TYPES</option>
        <option value="IGST">IGST</option>
        <option value="CGST_SGST">CGST + SGST</option>
      </select>
    </label>

    {showDistrict ? <label>TERRITORY
      <select value={state.district} onChange={(e) => set("district", e.target.value)}>
        <option value="">ALL DISTRICTS</option>
        {(meta.districts || []).map((district) => <option key={district} value={district}>{district}</option>)}
      </select>
    </label> : null}

    <label>PURCHASE USER
      <select value={state.userId} onChange={(e) => set("userId", e.target.value)}>
        <option value="">ALL USERS</option>
        {(meta.users || []).map((person) => <option key={person.id || "UNASSIGNED"} value={person.id}>{person.name}</option>)}
      </select>
    </label>

    {showDownloads ? <div className="srDownloadButtons">
      <button type="button" disabled={busy} onClick={() => onDownload("xlsx")}><Download size={15}/>EXCEL</button>
      <button type="button" disabled={busy} onClick={() => onDownload("pdf")}><Download size={15}/>PDF</button>
    </div> : null}
  </div>;
}

function ColumnFilter({ columns, visible, setVisible }) {
  return <details className="srColumnFilter">
    <summary><SlidersHorizontal size={15}/>COLUMNS</summary>
    <div className="srColumnMenu">
      {columns.map((col) => <label key={col.key}>
        <input
          type="checkbox"
          checked={visible.includes(col.key)}
          onChange={() => setVisible((old) => old.includes(col.key) ? old.filter((x) => x !== col.key) : [...old, col.key])}
        />
        {col.label}
      </label>)}
    </div>
  </details>;
}

function SummaryTotals(rows = []) {
  const productKeys = new Set();
  const sum = rows.reduce((acc, row) => {
    (row.productKeys || []).forEach((key) => productKeys.add(key));
    acc.noOfPackages += Number(row.noOfPackages || 0);
    acc.cgst += Number(row.cgst || 0);
    acc.sgst += Number(row.sgst || 0);
    acc.igst += Number(row.igst || 0);
    acc.basicAmount += Number(row.basicAmount || 0);
    acc.taxableAmount += Number(row.taxableAmount || 0);
    acc.grandTotal += Number(row.grandTotal || 0);
    return acc;
  }, { noOfProducts: 0, noOfPackages: 0, cgst: 0, sgst: 0, igst: 0, basicAmount: 0, taxableAmount: 0, grandTotal: 0 });
  sum.noOfProducts = productKeys.size || rows.reduce((n, row) => n + Number(row.noOfProducts || 0), 0);
  return sum;
}

function ProductTotals(rows = []) {
  return rows.reduce((acc, row) => {
    ["quantity", "cgst", "sgst", "igst", "basicTotal", "discount", "charges", "taxableTotal", "roundOff", "grandTotal"].forEach((key) => {
      acc[key] += Number(row[key] || 0);
    });
    return acc;
  }, { quantity: 0, cgst: 0, sgst: 0, igst: 0, basicTotal: 0, discount: 0, charges: 0, taxableTotal: 0, roundOff: 0, grandTotal: 0 });
}

function DataRows({ rows, columns, visibleColumns }) {
  const cols = columns.filter((col) => !visibleColumns || visibleColumns.includes(col.key));
  return <>{rows.map((row, rowIndex) => <tr key={row.id || row.partyId || `${row.number || "ROW"}-${rowIndex}`}>
    {cols.map((col) => <td key={col.key} className={col.money || col.number ? "num" : ""} style={col.width ? { minWidth: col.width } : undefined}>
      {col.render ? col.render(row) : col.money ? money(row[col.key]) : row[col.key] ?? "—"}
    </td>)}
  </tr>)}</>;
}

function TotalRow({ rows, columns, visibleColumns, label = "TOTAL", kind = "SUMMARY" }) {
  const sum = kind === "SUMMARY" ? SummaryTotals(rows) : ProductTotals(rows);
  const cols = columns.filter((col) => !visibleColumns || visibleColumns.includes(col.key));
  const numericKeys = kind === "SUMMARY"
    ? ["noOfProducts", "noOfPackages", "cgst", "sgst", "igst", "basicAmount", "taxableAmount", "grandTotal"]
    : ["quantity", "cgst", "sgst", "igst", "basicTotal", "discount", "charges", "taxableTotal", "roundOff", "grandTotal"];
  return <tr className="srTotalRow">{cols.map((col, index) => {
    let value = "";
    if (index === 0) value = label;
    else if (numericKeys.includes(col.key)) value = col.money ? money(sum[col.key]) : Number(sum[col.key] || 0).toLocaleString("en-IN");
    return <td key={col.key} className={col.money || col.number ? "num" : ""}>{value}</td>;
  })}</tr>;
}

function CrossCheckRow({ totals = {}, columns, visibleColumns, kind = "SUMMARY", label = "CROSS CHECK" }) {
  const cols = columns.filter((col) => !visibleColumns || visibleColumns.includes(col.key));
  const values = kind === "SUMMARY"
    ? {
        noOfProducts: totals.products ?? totals.noOfProducts,
        noOfPackages: totals.packages ?? totals.noOfPackages,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        basicAmount: totals.basicAmount,
        taxableAmount: totals.taxableAmount,
        grandTotal: totals.grandTotal,
      }
    : {
        quantity: totals.quantity,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        basicTotal: totals.basicTotal,
        discount: totals.discount,
        charges: totals.charges,
        taxableTotal: totals.taxableTotal,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
      };
  const numericKeys = Object.keys(values);
  return <tr className="srCrossCheckRow">{cols.map((col, index) => {
    let value = "";
    if (index === 0) value = label;
    else if (numericKeys.includes(col.key) && values[col.key] !== undefined) {
      value = col.money ? money(values[col.key]) : Number(values[col.key] || 0).toLocaleString("en-IN");
    }
    return <td key={col.key} className={col.money || col.number ? "num" : ""}>{value}</td>;
  })}</tr>;
}

function GroupTableRow({ open, onClick, label, count, total, colSpan, level = "territory" }) {
  return <tr className={`srInlineGroup ${level}`}>
    <td colSpan={colSpan}>
      <button type="button" onClick={onClick}>
        {open ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
        <b>{label}</b>
        <span>{Number(count || 0).toLocaleString("en-IN")} {level === "month" ? "ROWS" : "INVOICES"}</span>
        <strong>₹{money(total)}</strong>
      </button>
    </td>
  </tr>;
}

function UnifiedSummaryTable({ rows, visibleColumns, filters, monthlyExpandable, crossCheckTotals, crossCheckLabel }) {
  const cols = SUMMARY_COLUMNS.filter((col) => visibleColumns.includes(col.key));
  const useTerritoryGroups = canUseExpandableRows(filters);
  const territoryGroups = useTerritoryGroups ? groupRows(rows, "district") : [];
  const useMonthGroups = useTerritoryGroups && monthlyExpandable;
  const [openTerritories, setOpenTerritories] = useState(new Set());
  const [openMonths, setOpenMonths] = useState(new Set());

  useEffect(() => {
    const first = territoryGroups[0];
    if (!useTerritoryGroups || !first) {
      setOpenTerritories(new Set());
      setOpenMonths(new Set());
      return;
    }
    setOpenTerritories(new Set([first[0]]));
    if (useMonthGroups) {
      const firstMonth = groupRows(first[1], "monthKey")[0];
      setOpenMonths(firstMonth ? new Set([`${first[0]}::${firstMonth[0]}`]) : new Set());
    } else {
      setOpenMonths(new Set());
    }
  }, [rows, useTerritoryGroups, useMonthGroups]);

  const toggle = (setter, key) => setter((old) => {
    const next = new Set(old);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  return <div className="srTableWrap">
    <table className="srTable">
      <thead><tr>{cols.map((col) => <th key={col.key}>{col.label}</th>)}</tr></thead>
      <tbody>
        {useTerritoryGroups ? territoryGroups.map(([territory, territoryRows]) => {
          const territoryOpen = openTerritories.has(territory);
          const territoryTotal = SummaryTotals(territoryRows).grandTotal;
          const monthGroups = useMonthGroups ? groupRows(territoryRows, "monthKey") : [];
          return <React.Fragment key={territory}>
            <GroupTableRow open={territoryOpen} onClick={() => toggle(setOpenTerritories, territory)} label={`TERRITORY: ${territory}`} count={territoryRows.length} total={territoryTotal} colSpan={cols.length}/>
            {territoryOpen && useMonthGroups ? monthGroups.map(([monthKey, monthRows]) => {
              const monthId = `${territory}::${monthKey}`;
              const monthOpen = openMonths.has(monthId);
              return <React.Fragment key={monthId}>
                <GroupTableRow open={monthOpen} onClick={() => toggle(setOpenMonths, monthId)} label={monthRows[0]?.monthLabel || monthKey} count={monthRows.length} total={SummaryTotals(monthRows).grandTotal} colSpan={cols.length} level="month"/>
                {monthOpen ? <DataRows rows={monthRows} columns={SUMMARY_COLUMNS} visibleColumns={visibleColumns}/> : null}
              </React.Fragment>;
            }) : null}
            {territoryOpen && !useMonthGroups ? <DataRows rows={territoryRows} columns={SUMMARY_COLUMNS} visibleColumns={visibleColumns}/> : null}
          </React.Fragment>;
        }) : <DataRows rows={rows} columns={SUMMARY_COLUMNS} visibleColumns={visibleColumns}/>}
      </tbody>
      <tfoot>
        <TotalRow rows={rows} columns={SUMMARY_COLUMNS} visibleColumns={visibleColumns} label="FILTERED TOTAL" kind="SUMMARY"/>
        <CrossCheckRow totals={crossCheckTotals || {}} columns={SUMMARY_COLUMNS} visibleColumns={visibleColumns} kind="SUMMARY" label={crossCheckLabel}/>
      </tfoot>
    </table>
  </div>;
}

function UnifiedProductTable({ rows, visibleColumns, filters, monthlyExpandable, crossCheckTotals, crossCheckLabel }) {
  const cols = PARTY_PRODUCT_COLUMNS.filter((col) => visibleColumns.includes(col.key));
  const useMonthGroups = monthlyExpandable && canUseExpandableRows(filters);
  const monthGroups = useMonthGroups ? groupRows(rows, "monthKey") : [];
  const [openMonths, setOpenMonths] = useState(new Set());

  useEffect(() => {
    const first = monthGroups[0];
    setOpenMonths(first ? new Set([first[0]]) : new Set());
  }, [rows, useMonthGroups]);

  const toggleMonth = (key) => setOpenMonths((old) => {
    const next = new Set(old);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  return <div className="srTableWrap">
    <table className="srTable wide">
      <thead><tr>{cols.map((col) => <th key={col.key}>{col.label}</th>)}</tr></thead>
      <tbody>
        {useMonthGroups ? monthGroups.map(([monthKey, monthRows]) => {
          const open = openMonths.has(monthKey);
          return <React.Fragment key={monthKey}>
            <GroupTableRow open={open} onClick={() => toggleMonth(monthKey)} label={monthRows[0]?.monthLabel || monthKey} count={monthRows.length} total={ProductTotals(monthRows).grandTotal} colSpan={cols.length} level="month"/>
            {open ? <DataRows rows={monthRows} columns={PARTY_PRODUCT_COLUMNS} visibleColumns={visibleColumns}/> : null}
          </React.Fragment>;
        }) : <DataRows rows={rows} columns={PARTY_PRODUCT_COLUMNS} visibleColumns={visibleColumns}/>}
      </tbody>
      <tfoot>
        <TotalRow rows={rows} columns={PARTY_PRODUCT_COLUMNS} visibleColumns={visibleColumns} label="FILTERED TOTAL" kind="PRODUCT"/>
        <CrossCheckRow totals={crossCheckTotals || {}} columns={PARTY_PRODUCT_COLUMNS} visibleColumns={visibleColumns} kind="PRODUCT" label={crossCheckLabel}/>
      </tfoot>
    </table>
  </div>;
}

function useReportData(endpoint, filters) {
  const [data, setData] = useState({ rows: [], users: [], districts: [], totals: {} });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params.toString();
  }, [filters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage("");
    api(`${endpoint}?${query}`)
      .then((result) => { if (active) setData(result || { rows: [] }); })
      .catch((error) => { if (active) setMessage(error.message || "Unable to load purchase report"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint, query]);

  return { data, loading, message, setMessage, query };
}

function defaultFilters(withDistrict = false) {
  const now = new Date();
  return {
    financialYear: currentFinancialYear(now),
    view: "MONTHLY",
    period: String(now.getMonth() + 1),
    dateFrom: "",
    dateTo: "",
    partyType: "",
    partyId: "",
    productId: "",
    taxType: "",
    userId: "",
    ...(withDistrict ? { district: "" } : {}),
  };
}

function PurchaseSummary({ monthlyExpandable }) {
  const [filters, setFilters] = useState(() => defaultFilters(true));
  const { data, loading, message, setMessage, query } = useReportData("/reports/purchase-analysis", filters);
  const [visibleColumns, setVisibleColumns] = useState(SUMMARY_COLUMNS.map((col) => col.key));
  const rows = data.rows || [];

  const download = async (kind) => {
    try {
      setMessage("");
      const result = await apiBlob(`/reports/purchase-analysis.${kind}?${query}`);
      downloadBlob(result.blob, `Purchase_Summary_${filters.financialYear}.${kind}`);
    } catch (error) {
      setMessage(error.message || `Unable to download ${kind.toUpperCase()}`);
    }
  };

  return <div className="salesReport">
    <FilterBar state={filters} setState={setFilters} meta={data} showDistrict showDownloads onDownload={download} busy={loading}/>
    <div className="srTopline">
      <div className="srCount">{loading ? "LOADING..." : `${rows.length.toLocaleString("en-IN")} INVOICES`}</div>
      <ColumnFilter columns={SUMMARY_COLUMNS} visible={visibleColumns} setVisible={setVisibleColumns}/>
    </div>
    {message ? <div className="srMessage">{message}</div> : null}
    {loading ? <div className="srLoading">LOADING PURCHASE SUMMARY...</div> : !rows.length ? <div className="srEmpty">NO PURCHASE INVOICES FOUND FOR THE SELECTED FILTERS.</div> :
      <UnifiedSummaryTable rows={rows} visibleColumns={visibleColumns} filters={filters} monthlyExpandable={monthlyExpandable} crossCheckTotals={data.crossCheckTotals} crossCheckLabel="CROSS CHECK - PURCHASE INVOICE"/>
    }
  </div>;
}

function PartyProductWise({ monthlyExpandable }) {
  const [filters, setFilters] = useState(() => defaultFilters(false));
  const { data, loading, message } = useReportData("/reports/purchase-party-product", filters);
  const [visibleColumns, setVisibleColumns] = useState(PARTY_PRODUCT_COLUMNS.map((col) => col.key));
  const rows = data.rows || [];

  return <div className="salesReport">
    <FilterBar state={filters} setState={setFilters} meta={data}/>
    <div className="srTopline">
      <div className="srCount">{loading ? "LOADING..." : `${rows.length.toLocaleString("en-IN")} PRODUCT ROWS`}</div>
      <ColumnFilter columns={PARTY_PRODUCT_COLUMNS} visible={visibleColumns} setVisible={setVisibleColumns}/>
    </div>
    {message ? <div className="srMessage">{message}</div> : null}
    {loading ? <div className="srLoading">LOADING PARTY AND PRODUCT WISE PURCHASES...</div> : !rows.length ? <div className="srEmpty">NO PURCHASE INVOICE PRODUCT ROWS FOUND FOR THE SELECTED FILTERS.</div> :
      <UnifiedProductTable rows={rows} visibleColumns={visibleColumns} filters={filters} monthlyExpandable={monthlyExpandable} crossCheckTotals={data.crossCheckTotals} crossCheckLabel="CROSS CHECK - PURCHASE INVOICE"/>
    }
  </div>;
}


export default function PurchaseReportsPage({ reportType = "SUMMARY", monthlyExpandable = true }) {
  return <>
    <style>{`
      .salesReport{display:flex;flex-direction:column;gap:8px;padding:10px;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:11px}
      .srFilters{display:flex;align-items:end;gap:6px;flex-wrap:wrap;padding:7px;background:#f8fafc;border:0;border-radius:8px}
      .srFilters label{display:flex;flex-direction:column;gap:4px;font-size:9px;font-weight:800;color:var(--muted,#64748b)}
      .srFilters select,.srFilters input{height:33px;min-width:120px;border:1px solid var(--border,#dfe4ea);border-radius:7px;background:var(--surface,#fff);color:inherit;padding:0 8px;font:inherit;font-size:11px}
      .srDownloadButtons{display:flex;gap:6px;margin-left:auto}.srDownloadButtons button,.srColumnFilter summary{height:33px;display:flex;align-items:center;gap:5px;border:1px solid var(--border,#dfe4ea);border-radius:7px;background:var(--surface,#fff);color:inherit;padding:0 10px;font:inherit;font-size:10px;font-weight:800;cursor:pointer}
      .srTopline{display:flex;justify-content:space-between;align-items:center;gap:10px}.srCount{font-size:10px;color:var(--muted,#64748b)}
      .srColumnFilter{position:relative}.srColumnFilter summary{list-style:none}.srColumnMenu{position:absolute;right:0;top:38px;z-index:20;width:220px;padding:8px;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:9px;box-shadow:0 12px 30px #0002;display:grid;gap:4px}.srColumnMenu label{display:flex;align-items:center;gap:7px;font-size:10px;padding:4px}
      .srTableWrap{overflow:auto;border:1px solid var(--border,#e5e7eb);border-radius:8px;background:var(--surface,#fff)}.srTable{width:100%;border-collapse:collapse;min-width:1120px;font-size:10px}.srTable.wide{min-width:1950px}.srTable th{position:sticky;top:0;background:#f8fafc;padding:7px 6px;text-align:left;font-size:9px;white-space:nowrap;border-bottom:1px solid var(--border,#e5e7eb)}.srTable td{padding:7px 6px;border-top:1px solid #eef2f7;vertical-align:top}.srTable .num{text-align:right;font-variant-numeric:tabular-nums}.srTotalRow td{font-weight:900;background:#f8fafc;border-top:2px solid #dbe3ed}.srCrossCheckRow td{font-weight:900;background:#eefbf3;border-top:1px solid #bbf7d0}
      .srGroups,.srNestedGroups{display:grid;gap:7px}.srNestedGroups{padding:0 0 0 14px}.srGroup{display:grid;gap:6px}.srGroupHead{width:100%;display:grid;grid-template-columns:22px minmax(180px,1fr) auto auto;gap:10px;align-items:center;text-align:left;border:1px solid var(--border,#e5e7eb);background:var(--surface,#fff);color:inherit;border-radius:9px;padding:9px 11px;cursor:pointer;font:inherit}.srGroupHead.district{background:#f8fafc}.srGroupHead.month{padding:7px 10px}.srGroupHead span{font-size:9px;color:#64748b}.srGroupHead strong{font-size:11px}.srMessage{padding:9px 11px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;font-size:10px}.srEmpty{padding:35px;text-align:center;border:1px solid var(--border,#e5e7eb);border-radius:10px;background:var(--surface,#fff);color:#64748b}.srLoading{padding:20px;text-align:center;font-size:10px;color:#64748b}.srOverallTotal{display:grid;gap:5px;margin-top:2px}.srOverallTitle{font-size:10px;font-weight:900;color:#475569}.compactTotal{min-width:1120px}
      .srInlineGroup td{padding:0!important;background:#f8fafc;border-top:1px solid #e2e8f0!important}.srInlineGroup.month td{background:#fbfdff}.srInlineGroup button{width:100%;display:flex;align-items:center;gap:7px;border:0;background:transparent;color:inherit;padding:7px 8px;cursor:pointer;text-align:left;font:inherit}.srInlineGroup button b{font-size:10px}.srInlineGroup button span{margin-left:auto;font-size:9px;color:#64748b}.srInlineGroup button strong{font-size:10px;min-width:95px;text-align:right}.srInlineGroup.month button{padding-left:22px}
      @media(max-width:760px){.srFilters{flex-wrap:nowrap;overflow-x:auto;align-items:end}.srFilters label{flex:0 0 auto}.srDownloadButtons{margin-left:0;flex:0 0 auto}.srTopline{align-items:flex-start}.srGroupHead{grid-template-columns:20px minmax(130px,1fr) auto}.srGroupHead span{display:none}.srNestedGroups{padding-left:8px}}
    `}</style>
    {reportType === "PARTY_PRODUCT" ? <PartyProductWise monthlyExpandable={monthlyExpandable}/> : <PurchaseSummary monthlyExpandable={monthlyExpandable}/>} 
  </>;
}
