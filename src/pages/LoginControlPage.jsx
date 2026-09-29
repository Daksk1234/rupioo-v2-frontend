import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Pencil,
  Power,
  RefreshCw,
  ShieldCheck,
  Warehouse,
  UsersRound,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api } from "../lib/api.js";

const dt = (value) => value ? new Date(value).toLocaleString() : "—";

export default function LoginControlPage() {
  const [items, setItems] = useState([]);
  const [syncInfo, setSyncInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const load = async () => {
    setBusy(true);
    setMessage("");
    try {
      const data = await api("/auth/login-control");
      setItems(data?.items || []);
      setSyncInfo(data?.sync || null);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => ({
    superadmin: items.filter((x) => x.scopeType === "SUPERADMIN"),
    warehouses: items.filter((x) => x.scopeType === "WAREHOUSE"),
    roles: items.filter((x) => x.scopeType === "ROLE"),
  }), [items]);

  const sync = async () => {
    setBusy(true);
    setMessage("");
    try {
      const data = await api("/auth/login-control/sync", { method: "POST", body: "{}" });
      setMessage(`Login sync complete: ${data.created || 0} created, ${data.personLoginsDisabled || 0} personal login(s) disabled.`);
      await load();
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
    }
  };

  const changeLoginId = async (row) => {
    const value = window.prompt("Enter new Login ID", row.loginId || "");
    if (!value || value === row.loginId) return;
    try {
      await api(`/auth/login-control/${row._id}/login-id`, {
        method: "PUT",
        body: JSON.stringify({ loginId: value }),
      });
      setMessage("Login ID updated.");
      await load();
    } catch (error) { setMessage(error.message); }
  };

  const changeRecoveryEmail = async (row) => {
    const value = window.prompt("Enter recovery/contact email", row.recoveryEmail || "");
    if (!value || value === row.recoveryEmail) return;
    try {
      await api(`/auth/login-control/${row._id}/recovery-email`, {
        method: "PUT",
        body: JSON.stringify({ email: value }),
      });
      setMessage(row.scopeType === "SUPERADMIN" ? "Superadmin login email updated." : "Recovery/contact email updated.");
      await load();
    } catch (error) { setMessage(error.message); }
  };

  const openPassword = (row) => {
    setEditing(row);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setMessage("");
  };

  const savePassword = async () => {
    if (!editing) return;
    if (password.length < 8) return setMessage("Password must contain at least 8 characters.");
    if (password !== confirmPassword) return setMessage("Password confirmation does not match.");
    setBusy(true);
    try {
      await api(`/auth/login-control/${editing._id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password, confirmPassword }),
      });
      setMessage(`Password changed for ${editing.scopeName}.`);
      setEditing(null);
      setPassword("");
      setConfirmPassword("");
      await load();
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
    }
  };

  const toggle = async (row) => {
    try {
      await api(`/auth/login-control/${row._id}/status`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !row.loginEnabled }),
      });
      await load();
    } catch (error) { setMessage(error.message); }
  };

  const LoginTable = ({ rows, icon: Icon, title, description }) => (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="formTitle">
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon size={18}/>{title}</h3>
          <span>{description}</span>
        </div>
        <span className="statusBadge">{rows.length} login(s)</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="dataTable" style={{ minWidth: 1220 }}>
          <thead><tr>
            <th>Function / Location</th><th>Login Identity</th><th>Recovery / Contact Email</th><th>Role</th><th>Password</th><th>Access</th><th>Last Login</th><th>Login Count</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row._id}>
              <td><b>{row.scopeName}</b><div className="mutedText">{row.scopeType === "WAREHOUSE" ? "Warehouse credential" : row.scopeType === "SUPERADMIN" ? "Company Superadmin credential" : "Role / department credential"}</div></td>
              <td>{row.scopeType === "SUPERADMIN" ? <><code>{row.loginEmail || row.recoveryEmail || "NOT SET"}</code> <button className="iconBtn" title="Change Superadmin login email" onClick={() => changeRecoveryEmail(row)}><Pencil size={13}/></button><div className="mutedText">Email + password</div></> : <><code>{row.loginId || "NOT SET"}</code> <button className="iconBtn" title="Change Login ID" onClick={() => changeLoginId(row)}><Pencil size={13}/></button><div className="mutedText">Functional Login ID + password</div></>}</td>
              <td>{row.scopeType === "SUPERADMIN" ? <><span>{row.loginEmail || row.recoveryEmail || "—"}</span><div className="mutedText">Same email is used for recovery</div></> : row.recoveryEmail ? <><span>{row.recoveryEmail}</span> <button className="iconBtn" title="Change recovery/contact email" onClick={() => changeRecoveryEmail(row)}><Pencil size={13}/></button><div className="mutedText">Contact/recovery only; not a sign-in identity</div></> : <button className="btn ghost" onClick={() => changeRecoveryEmail(row)}><Mail size={13}/>Set Contact Email</button>}</td>
              <td>{row.role || "—"}<div className="mutedText">{row.department || row.dataScope || ""}</div></td>
              <td><StatusBadge value={row.passwordConfigured ? "CONFIGURED" : "NOT SET"}/><div className="mutedText">Changed: {dt(row.passwordUpdatedAt)}</div></td>
              <td><StatusBadge value={row.loginEnabled ? "ACTIVE" : "INACTIVE"}/></td>
              <td>{dt(row.lastLoginAt)}</td>
              <td>{row.loginCount || 0}</td>
              <td><div className="rowActions">
                <button title="Set / Change Password" onClick={() => openPassword(row)}><KeyRound size={15}/></button>
                {row.scopeType !== "SUPERADMIN" && <button title={row.loginEnabled ? "Disable Login" : "Enable Login"} onClick={() => toggle(row)}><Power size={15}/></button>}
              </div></td>
            </tr>)}
            {!rows.length && <tr><td colSpan="9" className="mutedText">No matching login exists yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );

  return <>
    <PageHeader
      title="Login Control"
      description="Single credential-control page. Superadmin uses email + password; operational functions use Login ID + password."
    />
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="formTitle">
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={19}/>V2 Login Rule</h3>
          <span>Company Superadmin, every active Warehouse, and every active functional Role get controlled credentials. Employee/person records never authenticate.</span>
        </div>
        <button className="btn primary" onClick={sync} disabled={busy}><RefreshCw size={15}/>{busy ? "Syncing..." : "Sync Logins"}</button>
      </div>
      <div className="resultBanner good" style={{ marginTop: 10 }}>
        <b>MASTER/Superadmin use registered email + password. Functional Role/Warehouse accounts use Login ID + password.</b> Mobile, GSTIN, PAN, Aadhaar, employee ID, customer ID and person name are never accepted as login identities. Passwords are hashed and never displayed.
      </div>
      {syncInfo && <div className="mutedText" style={{ marginTop: 8 }}>
        Last sync: {syncInfo.roleLogins || 0} Role login(s), {syncInfo.warehouseLogins || 0} Warehouse login(s), {syncInfo.staleDisabled || 0} stale disabled.
      </div>}
    </section>

    {message && <div className={`resultBanner ${/error|invalid|required|cannot|must|failed/i.test(message) ? "bad" : "good"}`} style={{ marginBottom: 14 }}>{message}</div>}

    <LoginTable rows={grouped.superadmin} icon={Building2} title="Company Superadmin" description="Superadmin signs in with the registered email + password."/>
    <LoginTable rows={grouped.warehouses} icon={Warehouse} title="Warehouse Logins" description="Each active warehouse receives one independent functional Login ID and password."/>
    <LoginTable rows={grouped.roles} icon={UsersRound} title="Functional Role Logins" description="Sales, Accounts, Dispatch, Cashier, Order Desk and every other active Role use shared functional credentials instead of personal credentials."/>

    {editing && <div className="modalOverlay">
      <section className="panel modalPanel" style={{ maxWidth: 520 }}>
        <div className="formTitle"><div><h3>Set Password</h3><span>{editing.scopeName} • {editing.scopeType === "SUPERADMIN" ? (editing.loginEmail || editing.recoveryEmail) : editing.loginId}</span></div><button className="iconBtn" onClick={() => setEditing(null)}>×</button></div>
        <div className="formGrid" style={{ gridTemplateColumns: "1fr" }}>
          <label>New Password<div className="authInputWrap" style={{ marginTop: 5 }}><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus/><button type="button" className="passwordToggle" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>
          <label>Confirm Password<input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}/></label>
        </div>
        <div className="formActions"><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" onClick={savePassword} disabled={busy}><KeyRound size={15}/>Save Password</button></div>
      </section>
    </div>}
  </>;
}
