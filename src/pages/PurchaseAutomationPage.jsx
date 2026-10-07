import React, { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Boxes, ClipboardList, FileSearch, RefreshCw, Send, ShoppingBasket, Truck, AlertTriangle, CheckCircle2, Copy, X, Upload, IndianRupee, PackageCheck, Pencil, Save, Trash2 } from "lucide-react";
import { api, getUser } from "../lib/api.js";
import { currentFinancialYear, financialYearOptions } from "../lib/financialYear.js";
import "../purchase-ai.css";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dt = (v) => v ? new Date(v).toLocaleString("en-IN") : "—";
const d = (v) => v ? new Date(v).toLocaleDateString("en-IN") : "—";
const n = (v) => Number(v || 0);
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fyMonthOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
const currentMonthName = () => monthNames[new Date().getMonth()];
const monthBounds = (fy, monthName) => { const startYear = Number(String(fy || "").slice(0, 4)); const monthIndex = monthNames.indexOf(monthName); if (!Number.isFinite(startYear)) return { fromDate: "", toDate: "" }; if (monthName === "ALL") return { fromDate: `${startYear}-04-01`, toDate: `${startYear+1}-03-31` }; if (monthIndex < 0) return { fromDate: "", toDate: "" }; const year = monthIndex >= 3 ? startYear : startYear + 1; const mm = String(monthIndex + 1).padStart(2, "0"); const last = String(new Date(year, monthIndex + 1, 0).getDate()).padStart(2, "0"); return { fromDate: `${year}-${mm}-01`, toDate: `${year}-${mm}-${last}` }; };
const statusLabel = (v) => String(v || "").replaceAll("_", " ");
const tabs = [
  ["ORDER_SHEET", "Order Sheet", ClipboardList],
  ["RFQ", "RFQ & Comparison", FileSearch],
  ["PO", "Purchase Orders", ShoppingBasket],
  ["GRN", "Incoming / QC", Boxes],
  ["COMPLAINTS", "Complaints", AlertTriangle],
  ["ACCOUNTS", "Accounts", IndianRupee],
];

function Modal({ children, onClose, small = false }) {
  return <div className="pa-modal-backdrop" onMouseDown={onClose}><div className={`pa-modal ${small ? "small" : ""}`} onMouseDown={(e) => e.stopPropagation()}>{children}</div></div>;
}

