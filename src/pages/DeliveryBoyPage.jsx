import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, CheckCircle2, LocateFixed, MapPin, Navigation, PackageCheck, Phone, RefreshCw, RotateCcw, Truck, XCircle } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { api, getUser } from "../lib/api.js";
import { currentFinancialYear, financialYearOptions } from "../lib/financialYear.js";

const upper = (v) => String(v || "").trim().toUpperCase();
const doneStatuses = new Set(["DELIVERED", "HANDED_TO_TRANSPORTER", "RETURNED_TO_WAREHOUSE", "SKIPPED"]);
const dateTime = (v) => v ? new Date(v).toLocaleString("en-IN") : "—";
const getPos = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) return reject(new Error("GPS is not available on this device"));
  navigator.geolocation.getCurrentPosition(
    (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
    () => reject(new Error("Allow location permission to continue")),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
  );
});

function Btn({ children, onClick, disabled, tone = "dark", icon: Icon }) {
  const tones = {
    dark: ["#111827", "white"], green: ["#047857", "white"], blue: ["#1d4ed8", "white"], orange: ["#fff7ed", "#9a3412"], red: ["#fef2f2", "#b91c1c"], soft: ["white", "#111827"],
  };
  const [bg, fg] = tones[tone] || tones.dark;
  return <button type="button" disabled={disabled} onClick={onClick} style={{ border: `1px solid ${disabled ? "#e5e7eb" : bg === "white" ? "#d1d5db" : bg}`, background: disabled ? "#f3f4f6" : bg, color: disabled ? "#9ca3af" : fg, borderRadius: 9, padding: "9px 11px", fontSize: 11, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: disabled ? "not-allowed" : "pointer" }}>{Icon ? <Icon size={15} /> : null}{children}</button>;
}

function Modal({ title, onClose, children }) {
  return <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,.55)", padding: 16, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: "100%", maxWidth: 620, maxHeight: "92vh", overflow: "auto", background: "white", borderRadius: 15 }}><div style={{ position: "sticky", top: 0, background: "white", zIndex: 2, padding: 14, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}><b>{title}</b><button type="button" onClick={onClose} style={{ border: 0, background: "none", cursor: "pointer" }}>✕</button></div><div style={{ padding: 14 }}>{children}</div></div></div>;
}

function Field({ label, children }) { return <label style={{ display: "block", fontSize: 10, fontWeight: 900, marginTop: 9 }}>{label}{children}</label>; }
const inputStyle = { display: "block", width: "100%", boxSizing: "border-box", padding: 9, marginTop: 4, border: "1px solid #d1d5db", borderRadius: 8, fontSize: 12 };

