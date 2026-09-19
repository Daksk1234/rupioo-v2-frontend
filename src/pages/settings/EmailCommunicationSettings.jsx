import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  beginMailConnect,
  connectSmtpMail,
  detectMailProvider,
  disconnectMail,
  getCurrentDatabase,
  getCurrentUser,
  getMailApiOrigin,
  getMailStatus,
  testMailConnection,
  updateMailSettings,
} from "../../services/smartMailApi";

const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, marginBottom: 16 };
const input = { width: "100%", height: 40, padding: "0 10px", border: "1px solid #d1d5db", borderRadius: 7, boxSizing: "border-box" };
const btn = (bg = "#2563eb") => ({ border: 0, background: bg, color: "#fff", minHeight: 38, padding: "0 15px", borderRadius: 7, cursor: "pointer", fontWeight: 700, marginRight: 8, marginBottom: 8 });
const label = { display: "block", fontSize: 12, color: "#475569", fontWeight: 700, marginBottom: 6 };

const providerName = (value) => ({ google: "Google / Gmail / Workspace", microsoft: "Microsoft / Outlook / 365", smtp: "Other Email (SMTP)" }[value] || "Not detected");

export default function EmailCommunicationSettings() {
  const database = getCurrentDatabase();
  const user = useMemo(() => getCurrentUser(), []);
  const [state, setState] = useState(null);
  const [email, setEmail] = useState(user?.email || "");
  const [provider, setProvider] = useState("");
  const [fromName, setFromName] = useState(user?.companyName || "");
  const [replyTo, setReplyTo] = useState("");
  const [signatureHtml, setSignatureHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [smtp, setSmtp] = useState({ host: "", port: 587, secure: false, username: "", password: "" });
  const [automation, setAutomation] = useState({
    invoiceAfterDelivery: false,
    receiptAfterPayment: false,
    reminderBeforeDueDays: 0,
    reminderOnDueDate: false,
    reminderEveryDaysAfterDue: 0,
  });

  const load = useCallback(async () => {
    if (!database) return;
    try {
      const res = await getMailStatus(database);
      setState(res);
      const c = res?.connection;
      if (c) {
        setEmail(c.email || email);
        setProvider(c.provider || "");
        setFromName(c.fromName || user?.companyName || "");
        setReplyTo(c.replyTo || "");
        setSignatureHtml(c.signatureHtml || "");
        setAutomation({
          invoiceAfterDelivery: Boolean(c?.automation?.invoiceAfterDelivery),
          receiptAfterPayment: Boolean(c?.automation?.receiptAfterPayment),
          reminderBeforeDueDays: Number(c?.automation?.reminderBeforeDueDays || 0),
          reminderOnDueDate: Boolean(c?.automation?.reminderOnDueDate),
          reminderEveryDaysAfterDue: Number(c?.automation?.reminderEveryDaysAfterDue || 0),
        });
      }
    } catch (e) {
      setMessage(e.message);
    }
  }, [database]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = (event) => {
      const allowedOrigins = new Set([window.location.origin, getMailApiOrigin()]);
      if (!allowedOrigins.has(event.origin)) return;
      if (event?.data?.type !== "rupio-mail-oauth") return;
      setMessage(event.data.ok ? "Email connected successfully." : event.data.message || "Connection failed");
      load();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [load]);

  const detect = async () => {
    setBusy(true); setMessage("");
    try {
      const res = await detectMailProvider(email);
      setProvider(res.provider);
      setMessage(`Provider detected: ${providerName(res.provider)}`);
      return res.provider;
    } catch (e) { setMessage(e.message); return ""; }
    finally { setBusy(false); }
  };

  const connect = async () => {
    if (!database) return setMessage("Company database is not selected.");
    setBusy(true); setMessage("");
    try {
      const detected = provider || (await detectMailProvider(email)).provider;
      setProvider(detected);
      if (detected === "smtp") {
        setMessage("This mailbox is not clearly Google or Microsoft. Use Other Email (SMTP) below.");
        return;
      }
      const res = await beginMailConnect(database, { email, provider: detected, fromName });
      const popup = window.open(res.authUrl, "rupio-mail-connect", "width=620,height=760,noopener=no");
      if (!popup) setMessage("Popup was blocked. Allow popups for Rupio and click Connect again.");
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };

  const connectSmtp = async () => {
    setBusy(true); setMessage("");
    try {
      await connectSmtpMail(database, { email, fromName, ...smtp });
      setMessage("Other email connected successfully.");
      await load();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setMessage("");
    try { const res = await testMailConnection(database); setMessage(res.message || "Test email queued/sent."); await load(); }
    catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!window.confirm("Disconnect this company email? Pending email will remain in the queue.")) return;
    setBusy(true);
    try { await disconnectMail(database); setMessage("Email disconnected."); await load(); }
    catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };

  const saveSettings = async () => {
    setBusy(true); setMessage("");
    try {
      await updateMailSettings(database, { fromName, replyTo, signatureHtml, automation });
      setMessage("Email settings saved.");
      await load();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };

  const connected = state?.connected;
  const c = state?.connection;

  return (
    <div style={{ padding: 18, maxWidth: 1050, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>Email & Communication</h2>
        <div style={{ color: "#64748b", marginTop: 5 }}>Connect the company mailbox once. Rupio will send invoices, ledgers, payment requests and other documents from this Superadmin's own mailbox.</div>
      </div>

      {message ? <div style={{ ...card, background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e3a8a" }}>{message}</div> : null}
      {c?.needsUpgrade ? <div style={{ ...card, background: "#fff7ed", borderColor: "#fdba74" }}><b>Legacy App Password connection detected.</b><br/>It will keep working. Enter the same email and click Connect to upgrade securely to OAuth.</div> : null}

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Company Sending Mailbox</h3>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px,2fr) minmax(220px,1fr)", gap: 14 }}>
          <div><label style={label}>Email Address</label><input style={input} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setProvider(""); }} placeholder="accounts@company.com" /></div>
          <div><label style={label}>Provider</label><div style={{ ...input, display: "flex", alignItems: "center", background: "#f8fafc" }}>{providerName(provider || c?.provider)}</div></div>
        </div>
        <div style={{ marginTop: 14 }}>
          <button style={btn()} disabled={busy || !email} onClick={connect}>{busy ? "Please wait..." : connected ? "RECONNECT / CHANGE EMAIL" : "CONNECT EMAIL"}</button>
          <button style={btn("#475569")} disabled={busy || !email} onClick={detect}>DETECT PROVIDER</button>
          {connected ? <><button style={btn("#059669")} disabled={busy} onClick={test}>SEND TEST EMAIL</button><button style={btn("#dc2626")} disabled={busy} onClick={disconnect}>DISCONNECT</button></> : null}
        </div>
        <div style={{ marginTop: 8, fontSize: 13 }}>
          Status: <b style={{ color: connected ? "#059669" : "#dc2626" }}>{connected ? "● CONNECTED" : `● ${String(c?.status || "NOT CONNECTED").toUpperCase()}`}</b>
          {c?.email ? <> &nbsp; • &nbsp; {c.email}</> : null}
          {state?.pending ? <> &nbsp; • &nbsp; Pending emails: <b>{state.pending}</b></> : null}
          {state?.failed ? <> &nbsp; • &nbsp; Failed: <b>{state.failed}</b></> : null}
        </div>
        {c?.lastError ? <div style={{ color: "#b91c1c", marginTop: 8 }}>Last error: {c.lastError}</div> : null}
      </div>

      {(provider === "smtp" || c?.provider === "smtp") && !connected ? (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Other Email / SMTP Fallback</h3>
          <div style={{ color: "#64748b", marginBottom: 12 }}>Use this only when the mailbox is not Google or Microsoft. Prefer an app password instead of the normal mailbox password.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(220px,1fr))", gap: 12 }}>
            <div><label style={label}>SMTP Host</label><input style={input} value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.yourprovider.com" /></div>
            <div><label style={label}>Port</label><input style={input} type="number" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })} /></div>
            <div><label style={label}>Username</label><input style={input} value={smtp.username} onChange={(e) => setSmtp({ ...smtp, username: e.target.value })} placeholder={email} /></div>
            <div><label style={label}>App Password</label><input style={input} type="password" value={smtp.password} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} /></div>
          </div>
          <label style={{ display: "block", margin: "12px 0" }}><input type="checkbox" checked={smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} /> Secure SSL/TLS</label>
          <button style={btn()} disabled={busy} onClick={connectSmtp}>CONNECT OTHER EMAIL</button>
        </div>
      ) : null}

      {connected ? (
        <>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Sender Settings</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(220px,1fr))", gap: 12 }}>
              <div><label style={label}>From Name</label><input style={input} value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="ABC Enterprises" /></div>
              <div><label style={label}>Reply-To (optional)</label><input style={input} type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder={email} /></div>
            </div>
            <div style={{ marginTop: 12 }}><label style={label}>Default Signature</label><textarea style={{ ...input, minHeight: 95, paddingTop: 10 }} value={signatureHtml} onChange={(e) => setSignatureHtml(e.target.value)} placeholder="For ABC Enterprises&#10;Accounts Department" /></div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Smart Mail Automation</h3>
            <label style={{ display: "block", marginBottom: 10 }}><input type="checkbox" checked={automation.invoiceAfterDelivery} onChange={(e) => setAutomation({ ...automation, invoiceAfterDelivery: e.target.checked })} /> Automatically email invoice after delivery confirmation</label>
            <label style={{ display: "block", marginBottom: 10 }}><input type="checkbox" checked={automation.receiptAfterPayment} onChange={(e) => setAutomation({ ...automation, receiptAfterPayment: e.target.checked })} /> Automatically email receipt after payment</label>
            <label style={{ display: "block", marginBottom: 10 }}><input type="checkbox" checked={automation.reminderOnDueDate} onChange={(e) => setAutomation({ ...automation, reminderOnDueDate: e.target.checked })} /> Payment reminder on due date</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(220px,1fr))", gap: 12 }}>
              <div><label style={label}>Reminder before due date (days, 0 = off)</label><input style={input} type="number" min="0" value={automation.reminderBeforeDueDays} onChange={(e) => setAutomation({ ...automation, reminderBeforeDueDays: Math.max(0, Number(e.target.value)) })} /></div>
              <div><label style={label}>Repeat after due date every (days, 0 = off)</label><input style={input} type="number" min="0" value={automation.reminderEveryDaysAfterDue} onChange={(e) => setAutomation({ ...automation, reminderEveryDaysAfterDue: Math.max(0, Number(e.target.value)) })} /></div>
            </div>
            <div style={{ marginTop: 14 }}><button style={btn()} disabled={busy} onClick={saveSettings}>SAVE EMAIL SETTINGS</button></div>
          </div>
        </>
      ) : null}
    </div>
  );
}
