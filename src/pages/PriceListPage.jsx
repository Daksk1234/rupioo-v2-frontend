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

const saleRateIncludingProfit = (saleRate, profitPercentage) => {
  const rate = Number(saleRate || 0);
  const profit = Math.max(3, Number(profitPercentage || 3));
  return rate > 0 ? rate + (rate * profit / 100) : 0;
};


export default function PriceListPage() {
  const admin = isAdminUser();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [maxDiscount, setMaxDiscount] = useState(0);
  const [fy, setFy] = useState(currentFinancialYear());
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [profitDrafts, setProfitDrafts] = useState({});
  const [savingProfitId, setSavingProfitId] = useState("");

  const load = async (next = 1) => {
    setLoading(true);
    setError("");
    try {
      const d = await api(
        `/catalog/old-dms-price-list/products?q=${encodeURIComponent(q)}&financialYear=${encodeURIComponent(fy)}&page=${next}&limit=100`,
      );
      const items = d.items || [];
      setRows(items);
      setProfitDrafts(Object.fromEntries(items.map((row) => [String(row._id), String(Math.max(3, Number(row.profitPercentage || 3)))])));
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

  const saveProfitPercentage = async (row) => {
    const id = String(row?._id || "");
    if (!id) return;
    const raw = Number(profitDrafts[id]);
    const profitPercentage = Number.isFinite(raw) ? Math.max(3, raw) : 3;
    setProfitDrafts((prev) => ({ ...prev, [id]: String(profitPercentage) }));
    if (Math.abs(profitPercentage - Math.max(3, Number(row.profitPercentage || 3))) < 0.0001) return;
    setSavingProfitId(id);
    setError("");
    try {
      await api("/catalog/old-dms-price-list/products", {
        method: "PUT",
        body: JSON.stringify({
          financialYear: fy,
          Products: [{
            id,
            profitPercentage,
            changedField: "profitPercentage",
          }],
        }),
      });
      await load(page);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingProfitId("");
    }
  };

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
        render: (r) => {
          const id = String(r._id);
          const saving = savingProfitId === id;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                min="3"
                step="0.01"
                value={profitDrafts[id] ?? "3"}
                disabled={saving}
                onChange={(e) => setProfitDrafts((prev) => ({ ...prev, [id]: e.target.value }))}
                onBlur={() => saveProfitPercentage(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                title="Minimum profit is 3%"
                style={{ width: 84, minWidth: 84 }}
              />
              <span>%</span>
              {saving && <span className="tableSubText">Saving…</span>}
            </div>
          );
        },
      },
      {
        key: "saleRateIncludingProfit",
        label: "Sales Rate Including Profit %",
        render: (r) => {
          const id = String(r._id);
          const profit = Math.max(3, Number(profitDrafts[id] ?? r.profitPercentage ?? 3));
          const baseSaleRate = Number(r.averageSaleRate || r.salePrice || 0);
          const calculated = saleRateIncludingProfit(baseSaleRate, profit);
          return (
            <div>
              <strong>₹{calculated.toFixed(2)}</strong>
              <span className="tableSubText">
                ₹{baseSaleRate.toFixed(2)} + {profit.toFixed(2)}%
              </span>
            </div>
          );
        },
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
    [maxDiscount, admin, profitDrafts, savingProfitId, fy, page],
  );

  return (
    <>
      <PageHeader
        title="Price List"
        description="Profit % is editable with a minimum of 3%. Sales Rate Including Profit % = Sale Rate + (Sale Rate × Profit %)."
        actions={false}
      />

      {error && <div className="resultBanner bad">{error}</div>}

      <section className="panel compactActionPanel">
        <div>
          <strong>Editable Profit Pricing</strong>
          <span>
            Average Purchase comes from posted purchase invoice lines for the selected FY. Profit % cannot be below 3%. Sales Rate Including Profit % is calculated from the Sale Rate, not from Average Purchase.
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