export default function PurchaseAutomationPage({ initialTab = "ORDER_SHEET" }) {
  const user = getUser();
  const [fy, setFy] = useState(currentFinancialYear());
  const [selectedMonth, setSelectedMonth] = useState(currentMonthName());
  const [tab, setTab] = useState(initialTab);
  const [dashboard, setDashboard] = useState({});
  const [requirements, setRequirements] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [pos, setPos] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [grns, setGrns] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [requiredByDate, setRequiredByDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [grnPo, setGrnPo] = useState(null);
  const [grnForm, setGrnForm] = useState(null);
  const [otpGrn, setOtpGrn] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [editingRequirementId, setEditingRequirementId] = useState("");

  const load = async () => {
    try {
      const { fromDate, toDate } = monthBounds(fy, selectedMonth);
      const [dash, reqs, r, p, inc, g, c, a] = await Promise.all([
        api("/purchase-ai/dashboard").catch(() => ({})),
        api("/purchase-ai/requirements").catch(() => []),
        api("/purchase-ai/rfqs").catch(() => []),
        api(`/purchase-ai/purchase-orders?financialYear=${encodeURIComponent(fy)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`).catch(() => []),
        api("/purchase-ai/incoming").catch(() => []),
        api("/purchase-ai/grns").catch(() => []),
        api("/purchase-ai/complaints").catch(() => []),
        api(`/purchase-ai/accounts-queue?financialYear=${encodeURIComponent(fy)}`).catch(() => []),
      ]);
      setDashboard(dash || {}); setRequirements(reqs || []); setRfqs(r || []); setPos(p || []); setIncoming(inc || []); setGrns(g || []); setComplaints(c || []); setAccounts(a || []);
    } catch (e) { setMsg(e.message); }
  };

  useEffect(() => { load(); }, [fy, selectedMonth]);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  const scanStock = async () => {
    setBusy(true); setMsg("");
    try { const r = await api("/purchase-ai/scan-stock", { method: "POST", body: JSON.stringify({ financialYear: fy }) }); setMsg(`${r.triggered || 0} products triggered by AI stock analysis.`); await load(); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  const updateReqQty = (id, value) => setRequirements((list) => list.map((r) => r._id === id ? { ...r, requestedQty: value } : r));
  const saveReqQty = async (r) => { try { await api(`/purchase-ai/requirements/${r._id}`, { method: "PATCH", body: JSON.stringify({ requestedQty: Number(r.requestedQty || 0) }) }); setEditingRequirementId(""); setMsg(`${r.productName} order quantity saved as manual override.`); } catch (e) { setMsg(e.message); } };

  const generate = async (r) => {
    setBusy(true); setMsg("");
    try {
      const result = await api(`/purchase-ai/requirements/${r._id}/generate`, { method: "POST", body: JSON.stringify({}) });
      setDraft({ requirement: result.requirement, items: (result.draftItems || []).map((x) => ({ ...x })), vendors: result.vendorSuggestions || [] });
      setSelectedVendors((result.vendorSuggestions || []).slice(0, 3).map((v) => v.vendorGlobalId));
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  const setDraftQty = (productId, value) => setDraft((x) => ({ ...x, items: x.items.map((i) => i.productId === productId ? { ...i, requestedQty: value } : i) }));
  const toggleVendor = (id) => setSelectedVendors((list) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const createRfq = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const requirementIds = [draft.requirement?._id].filter(Boolean);
      const result = await api("/purchase-ai/rfqs", { method: "POST", body: JSON.stringify({ financialYear: fy, requirementIds, items: draft.items, vendorGlobalIds: selectedVendors, requiredByDate, deliveryLocation }) });
      setMsg(`RFQ ${result.rfq?.rfqNo || "created"}. Vendor links are ready.`); setDraft(null); setTab("RFQ"); await load();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  const copyVendorLink = async (vendorId) => {
    try { const r = await api(`/purchase-ai/vendors/${encodeURIComponent(vendorId)}/portal-link`); await navigator.clipboard.writeText(r.url); setMsg(`Vendor portal link copied for ${r.vendor?.name || "supplier"}.`); }
    catch (e) { setMsg(e.message); }
  };

  const award = async (rfq, vendor) => {
    if (!window.confirm(`Create Purchase Order for ${vendor.vendorName}?`)) return;
    setBusy(true); try { const r = await api(`/purchase-ai/rfqs/${rfq._id}/award`, { method: "POST", body: JSON.stringify({ vendorGlobalId: vendor.vendorGlobalId, reason: `Selected from quotation comparison score ${vendor.comparisonScore || 0}.`, deliveryLocation, requiredByDate }) }); setMsg(`PO ${r.purchaseOrder?.poNo || "created"}.`); setTab("PO"); await load(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  const deletePurchaseOrder = async (po) => {
    if (!window.confirm(`Permanently delete Purchase Order ${po.poNo}? This removes the PO document from the database and cannot be undone.`)) return;
    setBusy(true); setMsg("");
    try {
      await api(`/purchase-ai/purchase-orders/${po._id}`, { method: "DELETE" });
      setMsg(`Purchase Order ${po.poNo} permanently deleted.`);
      await load();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const openGrn = (po) => {
    const shipment = po.shipments?.[po.shipments.length - 1] || {};
    setGrnPo(po);
    setGrnForm({ receivedPackages: shipment.packages || 0, dispatchedPackages: shipment.packages || 0, warehouseName: "", warehouseId: "", remarks: "", items: (po.items || []).map((i) => ({ productId: i.productId, productName: i.productName, dispatchedQty: shipment.items?.find((x) => x.productId === i.productId)?.qty || i.dispatchedQty || i.confirmedQty || i.orderedQty, receivedQty: shipment.items?.find((x) => x.productId === i.productId)?.qty || i.dispatchedQty || 0, acceptedQty: shipment.items?.find((x) => x.productId === i.productId)?.qty || i.dispatchedQty || 0, damagedQty: 0, rejectedQty: 0, shortQty: 0, excessQty: 0, wrongProductQty: 0, evidenceFileIds: [] })) });
  };
  const setGrnItem = (pid, key, value) => setGrnForm((f) => ({ ...f, items: f.items.map((i) => i.productId === pid ? { ...i, [key]: value } : i) }));
  const uploadEvidence = async (pid, file) => {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file); fd.append("entityType", "PURCHASE_QC"); fd.append("entityId", grnPo?.poNo || "QC");
    try { const meta = await api("/purchase-ai/files", { method: "POST", body: fd }); setGrnForm((f) => ({ ...f, items: f.items.map((i) => i.productId === pid ? { ...i, evidenceFileIds: [...(i.evidenceFileIds || []), meta.fileId] } : i) })); setMsg("QC evidence uploaded."); } catch (e) { setMsg(e.message); }
  };
  const createGrn = async () => {
    setBusy(true); try { const r = await api(`/purchase-ai/purchase-orders/${grnPo._id}/grn`, { method: "POST", body: JSON.stringify({ ...grnForm, shipmentId: grnPo.shipments?.[grnPo.shipments.length - 1]?._id }) }); setMsg(`GRN ${r.grnNo} created.`); setGrnPo(null); setGrnForm(null); await load(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  const qcComplete = async (grn) => {
    setBusy(true); try { const r = await api(`/purchase-ai/grns/${grn._id}/qc-complete`, { method: "POST", body: JSON.stringify({ items: grn.items, requestedResolution: "REPLACEMENT_OR_CREDIT_NOTE" }) }); setOtpGrn({ ...r.grn, otpId: r.otpId, devCode: r.devCode }); setOtpCode(r.devCode || ""); setMsg("QC complete. Warehouse OTP generated for inward."); await load(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  const inward = async () => {
    if (!otpGrn) return; setBusy(true);
    try { const r = await api(`/purchase-ai/grns/${otpGrn._id}/inward`, { method: "POST", body: JSON.stringify({ otpId: otpGrn.otpId || otpGrn.warehouseOtpId, code: otpCode }) }); setMsg(`Stock inwarded. Purchase Invoice ${r.purchaseInvoice?.invoiceNo || "created"} is now pending Accounts.`); setOtpGrn(null); setOtpCode(""); setTab("ACCOUNTS"); await load(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  const postAccounts = async (inv) => { if (!window.confirm(`Post ${inv.invoiceNo} to Purchase/GST/Creditor accounts?`)) return; setBusy(true); try { await api(`/purchase-ai/accounts/${inv._id}/post`, { method: "POST", body: JSON.stringify({ financialYear: inv.financialYear || fy }) }); setMsg(`${inv.invoiceNo} posted to Accounts.`); await load(); } catch (e) { setMsg(e.message); } finally { setBusy(false); } };
  const closeComplaint = async (c) => { try { await api(`/purchase-ai/complaints/${c._id}/close`, { method: "POST", body: JSON.stringify({ remarks: "Closed after review" }) }); await load(); } catch (e) { setMsg(e.message); } };

  const submittedQuotes = useMemo(() => rfqs.reduce((sum, r) => sum + (r.vendors || []).filter((v) => v.status === "SUBMITTED").length, 0), [rfqs]);

  return <div className="purchase-ai">
    <div className="pa-head">
      <div className="pa-title"><BrainCircuit size={24}/><div><h1>Purchase AI Control Center</h1><div className="pa-muted">Trend trigger → smart order sheet → multi-vendor RFQ → PO → dispatch → QC → OTP inward → accounts</div></div></div>
      <div className="pa-actions"><select className="pa-input" value={fy} onChange={(e)=>setFy(e.target.value)}>{financialYearOptions(user,{count:8,extra:[currentFinancialYear()]}).map(x=><option key={x} value={x}>FY {x}</option>)}</select><select className="pa-input" value={selectedMonth} onChange={(e)=>setSelectedMonth(e.target.value)}><option value="ALL">Full FY</option>{fyMonthOrder.map(m=><option key={m} value={m}>{m}</option>)}</select><button className="pa-btn" onClick={load}><RefreshCw size={15}/>Refresh</button><button className="pa-btn primary" disabled={busy} onClick={scanStock}><BrainCircuit size={15}/>{busy ? "Working…" : "Run AI Stock Scan"}</button></div>
    </div>

    {msg && <div className="pa-msg">{msg}</div>}
    <div className="pa-grid">
      <div className="pa-card"><div className="pa-muted">Triggered products</div><div className="pa-kpi">{dashboard.requirements || 0}</div></div>
      <div className="pa-card"><div className="pa-muted">RFQs open</div><div className="pa-kpi">{dashboard.rfqs || 0}</div></div>
      <div className="pa-card"><div className="pa-muted">Quotes received</div><div className="pa-kpi">{submittedQuotes}</div></div>
      <div className="pa-card"><div className="pa-muted">Active POs</div><div className="pa-kpi">{dashboard.purchaseOrders || 0}</div></div>
      <div className="pa-card"><div className="pa-muted">QC / inward</div><div className="pa-kpi">{dashboard.grns || 0}</div></div>
      <div className="pa-card"><div className="pa-muted">Open complaints</div><div className="pa-kpi">{dashboard.complaints || 0}</div></div>
    </div>
    {(dashboard.insights || []).length > 0 && <div className="pa-stack">{dashboard.insights.map((x, i) => <div className="pa-insight" key={i}>AI: {x}</div>)}</div>}

    <div className="pa-tabs">{tabs.map(([key, label, Icon]) => <button key={key} className={`pa-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}><Icon size={13} style={{verticalAlign:"middle",marginRight:5}}/>{label}</button>)}</div>

    {tab === "ORDER_SHEET" && <div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>Trend / Trigger</th><th>Product</th><th>Stock intelligence</th><th>AI Qty</th><th>Last Purchase</th><th>Supplier Contact</th><th>AI reasoning</th><th>Action</th></tr></thead><tbody>{requirements.filter((r) => ["TRIGGERED","ORDER_SHEET","HOLD"].includes(r.status)).map((r) => <tr key={r._id}>
      <td><span className={`pa-badge ${String(r.trendClass).toLowerCase()}`}>{r.trendClass}</span><div>{r.triggerPct}% trigger</div><div className="pa-muted">At {n(r.triggerQty).toFixed(2)}</div></td>
      <td><b>{r.productName}</b><div className="pa-muted">{r.sku} • {r.unit}</div></td>
      <td><div>Physical <b>{n(r.currentStock)}</b></div><div>Reserved {n(r.reservedStock)}</div><div>ATP {n(r.availableStock)}</div><div>Incoming PO {n(r.pendingPoQty)}</div><div><b>Effective {n(r.effectiveStock)}</b> / Target {n(r.targetStock)}</div></td>
      <td style={{minWidth:140}}>{editingRequirementId===r._id ? <><input autoFocus className="pa-input" type="number" value={r.requestedQty ?? r.suggestedQty ?? 0} onChange={(e)=>updateReqQty(r._id,e.target.value)}/><button className="pa-btn good" style={{marginTop:5}} onClick={()=>saveReqQty(r)}><Save size={13}/>Save</button></> : <><b>{n(r.requestedQty ?? r.suggestedQty)}</b> {r.unit}<div className="pa-muted">Suggested {n(r.suggestedQty)} • {r.quantitySource||"AI"}</div></>}</td>
      <td><b>{r.lastPurchase?.vendorName || "No history"}</b><div>{r.lastPurchase?.invoiceNo || "—"}</div><div>{d(r.lastPurchase?.date)} • {money(r.lastPurchase?.rate)}</div></td>
      <td><div>{r.lastPurchase?.mobile || "—"}</div><div>{r.lastPurchase?.email || "—"}</div></td>
      <td style={{maxWidth:260}}>{r.aiReason}</td>
      <td><div className="pa-stack"><button className="pa-btn" onClick={()=>setEditingRequirementId(r._id)}><Pencil size={14}/>Edit</button><button className="pa-btn primary" onClick={()=>generate(r)}><BrainCircuit size={14}/>Generate</button>{r.lastPurchase?.vendorGlobalId && <button className="pa-btn" onClick={()=>copyVendorLink(r.lastPurchase.vendorGlobalId)}><Copy size={14}/>Vendor Link</button>}</div></td>
    </tr>)}{!requirements.length && <tr><td colSpan="8">Run AI Stock Scan to create your smart purchase order sheet.</td></tr>}</tbody></table></div>}

    {tab === "RFQ" && <div className="pa-stack">{rfqs.map((r) => <div className="pa-panel" key={r._id}><div className="pa-head"><div><b>{r.rfqNo}</b> <span className="pa-badge blue">{statusLabel(r.status)}</span><div className="pa-muted">Created {dt(r.createdAt)} • Required {d(r.requiredByDate)}</div></div><div>{(r.items||[]).length} products</div></div><div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>Supplier</th><th>Status</th><th>Quote</th><th>Landed Total</th><th>Credit</th><th>AI Comparison</th><th>Action</th></tr></thead><tbody>{(r.vendors||[]).map((v)=><tr key={v._id || v.vendorGlobalId}><td><b>{v.vendorName}</b><div>{v.contact?.mobile}</div><div>{v.contact?.email}</div></td><td>{statusLabel(v.status)}</td><td>{v.quoteNo || "—"}<div>{d(v.quoteDate)}</div></td><td>{v.status === "SUBMITTED" ? money(v.landedTotal) : "—"}</td><td>{n(v.creditDays)} days</td><td>{v.status === "SUBMITTED" ? <><b>{n(v.comparisonScore).toFixed(1)}/100</b><div className="pa-muted">{(v.comparisonReasons||[]).join(" • ")}</div></> : "Waiting"}</td><td><div className="pa-inline"><button className="pa-btn" onClick={()=>copyVendorLink(v.vendorGlobalId)}><Copy size={13}/>Portal</button>{v.status === "SUBMITTED" && r.status !== "AWARDED" && <button className="pa-btn good" onClick={()=>award(r,v)}><CheckCircle2 size={13}/>Award</button>}</div></td></tr>)}</tbody></table></div></div>)}{!rfqs.length && <div className="pa-panel">No RFQs yet. Generate an order sheet and send it to suppliers.</div>}</div>}

    {tab === "PO" && <div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>PO</th><th>Supplier</th><th>Status</th><th>Amount</th><th>Confirmation</th><th>Dispatch</th><th>Vendor Portal</th></tr></thead><tbody>{pos.map((po)=><tr key={po._id}><td><b>{po.poNo}</b><div className="pa-muted">{po.rfqNo}</div></td><td>{po.vendorName}<div>{po.vendorContact?.mobile}</div></td><td><span className="pa-badge blue">{statusLabel(po.status)}</span></td><td>{money(po.grandTotal)}</td><td>{po.supplierConfirmation?.confirmedAt ? <><b>{d(po.supplierConfirmation.expectedDispatchDate)}</b><div>{po.supplierConfirmation.expectedDispatchTime}</div></> : "Waiting supplier"}</td><td>{(po.shipments||[]).length ? (po.shipments||[]).map((s)=><div key={s._id}>{s.lrNo || s.shipmentNo} • {s.packages} pkg • {d(s.dispatchDate)}</div>) : "Not dispatched"}</td><td><div className="pa-actions"><button className="pa-btn" onClick={()=>copyVendorLink(po.vendorGlobalId)}><Copy size={13}/>Copy Link</button><button className="pa-btn" disabled={busy} onClick={()=>deletePurchaseOrder(po)}><Trash2 size={13}/>Delete</button></div></td></tr>)}{!pos.length&&<tr><td colSpan="7">No purchase orders yet.</td></tr>}</tbody></table></div>}

    {tab === "GRN" && <div className="pa-stack"><div className="pa-panel"><b>Incoming Shipments</b><div className="pa-table-wrap" style={{marginTop:8}}><table className="pa-table"><thead><tr><th>PO</th><th>Supplier</th><th>LR / Transporter</th><th>Packages</th><th>Expected</th><th>Action</th></tr></thead><tbody>{incoming.map((po)=>{const s=po.shipments?.[po.shipments.length-1]||{};return <tr key={po._id}><td>{po.poNo}</td><td>{po.vendorName}</td><td>{s.lrNo||"—"}<div>{s.transporterName||"—"}</div></td><td>{s.packages||0}</td><td>{dt(s.expectedArrival)}</td><td><button className="pa-btn primary" onClick={()=>openGrn(po)}><PackageCheck size={14}/>Receive / QC</button></td></tr>})}</tbody></table></div></div><div className="pa-panel"><b>GRN / QC Queue</b><div className="pa-table-wrap" style={{marginTop:8}}><table className="pa-table"><thead><tr><th>GRN</th><th>PO</th><th>Supplier</th><th>Packages</th><th>QC</th><th>Variance</th><th>Action</th></tr></thead><tbody>{grns.map((g)=>{const variance=(g.items||[]).reduce((s,i)=>s+n(i.damagedQty)+n(i.rejectedQty)+n(i.shortQty)+n(i.wrongProductQty),0);return <tr key={g._id}><td>{g.grnNo}</td><td>{g.poNo}</td><td>{g.vendorName}</td><td>{g.receivedPackages}/{g.dispatchedPackages}</td><td>{statusLabel(g.qcStatus)}</td><td>{variance}</td><td>{g.qcStatus==="IN_PROGRESS"&&<button className="pa-btn good" onClick={()=>qcComplete(g)}>Complete QC + OTP</button>}{g.qcStatus==="INWARD_PENDING"&&<button className="pa-btn primary" onClick={()=>{setOtpGrn(g);setOtpCode("")}}>Enter Warehouse OTP</button>}</td></tr>})}</tbody></table></div></div></div>}

    {tab === "COMPLAINTS" && <div className="pa-stack">{complaints.map((c)=><div className="pa-panel" key={c._id}><div className="pa-head"><div><b>{c.complaintNo} • {c.vendorName}</b><div className="pa-muted">{c.poNo} / {c.grnNo}</div></div><span className="pa-badge warn">{statusLabel(c.status)}</span></div><p>{c.description}</p><div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>Product</th><th>Received</th><th>Damaged</th><th>Rejected</th><th>Short</th><th>Evidence</th></tr></thead><tbody>{(c.items||[]).map((i)=><tr key={i.productId}><td>{i.productName}</td><td>{i.receivedQty}</td><td>{i.damagedQty}</td><td>{i.rejectedQty}</td><td>{i.shortQty}</td><td>{(i.evidenceFileIds||[]).length} file(s)</td></tr>)}</tbody></table></div>{c.vendorResponse?.respondedAt&&<div className="pa-insight" style={{marginTop:8}}>Vendor: <b>{statusLabel(c.vendorResponse.action)}</b> — {c.vendorResponse.remarks || "No remarks"} {c.vendorResponse.promisedDate?` • promised ${d(c.vendorResponse.promisedDate)}`:""}</div>}<div className="pa-actions" style={{marginTop:8}}><button className="pa-btn" onClick={()=>copyVendorLink(c.vendorGlobalId)}>Vendor Portal</button>{c.status!=="CLOSED"&&<button className="pa-btn good" onClick={()=>closeComplaint(c)}>Close Complaint</button>}</div></div>)}{!complaints.length&&<div className="pa-panel">No supplier complaints.</div>}</div>}

    {tab === "ACCOUNTS" && <div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>Invoice</th><th>Date</th><th>Supplier</th><th>PO / GRN</th><th>Taxable</th><th>GST</th><th>Total</th><th>Action</th></tr></thead><tbody>{accounts.map((i)=><tr key={i._id}><td><b>{i.invoiceNo}</b><div className="pa-badge">{i.procurementMode}</div></td><td>{d(i.date)}</td><td>{i.supplierNameSnapshot}</td><td>{i.sourcePurchaseOrderNo}<div>{i.sourceGrnNo}</div></td><td>{money(i.taxableTotal)}</td><td>{money(i.taxTotal)}</td><td>{money(i.grandTotal)}</td><td><button className="pa-btn primary" onClick={()=>postAccounts(i)}><IndianRupee size={13}/>Post GST / Accounts</button></td></tr>)}{!accounts.length&&<tr><td colSpan="8">No inwarded PO invoices pending Accounts.</td></tr>}</tbody></table></div>}

    {draft && <Modal onClose={()=>setDraft(null)}><div className="pa-modal-head"><div><b>AI Purchase Draft</b><div className="pa-muted">Same-supplier products near trigger are automatically suggested. Quantities remain editable.</div></div><button className="pa-btn" onClick={()=>setDraft(null)}><X size={15}/></button></div><div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>Product</th><th>Trend</th><th>Effective / Trigger</th><th>AI Qty</th><th>Order Qty</th><th>Last Rate</th></tr></thead><tbody>{draft.items.map((i)=><tr key={i.productId}><td><b>{i.productName}</b><div>{i.sku}</div></td><td><span className={`pa-badge ${String(i.trendClass).toLowerCase()}`}>{i.trendClass}</span></td><td>{n(i.effectiveStock)} / {n(i.triggerQty)}</td><td>{n(i.suggestedQty)}</td><td><input className="pa-input" type="number" value={i.requestedQty ?? 0} onChange={(e)=>setDraftQty(i.productId,e.target.value)}/></td><td>{money(i.primaryVendorLastRate)}</td></tr>)}</tbody></table></div><h4>Suppliers to request quotation</h4><div className="pa-grid">{draft.vendors.map((v)=><label className="pa-vendor" key={v.vendorGlobalId}><input type="checkbox" checked={selectedVendors.includes(v.vendorGlobalId)} onChange={()=>toggleVendor(v.vendorGlobalId)}/><div><b>{v.vendorName}</b><div className="pa-muted">Last {money(v.lastRate)} • Avg {money(v.avgRate)} • {v.creditDays||0} days credit</div><div>{v.mobile} {v.email}</div></div></label>)}</div><div className="pa-form-grid" style={{marginTop:12}}><label>Required By<input className="pa-input" type="date" value={requiredByDate} onChange={(e)=>setRequiredByDate(e.target.value)}/></label><label>Delivery Location<input className="pa-input" value={deliveryLocation} onChange={(e)=>setDeliveryLocation(e.target.value)} placeholder="Warehouse / address"/></label></div><div className="pa-actions" style={{marginTop:12,justifyContent:"flex-end"}}><button className="pa-btn" onClick={()=>setDraft(null)}>Cancel</button><button className="pa-btn primary" disabled={!selectedVendors.length||busy} onClick={createRfq}><Send size={14}/>Send RFQ to {selectedVendors.length} supplier(s)</button></div></Modal>}

    {grnPo && grnForm && <Modal onClose={()=>setGrnPo(null)}><div className="pa-modal-head"><div><b>Receive / QC • {grnPo.poNo}</b><div className="pa-muted">{grnPo.vendorName}</div></div><button className="pa-btn" onClick={()=>setGrnPo(null)}><X size={15}/></button></div><div className="pa-form-grid"><label>Dispatched Packages<input className="pa-input" type="number" value={grnForm.dispatchedPackages} onChange={(e)=>setGrnForm({...grnForm,dispatchedPackages:e.target.value})}/></label><label>Received Packages<input className="pa-input" type="number" value={grnForm.receivedPackages} onChange={(e)=>setGrnForm({...grnForm,receivedPackages:e.target.value})}/></label><label>Warehouse<input className="pa-input" value={grnForm.warehouseName} onChange={(e)=>setGrnForm({...grnForm,warehouseName:e.target.value})}/></label></div><div className="pa-table-wrap" style={{marginTop:12}}><table className="pa-table"><thead><tr><th>Product</th><th>Dispatch</th><th>Received</th><th>Accepted</th><th>Damaged</th><th>Rejected</th><th>Short</th><th>Photo</th></tr></thead><tbody>{grnForm.items.map((i)=><tr key={i.productId}><td>{i.productName}</td><td>{i.dispatchedQty}</td>{["receivedQty","acceptedQty","damagedQty","rejectedQty","shortQty"].map((k)=><td key={k}><input className="pa-input" style={{width:82}} type="number" value={i[k]} onChange={(e)=>setGrnItem(i.productId,k,e.target.value)}/></td>)}<td><label className="pa-btn"><Upload size={13}/>Upload<input type="file" accept="image/*,application/pdf" hidden onChange={(e)=>uploadEvidence(i.productId,e.target.files?.[0])}/></label><div className="pa-muted">{(i.evidenceFileIds||[]).length} file(s)</div></td></tr>)}</tbody></table></div><div className="pa-actions" style={{marginTop:12,justifyContent:"flex-end"}}><button className="pa-btn primary" onClick={createGrn}>Create GRN & Start QC</button></div></Modal>}

    {otpGrn && <Modal small onClose={()=>setOtpGrn(null)}><div className="pa-modal-head"><div><b>Warehouse OTP • {otpGrn.grnNo}</b><div className="pa-muted">Order Desk can inward only after Warehouse verifies this OTP.</div></div><button className="pa-btn" onClick={()=>setOtpGrn(null)}><X size={15}/></button></div>{otpGrn.devCode&&<div className="pa-insight">Development OTP: <b>{otpGrn.devCode}</b></div>}<label>OTP<input className="pa-input" value={otpCode} onChange={(e)=>setOtpCode(e.target.value)} placeholder="6 digit OTP"/></label><div className="pa-actions" style={{marginTop:12,justifyContent:"flex-end"}}><button className="pa-btn primary" onClick={inward}>Verify OTP & Inward Stock</button></div></Modal>}
  </div>;
}
