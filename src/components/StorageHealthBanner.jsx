import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getUser, token } from "../lib/api.js";

const PALETTE = {
  critical: { background: "#7f1d1d", color: "#fff" },
  danger: { background: "#dc2626", color: "#fff" },
  warning: { background: "#f59e0b", color: "#111827" },
};

export default function StorageHealthBanner() {
  const navigate = useNavigate();
  const user = getUser();
  const isSuperadmin = String(user?.role || "").toUpperCase() === "SUPERADMIN";
  const [health, setHealth] = useState(null);

  const load = useCallback(async () => {
    if (!isSuperadmin || !token()) return;
    try {
      setHealth(await api("/storage/health"));
    } catch {
      // Network/API warnings should not replace the entire application header.
    }
  }, [isSuperadmin]);

  useEffect(() => {
    load();
    if (!isSuperadmin) return undefined;
    const id = window.setInterval(load, 20000);
    return () => window.clearInterval(id);
  }, [load, isSuperadmin]);

  if (!isSuperadmin || !health || health.severity === "healthy") return null;
  const palette = PALETTE[health.severity] || PALETTE.warning;

  return (
    <>
      <style>{`@keyframes rupioStoragePulse{0%,100%{opacity:1}50%{opacity:.58}}`}</style>
      <button
        type="button"
        onClick={() => navigate("/storage-settings")}
        title="Open Storage & Backup"
        style={{
          width: "100%",
          border: 0,
          padding: "7px 12px",
          cursor: "pointer",
          textAlign: "center",
          fontWeight: 900,
          fontSize: 12,
          letterSpacing: ".2px",
          animation: "rupioStoragePulse 1.15s ease-in-out infinite",
          ...palette,
        }}
      >
        ⚠ {health.message}
        {health.pendingReplication > 0 ? ` • Pending backup: ${health.pendingReplication}` : ""}
        {" • CLICK TO OPEN STORAGE"}
      </button>
    </>
  );
}
