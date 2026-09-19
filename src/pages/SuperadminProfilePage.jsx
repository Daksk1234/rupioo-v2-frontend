import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CloudCog,
  CalendarDays,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ReceiptIndianRupee,
  Save,
  ShieldCheck,
  UserRound,
  UploadCloud,
  WalletCards,
  X,
} from "lucide-react";
import { api, apiBlob, getUser, updateSessionUser } from "../lib/api.js";
import "../profile-bank.css";

const emptyPassword = { currentPassword: "", newPassword: "", confirmPassword: "" };

const fmtDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function SuperadminProfilePage() {
  const navigate = useNavigate();
  const sessionUser = getUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState(emptyPassword);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [signaturePreview, setSignaturePreview] = useState("");
  const [assetBusy, setAssetBusy] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api("/profile");
      setData(result);
      const company = result.company || {};
      const user = result.user || {};
      setForm({
        name: user.name || "",
        email: user.email || "",
        mobile: user.mobile || company.mobile || "",
        companyName: company.companyName || "",
        tradeName: company.tradeName || "",
        registeredAddress: company.registeredAddress || "",
        pincode: company.pincode || "",
        city: company.city || "",
        state: company.state || "",
        financialYear: company.financialYear || "",
        financialYears: Array.isArray(company.financialYears) ? company.financialYears : [],
        salesInvoicePrefix: company.salesInvoicePrefix || "",
        salesInvoiceSuffix: company.salesInvoiceSuffix || "",
        salesInvoiceStartingNumber: Number(company.salesInvoiceStartingNumber || 1),
        logoFileId: company.logoFileId || "",
        signatureFileId: company.signatureFileId || "",
        invoiceTerms: company.invoiceTerms || "GOODS ONCE SOLD CANNOT BE TAKEN BACK, TRANSPORTATION RISK AT BUYER SIDE",
        gpayNumber: company.gpayNumber || "",
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let active = true;
    const urls = [];

    const loadAssetPreview = async (fileId, setter) => {
      if (!fileId) {
        setter("");
        return;
      }
      try {
        const { blob } = await apiBlob(`/files/${fileId}`);
        if (!active) return;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        setter(url);
      } catch (_) {
        if (active) setter("");
      }
    };

    loadAssetPreview(data?.company?.logoFileId, setLogoPreview);
    loadAssetPreview(data?.company?.signatureFileId, setSignaturePreview);

    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [data?.company?.logoFileId, data?.company?.signatureFileId]);

  const subscription = data?.subscription || {};
  const company = data?.company || {};
  const user = data?.user || sessionUser || {};
  const plan = data?.plan || {};
  const stakeholders = company?.stakeholders || [];

  const statusTone = useMemo(() => {
    const value = String(subscription.status || company.subscriptionStatus || "ACTIVE").toUpperCase();
    if (["EXPIRED", "DELETED", "SUSPENDED"].includes(value)) return "bad";
    if (value === "EXPIRING") return "warn";
    return "good";
  }, [subscription.status, company.subscriptionStatus]);

  const saveProfile = async () => {
    setMessage("");
    setError("");
    try {
      const result = await api("/profile", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setData(result);
      updateSessionUser({
        ...result.user,
        companyProfile: result.company,
        plan: result.plan,
      });
      setEditing(false);
      setMessage("Profile updated successfully");
    } catch (e) {
      setError(e.message);
    }
  };

  const changePassword = async () => {
    setMessage("");
    setError("");
    if (passwordForm.newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }
    try {
      await api("/profile/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordOpen(false);
      setPasswordForm(emptyPassword);
      setMessage("Password changed successfully");
    } catch (e) {
      setError(e.message);
    }
  };

  const persistInvoiceAsset = async (field, fileId) => {
    const result = await api("/profile", {
      method: "PUT",
      body: JSON.stringify({ [field]: fileId || "" }),
    });
    setData(result);
    setForm((current) => ({ ...current, [field]: fileId || "" }));
    updateSessionUser({
      ...result.user,
      companyProfile: result.company,
      plan: result.plan,
    });
    return result;
  };

  const uploadInvoiceAsset = async (file, field) => {
    if (!file) return;
    setMessage("");
    setError("");
    setAssetBusy(field);
    try {
      if (!String(file.type || "").startsWith("image/")) {
        throw new Error("Please upload an image file");
      }
      if (Number(file.size || 0) > 5 * 1024 * 1024) {
        throw new Error("Image must be 5 MB or smaller");
      }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("module", "DMS");
      fd.append("entityType", "COMPANY_PROFILE");
      fd.append("entityId", String(company?._id || company?.tenantKey || "COMPANY"));
      fd.append("access", "PRIVATE");
      const meta = await api("/files/upload", { method: "POST", body: fd });
      const fileId = meta.fileId || "";
      if (!fileId) throw new Error("Upload completed but file ID was not returned");

      await persistInvoiceAsset(field, fileId);
      setMessage(
        field === "logoFileId"
          ? "Company logo uploaded and saved. It will now appear on invoices."
          : "Authorized signature uploaded and saved. It will now appear on invoices.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setAssetBusy("");
    }
  };

  const removeInvoiceAsset = async (field) => {
    setMessage("");
    setError("");
    setAssetBusy(field);
    try {
      await persistInvoiceAsset(field, "");
      setMessage(field === "logoFileId" ? "Company logo removed from invoice settings." : "Authorized signature removed from invoice settings.");
    } catch (e) {
      setError(e.message);
    } finally {
      setAssetBusy("");
    }
  };

  const updateYear = (index, value) => {
    const years = [...(form.financialYears || [])];
    years[index] = value;
    setForm({ ...form, financialYears: years });
  };

  const addYear = () => setForm({ ...form, financialYears: [...(form.financialYears || []), ""] });
  const removeYear = (index) => {
    const years = (form.financialYears || []).filter((_, i) => i !== index);
    setForm({ ...form, financialYears: years, financialYear: years.includes(form.financialYear) ? form.financialYear : years[0] || "" });
  };

  if (loading) return <section className="panel profileLoading">Loading Superadmin profile…</section>;

  return (
    <>
      <div className="profileTopActions">
        <div>
          <strong>{company.companyName || user.name}</strong>
          <span>Superadmin Profile & Company Subscription</span>
        </div>
        <div>
          <button className="btn ghost" onClick={() => navigate("/storage-settings")}><CloudCog size={15}/>Storage & Backup</button>
          <button className="btn ghost" onClick={() => setPasswordOpen(true)}><KeyRound size={15}/>Change Password</button>
          <button className="btn primary" onClick={() => setEditing(true)}><Pencil size={15}/>Edit Profile</button>
        </div>
      </div>

      {message && <div className="resultBanner good">{message}</div>}
      {error && <div className="resultBanner bad">{error}</div>}

      <section className="profileHero">
        <div className="profileAvatar"><UserRound size={28}/></div>
        <div className="profileIdentity">
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <div className="profilePills">
            <span>SUPERADMIN</span>
            <span>{company.companyType || "COMPANY"}</span>
            <span className={statusTone}>{subscription.status || "ACTIVE"}</span>
          </div>
        </div>
        <div className="profileTenant">
          <small>Tenant ID</small>
          <strong>{user.tenantId || company._id || "—"}</strong>
          <small>Tenant Key</small>
          <strong>{user.tenantKey || company.tenantKey || "—"}</strong>
        </div>
      </section>

      <div className="profileMetricGrid">
        <div><CalendarDays/><span>Days Left<strong>{subscription.daysLeft ?? "—"}</strong></span></div>
        <div><WalletCards/><span>Plan<strong>{plan.name || company.planCode || "—"}</strong></span></div>
        <div><CalendarDays/><span>Renewal<strong>{fmtDate(subscription.renewalDate)}</strong></span></div>
        <div><ShieldCheck/><span>Payment<strong>{company.paymentStatus || "—"}</strong></span></div>
        <div><Building2/><span>Branches<strong>{company.branchCount || 1}</strong></span></div>
      </div>

      <div className="profileContentGrid">
        <section className="panel profileCard">
          <h3><UserRound size={16}/>Superadmin Details</h3>
          <div className="profileInfoList">
            <div><span>Name</span><strong>{user.name || "—"}</strong></div>
            <div><span>Email</span><strong>{user.email || "—"}</strong></div>
            <div><span>Mobile</span><strong>{user.mobile || company.mobile || "—"}</strong></div>
            <div><span>Last Login</span><strong>{fmtDate(user.lastLoginAt)}</strong></div>
            <div><span>Login Count</span><strong>{user.loginCount || 0}</strong></div>
          </div>
        </section>

        <section className="panel profileCard">
          <h3><Building2 size={16}/>Company Identity</h3>
          <div className="profileInfoList">
            <div><span>Company</span><strong>{company.companyName || "—"}</strong></div>
            <div><span>Trade Name</span><strong>{company.tradeName || "—"}</strong></div>
            <div><span>GSTIN</span><strong>{company.gstin || "—"}</strong></div>
            <div><span>PAN</span><strong>{company.pan || "—"}</strong></div>
            <div><span>Company Type</span><strong>{company.companyType || "—"}</strong></div>
          </div>
        </section>

        <section className="panel profileCard">
          <h3><MapPin size={16}/>Registered Address</h3>
          <div className="profileInfoList">
            <div><span>Address</span><strong>{company.registeredAddress || "—"}</strong></div>
            <div><span>Pincode</span><strong>{company.pincode || "—"}</strong></div>
            <div><span>City</span><strong>{company.city || "—"}</strong></div>
            <div><span>State</span><strong>{company.state || "—"}</strong></div>
          </div>
        </section>

        <section className="panel profileCard">
          <h3><WalletCards size={16}/>Subscription</h3>
          <div className="profileInfoList">
            <div><span>Plan</span><strong>{plan.name || company.planCode || "—"}</strong></div>
            <div><span>Group</span><strong>{data?.group?.name || company.planGroupCode || "—"}</strong></div>
            <div><span>Billing</span><strong>{subscription.billingCycle || company.billingCycle || "—"}</strong></div>
            <div><span>Start</span><strong>{fmtDate(subscription.startAt)}</strong></div>
            <div><span>End</span><strong>{fmtDate(subscription.endAt)}</strong></div>
            <div><span>Monthly / Yearly</span><strong>{money(subscription.billingCycle === "MONTHLY" ? plan.monthlyAmount : plan.yearlyAmount)}</strong></div>
          </div>
        </section>

        <section className="panel profileCard profileWide">
          <h3><CalendarDays size={16}/>Financial Years</h3>
          <div className="profileYearChips">
            {(company.financialYears || []).map((year) => <span key={year} className={year === company.financialYear ? "active" : ""}>{year}{year === company.financialYear ? " • Default" : ""}</span>)}
            {!company.financialYears?.length && <span>{company.financialYear || "No FY configured"}</span>}
          </div>
        </section>

        <section className="panel profileCard profileWide">
          <h3><ReceiptIndianRupee size={16}/>Sales Invoice Numbering</h3>
          <div className="profileInfoList profileInvoiceSeries">
            <div><span>Prefix</span><strong>{company.salesInvoicePrefix || "—"}</strong></div>
            <div><span>Starting Number</span><strong>{Number(company.salesInvoiceStartingNumber || 1)}</strong></div>
            <div><span>Suffix</span><strong>{company.salesInvoiceSuffix || "—"}</strong></div>
            <div><span>Next Number</span><strong>{Number(company.salesInvoiceNextNumber || company.salesInvoiceStartingNumber || 1)}</strong></div>
            <div><span>Example</span><strong>{[company.salesInvoicePrefix, String(company.salesInvoiceNextNumber || company.salesInvoiceStartingNumber || 1), company.salesInvoiceSuffix].filter(Boolean).join("-") || "Configure invoice series"}</strong></div>
          </div>
        </section>

        <section className="panel profileCard profileWide">
          <h3><ReceiptIndianRupee size={16}/>Invoice Print Template</h3>
          <p style={{margin:"0 0 14px", color:"var(--muted, #667085)", fontSize:13}}>Upload the company logo and authorized signature here. They are saved immediately and used by the Master Invoice Template.</p>

          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:14, marginBottom:16}}>
            <div style={{border:"1px solid var(--line, #e4e7ec)", borderRadius:12, padding:14}}>
              <div style={{display:"flex", justifyContent:"space-between", gap:12, alignItems:"center", marginBottom:10}}>
                <div><strong>Company Logo</strong><div style={{fontSize:12, color:"var(--muted, #667085)", marginTop:3}}>PNG/JPG/WebP • Max 5 MB</div></div>
                <span className={company.logoFileId ? "statusBadge good" : "statusBadge warn"}>{company.logoFileId ? "UPLOADED" : "NOT UPLOADED"}</span>
              </div>
              <div style={{height:100, border:"1px dashed var(--line, #d0d5dd)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", background:"var(--soft, #f8fafc)", marginBottom:12, overflow:"hidden"}}>
                {logoPreview ? <img src={logoPreview} alt="Company logo preview" style={{maxWidth:"100%", maxHeight:"92px", objectFit:"contain"}}/> : <span style={{fontSize:12, color:"var(--muted, #667085)"}}>Logo preview</span>}
              </div>
              <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                <label className="btn primary" style={{cursor:assetBusy === "logoFileId" ? "wait" : "pointer", margin:0}}>
                  <UploadCloud size={14}/>{assetBusy === "logoFileId" ? "Uploading..." : company.logoFileId ? "Replace Logo" : "Upload Logo"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={!!assetBusy} onChange={e=>{const file=e.target.files?.[0]; e.target.value=""; uploadInvoiceAsset(file,"logoFileId");}}/>
                </label>
                {company.logoFileId && <button type="button" className="btn ghost" disabled={!!assetBusy} onClick={()=>removeInvoiceAsset("logoFileId")}><X size={14}/>Remove</button>}
              </div>
            </div>

            <div style={{border:"1px solid var(--line, #e4e7ec)", borderRadius:12, padding:14}}>
              <div style={{display:"flex", justifyContent:"space-between", gap:12, alignItems:"center", marginBottom:10}}>
                <div><strong>Authorized Signature</strong><div style={{fontSize:12, color:"var(--muted, #667085)", marginTop:3}}>Transparent PNG preferred • Max 5 MB</div></div>
                <span className={company.signatureFileId ? "statusBadge good" : "statusBadge warn"}>{company.signatureFileId ? "UPLOADED" : "NOT UPLOADED"}</span>
              </div>
              <div style={{height:100, border:"1px dashed var(--line, #d0d5dd)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", background:"var(--soft, #f8fafc)", marginBottom:12, overflow:"hidden"}}>
                {signaturePreview ? <img src={signaturePreview} alt="Authorized signature preview" style={{maxWidth:"100%", maxHeight:"92px", objectFit:"contain"}}/> : <span style={{fontSize:12, color:"var(--muted, #667085)"}}>Signature preview</span>}
              </div>
              <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                <label className="btn primary" style={{cursor:assetBusy === "signatureFileId" ? "wait" : "pointer", margin:0}}>
                  <UploadCloud size={14}/>{assetBusy === "signatureFileId" ? "Uploading..." : company.signatureFileId ? "Replace Signature" : "Upload Signature"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={!!assetBusy} onChange={e=>{const file=e.target.files?.[0]; e.target.value=""; uploadInvoiceAsset(file,"signatureFileId");}}/>
                </label>
                {company.signatureFileId && <button type="button" className="btn ghost" disabled={!!assetBusy} onClick={()=>removeInvoiceAsset("signatureFileId")}><X size={14}/>Remove</button>}
              </div>
            </div>
          </div>

          <div className="profileInfoList profileInvoiceSeries">
            <div><span>GPay / PhonePe No.</span><strong>{company.gpayNumber || company.mobile || "—"}</strong></div>
            <div><span>Payment QR</span><strong>Dynamic from Primary Bank UPI</strong></div>
            <div><span>GST e-Invoice</span><strong>IRN / Ack / IRP QR Ready</strong></div>
            <div><span>Rupio Footer</span><strong>Generated automatically</strong></div>
            <div><span>Template</span><strong>MASTER INVOICE TEMPLATE</strong></div>
          </div>
        </section>

        <section className="panel profileCard profileWide">
          <h3><UserRound size={16}/>Stakeholders</h3>
          <div className="profileStakeholders">
            {stakeholders.length ? stakeholders.map((item) => (
              <article key={item.stakeholderId || item.name}>
                <div className="profileStakeholderAvatar">{String(item.name || "S").slice(0,1).toUpperCase()}</div>
                <div><strong>{item.name}</strong><span>{item.roleType}</span></div>
                <div><span>PAN</span><strong>{item.pan || "—"}</strong></div>
                <div><span>Mobile</span><strong>{item.mobile || "—"}</strong></div>
                <div><span>Ownership</span><strong>{Number(item.ownershipPct || 0)}%</strong></div>
              </article>
            )) : <div className="empty">No stakeholders recorded.</div>}
          </div>
        </section>
      </div>

      {editing && (
        <div className="modalOverlay">
          <section className="panel modalPanel wideModal profileModal">
            <div className="formTitle"><div><h3>Edit Superadmin Profile</h3><span>GSTIN, PAN and legal constitution remain protected.</span></div><button className="iconBtn" onClick={() => setEditing(false)}><X/></button></div>
            <div className="formGrid compactGrid">
              <label>Name<input value={form.name || ""} onChange={e => setForm({...form,name:e.target.value})}/></label>
              <label>Email<input type="email" value={form.email || ""} onChange={e => setForm({...form,email:e.target.value})}/></label>
              <label>Mobile<input value={form.mobile || ""} onChange={e => setForm({...form,mobile:e.target.value})}/></label>
              <label>Company Name<input value={form.companyName || ""} onChange={e => setForm({...form,companyName:e.target.value})}/></label>
              <label>Trade Name<input value={form.tradeName || ""} onChange={e => setForm({...form,tradeName:e.target.value})}/></label>
              <label>Pincode<input value={form.pincode || ""} onChange={e => setForm({...form,pincode:e.target.value})}/></label>
              <label>City<input value={form.city || ""} onChange={e => setForm({...form,city:e.target.value})}/></label>
              <label>State<input value={form.state || ""} onChange={e => setForm({...form,state:e.target.value})}/></label>
              <label>Sales Invoice Prefix<input value={form.salesInvoicePrefix || ""} onChange={e => setForm({...form,salesInvoicePrefix:e.target.value})} placeholder="e.g. EKO"/></label>
              <label>Sales Invoice Starting Number<input type="number" min="1" value={form.salesInvoiceStartingNumber || 1} onChange={e => setForm({...form,salesInvoiceStartingNumber:Number(e.target.value)})}/></label>
              <label>Sales Invoice Suffix<input value={form.salesInvoiceSuffix || ""} onChange={e => setForm({...form,salesInvoiceSuffix:e.target.value})} placeholder="e.g. 26-27"/></label>
              <label>GPay / PhonePe No.<input value={form.gpayNumber || ""} onChange={e => setForm({...form,gpayNumber:e.target.value})} placeholder="Payment mobile number"/></label>
              <label>Company Logo<div className="lookupSelectRow"><input value={form.logoFileId || ""} readOnly placeholder="Not uploaded"/><label className="btn ghost" style={{cursor:"pointer"}}><UploadCloud size={14}/>Upload<input type="file" accept="image/*" hidden onChange={e=>uploadInvoiceAsset(e.target.files?.[0],"logoFileId")}/></label></div></label>
              <label>Authorized Signature<div className="lookupSelectRow"><input value={form.signatureFileId || ""} readOnly placeholder="Not uploaded"/><label className="btn ghost" style={{cursor:"pointer"}}><UploadCloud size={14}/>Upload<input type="file" accept="image/*" hidden onChange={e=>uploadInvoiceAsset(e.target.files?.[0],"signatureFileId")}/></label></div></label>
              <label className="wideField">Registered Address<textarea value={form.registeredAddress || ""} onChange={e => setForm({...form,registeredAddress:e.target.value})}/></label>
              <label className="wideField">Invoice Terms & Conditions<textarea value={form.invoiceTerms || ""} onChange={e => setForm({...form,invoiceTerms:e.target.value})}/></label>
            </div>
            <div className="profileFyEditor">
              <div className="sectionHeader"><h3>Financial Years</h3><button className="btn ghost" onClick={addYear}>Add Year</button></div>
              {(form.financialYears || []).map((year,index)=><div className="profileFyRow" key={`${index}-${year}`}><input value={year} placeholder="2026-27" onChange={e=>updateYear(index,e.target.value)}/><label><input type="radio" name="default-fy" checked={form.financialYear===year} onChange={()=>setForm({...form,financialYear:year})}/> Default</label><button onClick={()=>removeYear(index)}><X size={14}/></button></div>)}
            </div>
            <div className="formActions"><button className="btn ghost" onClick={() => setEditing(false)}>Cancel</button><button className="btn primary" onClick={saveProfile}><Save size={15}/>Save Changes</button></div>
          </section>
        </div>
      )}

      {passwordOpen && (
        <div className="modalOverlay">
          <section className="panel modalPanel profilePasswordModal">
            <div className="formTitle"><div><h3>Change Password</h3><span>Use at least 8 characters.</span></div><button className="iconBtn" onClick={() => setPasswordOpen(false)}><X/></button></div>
            <div className="formGrid">
              <label>Current Password<input type="password" value={passwordForm.currentPassword} onChange={e=>setPasswordForm({...passwordForm,currentPassword:e.target.value})}/></label>
              <label>New Password<input type="password" value={passwordForm.newPassword} onChange={e=>setPasswordForm({...passwordForm,newPassword:e.target.value})}/></label>
              <label>Confirm New Password<input type="password" value={passwordForm.confirmPassword} onChange={e=>setPasswordForm({...passwordForm,confirmPassword:e.target.value})}/></label>
            </div>
            <div className="formActions"><button className="btn ghost" onClick={() => setPasswordOpen(false)}>Cancel</button><button className="btn primary" onClick={changePassword}><KeyRound size={15}/>Change Password</button></div>
          </section>
        </div>
      )}
    </>
  );
}
