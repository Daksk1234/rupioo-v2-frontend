import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  FileText,
  MapPinned,
  PackageCheck,
  RefreshCw,
  Route,
  Search,
  Send,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { api, getUser } from "../lib/api.js";
import { configuredFinancialYear, financialYearOptions } from "../lib/financialYear.js";

const upper = (v) => String(v || "").trim().toUpperCase();
const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN");
};

const TAB_CONFIG = {
  ORDERS: {
    label: "All Orders",
    icon: ClipboardCheck,
    statuses: null,
  },
  VERIFY: {
    label: "Verification",
    icon: ShieldCheck,
    statuses: ["OTP_PENDING", "ORDER_PLACED", "CREDIT_HOLD", "VERIFIED"],
  },
  WAREHOUSE: {
    label: "Warehouse",
    icon: Boxes,
    statuses: ["STOCK_RESERVED", "SENT_TO_WAREHOUSE", "PICKING", "PACKING", "PACKED"],
  },
  ORDER_DESK: {
    label: "Order Desk",
    icon: FileText,
    statuses: ["PACKED", "SENT_TO_ORDER_DESK", "INVOICED_PARTIAL", "INVOICED"],
  },
  DISPATCH: {
    label: "Dispatch",
    icon: Truck,
    statuses: ["INVOICED", "INVOICED_PARTIAL", "READY_FOR_DISPATCH", "DELIVERY_ASSIGNED", "OUT_FOR_DELIVERY", "HANDED_TO_TRANSPORTER"],
  },
  RETURNS: {
    label: "Returns",
    icon: RefreshCw,
    statuses: ["DELIVERY_FAILED", "RETURN_IN_TRANSIT", "RETURNED_TO_WAREHOUSE", "CREDIT_NOTE_PENDING"],
  },
  CLOSED: {
    label: "Completed",
    icon: CheckCircle2,
    statuses: ["DELIVERED", "CLOSED", "CANCELLED", "REJECTED"],
  },
};

const STATUS_TONE = {
  OTP_PENDING: ["#fff7ed", "#9a3412"],
  CREDIT_HOLD: ["#fff1f2", "#be123c"],
  ORDER_PLACED: ["#eff6ff", "#1d4ed8"],
  VERIFIED: ["#eff6ff", "#1d4ed8"],
  STOCK_RESERVED: ["#eef2ff", "#4338ca"],
  SENT_TO_WAREHOUSE: ["#f5f3ff", "#6d28d9"],
  PICKING: ["#f5f3ff", "#6d28d9"],
  PACKING: ["#faf5ff", "#7e22ce"],
  PACKED: ["#ecfeff", "#0e7490"],
  SENT_TO_ORDER_DESK: ["#ecfeff", "#0e7490"],
  INVOICED: ["#ecfdf5", "#047857"],
  INVOICED_PARTIAL: ["#fffbeb", "#b45309"],
  READY_FOR_DISPATCH: ["#f0fdf4", "#15803d"],
  DELIVERY_ASSIGNED: ["#f0fdfa", "#0f766e"],
  OUT_FOR_DELIVERY: ["#ecfeff", "#0e7490"],
  HANDED_TO_TRANSPORTER: ["#f0fdfa", "#115e59"],
  DELIVERED: ["#ecfdf5", "#047857"],
  DELIVERY_FAILED: ["#fef2f2", "#b91c1c"],
  RETURN_IN_TRANSIT: ["#fff7ed", "#c2410c"],
  RETURNED_TO_WAREHOUSE: ["#fff7ed", "#9a3412"],
  CREDIT_NOTE_PENDING: ["#fff1f2", "#be123c"],
  CLOSED: ["#f0fdf4", "#166534"],
  CANCELLED: ["#f3f4f6", "#4b5563"],
  REJECTED: ["#fef2f2", "#991b1b"],
};

function Pill({ status }) {
  const key = upper(status);
  const [bg, color] = STATUS_TONE[key] || ["#f3f4f6", "#374151"];
  return (
    <span style={{ background: bg, color, borderRadius: 999, padding: "5px 9px", fontSize: 10, fontWeight: 900, letterSpacing: ".02em", whiteSpace: "nowrap" }}>
      {key.replaceAll("_", " ") || "—"}
    </span>
  );
}

