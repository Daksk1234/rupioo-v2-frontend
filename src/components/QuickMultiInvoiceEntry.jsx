import React, { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import PageHeader from "./PageHeader.jsx";
import { api, getUser } from "../lib/api.js";
import { fetchTransactionParties, partyGstin, partyOptionLabel } from "../lib/partyDirectory.js";

const round2 = (value) => Number((Number(value) || 0).toFixed(2));
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const rowId = (prefix = "row") => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const financialYearFromDate = (value) => {
  const d = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return "2026-27";
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
};

const newProductRow = () => ({
  id: rowId("product"),
  productId: "",
  qty: 1,
  basicPrice: 0,
  gstRate: 0,
});

const newInvoice = () => ({
  id: rowId("invoice"),
  invoiceNo: "",
  date: today(),
  partyId: "",
  rows: [newProductRow()],
  status: "DRAFT",
  message: "",
  savedInvoiceNo: "",
});

async function fetchAllPaged(path, limit = 200) {
  const separator = path.includes("?") ? "&" : "?";
  const first = await api(`${path}${separator}page=1&limit=${limit}`);
  const items = Array.isArray(first?.items) ? [...first.items] : [];
  const pages = Math.max(1, Number(first?.meta?.pages || 1));
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) => api(`${path}${separator}page=${i + 2}&limit=${limit}`)),
    );
    rest.forEach((result) => {
      if (Array.isArray(result?.items)) items.push(...result.items);
    });
  }
  return items;
}

function productDefaultBasic(product, type) {
  const gst = Number(product?.gstRate || 0);
  if (type === "purchase") {
    return round2(
      product?.lastPurchasePrice ??
      product?.averagePurchasePrice ??
      product?.averagePurchaseRate ??
      product?.openingRate ??
      product?.landedCost ??
      0,
    );
  }
  const explicit = Number(
    product?.basicSalePrice ??
    product?.basicPrice ??
    product?.averageSalePrice ??
    0,
  );
  if (explicit > 0) return round2(explicit);
  const taxInclusive = Number(product?.salePrice ?? product?.sellingPrice ?? product?.mrp ?? 0);
  return gst > 0 ? round2(taxInclusive / (1 + gst / 100)) : round2(taxInclusive);
}

function invoiceTaxMode(companyGstin, party) {
  const partyTax = partyGstin(party);
  const firm = String(companyGstin || "").trim().toUpperCase();
  if (firm.length >= 2 && partyTax.length >= 2) {
    return firm.slice(0, 2) === partyTax.slice(0, 2) ? "CGST_SGST" : "IGST";
  }
  return "CGST_SGST";
}

function lineTotals(row, taxMode) {
  const basicTotal = round2(Number(row.qty || 0) * Number(row.basicPrice || 0));
  const tax = round2(basicTotal * Number(row.gstRate || 0) / 100);
  return {
    basicTotal,
    tax,
    cgst: taxMode === "IGST" ? 0 : round2(tax / 2),
    sgst: taxMode === "IGST" ? 0 : round2(tax / 2),
    igst: taxMode === "IGST" ? tax : 0,
    lineTotal: round2(basicTotal + tax),
  };
}

