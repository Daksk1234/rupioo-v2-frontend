import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Cloud, CloudCog, RefreshCw, ShieldCheck, TriangleAlert, Unplug } from "lucide-react";
import { api, getUser } from "../lib/api.js";

const card = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
  background: "#fff",
  boxShadow: "0 8px 24px rgba(15,23,42,.05)",
};

const statusTone = (connected, status) => {
  if (connected) return { color: "#15803d", text: "CONNECTED" };
  if (status === "error") return { color: "#dc2626", text: "CONNECTION ERROR" };
  return { color: "#dc2626", text: "NOT CONNECTED" };
};

export default function StorageSettings() {
  const user = getUser() || {};
  const isMaster = String(user.role || "").toUpperCase() === "MASTER";
  const [tenantKey, setTenantKey] = useState(isMaster ? "" : String(user.tenantKey || ""));
  const [status, setStatus] = useState(null);
  const [consent, setConsent] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [oneDriveEmail, setOneDriveEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const tenantQuery = useMemo(() => {
    const value = String(tenantKey || "").trim();
    return value ? `?tenantKey=${encodeURIComponent(value)}` : "";
  }, [tenantKey]);

  const load = useCallback(async () => {
    if (isMaster && !String(tenantKey || "").trim()) {
      setStatus(null);
      return;
    }
    try {
      const result = await api(`/storage/status${tenantQuery}`);
      setStatus(result);
      if (result?.primary?.accountEmail) setGoogleEmail(result.primary.accountEmail);
      if (result?.backup?.accountEmail) setOneDriveEmail(result.backup.accountEmail);
      setError("");
    } catch (e) {
      setError(e.message || "Unable to read storage status");
    }
  }, [isMaster, tenantKey, tenantQuery]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15000);
    const onMessage = (event) => {
      if (event?.data?.type === "RUPIO_STORAGE_CONNECTED") {
        setMessage("Cloud connected successfully. Checking backup health…");
        window.setTimeout(load, 500);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("message", onMessage);
    };
  }, [load]);

  const startConnection = async (provider) => {
    setMessage("");
    setError("");
    if (!consent) {
      setError("Please accept the storage authorization checkbox first.");
      return;
    }
    if (isMaster && !String(tenantKey || "").trim()) {
      setError("Enter the target Superadmin tenant key first.");
      return;
    }

    const email = provider === "google" ? googleEmail.trim() : oneDriveEmail.trim();
    if (!email) {
      setError("Enter the cloud account email first.");
      return;
    }

    setBusy(provider);
    try {
      const params = new URLSearchParams({
        email,
        consentAccepted: "true",
        consentVersion: "2.0",
      });
      if (isMaster) params.set("tenantKey", tenantKey.trim());
      const result = await api(`/storage/${provider === "google" ? "google" : "onedrive"}/connect?${params.toString()}`);
      if (!result?.authUrl) throw new Error("Cloud provider did not return a connection URL");
      const popup = window.open(result.authUrl, `rupio-${provider}`, "width=720,height=820,resizable=yes,scrollbars=yes");
      if (!popup) throw new Error("Popup was blocked. Allow popups for Rupio V2 and click Connect again.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const testConnection = async (slot) => {
    setBusy(`test-${slot}`);
    setMessage("");
    setError("");
    try {
      const suffix = isMaster ? `?tenantKey=${encodeURIComponent(tenantKey.trim())}` : "";
      const result = await api(`/storage/test/${slot}${suffix}`, { method: "POST", body: JSON.stringify({}) });
      setMessage(result?.message || `${slot} cloud is healthy.`);
      await load();
    } catch (e) {
      setError(e.message);
      await load();
    } finally {
      setBusy("");
    }
  };

  const disconnect = async (slot, label) => {
    if (!window.confirm(`Disconnect ${label}? Existing cloud files will not be deleted.`)) return;
    setBusy(`disconnect-${slot}`);
    setMessage("");
    setError("");
    try {
      const suffix = isMaster ? `?tenantKey=${encodeURIComponent(tenantKey.trim())}` : "";
      await api(`/storage/disconnect/${slot}${suffix}`, { method: "POST", body: JSON.stringify({}) });
      setMessage(`${label} disconnected. Existing files remain in the provider.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const providerBox = ({ slot, provider, title, subtitle, email, setEmail, item }) => {
    const tone = statusTone(item?.connected, item?.status);
    const isGoogle = provider === "google";
    return (
      <section style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: isGoogle ? "#eff6ff" : "#ecfeff" }}>
              <Cloud size={21} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17 }}>{title}</h3>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{subtitle}</div>
            </div>
          </div>
          <strong style={{ color: tone.color, fontSize: 12 }}>● {tone.text}</strong>
        </div>

        <label style={{ display: "block", marginTop: 18, fontWeight: 700, fontSize: 12 }}>Cloud Account Email</label>
        <input
          type="email"
          value={email}
          disabled={Boolean(item?.connected)}
          placeholder={isGoogle ? "company@gmail.com" : "backup@outlook.com"}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", marginTop: 7, padding: "11px 12px", borderRadius: 10, border: "1px solid #cbd5e1", outline: "none" }}
        />
        <div style={{ marginTop: 7, color: "#64748b", fontSize: 11 }}>
          Password is never entered in Rupio. {isGoogle ? "Google" : "Microsoft"} opens its own secure login/OTP window.
        </div>

        {item?.lastError ? <div style={{ marginTop: 10, color: "#b91c1c", fontSize: 11 }}><b>Last error:</b> {item.lastError}</div> : null}

        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 16 }}>
          {!item?.connected ? (
            <button className="btn primary" type="button" disabled={Boolean(busy)} onClick={() => startConnection(provider)}>
              <CloudCog size={15} /> {busy === provider ? "Opening…" : isGoogle ? "Connect Google Drive" : "Connect Microsoft OneDrive"}
            </button>
          ) : (
            <>
              <button className="btn ghost" type="button" disabled={Boolean(busy)} onClick={() => testConnection(slot)}>
                <RefreshCw size={15} /> {busy === `test-${slot}` ? "Testing…" : "Test Connection"}
              </button>
              <button className="btn ghost" type="button" disabled={Boolean(busy)} onClick={() => disconnect(slot, isGoogle ? "Google Drive" : "Microsoft OneDrive")}>
                <Unplug size={15} /> Disconnect
              </button>
            </>
          )}
        </div>
      </section>
    );
  };

  const healthy = Boolean(status?.healthy);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gap: 16 }}>
      <section className="panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <CloudCog size={25} />
          <div>
            <h2 style={{ margin: 0 }}>Storage & Backup</h2>
            <div style={{ color: "#64748b", marginTop: 3, fontSize: 12 }}>
              Primary Google Drive + independent Microsoft OneDrive backup. Upload once; Rupio keeps both providers synchronized.
            </div>
          </div>
        </div>

        {isMaster ? (
          <div style={{ marginTop: 18 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 800 }}>Target Superadmin Tenant Key</label>
            <input
              value={tenantKey}
              onChange={(e) => setTenantKey(e.target.value)}
              placeholder="Enter company tenant key"
              style={{ width: "100%", marginTop: 7, padding: "11px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}
            />
            <button className="btn ghost" type="button" style={{ marginTop: 9 }} onClick={load}>Load Company Storage</button>
          </div>
        ) : (
          <div style={{ marginTop: 14, fontSize: 11, color: "#64748b" }}>Company storage key: <b>{tenantKey || "Unavailable"}</b></div>
        )}

        {message ? <div className="resultBanner good" style={{ marginTop: 14 }}>{message}</div> : null}
        {error ? <div className="resultBanner bad" style={{ marginTop: 14 }}>{error}</div> : null}

        <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: healthy ? "#f0fdf4" : "#fff7ed", display: "flex", gap: 10, alignItems: "center" }}>
          {healthy ? <CheckCircle2 size={20} color="#15803d" /> : <TriangleAlert size={20} color="#b45309" />}
          <div>
            <strong>{healthy ? "Backup healthy — both providers connected and synchronized" : "Backup attention required"}</strong>
            <div style={{ fontSize: 11, marginTop: 2 }}>Files waiting for dual-cloud backup: {Number(status?.pendingReplication || 0)}</div>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 16, cursor: "pointer", fontSize: 12 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
          <span><ShieldCheck size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />I authorise Rupio V2 to create/manage its business-storage folders in these two cloud accounts. Provider passwords are never stored by Rupio.</span>
        </label>
      </section>

      {providerBox({
        slot: "primary",
        provider: "google",
        title: "PRIMARY — Google Drive",
        subtitle: "Main private document and original-image copy.",
        email: googleEmail,
        setEmail: setGoogleEmail,
        item: status?.primary,
      })}

      {providerBox({
        slot: "backup",
        provider: "onedrive",
        title: "BACKUP — Microsoft OneDrive",
        subtitle: "Independent second provider used for automatic backup and failover.",
        email: oneDriveEmail,
        setEmail: setOneDriveEmail,
        item: status?.backup,
      })}

      <section className="panel" style={{ padding: 16, fontSize: 12, color: "#475569" }}>
        Product catalog thumbnails/app images remain in Rupio fast storage/cache so Customer App and Sales App can keep showing products during a temporary provider outage.
      </section>
    </div>
  );
}