export default function DeliveryBoyPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const user = getUser() || {};
  const userId = String(user._id || user.id || user.userId || "");
  const admin = ["MASTER", "SUPERADMIN"].includes(upper(user.role));
  const [fy, setFy] = useState(params.get("financialYear") || currentFinancialYear());
  const [runs, setRuns] = useState([]);
  const [run, setRun] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [handover, setHandover] = useState(null);
  const [returning, setReturning] = useState(null);
  const locationSentAt = useRef(0);

  const runId = params.get("runId") || "";
  const load = useCallback(async (silent = false) => {
    if (!silent) setBusy(true);
    try {
      const q = new URLSearchParams({ financialYear: fy });
      if (!admin && userId) q.set("deliveryBoyId", userId);
      const list = await api(`/sales-app/order-flow/delivery-runs?${q.toString()}`);
      setRuns(list?.items || []);
      const selectedId = runId || list?.items?.find((x) => ["PLANNED", "IN_PROGRESS"].includes(x.status))?._id || "";
      if (selectedId) {
        const detail = await api(`/sales-app/order-flow/delivery-runs/${selectedId}?financialYear=${encodeURIComponent(fy)}`);
        setRun(detail);
        if (!runId && detail?._id) setParams({ deliveryApp: "1", financialYear: fy, runId: detail._id }, { replace: true });
      } else setRun(null);
    } catch (e) { if (!silent) setMsg(e.message); }
    finally { if (!silent) setBusy(false); }
  }, [admin, fy, runId, setParams, userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = window.setInterval(() => load(true), 7000); return () => window.clearInterval(t); }, [load]);

  useEffect(() => {
    if (!run?._id || run.status !== "IN_PROGRESS" || !navigator.geolocation) return undefined;
    const watch = navigator.geolocation.watchPosition((p) => {
      const now = Date.now();
      if (now - locationSentAt.current < 12000) return;
      locationSentAt.current = now;
      api(`/sales-app/order-flow/delivery-runs/${run._id}/location?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }) }).catch(() => {});
    }, () => {}, { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [fy, run?._id, run?.status]);

  const openStops = useMemo(() => [...(run?.stops || [])].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0)), [run]);
  const currentStop = openStops.find((x) => !doneStatuses.has(x.status) && x.status !== "RETURN_IN_TRANSIT")
    || openStops.find((x) => x.status === "RETURN_IN_TRANSIT")
    || null;
  const completed = openStops.filter((x) => doneStatuses.has(x.status)).length;

  const doAction = async (fn, okText) => {
    setBusy(true); setMsg("");
    try { await fn(); setMsg(okText); await load(true); }
    catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const start = () => doAction(async () => {
    const pos = await getPos();
    await api(`/sales-app/order-flow/delivery-runs/${run._id}/location?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify(pos) });
    await api(`/sales-app/order-flow/delivery-runs/${run._id}/start?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: "{}" });
  }, "Delivery run started. Live location tracking is active.");

  const reoptimize = () => doAction(async () => {
    const pos = await getPos();
    await api(`/sales-app/order-flow/delivery-runs/${run._id}/reoptimize?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify(pos) });
  }, "Remaining stops re-optimized from your current location.");

  const arrive = (stop) => doAction(async () => {
    const pos = await getPos();
    await api(`/sales-app/order-flow/delivery-runs/${run._id}/stops/${stop.stopId}/arrive?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify(pos) });
  }, "Arrival verified by GPS.");

  const customerDeliver = (stop) => doAction(async () => {
    const otp = await api(`/sales-app/order-flow/delivery-runs/${run._id}/stops/${stop.stopId}/otp?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify({ action: "CUSTOMER_DELIVERY" }) });
    const code = window.prompt(`Enter customer delivery OTP.${otp?.devCode ? `\nDevelopment OTP: ${otp.devCode}` : ""}`);
    if (!code) throw new Error("Customer OTP is required");
    await api(`/sales-app/order-flow/delivery-runs/${run._id}/stops/${stop.stopId}/complete?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify({ otpId: otp.otpId, code }) });
  }, "Customer delivery completed and invoice marked delivered.");

  const failStop = (stop) => doAction(async () => {
    const reason = window.prompt("Delivery failure reason (shop closed / customer unavailable / refused / payment issue / address problem / other):");
    if (!reason) throw new Error("Failure reason is required");
    const otp = await api(`/sales-app/order-flow/delivery-runs/${run._id}/stops/${stop.stopId}/otp?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify({ action: "SALESPERSON_CANCEL" }) });
    const code = window.prompt(`Enter salesperson cancellation OTP.${otp?.devCode ? `\nDevelopment OTP: ${otp.devCode}` : ""}`);
    if (!code) throw new Error("Salesperson OTP is required");
    const retry = window.confirm("Press OK to keep this delivery for RETRY. Press Cancel to cancel delivery and return goods to warehouse.");
    await api(`/sales-app/order-flow/delivery-runs/${run._id}/stops/${stop.stopId}/fail?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify({ otpId: otp.otpId, code, reason, cancelAndReturn: !retry }) });
  }, "Delivery failure recorded with salesperson OTP.");

  const openReturn = async (stop) => {
    setBusy(true); setMsg("");
    try {
      const [orderData, warehouseData] = await Promise.all([
        api(`/sales-app/order-flow/orders/${stop.orderId}?financialYear=${encodeURIComponent(fy)}`),
        api(`/sales-app/order-flow/warehouse-users?warehouseId=${encodeURIComponent(stop.warehouseId || "")}`).catch(() => ({ items: [] })),
      ]);
      const items = (orderData?.order?.items || []).map((x) => ({ productId: x.productId, name: x.nameSnapshot || x.sku, max: Number(x.invoicedQty || x.packedQty || x.qty || 0), qty: Number(x.invoicedQty || x.packedQty || x.qty || 0), condition: "SALEABLE" }));
      setReturning({ stop, warehouseUsers: warehouseData?.items || [], warehouseRecipientId: warehouseData?.items?.[0]?._id || "", items, remarks: "" });
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const saveReturn = () => doAction(async () => {
    if (!returning.warehouseRecipientId) throw new Error("Select the warehouse receiver");
    const otp = await api(`/sales-app/order-flow/delivery-runs/${run._id}/stops/${returning.stop.stopId}/otp?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify({ action: "WAREHOUSE_RETURN", warehouseRecipientId: returning.warehouseRecipientId }) });
    const code = window.prompt(`Ask the warehouse receiver for the handover OTP and enter it here.${otp?.devCode ? `\nDevelopment OTP: ${otp.devCode}` : ""}`);
    if (!code) throw new Error("Warehouse OTP is required");
    await api(`/sales-app/order-flow/delivery-runs/${run._id}/stops/${returning.stop.stopId}/return-to-warehouse?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify({ otpId: otp.otpId, code, remarks: returning.remarks, items: returning.items.map((x) => ({ productId: x.productId, qty: Number(x.qty || 0), condition: x.condition })) }) });
    setReturning(null);
  }, "Warehouse handover verified. Credit note draft created for Order Desk.");

  const completeTransporter = () => doAction(async () => {
    if (!handover.cnNo) throw new Error("CN / LR / Bilty number is required");
    if (!handover.file) throw new Error("CN / LR / Bilty copy image is mandatory");
    const fd = new FormData(); fd.append("file", handover.file); fd.append("module", "DMS"); fd.append("entityType", "TRANSPORT_CN"); fd.append("entityId", handover.stop.invoiceId || handover.stop.orderId); fd.append("access", "PRIVATE");
    const uploaded = await api("/files/upload", { method: "POST", body: fd });
    await api(`/sales-app/order-flow/delivery-runs/${run._id}/stops/${handover.stop.stopId}/complete?financialYear=${encodeURIComponent(fy)}`, { method: "POST", body: JSON.stringify({ cnNo: handover.cnNo, cnDate: handover.cnDate, packages: Number(handover.packages || 0), weight: Number(handover.weight || 0), freightAmount: Number(handover.freightAmount || 0), freightMode: handover.freightMode, contactPerson: handover.contactPerson, mobile: handover.mobile, vehicleNo: handover.vehicleNo, destination: handover.destination, proofFileId: uploaded.fileId }) });
    setHandover(null);
  }, "Transporter handover completed. Customer and salesperson alerts were queued immediately.");

  if (!run) {
    return <div><PageHeader title="Delivery App" description="Assigned runs • GPS optimized sequence • OTP proof of delivery" actions={false}/>{msg ? <div className="resultBanner">{msg}</div> : null}<section className="panel editorPanel"><div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}><Field label="Financial Year"><select value={fy} onChange={(e) => { setFy(e.target.value); setParams({ deliveryApp: "1", financialYear: e.target.value }); }} style={inputStyle}>{financialYearOptions(user, { count: 8, extra: [fy] }).map((x) => <option key={x} value={x}>{x}</option>)}</select></Field><Btn icon={RefreshCw} tone="soft" onClick={() => load()} disabled={busy}>Refresh</Btn><Btn tone="soft" onClick={() => navigate("/dms/dispatch")}>Back to Dispatch</Btn></div><div style={{ display: "grid", gap: 9, marginTop: 14 }}>{runs.map((r) => <button key={r._id} type="button" onClick={() => setParams({ deliveryApp: "1", financialYear: fy, runId: r._id })} style={{ border: "1px solid #e5e7eb", borderRadius: 11, background: "white", padding: 13, textAlign: "left", cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{r.runNo}</b><b style={{ fontSize: 10 }}>{r.status}</b></div><div style={{ fontSize: 10, color: "#64748b", marginTop: 5 }}>{r.deliveryBoyNameSnapshot} • {(r.stops || []).length} stops • {(Number(r.estimatedDistanceMeters || 0) / 1000).toFixed(1)} km</div></button>)}{!runs.length ? <div style={{ color: "#94a3b8", fontSize: 12, padding: 20, textAlign: "center" }}>{busy ? "Loading…" : "No delivery runs assigned"}</div> : null}</div></section></div>;
  }

  return <div>
    <PageHeader title={`Delivery App • ${run.runNo}`} description={`${run.deliveryBoyNameSnapshot || "Delivery Boy"} • ${completed}/${openStops.length} completed • Route v${run.routeVersion || 1}`} actions={false}/>
    {msg ? <div className="resultBanner">{msg}</div> : null}
    <section className="panel editorPanel" style={{ padding: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "space-between", alignItems: "center" }}><div><b style={{ fontSize: 13 }}>{run.status.replaceAll("_", " ")}</b><div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>{(Number(run.estimatedDistanceMeters || 0) / 1000).toFixed(1)} km planned • ~{run.estimatedTravelMinutes || 0} min driving • Vehicle {run.vehicleNo || "—"}</div></div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{run.status === "PLANNED" ? <Btn icon={Navigation} tone="green" onClick={start} disabled={busy}>Start Run</Btn> : null}{run.status === "IN_PROGRESS" ? <Btn icon={RefreshCw} tone="blue" onClick={reoptimize} disabled={busy}>Re-optimize Remaining</Btn> : null}<Btn tone="soft" onClick={() => setParams({ deliveryApp: "1", financialYear: fy })}>Runs</Btn><Btn tone="soft" onClick={() => navigate("/dms/dispatch")}>Dispatch Desk</Btn></div></div>
      {currentStop ? <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe" }}><div style={{ fontSize: 9, textTransform: "uppercase", color: "#1d4ed8", fontWeight: 900 }}>NEXT DELIVERY • STOP {currentStop.sequence}</div><div style={{ marginTop: 4, fontSize: 15, fontWeight: 950 }}>{currentStop.destinationNameSnapshot}</div><div style={{ marginTop: 3, fontSize: 11, color: "#475569" }}>{currentStop.addressSnapshot} {currentStop.citySnapshot} {currentStop.pincodeSnapshot}</div><div style={{ marginTop: 5, fontSize: 10, color: "#64748b" }}>{currentStop.destinationType === "TRANSPORTER" ? `For customer: ${currentStop.customerNameSnapshot} • Transporter handover` : `Customer: ${currentStop.customerNameSnapshot}`} • Invoice {currentStop.invoiceNo} • {currentStop.packageCount || 0} package(s)</div></div> : null}
      <div style={{ display: "grid", gap: 9, marginTop: 12 }}>{openStops.map((stop) => {
        const isCurrent = currentStop?.stopId === stop.stopId;
        const isDone = doneStatuses.has(stop.status);
        return <div key={stop.stopId} style={{ border: `1px solid ${isCurrent ? "#60a5fa" : "#e5e7eb"}`, borderRadius: 12, padding: 12, opacity: isDone ? .72 : 1, background: isCurrent ? "#f8fbff" : "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><b style={{ fontSize: 12 }}>#{stop.sequence} {stop.destinationNameSnapshot}</b><div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{stop.destinationType} • {stop.invoiceNo} • ETA {stop.estimatedArrivalAt ? new Date(stop.estimatedArrivalAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</div></div><span style={{ fontSize: 9, fontWeight: 900 }}>{stop.status.replaceAll("_", " ")}</span></div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 7 }}>{stop.addressSnapshot} {stop.citySnapshot} {stop.pincodeSnapshot}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
            {!isDone && isCurrent ? <Btn icon={Navigation} tone="blue" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.location?.lat},${stop.location?.lng}`)}`, "_blank")}>Navigate</Btn> : null}
            {stop.mobileSnapshot ? <Btn icon={Phone} tone="soft" onClick={() => { window.location.href = `tel:${stop.mobileSnapshot}`; }}>Call</Btn> : null}
            {!isDone && isCurrent && stop.status !== "ARRIVED" ? <Btn icon={LocateFixed} tone="green" onClick={() => arrive(stop)} disabled={busy}>I Have Arrived</Btn> : null}
            {!isDone && isCurrent && stop.status === "ARRIVED" && stop.destinationType === "CUSTOMER" ? <Btn icon={CheckCircle2} tone="green" onClick={() => customerDeliver(stop)} disabled={busy}>Customer OTP & Deliver</Btn> : null}
            {!isDone && isCurrent && stop.status === "ARRIVED" && stop.destinationType === "TRANSPORTER" ? <Btn icon={Camera} tone="green" onClick={() => setHandover({ stop, cnNo: "", cnDate: new Date().toISOString().slice(0,10), packages: stop.packageCount || "", weight: stop.actualWeight || "", freightAmount: "", freightMode: "TO_PAY", contactPerson: "", mobile: "", vehicleNo: "", destination: stop.citySnapshot || "", file: null })}>Enter CN + Photo</Btn> : null}
            {!isDone && isCurrent && ["PENDING", "STARTED", "ARRIVED", "FAILED"].includes(stop.status) ? <Btn icon={XCircle} tone="red" onClick={() => failStop(stop)} disabled={busy}>Delivery Failed</Btn> : null}
            {stop.status === "RETURN_IN_TRANSIT" ? <Btn icon={RotateCcw} tone="orange" onClick={() => openReturn(stop)} disabled={busy}>Hand Back to Warehouse</Btn> : null}
          </div>
          {stop.transporterHandover?.cnNo ? <div style={{ fontSize: 9, marginTop: 7, color: "#0f766e" }}>CN {stop.transporterHandover.cnNo} • {dateTime(stop.transporterHandover.capturedAt)} • Proof saved</div> : null}
        </div>;
      })}</div>
    </section>

    {handover ? <Modal title={`Transporter Handover • ${handover.stop.invoiceNo}`} onClose={() => setHandover(null)}><div style={{ padding: 9, background: "#f0fdfa", borderRadius: 8, fontSize: 10 }}>Destination: <b>{handover.stop.transporterNameSnapshot}</b> • Customer: {handover.stop.customerNameSnapshot}. This will be marked successful only after CN details and CN image are saved.</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}><Field label="CN / LR / Bilty No"><input value={handover.cnNo} onChange={(e) => setHandover({ ...handover, cnNo: e.target.value })} style={inputStyle}/></Field><Field label="CN Date"><input type="date" value={handover.cnDate} onChange={(e) => setHandover({ ...handover, cnDate: e.target.value })} style={inputStyle}/></Field><Field label="Packages"><input type="number" min="0" value={handover.packages} onChange={(e) => setHandover({ ...handover, packages: e.target.value })} style={inputStyle}/></Field><Field label="Weight"><input type="number" min="0" step="any" value={handover.weight} onChange={(e) => setHandover({ ...handover, weight: e.target.value })} style={inputStyle}/></Field><Field label="Freight"><input type="number" min="0" step="any" value={handover.freightAmount} onChange={(e) => setHandover({ ...handover, freightAmount: e.target.value })} style={inputStyle}/></Field><Field label="Freight Mode"><select value={handover.freightMode} onChange={(e) => setHandover({ ...handover, freightMode: e.target.value })} style={inputStyle}><option>TO_PAY</option><option>PAID</option><option>BILLING</option></select></Field><Field label="Transporter Contact"><input value={handover.contactPerson} onChange={(e) => setHandover({ ...handover, contactPerson: e.target.value })} style={inputStyle}/></Field><Field label="Mobile"><input value={handover.mobile} onChange={(e) => setHandover({ ...handover, mobile: e.target.value })} style={inputStyle}/></Field><Field label="Vehicle No"><input value={handover.vehicleNo} onChange={(e) => setHandover({ ...handover, vehicleNo: e.target.value })} style={inputStyle}/></Field><Field label="Destination on CN"><input value={handover.destination} onChange={(e) => setHandover({ ...handover, destination: e.target.value })} style={inputStyle}/></Field></div><Field label="CN / LR / Bilty Copy Image (mandatory)"><input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setHandover({ ...handover, file: e.target.files?.[0] || null })} style={inputStyle}/></Field><div style={{ display: "flex", justifyContent: "flex-end", gap: 7, marginTop: 14 }}><Btn tone="soft" onClick={() => setHandover(null)}>Cancel</Btn><Btn icon={PackageCheck} tone="green" onClick={completeTransporter} disabled={busy}>Confirm Transporter Handover</Btn></div></Modal> : null}

    {returning ? <Modal title={`Warehouse Return • ${returning.stop.invoiceNo}`} onClose={() => setReturning(null)}><div style={{ fontSize: 10, color: "#64748b" }}>The warehouse receiver must provide the internal OTP. Saleable quantity is returned to stock; other conditions stay in the return record. A credit-note draft is created immediately.</div><Field label="Warehouse Receiver"><select value={returning.warehouseRecipientId} onChange={(e) => setReturning({ ...returning, warehouseRecipientId: e.target.value })} style={inputStyle}><option value="">Select receiver</option>{returning.warehouseUsers.map((x) => <option key={x._id} value={x._id}>{x.name} {x.designation ? `• ${x.designation}` : ""}</option>)}</select></Field><div style={{ marginTop: 10 }}>{returning.items.map((x, i) => <div key={x.productId} style={{ display: "grid", gridTemplateColumns: "1fr 90px 120px", gap: 7, alignItems: "end", padding: "7px 0", borderTop: "1px solid #f1f5f9" }}><div><b style={{ fontSize: 10 }}>{x.name}</b><div style={{ fontSize: 9, color: "#94a3b8" }}>Max {x.max}</div></div><Field label="Qty"><input type="number" min="0" max={x.max} step="any" value={x.qty} onChange={(e) => setReturning((old) => ({ ...old, items: old.items.map((r, n) => n === i ? { ...r, qty: e.target.value } : r) }))} style={inputStyle}/></Field><Field label="Condition"><select value={x.condition} onChange={(e) => setReturning((old) => ({ ...old, items: old.items.map((r, n) => n === i ? { ...r, condition: e.target.value } : r) }))} style={inputStyle}><option>SALEABLE</option><option>DAMAGED</option><option>OPENED</option><option>SHORT</option><option>QUARANTINE</option></select></Field></div>)}</div><Field label="Warehouse Return Remark"><textarea rows={2} value={returning.remarks} onChange={(e) => setReturning({ ...returning, remarks: e.target.value })} style={inputStyle}/></Field><div style={{ display: "flex", justifyContent: "flex-end", gap: 7, marginTop: 14 }}><Btn tone="soft" onClick={() => setReturning(null)}>Cancel</Btn><Btn icon={Truck} tone="green" onClick={saveReturn} disabled={busy}>Warehouse OTP & Receive</Btn></div></Modal> : null}
  </div>;
}
