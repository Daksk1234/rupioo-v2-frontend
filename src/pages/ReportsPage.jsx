import React, { useEffect, useMemo, useRef, useState } from "react";
import { Printer, FileSpreadsheet, Search, Monitor } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import { api, apiBlob, getUser } from "../lib/api.js";
import {
  currentFinancialYear,
  financialYearOptions,
} from "../lib/financialYear.js";
import {
  currentMonthName,
  FY_MONTHS,
  monthBounds,
} from "../lib/periodFilters.js";
import { accessForPath } from "../lib/permissionAccess.js";

const esc = (v) => String(v ?? "").replaceAll('"', '""');
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v) =>
  n(v).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const qty = (v) =>
  n(v).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const isClosingStockReport = (name) =>
  /^(closing stock|closing stock report|closing stock report \(live\))$/i.test(
    String(name || "").trim(),
  );

function OldDmsClosingStockTable({ rows, fy, rowSearch }) {
  const [warehouse, setWarehouse] = useState("ALL");
  const [hideZero, setHideZero] = useState(false);
  const warehouses = useMemo(
    () =>
      [...new Set((rows || []).map((r) => r.warehouse || "UNASSIGNED"))].sort(),
    [rows],
  );
  useEffect(() => {
    setWarehouse("ALL");
    setHideZero(false);
  }, [fy]);
  const filtered = useMemo(() => {
    const term = String(rowSearch || "")
      .trim()
      .toLowerCase();
    return (rows || []).filter((r) => {
      if (
        warehouse !== "ALL" &&
        String(r.warehouse || "UNASSIGNED") !== warehouse
      )
        return false;
      if (hideZero && n(r.closingTotal) === 0) return false;
      if (!term) return true;
      return [
        r.financialYear,
        r.warehouse,
        r.product,
        r.hsn,
        r.openingSource,
      ].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(term),
      );
    });
  }, [rows, warehouse, hideZero, rowSearch]);
  const totals = useMemo(
    () =>
      filtered.reduce(
        (a, r) => {
          for (const k of [
            "openingQty",
            "openingRate",
            "openingTotal",
            "inwardQty",
            "inwardRate",
            "inwardTotal",
            "stockInOrderQty",
            "stockInOrderRate",
            "stockInOrderTotal",
            "outwardQty",
            "outwardRate",
            "outwardTotal",
            "closingQty",
            "closingRate",
            "closingTotal",
          ])
            a[k] += n(r[k]);
          return a;
        },
        Object.fromEntries(
          [
            "openingQty",
            "openingRate",
            "openingTotal",
            "inwardQty",
            "inwardRate",
            "inwardTotal",
            "stockInOrderQty",
            "stockInOrderRate",
            "stockInOrderTotal",
            "outwardQty",
            "outwardRate",
            "outwardTotal",
            "closingQty",
            "closingRate",
            "closingTotal",
          ].map((k) => [k, 0]),
        ),
      ),
    [filtered],
  );
  return (
    <>
      <div
        className="toolbar reportTools"
        style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}
      >
        <label>
          Warehouse{" "}
          <select
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={hideZero ? "primary" : ""}
          onClick={() => setHideZero(true)}
        >
          Hide Zero Closing Total
        </button>
        <button type="button" onClick={() => setHideZero(false)}>
          Show All
        </button>
        <strong>{filtered.length} records</strong>
      </div>
      <div
        style={{
          overflowX: "auto",
          border: "1px solid var(--border,#dbe2ea)",
          borderRadius: 12,
        }}
      >
        <table
          className="oldDmsClosingStockTable"
          style={{
            width: "100%",
            minWidth: 1750,
            borderCollapse: "collapse",
            fontSize: "10pt",
          }}
        >
          <thead>
            <tr>
              <th rowSpan="2">FY</th>
              <th rowSpan="2">WAREHOUSE</th>
              <th colSpan="2">PRODUCT DETAILS</th>
              <th colSpan="4">OPENING STOCK DETAILS</th>
              <th colSpan="3">INWARD STOCK DETAILS</th>
              <th colSpan="3">STOCK IN ORDER DETAILS</th>
              <th colSpan="3">OUTWARD STOCK DETAILS</th>
              <th colSpan="3">CLOSING STOCK DETAILS</th>
            </tr>
            <tr>
              <th>PRODUCT</th>
              <th>HSN</th>
              <th>QTY</th>
              <th>RATE</th>
              <th>TOTAL</th>
              <th>SOURCE</th>
              <th>QTY</th>
              <th>RATE</th>
              <th>TOTAL</th>
              <th>QTY</th>
              <th>RATE</th>
              <th>TOTAL</th>
              <th>QTY</th>
              <th>RATE</th>
              <th>TOTAL</th>
              <th>QTY</th>
              <th>RATE</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.warehouse}-${r.product}-${i}`}>
                <td>{r.financialYear || fy}</td>
                <td>{r.warehouse || ""}</td>
                <td>{r.product || ""}</td>
                <td>{r.hsn || ""}</td>
                <td>{qty(r.openingQty)}</td>
                <td>{money(r.openingRate)}</td>
                <td>{money(r.openingTotal)}</td>
                <td>{r.openingSource || ""}</td>
                <td>{qty(r.inwardQty)}</td>
                <td>{money(r.inwardRate)}</td>
                <td>{money(r.inwardTotal)}</td>
                <td>{qty(r.stockInOrderQty)}</td>
                <td>{money(r.stockInOrderRate)}</td>
                <td>{money(r.stockInOrderTotal)}</td>
                <td>{qty(r.outwardQty)}</td>
                <td>{money(r.outwardRate)}</td>
                <td>{money(r.outwardTotal)}</td>
                <td>{qty(r.closingQty)}</td>
                <td>{money(r.closingRate)}</td>
                <td>{money(r.closingTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{fy}</td>
              <td>GRAND TOTAL</td>
              <td></td>
              <td></td>
              <td>{qty(totals.openingQty)}</td>
              <td>{money(totals.openingRate)}</td>
              <td>{money(totals.openingTotal)}</td>
              <td></td>
              <td>{qty(totals.inwardQty)}</td>
              <td>{money(totals.inwardRate)}</td>
              <td>{money(totals.inwardTotal)}</td>
              <td>{qty(totals.stockInOrderQty)}</td>
              <td>{money(totals.stockInOrderRate)}</td>
              <td>{money(totals.stockInOrderTotal)}</td>
              <td>{qty(totals.outwardQty)}</td>
              <td>{money(totals.outwardRate)}</td>
              <td>{money(totals.outwardTotal)}</td>
              <td>{qty(totals.closingQty)}</td>
              <td>{money(totals.closingRate)}</td>
              <td>{money(totals.closingTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("ALL");
  const [rowSearch, setRowSearch] = useState("");
  const [hidden, setHidden] = useState([]);
  const access = accessForPath("/dms/reports");
  const [fy, setFy] = useState(currentFinancialYear());
  const [selectedMonth, setSelectedMonth] = useState(currentMonthName());
  const reportRequestRef = useRef(0);
  const years = financialYearOptions(getUser(), { count: 10, extra: [fy] });

  useEffect(() => {
    api("/reports/catalog")
      .then(setReports)
      .catch((e) => setMsg(e.message));
  }, []);
  const categories = [...new Set(reports.map((r) => r.category || "Other"))];
  const list = reports.filter(
    (r) =>
      r.name.toLowerCase().includes(q.toLowerCase()) &&
      (category === "ALL" || r.category === category),
  );

  const run = async (r) => {
    const requestId = ++reportRequestRef.current;
    setLoading(true);
    setMsg("");
    try {
      const { startDate, endDate } = monthBounds(fy, selectedMonth);
      const d = await api(
        `/reports/run?name=${encodeURIComponent(r.name)}&financialYear=${encodeURIComponent(fy)}&startDate=${startDate}&endDate=${endDate}`,
      );
      if (requestId !== reportRequestRef.current) return null;
      setSelected(r);
      setData(d);
      return d;
    } catch (e) {
      if (requestId === reportRequestRef.current) setMsg(e.message);
      return null;
    } finally {
      if (requestId === reportRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (selected) run(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy, selectedMonth]);

  const download = async (r) => {
    try {
      setMsg("");
      if (
        ["V2_NATIVE", "V2_LIVE", "V2_OLD_DMS_REFERENCE"].includes(
          r.implementation,
        )
      ) {
        const { startDate, endDate } = monthBounds(fy, selectedMonth);
        const url = `/reports/export.xlsx?name=${encodeURIComponent(r.name)}&financialYear=${encodeURIComponent(fy)}&startDate=${startDate}&endDate=${endDate}`;
        const { blob } = await apiBlob(url);
        const link = document.createElement("a"),
          href = URL.createObjectURL(blob);
        link.href = href;
        link.download = `${r.name.replace(/[^a-z0-9]+/gi, "_")}_${fy}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(href), 3000);
        return;
      }
      const d = await run(r);
      if (!d) return;
      const rows = d.rows || [],
        keys = [...new Set(rows.flatMap((x) => Object.keys(x)))];
      const safe = (v) =>
        typeof v === "string" && /^[\s]*[=+@\-]/.test(v) ? `'${v}` : v;
      const content = [
        keys.map((k) => `"${esc(k)}"`).join(","),
        ...rows.map((x) =>
          keys
            .map(
              (k) =>
                `"${esc(safe(x[k] instanceof Object ? JSON.stringify(x[k]) : x[k]))}"`,
            )
            .join(","),
        ),
      ].join("\n");
      const blob = new Blob(["\ufeff" + content], {
          type: "text/csv;charset=utf-8",
        }),
        href = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = href;
      a.download = `${r.name.replace(/[^a-z0-9]+/gi, "_")}_${fy}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };
  const print = async (r) => {
    const result = await run(r);
    if (result) requestAnimationFrame(() => window.print());
  };
  const allKeys = useMemo(
    () => [...new Set((data?.rows || []).flatMap((row) => Object.keys(row)))],
    [data],
  );
  useEffect(() => {
    if (!selected) return;
    try {
      const saved = JSON.parse(
        localStorage.getItem(`v2-report-cols:${selected.name}`) || "[]",
      );
      setHidden(Array.isArray(saved) ? saved : []);
    } catch {
      setHidden([]);
    }
  }, [selected?.name]);
  const toggleColumn = (key) =>
    setHidden((previous) => {
      const next = previous.includes(key)
        ? previous.filter((x) => x !== key)
        : [...previous, key];
      if (selected)
        localStorage.setItem(
          `v2-report-cols:${selected.name}`,
          JSON.stringify(next),
        );
      return next;
    });
  const cols = allKeys
    .filter((k) => !hidden.includes(k))
    .map((k) => ({
      key: k,
      label: k.replace(/([A-Z])/g, " $1").replaceAll("_", " "),
      render: (r) =>
        r[k] == null
          ? "—"
          : /date$/i.test(k) && !Number.isNaN(new Date(r[k]).getTime())
            ? new Date(r[k]).toLocaleDateString("en-IN")
            : r[k] instanceof Object
              ? JSON.stringify(r[k])
              : String(r[k]),
    }));
  const visibleRows = (data?.rows || []).filter(
    (row) =>
      !rowSearch.trim() ||
      Object.values(row).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(rowSearch.trim().toLowerCase()),
      ),
  );
  const closingStockSelected = isClosingStockReport(selected?.name);

  return (
    <>
      <style>{`
      .oldDmsClosingStockTable th,.oldDmsClosingStockTable td{border:1px solid #d9e1e8;padding:7px 8px;text-align:right;white-space:nowrap}
      .oldDmsClosingStockTable th{background:#f4f7f6;font-weight:800;text-transform:uppercase;text-align:center}
      .oldDmsClosingStockTable td:nth-child(2),.oldDmsClosingStockTable td:nth-child(3),.oldDmsClosingStockTable td:nth-child(4),.oldDmsClosingStockTable td:nth-child(8){text-align:left}
      .oldDmsClosingStockTable tfoot td{font-weight:800;background:#eef3f8}
      @media print { .reportGrid, .reportSearch, .reportTools, .toolbar:not(.reportPrintable .toolbar), .reportActions {display:none!important} .reportPrintable {margin:0!important;border:0!important;box-shadow:none!important} .oldDmsClosingStockTable{font-size:8pt!important;min-width:0!important} @page{size:landscape;margin:8mm} }
    `}</style>
      <PageHeader
        title="All Reports"
        description="Permission-aware reports for DMS, Accounts, GST, Targets, HR, Production, MASTER and audit."
        actions={false}
      />
      {msg && <div className="resultBanner bad">{msg}</div>}
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <label>
          Financial Year{" "}
          <select
            value={fy}
            onChange={(e) => {
              setFy(e.target.value);
              setData(null);
            }}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label>
          Month{" "}
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setData(null);
            }}
          >
            <option value="ALL">Full FY</option>
            {FY_MONTHS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="reportSearch">
        <Search />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reports..."
        />
        <select
          aria-label="Report category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="ALL">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <p style={{ fontSize: "10pt" }}>
        {list.filter((r) => r.implementation !== "UNSUPPORTED").length} working
        reports · {list.length} listed • Live reports read current V2 records.
        Unmapped legacy reports are disabled, not filled with unrelated data.
      </p>
      {loading && <p role="status">Loading report…</p>}
      {selected && data && (
        <section className="panel reportPrintable" style={{ marginTop: 16 }}>
          <div className="panelHead">
            <div>
              <h3>{selected.name}</h3>
              <p>
                Generated {new Date(data.generatedAt).toLocaleString("en-IN")}
              </p>
            </div>
          </div>
          {data.source && (
            <p style={{ fontSize: "10pt" }}>
              <strong>Data source:</strong> {data.source} ·{" "}
              {data.recordCount ?? data.rows?.length ?? 0} rows ·{" "}
              {data.startDate} to {data.endDate}
            </p>
          )}
          {data.note && (
            <p style={{ fontSize: "10pt" }}>
              <strong>Calculation note:</strong> {data.note}
            </p>
          )}
          {!data.rows?.length && (
            <div className="resultBanner" role="status">
              {data.emptyReason ||
                "No records found for this report and period."}{" "}
              {selectedMonth !== "ALL" && (
                <button type="button" onClick={() => setSelectedMonth("ALL")}>
                  View full FY
                </button>
              )}
            </div>
          )}
          {closingStockSelected ? (
            <>
              <div className="summaryCards">
                <div>
                  <strong>{qty(data.summary?.openingQty)}</strong>
                  <span>Opening Qty</span>
                </div>
                <div>
                  <strong>{qty(data.summary?.inwardQty)}</strong>
                  <span>Inward Qty</span>
                </div>
                <div>
                  <strong>{qty(data.summary?.stockInOrderQty)}</strong>
                  <span>Stock In Order</span>
                </div>
                <div>
                  <strong>{qty(data.summary?.outwardQty)}</strong>
                  <span>Outward Qty</span>
                </div>
                <div>
                  <strong>{qty(data.summary?.closingQty)}</strong>
                  <span>Closing Qty</span>
                </div>
                <div>
                  <strong>₹{money(data.summary?.closingTotal)}</strong>
                  <span>Closing Stock Value</span>
                </div>
              </div>
              <div
                className="toolbar reportTools"
                style={{ gap: 12, flexWrap: "wrap" }}
              >
                <label>
                  Search{" "}
                  <input
                    value={rowSearch}
                    onChange={(e) => setRowSearch(e.target.value)}
                    placeholder="Warehouse / product / HSN"
                  />
                </label>
              </div>
              <OldDmsClosingStockTable
                rows={data.rows || []}
                fy={fy}
                rowSearch={rowSearch}
              />
            </>
          ) : (
            <>
              <div className="summaryCards">
                {Object.entries(data.summary || {}).map(([k, v]) => (
                  <div key={k}>
                    <strong>
                      {typeof v === "number"
                        ? v.toLocaleString("en-IN")
                        : String(v)}
                    </strong>
                    <span>{k}</span>
                  </div>
                ))}
              </div>
              <div
                className="toolbar reportTools"
                style={{ gap: 12, flexWrap: "wrap" }}
              >
                <label>
                  Find a row{" "}
                  <input
                    value={rowSearch}
                    onChange={(e) => setRowSearch(e.target.value)}
                    placeholder="Search this report"
                  />
                </label>
                <details>
                  <summary>
                    Choose columns ({cols.length}/{allKeys.length})
                  </summary>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      padding: 12,
                      maxWidth: 700,
                    }}
                  >
                    {allKeys.map((k) => (
                      <label key={k}>
                        <input
                          type="checkbox"
                          checked={!hidden.includes(k)}
                          onChange={() => toggleColumn(k)}
                        />{" "}
                        {k.replace(/([A-Z])/g, " $1")}
                      </label>
                    ))}
                    <button
                      onClick={() => {
                        setHidden([]);
                        localStorage.removeItem(
                          `v2-report-cols:${selected.name}`,
                        );
                      }}
                    >
                      Show all
                    </button>
                  </div>
                </details>
                <span>
                  {visibleRows.length} of {data.rows?.length || 0} rows
                </span>
              </div>
              <DataTable
                rows={visibleRows}
                columns={
                  cols.length
                    ? cols
                    : [{ key: "empty", label: "Select a column" }]
                }
              />
            </>
          )}
        </section>
      )}
      <div className="reportGrid">
        {list.map((r) => (
          <article key={r.id}>
            <div>
              <span>
                {r.category || "Report"} · {r.id}
              </span>
              <h3>{r.name}</h3>
              <small>
                {r.implementation === "UNSUPPORTED"
                  ? "Source mapping unavailable — not a working report"
                  : "Live V2 data • old-DMS behaviour referenced • source-mapped"}
              </small>
            </div>
            <div className="reportActions">
              {access.view && r.implementation !== "UNSUPPORTED" && (
                <button onClick={() => run(r)}>
                  <Monitor />
                  View data
                </button>
              )}
              {access.download && r.implementation !== "UNSUPPORTED" && (
                <button onClick={() => download(r)}>
                  <FileSpreadsheet />
                  Excel
                </button>
              )}
              {access.print && r.implementation !== "UNSUPPORTED" && (
                <button onClick={() => print(r)}>
                  <Printer />
                  PDF/Print
                </button>
              )}
            </div>
            <footer>This page is generated by the Rupioo Global System.</footer>
          </article>
        ))}
      </div>
    </>
  );
}
