import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api } from "../lib/api.js";
import { currentFinancialYear } from "../lib/financialYear.js";
import EditMasterLink from "../components/EditMasterLink.jsx";
import { isAdminUser } from "../lib/adminVisibility.js";

const profitBand = (value) => {
  const p = Number(value || 0);
  if (p >= 15) return "GREEN";
  if (p >= 10) return "ORANGE";
  if (p >= 5) return "BLUE";
  return "RED";
};

export default function PriceListPage() {
  const admin = isAdminUser();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [maxDiscount, setMaxDiscount] = useState(0);
  const [grades, setGrades] = useState([]);
  const [fy, setFy] = useState(currentFinancialYear());
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });

  const load = async (next = 1) => {
    setLoading(true);
    setError("");
    try {
      const d = await api(
        `/catalog/old-dms-price-list/products?q=${encodeURIComponent(q)}&financialYear=${encodeURIComponent(fy)}&page=${next}&limit=100`,
      );
      const items = d.items || [];
      setRows(items);
      setMaxDiscount(Number(d.maxDiscount || 0));
      setGrades(Array.isArray(d.grades) ? d.grades : []);
      setMeta(d.meta || { page: next, pages: 1, total: (d.items || []).length });
      setPage(d.meta?.page || next);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy]);

  const columns = useMemo(
    () => [
      {
        key: "name",
        label: "Product Name",
        render: (r) => (
          <EditMasterLink to="/dms/products" id={r._id} resource="product">{r.name}</EditMasterLink>
        ),
      },
      { key: "sku", label: "SKU" },
      {
        key: "averagePurchaseRate",
        label: "Average Purchase",
        render: (r) => (
          <div>
            <strong>₹{Number(r.averagePurchaseRate || 0).toFixed(2)}</strong>
            <span className="tableSubText">
              {Number(r.purchaseObservations || 0)} purchase line{Number(r.purchaseObservations || 0) === 1 ? "" : "s"}
            </span>
          </div>
        ),
      },
      {
        key: "profitPercentage",
        label: "Profit %",
        render: (r) => (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number"
              value={Number(r.profitPercentage || 3).toFixed(2)}
              readOnly
              title="Auto calculated from Market Sale Price and Landed Price. Minimum 3%."
              style={{ width: 84, minWidth: 84, cursor: "default" }}
            />
            <span>%</span>
          </div>
        ),
      },
      {
        key: "minimumSalePrice",
        label: "Minimum Sale Price",
        render: (r) => (
          <div>
            <strong>₹{Number(r.minimumSalePrice || 0).toFixed(2)}</strong>
            <span className="tableSubText">
              Landed ₹{Number(r.landedPrice || 0).toFixed(2)} + {Number(r.profitPercentage || 3).toFixed(2)}%
            </span>
          </div>
        ),
      },
      {
        key: "marketSalePrice",
        label: "Market Sale Price",
        render: (r) => (
          <div>
            <strong>₹{Number(r.marketSalePrice || 0).toFixed(2)}</strong>
            <span className="tableSubText">
              {Number(r.saleObservations || 0)} sale line{Number(r.saleObservations || 0) === 1 ? "" : "s"}
            </span>
          </div>
        ),
      },
      {
        key: "maxGradeDiscountPct",
        label: "Highest Grade",
        render: () => `${Number(maxDiscount || 0)}%`,
      },
      { key: "gstRate", label: "GST", render: (r) => `${Number(r.gstRate || 0)}%` },
      {
        key: "mrp",
        label: "Calculated MRP",
        render: (r) => `₹${Number(r.mrp || 0).toFixed(2)}`,
      },
      {
        key: "mrpBasicExGst",
        label: "MRP Basic ex GST",
        render: (r) => `₹${Number(r.mrpBasicExGst || 0).toFixed(2)}`,
      },
      ...grades.map((grade) => ({
        key: `grade-${grade.code}`,
        label: `${grade.code} Basic (${Number(grade.discountPct || 0)}%)`,
        render: (r) => {
          const row = (r.gradePrices || []).find((x) => String(x.code) === String(grade.code));
          return (
            <div>
              <strong>₹{Number(row?.basicRate || 0).toFixed(2)}</strong>
              <span className="tableSubText">Incl GST ₹{Number(row?.saleIncludingGst || 0).toFixed(2)}</span>
            </div>
          );
        },
      })),
      ...(admin ? [{
        key: "profitColorCode",
        label: "Band",
        render: (r) => <StatusBadge value={profitBand(r.profitPercentage)} />,
      }] : []),
      {
        key: "pricingSource",
        label: "Source",
        render: (r) => (
          <span className="tableSubText">
            {r.saleObservations || r.purchaseObservations ? "Invoice averages" : "Product master fallback"}
          </span>
        ),
      },
    ],
    [maxDiscount, grades, admin],
  );

  return (
    <>
      <PageHeader
        title="Price List"
        description="Market Sale Price is the average selling rate from posted invoices. Profit % is auto calculated from Market Sale Price and Landed Price with a minimum of 3%. Minimum Sale Price is Landed Price plus that Profit %."
        actions={false}
      />

      {error && <div className="resultBanner bad">{error}</div>}

      <section className="panel compactActionPanel">
        <div>
          <strong>Automatic Profit Pricing</strong>
          <span>
            Market Sale Price is the simple average selling rate from posted Sales Invoice lines for the selected FY. Profit % = ((Market Sale Price - Landed Price) ÷ Landed Price) × 100 with a minimum of 3%. Minimum Sale Price = Landed Price + Profit %.
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="recordCount">Highest Grade: {Number(maxDiscount || 0)}%</span>
          <button className="btn ghost" onClick={() => load(page)} disabled={loading}>
            <RefreshCw /> Refresh Averages
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="toolbar">
          <div className="searchBox">
            <Search />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(1)}
              placeholder="Search product / SKU / category..."
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            FY
            <input
              style={{ width: 100 }}
              value={fy}
              onChange={(e) => setFy(e.target.value)}
              placeholder="2026-27"
            />
          </label>
          <button className="btn ghost" onClick={() => load(1)} disabled={loading}>
            <RefreshCw /> Refresh
          </button>
          <div className="recordCount">{meta.total || 0} products</div>
        </div>

        <DataTable rows={rows} columns={columns} />
        <div className="paginationBar">
          <span>
            Page {meta.page || page} of {Math.max(1, meta.pages || 1)}
          </span>
          <div>
            <button className="btn ghost" disabled={page <= 1} onClick={() => load(page - 1)}>
              Previous
            </button>
            <button
              className="btn ghost"
              disabled={page >= (meta.pages || 1)}
              onClick={() => load(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
