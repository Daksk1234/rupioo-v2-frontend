import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api } from "../lib/api.js";
import EditMasterLink from "../components/EditMasterLink.jsx";
import { isAdminUser } from "../lib/adminVisibility.js";

const currentFY = () => {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
};

const profitBand = (value) => {
  const p = Number(value || 0);
  if (p >= 15) return "GREEN";
  if (p >= 10) return "ORANGE";
  if (p >= 5) return "BLUE";
  return "RED";
};

const profitTextColor = (value) => {
  const band = profitBand(value);
  if (band === "GREEN") return "#15803d";
  if (band === "ORANGE") return "#c2410c";
  if (band === "BLUE") return "#1d4ed8";
  return "#b91c1c";
};

export default function PriceListPage() {
  const admin = isAdminUser();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [maxDiscount, setMaxDiscount] = useState(0);
  const [fy, setFy] = useState(currentFY());
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });

  const load = async (next = 1) => {
    setLoading(true);
    setError("");
    try {
      const d = await api(
        `/catalog/old-dms-price-list/products?q=${encodeURIComponent(q)}&financialYear=${encodeURIComponent(fy)}&page=${next}&limit=100`,
      );
      setRows(d.items || []);
      setMaxDiscount(Number(d.maxDiscount || 0));
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
      { key: "hsnCode", label: "HSN" },
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
        key: "averageSaleRate",
        label: "Average Sale / Sale Rate",
        render: (r) => (
          <div>
            <strong>₹{Number(r.averageSaleRate || 0).toFixed(2)}</strong>
            <span className="tableSubText">
              {Number(r.saleObservations || 0)} sale line{Number(r.saleObservations || 0) === 1 ? "" : "s"}
            </span>
          </div>
        ),
      },
      ...(admin ? [{
        key: "profitPercentage",
        label: "Profit % (Auto)",
        render: (r) => (
          <strong style={{ color: profitTextColor(r.profitPercentage) }}>
            {Number(r.profitPercentage || 0).toFixed(2)}%
          </strong>
        ),
      }] : []),
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
    [maxDiscount, admin],
  );

  return (
    <>
      <PageHeader
        title="Price List"
        description={admin ? "Profit is calculated automatically from the simple average sale rate and simple average purchase rate of posted invoices." : "Current product pricing and invoice-average reference rates."}
        actions={false}
      />

      {error && <div className="resultBanner bad">{error}</div>}

      <section className="panel compactActionPanel">
        <div>
          <strong>{admin ? "Automatic Average Profit" : "Invoice Average Pricing"}</strong>
          <span>
            {admin ? "Average Sale = simple mean of posted sale invoice line rates. Average Purchase = simple mean of posted purchase invoice line rates. Profit % = (Average Sale − Average Purchase) ÷ Average Purchase × 100." : "Average sale and purchase reference rates are calculated from posted invoice lines. Profit and margin health are restricted to Admin users."}
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
              placeholder="Search product / SKU / HSN / category..."
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
