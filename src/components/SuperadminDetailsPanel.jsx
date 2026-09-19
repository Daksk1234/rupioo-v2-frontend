import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  Ban,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  History,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { api } from "../lib/api.js";
import "../superadmin-details.css";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const fmtDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const fmtDateTime = (value) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const statusTone = (status) => {
  const value = String(status || "").toUpperCase();
  if (["ACTIVE", "PAID", "MANUAL_PAID", "FREE"].includes(value)) return "good";
  if (["EXPIRING", "PENDING", "ORDER_CREATED"].includes(value)) return "warn";
  if (["EXPIRED", "SUSPENDED", "DELETED", "FAILED", "CANCELLED"].includes(value)) return "bad";
  return "neutral";
};

const cleanYears = (value) =>
  Array.from(
    new Set(
      String(value || "")
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

export default function SuperadminDetailsPanel({
  superadminId,
  plans = [],
  onClose,
  onChanged,
  notify,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [renewForm, setRenewForm] = useState({
    planCode: "",
    billingCycle: "YEARLY",
    periods: 1,
    paymentNote: "",
  });

  const load = async () => {
    if (!superadminId) return;
    setLoading(true);
    try {
      const result = await api(`/access/superadmins/${superadminId}`);
      setDetail(result);
      const profile = result.companyProfile || {};
      setEditForm({
        companyName: profile.companyName || "",
        tradeName: profile.tradeName || "",
        mobile: profile.mobile || "",
        email: profile.email || result.user?.email || "",
        registeredAddress: profile.registeredAddress || "",
        pincode: profile.pincode || "",
        city: profile.city || "",
        state: profile.state || "",
        financialYear: profile.financialYear || "",
        financialYears: (profile.financialYears || []).join(", "),
        hasMultipleBranches: Boolean(profile.hasMultipleBranches),
        branchCount: Number(profile.branchCount || 1),
        autoRenew: Boolean(profile.autoRenew),
        graceDays: Number(profile.graceDays || 0),
      });
      setRenewForm({
        planCode: profile.planCode || result.plan?.code || "",
        billingCycle: profile.billingCycle || "YEARLY",
        periods: 1,
        paymentNote: "",
      });
    } catch (error) {
      notify?.(error.message, "bad");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTab("overview");
    setEditing(false);
    setRenewing(false);
    load();
  }, [superadminId]);

  const plan = useMemo(
    () => plans.find((item) => item.code === renewForm.planCode),
    [plans, renewForm.planCode],
  );

  const renewalAmount = useMemo(() => {
    const one = renewForm.billingCycle === "MONTHLY"
      ? Number(plan?.monthlyAmount || 0)
      : Number(plan?.yearlyAmount || 0);
    return one * Math.max(1, Number(renewForm.periods || 1));
  }, [plan, renewForm.billingCycle, renewForm.periods]);

  if (!superadminId) return null;

  const profile = detail?.companyProfile || {};
  const user = detail?.user || {};
  const subscription = detail?.subscription || {};
  const payments = detail?.payments || [];
  const stats = detail?.stats || {};
  const isDeleted = String(profile.status || "").toUpperCase() === "DELETED";
  const isSuspended = String(profile.status || "").toUpperCase() === "SUSPENDED";

  const saveEdit = async () => {
    setWorking(true);
    try {
      await api(`/access/superadmins/${superadminId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...editForm,
          financialYears: cleanYears(editForm.financialYears),
          branchCount: Number(editForm.branchCount || 1),
          graceDays: Number(editForm.graceDays || 0),
        }),
      });
      notify?.("Superadmin company details updated");
      setEditing(false);
      await load();
      await onChanged?.();
    } catch (error) {
      notify?.(error.message, "bad");
    } finally {
      setWorking(false);
    }
  };

  const renew = async () => {
    setWorking(true);
    try {
      await api(`/access/superadmins/${superadminId}/renew`, {
        method: "POST",
        body: JSON.stringify({
          ...renewForm,
          periods: Number(renewForm.periods || 1),
        }),
      });
      notify?.("Plan renewed successfully");
      setRenewing(false);
      await load();
      await onChanged?.();
    } catch (error) {
      notify?.(error.message, "bad");
    } finally {
      setWorking(false);
    }
  };

  const setCompanyStatus = async (status) => {
    setWorking(true);
    try {
      await api(`/access/superadmins/${superadminId}/company-status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      notify?.(status === "ACTIVE" ? "Company activated" : "Company suspended");
      await load();
      await onChanged?.();
    } catch (error) {
      notify?.(error.message, "bad");
    } finally {
      setWorking(false);
    }
  };

  const resetPassword = async () => {
    const password = window.prompt("Enter a new password (minimum 8 characters)");
    if (!password) return;
    setWorking(true);
    try {
      await api(`/access/users/${superadminId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      notify?.("Password reset successfully");
    } catch (error) {
      notify?.(error.message, "bad");
    } finally {
      setWorking(false);
    }
  };

  const removeCompany = async () => {
    const confirmation = window.prompt(
      `Type DELETE to remove ${profile.companyName || "this company"} from active use. Data will be retained for audit/recovery.`,
    );
    if (confirmation !== "DELETE") return;
    const reason = window.prompt("Reason for deletion", "Deleted by MASTER") || "Deleted by MASTER";
    setWorking(true);
    try {
      await api(`/access/superadmins/${superadminId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      notify?.("Company deleted. Historical data has been retained.");
      await load();
      await onChanged?.();
    } catch (error) {
      notify?.(error.message, "bad");
    } finally {
      setWorking(false);
    }
  };

  const restoreCompany = async () => {
    setWorking(true);
    try {
      await api(`/access/superadmins/${superadminId}/restore`, { method: "POST" });
      notify?.("Company restored successfully");
      await load();
      await onChanged?.();
    } catch (error) {
      notify?.(error.message, "bad");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="saDetailBackdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <aside className="saDetailPanel">
        <div className="saDetailHeader">
          <div className="saDetailIdentity">
            <span className="saDetailLogo"><Building2 size={21} /></span>
            <div>
              <div className="saDetailTitleRow">
                <h2>{profile.companyName || user.name || "Superadmin"}</h2>
                <span className={`saStatePill ${statusTone(profile.status)}`}>{profile.status || "ACTIVE"}</span>
              </div>
              <p>{profile.gstin || user.tenantKey} • {profile.companyType || "Company"}</p>
            </div>
          </div>
          <div className="saDetailHeaderActions">
            <button type="button" onClick={load} title="Refresh"><RefreshCw size={16} /></button>
            <button type="button" onClick={onClose} title="Close"><X size={18} /></button>
          </div>
        </div>

        {loading && !detail ? (
          <div className="saDetailLoading"><Loader2 className="spin" size={22} /> Loading company details...</div>
        ) : (
          <>
            <div className="saDetailQuickActions">
              {!isDeleted && <button className="primary" type="button" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button>}
              {!isDeleted && <button type="button" onClick={() => setRenewing(true)}><CalendarClock size={15} /> Renew / Change Plan</button>}
              {!isDeleted && <button type="button" onClick={resetPassword}><KeyRound size={15} /> Reset Password</button>}
              {!isDeleted && (isSuspended
                ? <button type="button" onClick={() => setCompanyStatus("ACTIVE")}><CheckCircle2 size={15} /> Activate</button>
                : <button type="button" onClick={() => setCompanyStatus("SUSPENDED")}><Ban size={15} /> Suspend</button>)}
              {isDeleted
                ? <button className="restore" type="button" onClick={restoreCompany}><RotateCcw size={15} /> Restore Company</button>
                : <button className="danger" type="button" onClick={removeCompany}><Trash2 size={15} /> Delete</button>}
            </div>

            <div className="saSubscriptionHero">
              <div>
                <span>Current Plan</span>
                <strong>{detail?.plan?.name || profile.planCode || "—"}</strong>
                <small>{subscription.billingCycle || profile.billingCycle || "YEARLY"}</small>
              </div>
              <div className="saDaysLeft">
                <span>Days Left</span>
                <strong className={statusTone(subscription.status)}>
                  {Number.isFinite(Number(subscription.daysLeft)) ? Math.max(0, Number(subscription.daysLeft)) : "—"}
                </strong>
                <small>{subscription.status || "ACTIVE"}</small>
              </div>
              <div>
                <span>Renewal Date</span>
                <strong>{fmtDate(subscription.renewalDate)}</strong>
                <small>{profile.autoRenew ? "Auto-renew ON" : "Manual renewal"}</small>
              </div>
              <div>
                <span>Last Payment</span>
                <strong>{profile.paymentStatus || "—"}</strong>
                <small>{profile.paymentRef || "No reference"}</small>
              </div>
            </div>

            <div className="saDetailStats">
              <div><UsersRound size={17} /><span>Active Users<strong>{stats.activeUsers ?? 0}</strong></span></div>
              <div><ShieldCheck size={17} /><span>Roles<strong>{stats.roles ?? 0}</strong></span></div>
              <div><Building2 size={17} /><span>Branches<strong>{stats.branches ?? profile.branchCount ?? 1}</strong></span></div>
              <div><UserRound size={17} /><span>Stakeholders<strong>{stats.stakeholders ?? 0}</strong></span></div>
              <div><Clock3 size={17} /><span>Last Login<strong>{fmtDateTime(user.lastLoginAt)}</strong></span></div>
            </div>

            <div className="saDetailTabs">
              {[
                ["overview", "Overview"],
                ["company", "Company"],
                ["stakeholders", "Stakeholders"],
                ["payments", "Payments"],
                ["history", "Plan History"],
              ].map(([key, label]) => (
                <button type="button" className={tab === key ? "active" : ""} key={key} onClick={() => setTab(key)}>{label}</button>
              ))}
            </div>

            <div className="saDetailBody">
              {tab === "overview" && (
                <div className="saOverviewGrid">
                  <section>
                    <h4>Subscription</h4>
                    <div className="saInfoList">
                      <div><span>Plan</span><strong>{detail?.plan?.name || profile.planCode || "—"}</strong></div>
                      <div><span>Billing</span><strong>{subscription.billingCycle || profile.billingCycle || "—"}</strong></div>
                      <div><span>Started</span><strong>{fmtDate(subscription.startAt)}</strong></div>
                      <div><span>Expires</span><strong>{fmtDate(subscription.endAt)}</strong></div>
                      <div><span>Renewal</span><strong>{fmtDate(subscription.renewalDate)}</strong></div>
                      <div><span>Grace Days</span><strong>{profile.graceDays || 0}</strong></div>
                    </div>
                  </section>
                  <section>
                    <h4>Superadmin Login</h4>
                    <div className="saInfoList">
                      <div><span>Email</span><strong>{user.email || "—"}</strong></div>
                      <div><span>Mobile</span><strong>{user.mobile || "—"}</strong></div>
                      <div><span>Last Login</span><strong>{fmtDateTime(user.lastLoginAt)}</strong></div>
                      <div><span>Login Count</span><strong>{user.loginCount || 0}</strong></div>
                      <div><span>Tenant ID</span><strong className="mono">{user.tenantId || profile._id || "—"}</strong></div>
                      <div><span>Tenant Key</span><strong className="mono">{user.tenantKey || "—"}</strong></div>
                    </div>
                  </section>
                  <section className="wide">
                    <h4>Quick Company Information</h4>
                    <div className="saContactGrid">
                      <div><Mail size={15} /><span>{profile.email || user.email || "—"}</span></div>
                      <div><Phone size={15} /><span>{profile.mobile || user.mobile || "—"}</span></div>
                      <div><MapPin size={15} /><span>{[profile.registeredAddress, profile.city, profile.state, profile.pincode].filter(Boolean).join(", ") || "—"}</span></div>
                    </div>
                  </section>
                </div>
              )}

              {tab === "company" && (
                <div className="saCompanyDetailsGrid">
                  {[
                    ["Company Name", profile.companyName],
                    ["Trade Name", profile.tradeName],
                    ["Company Type", profile.companyType],
                    ["GSTIN", profile.gstin],
                    ["PAN", profile.pan],
                    ["Aadhaar", profile.aadhaarMasked],
                    ["Email", profile.email],
                    ["Mobile", profile.mobile],
                    ["Address", profile.registeredAddress],
                    ["Pincode", profile.pincode],
                    ["City", profile.city],
                    ["State", profile.state],
                    ["Default FY", profile.financialYear],
                    ["Financial Years", (profile.financialYears || []).join(", ")],
                    ["Branches", profile.branchCount || 1],
                    ["Created", fmtDateTime(profile.createdAt)],
                  ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || "—"}</strong></div>)}
                </div>
              )}

              {tab === "stakeholders" && (
                <div className="saStakeholderList">
                  {(profile.stakeholders || []).length ? (profile.stakeholders || []).map((row, index) => (
                    <article key={row.stakeholderId || index}>
                      <div><span className="saPersonAvatar">{String(row.name || "S").slice(0, 1).toUpperCase()}</span><span><strong>{row.name}</strong><small>{row.roleType || "STAKEHOLDER"}</small></span></div>
                      <div><span>PAN</span><strong>{row.pan || "—"}</strong></div>
                      <div><span>Ownership</span><strong>{Number(row.ownershipPct || 0)}%</strong></div>
                      <div><span>Profit Share</span><strong>{Number(row.profitSharePct || 0)}%</strong></div>
                      <div><span>Contribution</span><strong>{money(row.contribution)}</strong></div>
                      <div><span>Status</span><strong>{row.active === false ? "Inactive" : "Active"}</strong></div>
                    </article>
                  )) : <div className="saEmpty">No stakeholders saved.</div>}
                </div>
              )}

              {tab === "payments" && (
                <div className="saPaymentHistory">
                  {payments.length ? payments.map((payment) => (
                    <article key={payment._id || payment.paymentRef}>
                      <span className={`saPaymentIcon ${statusTone(payment.status)}`}><CreditCard size={17} /></span>
                      <div className="main"><strong>{money(payment.amountRupees)}</strong><small>{payment.paymentRef}</small></div>
                      <div><span>Plan</span><strong>{payment.planCode}</strong></div>
                      <div><span>Cycle</span><strong>{payment.billingCycle}</strong></div>
                      <div><span>Provider</span><strong>{payment.provider}</strong></div>
                      <div><span>Status</span><strong className={statusTone(payment.status)}>{payment.status}</strong></div>
                      <div><span>Date</span><strong>{fmtDateTime(payment.verifiedAt || payment.createdAt)}</strong></div>
                    </article>
                  )) : <div className="saEmpty">No payment history found.</div>}
                </div>
              )}

              {tab === "history" && (
                <div className="saPlanHistory">
                  {(profile.planHistory || []).length ? [...profile.planHistory].reverse().map((row, index) => (
                    <article key={`${row.paymentRef || "history"}-${index}`}>
                      <span><History size={16} /></span>
                      <div><strong>{row.planCode || "Plan"}</strong><small>{row.action || "UPDATE"}</small></div>
                      <div><span>Cycle</span><strong>{row.billingCycle || "—"}</strong></div>
                      <div><span>Period</span><strong>{fmtDate(row.startAt)} → {fmtDate(row.endAt)}</strong></div>
                      <div><span>Amount</span><strong>{money(row.amountRupees)}</strong></div>
                    </article>
                  )) : <div className="saEmpty">No plan history saved yet.</div>}
                </div>
              )}
            </div>
          </>
        )}

        {editing && (
          <div className="saDetailModalLayer">
            <div className="saDetailModal">
              <div className="saModalHeader"><div><Pencil size={17} /><span><strong>Edit Company</strong><small>GSTIN, PAN and legal constitution stay protected.</small></span></div><button type="button" onClick={() => setEditing(false)}><X size={17} /></button></div>
              <div className="saModalGrid">
                <label><span>Company Name</span><input value={editForm.companyName || ""} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} /></label>
                <label><span>Trade Name</span><input value={editForm.tradeName || ""} onChange={(e) => setEditForm({ ...editForm, tradeName: e.target.value })} /></label>
                <label><span>Email</span><input type="email" value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></label>
                <label><span>Mobile</span><input value={editForm.mobile || ""} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} /></label>
                <label className="wide"><span>Registered Address</span><input value={editForm.registeredAddress || ""} onChange={(e) => setEditForm({ ...editForm, registeredAddress: e.target.value })} /></label>
                <label><span>Pincode</span><input value={editForm.pincode || ""} onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })} /></label>
                <label><span>City</span><input value={editForm.city || ""} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} /></label>
                <label><span>State</span><input value={editForm.state || ""} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} /></label>
                <label><span>Default FY</span><input value={editForm.financialYear || ""} onChange={(e) => setEditForm({ ...editForm, financialYear: e.target.value })} placeholder="2026-27" /></label>
                <label className="wide"><span>Financial Years</span><input value={editForm.financialYears || ""} onChange={(e) => setEditForm({ ...editForm, financialYears: e.target.value })} placeholder="2025-26, 2026-27" /></label>
                <label><span>No. of Branches</span><input type="number" min="1" value={editForm.branchCount || 1} onChange={(e) => setEditForm({ ...editForm, branchCount: e.target.value, hasMultipleBranches: Number(e.target.value) > 1 })} /></label>
                <label><span>Grace Days</span><input type="number" min="0" max="365" value={editForm.graceDays || 0} onChange={(e) => setEditForm({ ...editForm, graceDays: e.target.value })} /></label>
                <label className="check wide"><input type="checkbox" checked={Boolean(editForm.autoRenew)} onChange={(e) => setEditForm({ ...editForm, autoRenew: e.target.checked })} /><span>Auto-renew preference</span></label>
              </div>
              <div className="saModalActions"><button type="button" onClick={() => setEditing(false)}>Cancel</button><button className="primary" disabled={working} type="button" onClick={saveEdit}>{working ? <Loader2 className="spin" size={15} /> : <CheckCircle2 size={15} />} Save Changes</button></div>
            </div>
          </div>
        )}

        {renewing && (
          <div className="saDetailModalLayer">
            <div className="saDetailModal compact">
              <div className="saModalHeader"><div><CalendarClock size={17} /><span><strong>Renew / Change Plan</strong><small>MASTER confirms payment and extends the subscription.</small></span></div><button type="button" onClick={() => setRenewing(false)}><X size={17} /></button></div>
              <div className="saModalGrid">
                <label className="wide"><span>Plan</span><select value={renewForm.planCode} onChange={(e) => setRenewForm({ ...renewForm, planCode: e.target.value })}>{plans.filter((item) => String(item.status || "ACTIVE").toUpperCase() === "ACTIVE").map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}</select></label>
                <label><span>Billing Cycle</span><select value={renewForm.billingCycle} onChange={(e) => setRenewForm({ ...renewForm, billingCycle: e.target.value })}><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label>
                <label><span>No. of Periods</span><input type="number" min="1" max="36" value={renewForm.periods} onChange={(e) => setRenewForm({ ...renewForm, periods: e.target.value })} /></label>
                <label className="wide"><span>Payment Note / Reference</span><input value={renewForm.paymentNote} onChange={(e) => setRenewForm({ ...renewForm, paymentNote: e.target.value })} placeholder="Bank receipt / cash / reference" /></label>
              </div>
              <div className="saRenewAmount"><BadgeIndianRupee size={20} /><span>Amount to record<strong>{money(renewalAmount)}</strong></span></div>
              <div className="saModalActions"><button type="button" onClick={() => setRenewing(false)}>Cancel</button><button className="primary" disabled={working || !renewForm.planCode} type="button" onClick={renew}>{working ? <Loader2 className="spin" size={15} /> : <CheckCircle2 size={15} />} Mark Paid & Renew</button></div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
