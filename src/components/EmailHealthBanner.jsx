import React, { useEffect, useMemo, useState } from "react";
import { getCurrentDatabase, getCurrentUser, getMailStatus } from "../services/smartMailApi";

export default function EmailHealthBanner({ settingsPath = "/app/settings/email-communication" }) {
  const user = useMemo(() => getCurrentUser(), []);
  const database = getCurrentDatabase();
  const role = String(user?.rolename?.roleName || user?.roleName || user?.role || "").toUpperCase();
  const canManage = role.includes("MASTER") || role.includes("SUPERADMIN") || role.includes("SUPER ADMIN") || role.includes("ADMIN");
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!database || !canManage) return undefined;
    let alive = true;
    const load = async () => {
      try { const res = await getMailStatus(database); if (alive) setState(res); }
      catch { if (alive) setState({ connected: false, pending: 0, failed: 0, connection: { status: "error" } }); }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, [database, canManage]);

  if (!canManage || !state) return null;
  const pending = Number(state.pending || 0);
  const failed = Number(state.failed || 0);
  const connected = Boolean(state.connected);
  if (connected && pending === 0 && failed === 0) return null;

  let bg = "#dc2626";
  let text = "COMPANY EMAIL DISCONNECTED — CLICK TO CONNECT / RECONNECT";
  if (connected && (pending > 0 || failed > 0)) {
    bg = "#d97706";
    text = `EMAIL ATTENTION — ${pending} PENDING${failed ? `, ${failed} FAILED` : ""} — CLICK TO VIEW`;
  } else if (!state.connection) {
    text = "COMPANY EMAIL NOT CONNECTED — CLICK TO CONNECT";
  }

  return (
    <div
      onClick={() => { window.location.href = settingsPath; }}
      style={{
        background: bg, color: "#fff", fontWeight: 800, textAlign: "center", padding: "7px 12px",
        cursor: "pointer", position: "relative", zIndex: 9999, animation: "rupioMailPulse 1.4s ease-in-out infinite",
      }}
    >
      {text}
      <style>{`@keyframes rupioMailPulse{0%,100%{opacity:1}50%{opacity:.72}}`}</style>
    </div>
  );
}