export default function QuickMultiInvoiceEntry({ type = "sales", onBack }) {
  const isSales = type === "sales";
  const title = isSales ? "Quick Multi Sales Invoice Entry" : "Quick Multi Purchase Invoice Entry";
  const sessionUser = getUser();
  const companyGstin = String(sessionUser?.companyProfile?.gstin || "").trim().toUpperCase();

  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [invoices, setInvoices] = useState([newInvoice()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageMessage, setPageMessage] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setPageMessage("");
      try {
        const [partyRows, productRows, warehouseResult] = await Promise.all([
          fetchTransactionParties(300),
          fetchAllPaged("/products?status=ACTIVE", 200),
          isSales ? api("/modules/dms/warehouses?status=ACTIVE&limit=200").catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
        ]);
        if (!active) return;
        const warehouseRows = Array.isArray(warehouseResult) ? warehouseResult : (warehouseResult?.items || []);
        setParties(partyRows);
        setProducts(productRows);
        setWarehouses(warehouseRows);
        if (isSales && warehouseRows.length === 1) setWarehouseId(String(warehouseRows[0]._id || ""));
      } catch (error) {
        if (active) setPageMessage(error.message || "Could not load invoice masters");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isSales]);

  const partyMap = useMemo(() => new Map(parties.map((row) => [String(row.globalCustomerId || ""), row])), [parties]);
  const productMap = useMemo(() => new Map(products.map((row) => [String(row._id || ""), row])), [products]);

  const updateInvoice = (invoiceIndex, patch) => {
    setInvoices((list) => list.map((invoice, index) => index === invoiceIndex ? { ...invoice, ...patch, status: invoice.status === "SAVED" ? invoice.status : "DRAFT", message: invoice.status === "SAVED" ? invoice.message : "" } : invoice));
  };

  const updateProductRow = (invoiceIndex, productIndex, patch) => {
    setInvoices((list) => list.map((invoice, index) => {
      if (index !== invoiceIndex || invoice.status === "SAVED") return invoice;
      return {
        ...invoice,
        status: "DRAFT",
        message: "",
        rows: invoice.rows.map((row, rIndex) => rIndex === productIndex ? { ...row, ...patch } : row),
      };
    }));
  };

  const selectProduct = (invoiceIndex, productIndex, productId) => {
    const product = productMap.get(String(productId || ""));
    updateProductRow(invoiceIndex, productIndex, {
      productId,
      gstRate: Number(product?.gstRate || 0),
      basicPrice: product ? productDefaultBasic(product, type) : 0,
    });
  };

  const addProduct = (invoiceIndex) => {
    setInvoices((list) => list.map((invoice, index) => index === invoiceIndex && invoice.status !== "SAVED" ? { ...invoice, rows: [...invoice.rows, newProductRow()] } : invoice));
  };

  const removeProduct = (invoiceIndex, productIndex) => {
    setInvoices((list) => list.map((invoice, index) => {
      if (index !== invoiceIndex || invoice.status === "SAVED") return invoice;
      if (invoice.rows.length <= 1) return { ...invoice, rows: [newProductRow()] };
      return { ...invoice, rows: invoice.rows.filter((_, rIndex) => rIndex !== productIndex) };
    }));
  };

  const addInvoice = () => setInvoices((list) => [...list, newInvoice()]);
  const removeInvoice = (invoiceIndex) => {
    setInvoices((list) => list.length <= 1 ? [newInvoice()] : list.filter((_, index) => index !== invoiceIndex));
  };

  const totalsForInvoice = (invoice) => {
    const party = partyMap.get(String(invoice.partyId || ""));
    const taxMode = invoiceTaxMode(companyGstin, party);
    const rows = invoice.rows.map((row) => lineTotals(row, taxMode));
    const basic = round2(rows.reduce((sum, row) => sum + row.basicTotal, 0));
    const cgst = round2(rows.reduce((sum, row) => sum + row.cgst, 0));
    const sgst = round2(rows.reduce((sum, row) => sum + row.sgst, 0));
    const igst = round2(rows.reduce((sum, row) => sum + row.igst, 0));
    const tax = round2(cgst + sgst + igst);
    const beforeRound = round2(basic + tax);
    const invoiceAmount = Math.round(beforeRound);
    return { taxMode, rows, basic, cgst, sgst, igst, tax, beforeRound, invoiceAmount, roundOff: round2(invoiceAmount - beforeRound) };
  };

  const validateInvoice = (invoice) => {
    if (!invoice.date) return "Date is required";
    if (!invoice.partyId) return `Select ${isSales ? "customer" : "supplier"}`;
    if (isSales && !warehouseId) return "Select warehouse at the top";
    if (!invoice.rows.length) return "Add at least one product";
    for (let i = 0; i < invoice.rows.length; i += 1) {
      const row = invoice.rows[i];
      if (!row.productId) return `Product ${i + 1}: select product`;
      if (Number(row.qty || 0) <= 0) return `Product ${i + 1}: quantity must be greater than zero`;
      if (Number(row.basicPrice || 0) < 0) return `Product ${i + 1}: basic price cannot be negative`;
    }
    return "";
  };

  const postInvoice = async (invoice) => {
    const party = partyMap.get(String(invoice.partyId || ""));
    const totals = totalsForInvoice(invoice);
    const financialYear = financialYearFromDate(invoice.date);
    if (isSales) {
      return api("/transactions/sales-invoices", {
        method: "POST",
        body: JSON.stringify({
          financialYear,
          date: invoice.date,
          invoiceNo: String(invoice.invoiceNo || "").trim(),
          importSource: "QUICK_ENTRY",
          customerGlobalId: invoice.partyId,
          warehouseId,
          gstType: totals.taxMode,
          remarks: "Quick multi-invoice entry",
          items: invoice.rows.map((row) => ({
            productId: row.productId,
            qty: Number(row.qty || 0),
            basicRate: Number(row.basicPrice || 0),
            saleRate: round2(Number(row.basicPrice || 0) * (1 + Number(row.gstRate || 0) / 100)),
            gstRate: Number(row.gstRate || 0),
            discountPct: 0,
            gradeDiscountPct: 0,
            mrp: Number(productMap.get(String(row.productId))?.mrp || 0),
          })),
        }),
      });
    }

    return api("/transactions/purchase-invoices", {
      method: "POST",
      body: JSON.stringify({
        financialYear,
        date: invoice.date,
        invoiceNo: String(invoice.invoiceNo || "").trim(),
        supplierGlobalId: invoice.partyId,
        supplierName: party?.localName || party?.legalName || party?.tradeName || "Supplier",
        supplierGstin: partyGstin(party),
        purchaseType: "GST",
        remarks: "Quick multi-invoice entry",
        items: invoice.rows.map((row) => ({
          productId: row.productId,
          qty: Number(row.qty || 0),
          rate: Number(row.basicPrice || 0),
          gstRate: Number(row.gstRate || 0),
          discountPct: 0,
        })),
      }),
    });
  };

  const saveAll = async () => {
    if (saving) return;
    setSaving(true);
    setPageMessage("");
    let saved = 0;
    let failed = 0;

    for (let index = 0; index < invoices.length; index += 1) {
      const invoice = invoices[index];
      if (invoice.status === "SAVED") continue;
      const validation = validateInvoice(invoice);
      if (validation) {
        failed += 1;
        setInvoices((list) => list.map((row, i) => i === index ? { ...row, status: "ERROR", message: validation } : row));
        continue;
      }

      setInvoices((list) => list.map((row, i) => i === index ? { ...row, status: "SAVING", message: "Posting..." } : row));
      try {
        const result = await postInvoice(invoice);
        saved += 1;
        setInvoices((list) => list.map((row, i) => i === index ? {
          ...row,
          status: "SAVED",
          savedInvoiceNo: result?.invoiceNo || row.invoiceNo || "",
          invoiceNo: result?.invoiceNo || row.invoiceNo || "",
          message: `Saved ${result?.invoiceNo || "invoice"}`,
        } : row));
      } catch (error) {
        failed += 1;
        setInvoices((list) => list.map((row, i) => i === index ? { ...row, status: "ERROR", message: error.message || "Could not save invoice" } : row));
      }
    }

    const alreadySaved = invoices.filter((row) => row.status === "SAVED").length;
    setPageMessage(`${saved} invoice${saved === 1 ? "" : "s"} saved${failed ? ` • ${failed} need correction` : ""}${alreadySaved ? ` • ${alreadySaved} already saved` : ""}.`);
    setSaving(false);
  };

  const pageTotals = useMemo(() => invoices.reduce((out, invoice) => {
    const totals = totalsForInvoice(invoice);
    out.basic += totals.basic;
    out.tax += totals.tax;
    out.amount += totals.invoiceAmount;
    return out;
  }, { basic: 0, tax: 0, amount: 0 }), [invoices, partyMap, companyGstin]);

  return (
    <>
      <PageHeader title={title} description="Fast manual entry for many invoices. Add one or more product rows under each invoice, then Save All." actions={false} />

      {pageMessage && <div className={`resultBanner ${/saved/i.test(pageMessage) && !/correction/i.test(pageMessage) ? "good" : "bad"}`}>{pageMessage}</div>}

      <section className="panel" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>ENTRY TYPE</div>
            <strong style={{ fontSize: 18 }}>{isSales ? "SALES INVOICES" : "PURCHASE INVOICES"}</strong>
          </div>
          {isSales && (
            <label style={{ minWidth: 260 }}>
              <span>Warehouse *</span>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={saving}>
                <option value="">Select Warehouse</option>
                {warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.title || warehouse.reference || warehouse.name || "Warehouse"}</option>)}
              </select>
            </label>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="oldDmsBackBtn" onClick={onBack} disabled={saving}><X size={15}/> Back</button>
            <button type="button" className="oldDmsSubmitBtn" onClick={saveAll} disabled={saving || loading}>{saving ? "Saving..." : "Save All Invoices"}</button>
          </div>
        </div>
      </section>

      {loading && <section className="panel" style={{ padding: 20 }}>Loading party/product masters...</section>}

      {!loading && invoices.map((invoice, invoiceIndex) => {
        const party = partyMap.get(String(invoice.partyId || ""));
        const totals = totalsForInvoice(invoice);
        const locked = invoice.status === "SAVED" || invoice.status === "SAVING";
        return (
          <section key={invoice.id} className="panel" style={{ marginBottom: 14, overflow: "hidden", border: invoice.status === "ERROR" ? "1px solid #d66" : undefined }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 0.8fr) minmax(145px, 0.65fr) minmax(280px, 1.6fr) auto", gap: 10, alignItems: "end", padding: 12, borderBottom: "1px solid rgba(127,127,127,.18)" }}>
              <label><span>Invoice No.</span><input value={invoice.invoiceNo} onChange={(e) => updateInvoice(invoiceIndex, { invoiceNo: e.target.value })} disabled={locked} placeholder={isSales ? "Blank = auto series" : "Invoice number"}/></label>
              <label><span>Date *</span><input type="date" value={invoice.date} onChange={(e) => updateInvoice(invoiceIndex, { date: e.target.value })} disabled={locked}/></label>
              <label><span>{isSales ? "Party / Customer" : "Party / Supplier"} *</span><select value={invoice.partyId} onChange={(e) => updateInvoice(invoiceIndex, { partyId: e.target.value })} disabled={locked}><option value="">Select Party</option>{parties.map((row) => <option key={row.globalCustomerId} value={row.globalCustomerId}>{partyOptionLabel(row)}</option>)}</select></label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className={`statusBadge ${invoice.status === "SAVED" ? "good" : invoice.status === "ERROR" ? "bad" : ""}`}>{invoice.status}</span>
                <button type="button" className="oldDmsIconBtn" onClick={() => removeInvoice(invoiceIndex)} disabled={saving} title="Remove Invoice"><Trash2 size={14}/></button>
              </div>
            </div>

            <div style={{ padding: "8px 12px", fontSize: 12, display: "flex", gap: 16, flexWrap: "wrap", background: "rgba(127,127,127,.04)" }}>
              <span>FY <b>{financialYearFromDate(invoice.date)}</b></span>
              <span>GSTIN <b>{partyGstin(party) || "—"}</b></span>
              <span>Tax <b>{totals.taxMode === "IGST" ? "IGST" : "CGST + SGST"}</b></span>
              {invoice.message && <span style={{ color: invoice.status === "ERROR" ? "#b42318" : undefined }}><b>{invoice.message}</b></span>}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="oldDmsInvoiceListTable" style={{ minWidth: 1180, width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 260 }}>Product</th>
                    <th style={{ width: 95 }}>Qty</th>
                    <th style={{ width: 125 }}>Basic Price</th>
                    <th style={{ width: 90 }}>Tax %</th>
                    <th style={{ width: 130 }}>Basic Total</th>
                    <th style={{ width: 115 }}>CGST</th>
                    <th style={{ width: 115 }}>SGST</th>
                    <th style={{ width: 115 }}>IGST</th>
                    <th style={{ width: 140 }}>Invoice Amount</th>
                    <th style={{ width: 46 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.rows.map((row, productIndex) => {
                    const product = productMap.get(String(row.productId || ""));
                    const calc = lineTotals(row, totals.taxMode);
                    return (
                      <tr key={row.id}>
                        <td><select value={row.productId} onChange={(e) => selectProduct(invoiceIndex, productIndex, e.target.value)} disabled={locked}><option value="">Select Product</option>{products.map((item) => <option key={item._id} value={item._id}>{item.name}{item.sku ? ` • ${item.sku}` : ""}</option>)}</select>{product && <small style={{ display: "block", marginTop: 4, opacity: .65 }}>HSN {product.hsnCode || "—"}{isSales ? ` • Stock ${Number(product.currentStock || 0)}` : ""}</small>}</td>
                        <td><input type="number" min="0" step="any" value={row.qty} onChange={(e) => updateProductRow(invoiceIndex, productIndex, { qty: e.target.value })} disabled={locked}/></td>
                        <td><input type="number" min="0" step="0.01" value={row.basicPrice} onChange={(e) => updateProductRow(invoiceIndex, productIndex, { basicPrice: e.target.value })} disabled={locked}/></td>
                        <td><input type="number" min="0" step="0.01" value={row.gstRate} onChange={(e) => updateProductRow(invoiceIndex, productIndex, { gstRate: e.target.value })} disabled={locked}/></td>
                        <td><b>{money(calc.basicTotal)}</b></td>
                        <td>{money(calc.cgst)}</td>
                        <td>{money(calc.sgst)}</td>
                        <td>{money(calc.igst)}</td>
                        <td><b>{money(calc.lineTotal)}</b></td>
                        <td><button type="button" className="oldDmsIconBtn" onClick={() => removeProduct(invoiceIndex, productIndex)} disabled={locked} title="Remove Product"><Trash2 size={13}/></button></td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan="10" style={{ padding: 8 }}><button type="button" className="oldDmsBackBtn" onClick={() => addProduct(invoiceIndex)} disabled={locked}><Plus size={14}/> Add Product</button></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="4"><b>INVOICE TOTAL</b></td>
                    <td><b>{money(totals.basic)}</b></td>
                    <td><b>{money(totals.cgst)}</b></td>
                    <td><b>{money(totals.sgst)}</b></td>
                    <td><b>{money(totals.igst)}</b></td>
                    <td><b>{money(totals.invoiceAmount)}</b><small style={{ display: "block", opacity: .65 }}>Round {totals.roundOff >= 0 ? "+" : ""}{totals.roundOff.toFixed(2)}</small></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}

      <section className="panel" style={{ padding: 12, marginBottom: 30 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
          <button type="button" className="oldDmsBackBtn" onClick={addInvoice} disabled={saving}><Plus size={15}/> Add Another Invoice</button>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <span>Invoices <b>{invoices.length}</b></span>
            <span>Basic <b>{money(pageTotals.basic)}</b></span>
            <span>Tax <b>{money(pageTotals.tax)}</b></span>
            <span>Total <b>{money(pageTotals.amount)}</b></span>
          </div>
          <button type="button" className="oldDmsSubmitBtn" onClick={saveAll} disabled={saving || loading}><Save size={15}/> {saving ? "Saving..." : "Save All Invoices"}</button>
        </div>
      </section>
    </>
  );
}