function ActionButton({ children, onClick, disabled, tone = "primary", icon: Icon }) {
  const tones = {
    primary: { background: "#111827", color: "white", border: "#111827" },
    good: { background: "#047857", color: "white", border: "#047857" },
    blue: { background: "#1d4ed8", color: "white", border: "#1d4ed8" },
    soft: { background: "white", color: "#111827", border: "#d1d5db" },
    warn: { background: "#fff7ed", color: "#9a3412", border: "#fed7aa" },
  };
  const t = tones[tone] || tones.primary;
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${t.border}`, background: disabled ? "#f3f4f6" : t.background, color: disabled ? "#9ca3af" : t.color, borderRadius: 8, padding: "7px 10px", fontSize: 11, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer" }}>
      {Icon ? <Icon size={14} /> : null}{children}
    </button>
  );
}

function Modal({ title, children, onClose, width = 760 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 2500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto", background: "white", borderRadius: 14, boxShadow: "0 20px 55px rgba(0,0,0,.25)" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 2, background: "white", borderBottom: "1px solid #e5e7eb", padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b style={{ fontSize: 14 }}>{title}</b>
          <button type="button" onClick={onClose} style={{ border: 0, background: "transparent", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Location is not available in this browser"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => reject(new Error("Allow location access to create an optimized delivery route")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  });
}

export default function OrderControlCenter({ initialTab = "ORDERS" }) {
  const navigate = useNavigate();
  const user = getUser();
  const [fy, setFy] = useState(configuredFinancialYear(user));
  const [tab, setTab] = useState(initialTab);
  const [orders, setOrders] = useState([]);
  const [runs, setRuns] = useState([]);
  const [deliveryBoys, setDeliveryBoys] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [detail, setDetail] = useState(null);
  const [packing, setPacking] = useState(null);
  const [dispatch, setDispatch] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [orderData, runData, boysData, noteData] = await Promise.all([
        api(`/sales-app/order-flow/orders?financialYear=${encodeURIComponent(fy)}&limit=200`),
        api(`/sales-app/order-flow/delivery-runs?financialYear=${encodeURIComponent(fy)}`).catch(() => ({ items: [] })),
        api("/sales-app/order-flow/delivery-boys").catch(() => ({ items: [] })),
        api(`/sales-app/order-flow/credit-notes?financialYear=${encodeURIComponent(fy)}`).catch(() => ({ items: [] })),
      ]);
      setOrders(orderData?.items || []);
      setRuns(runData?.items || []);
      setDeliveryBoys(boysData?.items || []);
      setCreditNotes(noteData?.items || []);
    } catch (e) {
      if (!silent) setMsg(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fy]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => load(true), 8000);
    return () => window.clearInterval(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const statuses = TAB_CONFIG[tab]?.statuses;
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statuses && !statuses.includes(upper(o.workflowStatus))) return false;
      if (!q) return true;
      return [o.orderNo, o.customerNameSnapshot, o.salespersonNameSnapshot, o.invoice?.invoiceNo]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [orders, tab, search]);

  const counts = useMemo(() => Object.fromEntries(Object.entries(TAB_CONFIG).map(([key, cfg]) => [
    key,
    cfg.statuses ? orders.filter((o) => cfg.statuses.includes(upper(o.workflowStatus))).length : orders.length,
  ])), [orders]);

  const mutate = async (fn, success) => {
    setMsg(""); setLoading(true);
    try { await fn(); setMsg(success); await load(true); }
    catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  };

  const transition = (order, toStatus, success) => mutate(
    () => api(`/sales-app/order-flow/orders/${order._id}/transition?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify({ toStatus }) }),
    success || `${order.orderNo} moved to ${toStatus.replaceAll("_", " ")}`,
  );

  const verifyReserve = (order) => mutate(
    () => api(`/sales-app/order-flow/orders/${order._id}/verify-and-reserve?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: "{}" }),
    `${order.orderNo} verified and stock reserved`,
  );

  const creditDecision = (order, action) => mutate(
    () => api(`/sales-app/orders/${order._id}/credit-decision?financialYear=${encodeURIComponent(fy)}`, { method: "PATCH", body: JSON.stringify({ action, remarks: action === "APPROVE" ? "Approved from Order Control Center" : "Rejected from Order Control Center" }) }),
    `${order.orderNo}: credit ${action === "APPROVE" ? "approved" : "rejected"}`,
  );

  const requestCustomerOtp = async (order) => {
    setLoading(true); setMsg("");
    try {
      const result = await api(`/sales-app/order-flow/orders/${order._id}/customer-otp?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: "{}" });
      const code = window.prompt(`Customer OTP created for ${order.orderNo}.${result?.devCode ? ` DEV OTP: ${result.devCode}` : " Ask the customer for the OTP."}\n\nEnter OTP now, or Cancel to verify later:`);
      if (code) {
        await api(`/sales-app/order-flow/orders/${order._id}/customer-otp/verify?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify({ otpId: result.otpId, code }) });
        setMsg(`${order.orderNo} customer OTP verified`);
      } else {
        setMsg(`${order.orderNo}: OTP created; verification remains pending`);
      }
      await load(true);
    } catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  };

  const openDetail = async (order) => {
    setLoading(true); setMsg("");
    try { setDetail(await api(`/sales-app/order-flow/orders/${order._id}?financialYear=${encodeURIComponent(fy)}`)); }
    catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  };

  const startPacking = (order) => mutate(
    () => api(`/sales-app/order-flow/orders/${order._id}/packing/start?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: "{}" }),
    `${order.orderNo}: warehouse packing started`,
  );

  const openPacking = (order) => setPacking({
    order,
    packageCount: Number(order.packing?.packageCount || 0),
    actualWeight: Number(order.packing?.actualWeight || 0),
    remarks: "",
    items: (order.items || []).map((x) => ({ productId: x.productId, name: x.nameSnapshot, orderedQty: Number(x.qty || 0), reservedQty: Number(x.reservedQty || 0), packedQty: Number(x.packedQty || x.reservedQty || x.qty || 0), shortageReason: x.shortageReason || "" })),
  });

  const savePacking = () => {
    const state = packing;
    if (!state) return;
    mutate(
      () => api(`/sales-app/order-flow/orders/${state.order._id}/packing/complete?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify({ items: state.items, packageCount: state.packageCount, actualWeight: state.actualWeight, remarks: state.remarks }) }),
      `${state.order.orderNo}: actual packed quantity saved`,
    ).then(() => setPacking(null));
  };

  const toggleSelected = (id) => setSelected((old) => {
    const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });

  const openDispatch = async () => {
    const ids = [...selected];
    if (!ids.length) return setMsg("Select one or more READY FOR DISPATCH orders");
    const invalid = orders.filter((o) => ids.includes(String(o._id)) && !["READY_FOR_DISPATCH", "INVOICED", "INVOICED_PARTIAL"].includes(upper(o.workflowStatus)));
    if (invalid.length) return setMsg("Only invoiced / ready-for-dispatch orders can be routed");
    try {
      const pos = await getPosition();
      setDispatch({ orderIds: ids, deliveryBoyId: deliveryBoys[0]?._id || "", vehicleNo: "", startLocation: pos });
    } catch (e) { setMsg(e.message); }
  };

  const createRun = () => {
    if (!dispatch?.deliveryBoyId) return setMsg("Select a delivery boy");
    mutate(
      () => api(`/sales-app/order-flow/delivery-runs?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify(dispatch) }),
      "Optimized delivery run created",
    ).then(() => { setDispatch(null); setSelected(new Set()); });
  };

  const issueCreditNote = (note) => {
    if (!window.confirm(`Issue credit note ${note.creditNoteNo} for ${money(note.grandTotal)}? This will post accounting.`)) return;
    mutate(
      () => api(`/sales-app/order-flow/credit-notes/${note._id}/issue?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: "{}" }),
      `Credit note ${note.creditNoteNo} issued`,
    );
  };

  const actionsFor = (order) => {
    const status = upper(order.workflowStatus);
    if (status === "CREDIT_HOLD") return <span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap" }}><ActionButton icon={CheckCircle2} tone="good" onClick={() => creditDecision(order, "APPROVE")}>Approve Credit</ActionButton><ActionButton tone="warn" onClick={() => creditDecision(order, "REJECT")}>Reject</ActionButton></span>;
    if (status === "OTP_PENDING") return <ActionButton icon={ShieldCheck} tone="blue" onClick={() => requestCustomerOtp(order)}>Customer OTP</ActionButton>;
    if (status === "ORDER_PLACED" || status === "VERIFIED") return <ActionButton icon={CheckCircle2} tone="good" onClick={() => verifyReserve(order)}>Verify & Reserve</ActionButton>;
    if (status === "STOCK_RESERVED") return <ActionButton icon={Send} tone="blue" onClick={() => transition(order, "SENT_TO_WAREHOUSE")}>Send Warehouse</ActionButton>;
    if (["SENT_TO_WAREHOUSE", "PICKING"].includes(status)) return <ActionButton icon={Boxes} tone="blue" onClick={() => startPacking(order)}>Start Packing</ActionButton>;
    if (status === "PACKING") return <ActionButton icon={PackageCheck} tone="good" onClick={() => openPacking(order)}>Complete Packing</ActionButton>;
    if (status === "PACKED") return <ActionButton icon={Send} tone="blue" onClick={() => transition(order, "SENT_TO_ORDER_DESK")}>Send Order Desk</ActionButton>;
    if (status === "SENT_TO_ORDER_DESK") return <ActionButton icon={FileText} tone="good" onClick={() => navigate(`/dms/sales-invoices?orderId=${encodeURIComponent(order._id)}&financialYear=${encodeURIComponent(fy)}`)}>Generate Invoice</ActionButton>;
    if (["INVOICED", "INVOICED_PARTIAL"].includes(status)) return <ActionButton icon={Truck} tone="blue" onClick={() => transition(order, "READY_FOR_DISPATCH")}>Ready Dispatch</ActionButton>;
    if (status === "READY_FOR_DISPATCH") return <span style={{ fontSize: 10, fontWeight: 800, color: "#15803d" }}>Select for route</span>;
    return <span style={{ fontSize: 10, color: "#6b7280" }}>{order.nextAction || "View timeline"}</span>;
  };

  return (
    <div>
      <PageHeader title="Order Control Center" subtitle="Order → Warehouse → Packing → Invoice → Dispatch → Delivery → Return / Credit Note" />

      <div style={{ marginBottom: 12, padding: 12, border: "1px solid #dbeafe", background: "#eff6ff", borderRadius: 10, fontSize: 11, lineHeight: 1.5 }}>
        <b>Two billing modes are active:</b> Order-based billing runs through this control center. Walk-in / cash / doorstep sales can still be billed immediately from <button type="button" onClick={() => navigate("/dms/sales-invoices?create=1")} style={{ border: 0, background: "transparent", color: "#1d4ed8", padding: 0, fontWeight: 900, cursor: "pointer" }}>Direct Sales Invoice</button> without creating an order.
      </div>

      {msg ? <div style={{ marginBottom: 10, padding: "9px 11px", borderRadius: 8, background: msg.toLowerCase().includes("error") ? "#fef2f2" : "#f8fafc", border: "1px solid #e5e7eb", fontSize: 11 }}>{msg}</div> : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <select value={fy} onChange={(e) => { setFy(e.target.value); setSelected(new Set()); }} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 11, fontWeight: 800 }}>
          {financialYearOptions(user, { count: 8 }).map((x) => <option key={x} value={x}>FY {x}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", border: "1px solid #d1d5db", borderRadius: 8, padding: "0 9px", background: "white", minWidth: 220 }}>
          <Search size={14} color="#6b7280" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order / customer / invoice" style={{ border: 0, outline: 0, padding: "8px 7px", width: "100%", fontSize: 11 }} />
        </div>
        <ActionButton icon={RefreshCw} tone="soft" onClick={() => load()} disabled={loading}>Refresh</ActionButton>
        {tab === "DISPATCH" ? <ActionButton icon={Route} tone="good" onClick={openDispatch}>Create Optimized Route ({selected.size})</ActionButton> : null}
        <ActionButton icon={MapPinned} tone="soft" onClick={() => navigate(`/dms/dispatch?deliveryApp=1&financialYear=${encodeURIComponent(fy)}`)}>Delivery App</ActionButton>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 8 }}>
        {Object.entries(TAB_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return <button key={key} type="button" onClick={() => setTab(key)} style={{ flex: "0 0 auto", border: `1px solid ${tab === key ? "#111827" : "#e5e7eb"}`, background: tab === key ? "#111827" : "white", color: tab === key ? "white" : "#374151", borderRadius: 9, padding: "8px 10px", fontSize: 10, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}><Icon size={14} />{cfg.label}<span style={{ opacity: .7 }}>{counts[key] || 0}</span></button>;
        })}
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "white" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1050, fontSize: 10.5 }}>
          <thead><tr style={{ background: "#f8fafc", color: "#475569" }}>
            {tab === "DISPATCH" ? <th style={{ padding: 9, width: 36 }} /> : null}
            <th style={{ padding: 9, textAlign: "left" }}>Order</th><th style={{ padding: 9, textAlign: "left" }}>Date / Time</th><th style={{ padding: 9, textAlign: "left" }}>Customer</th><th style={{ padding: 9, textAlign: "right" }}>Amount</th><th style={{ padding: 9, textAlign: "center" }}>Qty O/P/I</th><th style={{ padding: 9, textAlign: "left" }}>Status</th><th style={{ padding: 9, textAlign: "left" }}>Invoice</th><th style={{ padding: 9, textAlign: "left" }}>Next Action</th><th style={{ padding: 9 }} /></tr></thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o._id} style={{ borderTop: "1px solid #f1f5f9" }}>
                {tab === "DISPATCH" ? <td style={{ padding: 9 }}><input type="checkbox" disabled={!["READY_FOR_DISPATCH", "INVOICED", "INVOICED_PARTIAL"].includes(upper(o.workflowStatus))} checked={selected.has(String(o._id))} onChange={() => toggleSelected(String(o._id))} /></td> : null}
                <td style={{ padding: 9 }}><button type="button" onClick={() => openDetail(o)} style={{ border: 0, background: "transparent", color: "#1d4ed8", fontWeight: 900, cursor: "pointer", padding: 0 }}>{o.orderNo}</button><div style={{ color: "#94a3b8", marginTop: 2 }}>{o.orderChannel || "DMS"}</div></td>
                <td style={{ padding: 9 }}>{dateTime(o.date || o.createdAt)}</td>
                <td style={{ padding: 9 }}><b>{o.customerNameSnapshot || "—"}</b></td>
                <td style={{ padding: 9, textAlign: "right", fontWeight: 800 }}>{money(o.grandTotal)}</td>
                <td style={{ padding: 9, textAlign: "center" }}>{Number(o.orderedQty || 0)} / {Number(o.packedQty || 0)} / {Number(o.invoicedQty || 0)}</td>
                <td style={{ padding: 9 }}><Pill status={o.workflowStatus} /></td>
                <td style={{ padding: 9 }}>{o.invoice?.invoiceNo || (o.invoices || []).map((x) => x.invoiceNo).filter(Boolean).join(", ") || "—"}</td>
                <td style={{ padding: 9 }}>{actionsFor(o)}</td>
                <td style={{ padding: 9, textAlign: "right" }}><ActionButton tone="soft" onClick={() => openDetail(o)}>Timeline</ActionButton></td>
              </tr>
            ))}
            {!filtered.length ? <tr><td colSpan={10} style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>{loading ? "Loading…" : "No orders in this queue"}</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><b style={{ fontSize: 12 }}>Delivery Runs</b><span style={{ fontSize: 10, color: "#6b7280" }}>{runs.length} recent run(s)</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 8 }}>
          {runs.slice(0, 6).map((r) => <button key={r._id} type="button" onClick={() => navigate(`/dms/dispatch?deliveryApp=1&runId=${encodeURIComponent(r._id)}&financialYear=${encodeURIComponent(fy)}`)} style={{ textAlign: "left", border: "1px solid #e5e7eb", background: "white", borderRadius: 10, padding: 11, cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between" }}><b>{r.runNo}</b><Pill status={r.status} /></div><div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>{r.deliveryBoyNameSnapshot || "Unassigned"} • {(r.stops || []).length} stops • {(Number(r.estimatedDistanceMeters || 0) / 1000).toFixed(1)} km</div></button>)}
        </div>
      </div>

      {tab === "RETURNS" && creditNotes.length ? <div style={{ marginTop: 16 }}><b style={{ fontSize: 12 }}>Credit Note Queue</b><div style={{ marginTop: 8, display: "grid", gap: 7 }}>{creditNotes.map((n) => <div key={n._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, border: "1px solid #e5e7eb", borderRadius: 9, padding: 10 }}><div><b>{n.creditNoteNo}</b><div style={{ fontSize: 10, color: "#64748b" }}>{n.invoiceNo} • {n.customerNameSnapshot} • {money(n.grandTotal)}</div></div>{n.status === "DRAFT" ? <ActionButton icon={CreditCard} tone="good" onClick={() => issueCreditNote(n)}>Issue Credit Note</ActionButton> : <Pill status={n.status} />}</div>)}</div></div> : null}

      {detail ? <Modal title={`Order ${detail.order?.orderNo || ""}`} onClose={() => setDetail(null)} width={860}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginBottom: 14 }}>
          {[['Customer', detail.order?.customerNameSnapshot], ['Status', upper(detail.order?.workflowStatus).replaceAll('_',' ')], ['Ordered', detail.order?.orderedQty], ['Packed', detail.order?.packedQty], ['Invoiced', detail.order?.invoicedQty], ['Amount', money(detail.order?.grandTotal)]].map(([k,v]) => <div key={k} style={{ background: "#f8fafc", borderRadius: 8, padding: 9 }}><div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>{k}</div><div style={{ marginTop: 4, fontSize: 12, fontWeight: 900 }}>{v ?? '—'}</div></div>)}
        </div>
        <b style={{ fontSize: 12 }}>Products</b>
        <div style={{ overflowX: "auto", marginTop: 6 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}><thead><tr style={{ background: "#f8fafc" }}><th style={{ padding: 7, textAlign: "left" }}>Product</th><th>Ordered</th><th>Reserved</th><th>Packed</th><th>Invoiced</th></tr></thead><tbody>{(detail.order?.items || []).map((x) => <tr key={x.productId} style={{ borderTop: "1px solid #eee" }}><td style={{ padding: 7 }}>{x.nameSnapshot}</td><td style={{ textAlign: "center" }}>{x.qty}</td><td style={{ textAlign: "center" }}>{x.reservedQty || 0}</td><td style={{ textAlign: "center" }}>{x.packedQty || 0}</td><td style={{ textAlign: "center" }}>{x.invoicedQty || 0}</td></tr>)}</tbody></table></div>
        <b style={{ display: "block", fontSize: 12, marginTop: 14 }}>Realtime Timeline</b>
        <div style={{ marginTop: 8, borderLeft: "2px solid #dbeafe", paddingLeft: 14 }}>{(detail.events || []).map((e) => <div key={e._id} style={{ position: "relative", paddingBottom: 13 }}><span style={{ position: "absolute", left: -20, top: 3, width: 10, height: 10, borderRadius: 999, background: "#2563eb", border: "2px solid white" }} /><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: 10 }}>{upper(e.toStatus || e.type).replaceAll('_',' ')}</b><span style={{ fontSize: 9, color: "#94a3b8" }}>{dateTime(e.occurredAt)}</span></div><div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>{e.note || e.type}</div><div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{e.actorNameSnapshot || "System"}</div></div>)}{!(detail.events || []).length ? <div style={{ fontSize: 10, color: "#94a3b8" }}>No lifecycle events recorded yet.</div> : null}</div>
      </Modal> : null}

      {packing ? <Modal title={`Complete Packing • ${packing.order.orderNo}`} onClose={() => setPacking(null)}>
        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 10 }}>Enter actual packed quantities. Invoice generation will use these quantities, not the original ordered quantities.</div>
        {(packing.items || []).map((x, i) => <div key={x.productId} style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr", gap: 8, alignItems: "end", borderBottom: "1px solid #f1f5f9", padding: "8px 0" }}><div><b style={{ fontSize: 11 }}>{x.name}</b><div style={{ fontSize: 9, color: "#64748b" }}>Ordered {x.orderedQty} • Reserved {x.reservedQty}</div></div><label style={{ fontSize: 9, fontWeight: 800 }}>Packed Qty<input type="number" min="0" max={x.reservedQty} step="any" value={x.packedQty} onChange={(e) => setPacking((old) => ({ ...old, items: old.items.map((row, index) => index === i ? { ...row, packedQty: e.target.value } : row) }))} style={{ display: "block", width: "100%", marginTop: 3, padding: 7, border: "1px solid #d1d5db", borderRadius: 6 }} /></label><label style={{ fontSize: 9, fontWeight: 800 }}>Shortage / Remark<input value={x.shortageReason} onChange={(e) => setPacking((old) => ({ ...old, items: old.items.map((row, index) => index === i ? { ...row, shortageReason: e.target.value } : row) }))} style={{ display: "block", width: "100%", marginTop: 3, padding: 7, border: "1px solid #d1d5db", borderRadius: 6 }} /></label></div>)}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}><label style={{ fontSize: 9, fontWeight: 800 }}>Packages<input type="number" min="0" value={packing.packageCount} onChange={(e) => setPacking((old) => ({ ...old, packageCount: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 3, padding: 8, border: "1px solid #d1d5db", borderRadius: 7 }} /></label><label style={{ fontSize: 9, fontWeight: 800 }}>Actual Weight<input type="number" min="0" step="any" value={packing.actualWeight} onChange={(e) => setPacking((old) => ({ ...old, actualWeight: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 3, padding: 8, border: "1px solid #d1d5db", borderRadius: 7 }} /></label></div>
        <label style={{ display: "block", fontSize: 9, fontWeight: 800, marginTop: 8 }}>Packing Remark<textarea value={packing.remarks} onChange={(e) => setPacking((old) => ({ ...old, remarks: e.target.value }))} rows={2} style={{ display: "block", width: "100%", marginTop: 3, padding: 8, border: "1px solid #d1d5db", borderRadius: 7 }} /></label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}><ActionButton tone="soft" onClick={() => setPacking(null)}>Cancel</ActionButton><ActionButton icon={PackageCheck} tone="good" onClick={savePacking}>Save Packed Qty</ActionButton></div>
      </Modal> : null}

      {dispatch ? <Modal title="Create Optimized Delivery Run" onClose={() => setDispatch(null)} width={560}>
        <div style={{ padding: 10, background: "#f8fafc", borderRadius: 8, fontSize: 10, marginBottom: 10 }}>{dispatch.orderIds.length} order(s) selected. The route will be sequenced from the current dispatch location using customer/transporter latitude and longitude.</div>
        <label style={{ display: "block", fontSize: 9, fontWeight: 800 }}>Delivery Boy<select value={dispatch.deliveryBoyId} onChange={(e) => setDispatch((old) => ({ ...old, deliveryBoyId: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: 8, border: "1px solid #d1d5db", borderRadius: 7 }}>{!deliveryBoys.length ? <option value="">No delivery-role users found</option> : null}{deliveryBoys.map((x) => <option key={x._id} value={x._id}>{x.name} {x.mobile ? `• ${x.mobile}` : ""}</option>)}</select></label>
        <label style={{ display: "block", fontSize: 9, fontWeight: 800, marginTop: 9 }}>Vehicle Number<input value={dispatch.vehicleNo} onChange={(e) => setDispatch((old) => ({ ...old, vehicleNo: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: 8, border: "1px solid #d1d5db", borderRadius: 7 }} /></label>
        <div style={{ marginTop: 9, fontSize: 10, color: "#475569" }}>Start GPS: {Number(dispatch.startLocation.lat).toFixed(6)}, {Number(dispatch.startLocation.lng).toFixed(6)}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><ActionButton tone="soft" onClick={() => setDispatch(null)}>Cancel</ActionButton><ActionButton icon={Route} tone="good" onClick={createRun}>Optimize & Assign</ActionButton></div>
      </Modal> : null}
    </div>
  );
}
