import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  CreditCard,
  KeyRound,
  Loader2,
  MapPin,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import DataTable from "../components/DataTable.jsx";
import SuperadminDetailsPanel from "../components/SuperadminDetailsPanel.jsx";
import { api } from "../lib/api.js";
import "../superadmin-page.css";

const COMPANY_TYPES = [
  ["PROPRIETORSHIP", "Proprietorship"],
  ["PARTNERSHIP", "Partnership Firm"],
  ["LLP", "LLP"],
  ["PRIVATE_LIMITED", "Private Limited Company"],
  ["PUBLIC_LIMITED", "Public Limited Company"],
  ["OPC", "One Person Company (OPC)"],
  ["TRUST", "Trust"],
  ["SOCIETY", "Society / Association"],
  ["OTHER", "Other"],
];

const rolesFor = (type) =>
  ({
    PROPRIETORSHIP: ["PROPRIETOR"],
    PARTNERSHIP: ["PARTNER"],
    LLP: ["DESIGNATED_PARTNER", "PARTNER"],
    PRIVATE_LIMITED: ["DIRECTOR", "SHAREHOLDER", "PROMOTER", "AUTHORISED_SIGNATORY"],
    PUBLIC_LIMITED: ["DIRECTOR", "SHAREHOLDER", "PROMOTER", "AUTHORISED_SIGNATORY"],
    OPC: ["DIRECTOR", "SHAREHOLDER", "PROMOTER", "AUTHORISED_SIGNATORY"],
    TRUST: ["TRUSTEE", "AUTHORISED_SIGNATORY"],
    SOCIETY: ["MEMBER", "AUTHORISED_SIGNATORY"],
    OTHER: ["OWNER", "MEMBER", "AUTHORISED_SIGNATORY"],
  })[type] || ["OWNER"];

const itemsOf = (value) =>
  Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];

const gstinClean = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 15);

const panFromGstin = (gstin) =>
  String(gstin || "").length === 15 ? String(gstin).slice(2, 12) : "";

const passwordFromGstin = (gstin) => {
  const value = String(gstin || "");
  return value.length === 15 ? `${value.slice(0, 4)}${value.slice(-4)}` : "";
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const currentFinancialYear = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String(year + 1).slice(-2)}`;
};

const financialYearOptions = () => {
  const current = Number(currentFinancialYear().slice(0, 4));
  return Array.from({ length: 5 }, (_, index) => {
    const start = current - 1 + index;
    return `${start}-${String(start + 1).slice(-2)}`;
  });
};

const blankStakeholder = (companyType, companyPan = "") => ({
  name: "",
  roleType: rolesFor(companyType)[0],
  pan: companyType === "PROPRIETORSHIP" ? companyPan : "",
  aadhaar: "",
  dinDpin: "",
  mobile: "",
  email: "",
  designation: "",
  ownershipPct: 0,
  profitSharePct: 0,
  contribution: 0,
  openingCapital: 0,
  shareholder: false,
  systemLoginRequired: false,
  accountingRelationships: [],
});

const initialForm = () => ({
  gstin: "",
  pan: "",
  companyName: "",
  tradeName: "",
  aadhaar: "",
  mobile: "",
  companyType: "",
  address: "",
  pincode: "",
  city: "",
  state: "",
  email: "",
  password: "",
  financialYear: currentFinancialYear(),
  financialYears: [currentFinancialYear()],
  hasMultipleBranches: false,
  branchCount: 1,
  planCode: "",
  gstVerified: false,
  gstSource: "",
  gstStatus: "",
  gstTaxpayerType: "",
  gstConstitution: "",
  stakeholders: [],
  billingCycle: "YEARLY",
  skipPayment: false,
  manualPaymentNote: "",
});

const loadRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay Checkout")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Unable to load Razorpay Checkout"));
    document.body.appendChild(script);
  });

export default function SuperadminPage() {
  const [rows, setRows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSuperadminId, setSelectedSuperadminId] = useState("");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm());
  const [passwordEdited, setPasswordEdited] = useState(false);
  const [customFinancialYear, setCustomFinancialYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [gstLoading, setGstLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("good");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [razorpayStatus, setRazorpayStatus] = useState({ configured: false });

  const activePlans = useMemo(
    () => plans.filter((plan) => String(plan.status || "ACTIVE").toUpperCase() === "ACTIVE"),
    [plans],
  );

  const selectedPlan = useMemo(
    () => activePlans.find((plan) => plan.code === form.planCode),
    [activePlans, form.planCode],
  );

  const planAmount = useMemo(
    () =>
      form.billingCycle === "MONTHLY"
        ? Number(selectedPlan?.monthlyAmount || 0)
        : Number(selectedPlan?.yearlyAmount || 0),
    [form.billingCycle, selectedPlan],
  );

  const branchLimit = selectedPlan?.limits?.companies;

  const notify = (text, type = "good") => {
    setMessage(text);
    setMessageType(type);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [superadmins, planRows, paymentStatus] = await Promise.all([
        api("/access/superadmins"),
        api("/master/plans?limit=500"),
        api("/access/superadmins/payment/status").catch(() => ({ configured: false })),
      ]);

      setRows(itemsOf(superadmins));
      const normalizedPlans = itemsOf(planRows);
      setPlans(normalizedPlans);
      setRazorpayStatus(paymentStatus || { configured: false });
    } catch (error) {
      notify(error.message, "bad");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    const firstPlan = activePlans[0];
    const next = initialForm();
    next.planCode = firstPlan?.code || "";
    setForm(next);
    setStep(1);
    setPasswordEdited(false);
    setCustomFinancialYear("");
    setPaymentRef("");
    setPaymentVerified(false);
    setMessage("");
    setShowCreate(true);
  };

  const closeCreate = () => {
    if (paying || creating) return;
    setShowCreate(false);
    setStep(1);
    setPaymentRef("");
    setPaymentVerified(false);
  };

  const changeGstin = (raw) => {
    const gstin = gstinClean(raw);
    const pan = panFromGstin(gstin);
    const nextPassword = passwordFromGstin(gstin);

    setForm((current) => ({
      ...current,
      gstin,
      pan,
      password: passwordEdited ? current.password : nextPassword,
      gstVerified: false,
      gstSource: "",
      gstStatus: "",
      gstTaxpayerType: "",
      gstConstitution: "",
      stakeholders:
        current.companyType === "PROPRIETORSHIP" && current.stakeholders.length
          ? [{ ...current.stakeholders[0], pan }]
          : current.stakeholders,
    }));
  };

  const useAutomaticPassword = () => {
    setPasswordEdited(false);
    setForm((current) => ({ ...current, password: passwordFromGstin(current.gstin) }));
  };

  const lookupPincode = async (pin = form.pincode) => {
    const value = String(pin || "").replace(/\D/g, "").slice(0, 6);
    if (value.length !== 6) return;

    setPinLoading(true);
    try {
      const result = await api(`/reference/pincodes?q=${encodeURIComponent(value)}`);
      const rows = itemsOf(result);
      const match = rows.find((row) => String(row.pincode) === value) || rows[0];
      if (match) {
        setForm((current) => ({
          ...current,
          pincode: value,
          city: match.city || match.district || current.city,
          state: match.state || current.state,
        }));
      }
    } catch {
      // Pincode enrichment is helpful but should not block company registration.
    } finally {
      setPinLoading(false);
    }
  };

  const lookupGst = async () => {
    if (form.gstin.length !== 15) {
      notify("Enter a complete 15-character GST Number", "bad");
      return;
    }

    setGstLoading(true);
    try {
      const taxpayer = await api(`/reference/gst/search?gstin=${encodeURIComponent(form.gstin)}`);
      const rawAddress = taxpayer?.principalAddressRaw || {};
      const pin = String(rawAddress.pncd || rawAddress.pincode || "").replace(/\D/g, "").slice(0, 6);

      setForm((current) => ({
        ...current,
        companyName: taxpayer.legalName || taxpayer.tradeName || current.companyName,
        tradeName: taxpayer.tradeName || current.tradeName,
        pan: taxpayer.pan || panFromGstin(current.gstin),
        address: taxpayer.principalAddress || current.address,
        pincode: pin || current.pincode,
        city: rawAddress.city || rawAddress.loc || rawAddress.dst || current.city,
        state: rawAddress.state || rawAddress.stcd || current.state,
        gstVerified: true,
        gstSource: taxpayer.source || "GST_PROVIDER",
        gstStatus: taxpayer.status || "",
        gstTaxpayerType: taxpayer.taxpayerType || "",
        gstConstitution: taxpayer.constitution || "",
      }));

      if (pin) await lookupPincode(pin);
      notify("GST details fetched successfully");
    } catch (error) {
      notify(`${error.message}. You can still enter the company details manually.`, "bad");
    } finally {
      setGstLoading(false);
    }
  };

  const changeCompanyType = (companyType) => {
    setForm((current) => ({
      ...current,
      companyType,
      stakeholders: companyType ? [blankStakeholder(companyType, current.pan)] : [],
    }));
  };

  const updateStakeholder = (index, key, value) => {
    setForm((current) => ({
      ...current,
      stakeholders: current.stakeholders.map((stakeholder, stakeholderIndex) =>
        stakeholderIndex === index ? { ...stakeholder, [key]: value } : stakeholder,
      ),
    }));
  };

  const addStakeholder = () => {
    if (form.companyType === "PROPRIETORSHIP") return;
    setForm((current) => ({
      ...current,
      stakeholders: [...current.stakeholders, blankStakeholder(current.companyType, current.pan)],
    }));
  };

  const removeStakeholder = (index) => {
    if (form.companyType === "PROPRIETORSHIP") return;
    setForm((current) => ({
      ...current,
      stakeholders: current.stakeholders.filter((_, stakeholderIndex) => stakeholderIndex !== index),
    }));
  };

  const toggleFinancialYear = (year) => {
    setForm((current) => {
      const exists = (current.financialYears || []).includes(year);
      const nextYears = exists
        ? current.financialYears.filter((item) => item !== year)
        : [...(current.financialYears || []), year];
      const nextDefault = nextYears.includes(current.financialYear)
        ? current.financialYear
        : nextYears[0] || "";
      return { ...current, financialYears: nextYears, financialYear: nextDefault };
    });
  };

  const addCustomFinancialYear = () => {
    const value = customFinancialYear.trim();
    if (!/^20\d{2}-\d{2}$/.test(value)) {
      notify("Financial Year must be in YYYY-YY format, for example 2026-27", "bad");
      return;
    }
    setForm((current) => ({
      ...current,
      financialYears: Array.from(new Set([...(current.financialYears || []), value])),
      financialYear: current.financialYear || value,
    }));
    setCustomFinancialYear("");
  };

  const stepOneValid =
    form.gstin.length === 15 &&
    form.pan.length === 10 &&
    form.companyName.trim() &&
    form.companyType &&
    /^\S+@\S+\.\S+$/.test(form.email) &&
    form.password.length >= 8 &&
    form.financialYear &&
    form.financialYears?.length > 0 &&
    form.planCode &&
    (!form.hasMultipleBranches || Number(form.branchCount) >= 2);

  const stepTwoValid =
    form.stakeholders.length > 0 && form.stakeholders.every((stakeholder) => stakeholder.name.trim());

  const createSuperadmin = async ({ skipPayment = false, verifiedPaymentRef = "" } = {}) => {
    setCreating(true);
    try {
      const payload = {
        ...form,
        branchCount: form.hasMultipleBranches ? Number(form.branchCount || 2) : 1,
        skipPayment,
        paymentRef: verifiedPaymentRef || paymentRef,
      };

      const created = await api("/access/superadmins", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      notify(
        `${created.companyProfile?.companyName || form.companyName} created successfully. Payment: ${created.payment?.status || "Recorded"}.`,
      );
      setShowCreate(false);
      setStep(1);
      setPaymentRef("");
      setPaymentVerified(false);
      await load();
    } catch (error) {
      notify(error.message, "bad");
    } finally {
      setCreating(false);
    }
  };

  const payAndCreate = async () => {
    if (!selectedPlan) {
      notify("Select an active plan", "bad");
      return;
    }

    if (planAmount <= 0) {
      await createSuperadmin();
      return;
    }

    if (paymentVerified && paymentRef) {
      await createSuperadmin({ verifiedPaymentRef: paymentRef });
      return;
    }

    if (!razorpayStatus.configured) {
      notify(
        "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or mark Payment already received.",
        "bad",
      );
      return;
    }

    setPaying(true);
    try {
      const order = await api("/access/superadmins/payment/order", {
        method: "POST",
        body: JSON.stringify({
          planCode: form.planCode,
          billingCycle: form.billingCycle,
          gstin: form.gstin,
          companyName: form.companyName,
        }),
      });

      if (order.free) {
        await createSuperadmin();
        return;
      }

      await loadRazorpayScript();

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Rupioo Global",
        description: `${selectedPlan.name} • ${form.billingCycle === "MONTHLY" ? "Monthly" : "Yearly"}`,
        order_id: order.orderId,
        prefill: {
          name: form.companyName,
          email: form.email,
          contact: form.mobile,
        },
        notes: {
          gstin: form.gstin,
          plan: form.planCode,
        },
        theme: { color: "#625cf0" },
        handler: async (response) => {
          try {
            const verified = await api("/access/superadmins/payment/verify", {
              method: "POST",
              body: JSON.stringify({
                paymentRef: order.paymentRef,
                ...response,
              }),
            });
            setPaymentRef(verified.paymentRef);
            setPaymentVerified(true);
            notify("Payment verified. Creating Superadmin...");
            await createSuperadmin({ verifiedPaymentRef: verified.paymentRef });
          } catch (error) {
            notify(error.message, "bad");
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            notify("Payment window closed. No Superadmin was created.", "bad");
          },
        },
      });

      checkout.on("payment.failed", (response) => {
        setPaying(false);
        notify(response?.error?.description || "Razorpay payment failed", "bad");
      });

      checkout.open();
    } catch (error) {
      setPaying(false);
      notify(error.message, "bad");
    }
  };

  const finish = async () => {
    if (form.skipPayment) {
      await createSuperadmin({ skipPayment: true });
      return;
    }
    await payAndCreate();
  };

  const toggleStatus = async (row) => {
    try {
      await api(`/access/users/${row._id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      await load();
    } catch (error) {
      notify(error.message, "bad");
    }
  };

  const resetPassword = async (row) => {
    const password = window.prompt("Enter new password (minimum 8 characters)");
    if (!password) return;
    try {
      await api(`/access/users/${row._id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      notify("Password reset successfully");
    } catch (error) {
      notify(error.message, "bad");
    }
  };

  return (
    <>
      <div className="saPageToolbar">
        <div>
          <strong>Superadmins</strong>
          <span>{rows.length} registered company account(s)</span>
        </div>
        <div className="saToolbarActions">
          <button className="saBtn secondary" type="button" onClick={load}>
            <RefreshCw size={15} /> {loading ? "Loading" : "Refresh"}
          </button>
          <button className="saBtn primary" type="button" onClick={openCreate}>
            <Plus size={16} /> Create Superadmin
          </button>
        </div>
      </div>

      {message && <div className={`resultBanner ${messageType}`}>{message}</div>}

      {showCreate && (
        <section className="saWizard">
          <div className="saWizardTop">
            <div>
              <h3>Create Superadmin</h3>
              <p>Company details, stakeholders and payment in three simple steps.</p>
            </div>
            <button className="saIconButton" type="button" onClick={closeCreate}>
              <X size={18} />
            </button>
          </div>

          <div className="saSteps">
            {[
              [1, "Company"],
              [2, "Stakeholders"],
              [3, "Payment"],
            ].map(([number, label]) => (
              <div key={number} className={step >= number ? "active" : ""}>
                <span>{step > number ? <Check size={14} /> : number}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="saStepBody">
              <div className="saSectionTitle">
                <Building2 size={17} /> Company & Login Details
              </div>

              <div className="saFormGrid">
                <label className="saWideField">
                  <span>GST Number *</span>
                  <div className="saInlineField">
                    <input
                      value={form.gstin}
                      onChange={(event) => changeGstin(event.target.value)}
                      onBlur={() => form.gstin.length === 15 && lookupGst()}
                      placeholder="15-character GSTIN"
                    />
                    <button type="button" onClick={lookupGst} disabled={gstLoading || form.gstin.length !== 15}>
                      {gstLoading ? <Loader2 className="spin" size={15} /> : <Search size={15} />}
                      Fetch GST
                    </button>
                  </div>
                  {form.gstVerified && (
                    <small className="saGoodText">
                      <CircleCheckBig size={13} /> GST verified • {form.gstStatus || "Taxpayer found"}
                    </small>
                  )}
                </label>

                <label>
                  <span>PAN Number *</span>
                  <input value={form.pan} readOnly placeholder="Auto from GSTIN" />
                </label>

                <label>
                  <span>Company Name *</span>
                  <input
                    value={form.companyName}
                    onChange={(event) => setForm({ ...form, companyName: event.target.value })}
                    placeholder="Legal company name"
                  />
                </label>

                <label>
                  <span>Aadhaar Number</span>
                  <input
                    value={form.aadhaar}
                    onChange={(event) =>
                      setForm({ ...form, aadhaar: event.target.value.replace(/\D/g, "").slice(0, 12) })
                    }
                    placeholder="Optional • 12 digits"
                  />
                </label>

                <label>
                  <span>Mobile Number</span>
                  <input
                    value={form.mobile}
                    onChange={(event) =>
                      setForm({ ...form, mobile: event.target.value.replace(/\D/g, "").slice(0, 10) })
                    }
                    placeholder="10-digit mobile"
                  />
                </label>

                <label>
                  <span>Company Type *</span>
                  <select value={form.companyType} onChange={(event) => changeCompanyType(event.target.value)}>
                    <option value="">Select company type</option>
                    {COMPANY_TYPES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="saWideField">
                  <span>Address</span>
                  <textarea
                    rows="2"
                    value={form.address}
                    onChange={(event) => setForm({ ...form, address: event.target.value })}
                    placeholder="Registered address"
                  />
                </label>

                <label>
                  <span>Pincode</span>
                  <div className="saInputWithIcon">
                    <MapPin size={15} />
                    <input
                      value={form.pincode}
                      onChange={(event) =>
                        setForm({ ...form, pincode: event.target.value.replace(/\D/g, "").slice(0, 6) })
                      }
                      onBlur={() => lookupPincode()}
                      placeholder="6-digit PIN"
                    />
                    {pinLoading && <Loader2 className="spin" size={14} />}
                  </div>
                </label>

                <label>
                  <span>City</span>
                  <input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
                </label>

                <label>
                  <span>State</span>
                  <input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} />
                </label>

                <label>
                  <span>Email ID *</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value.trim() })}
                    placeholder="Superadmin login email"
                  />
                </label>

                <label>
                  <span>Password *</span>
                  <div className="saPasswordField">
                    <input
                      value={form.password}
                      onChange={(event) => {
                        setPasswordEdited(true);
                        setForm({ ...form, password: event.target.value });
                      }}
                      placeholder="Auto from GSTIN"
                    />
                    <button type="button" onClick={useAutomaticPassword} title="Use GST-based password">
                      <KeyRound size={14} /> Auto
                    </button>
                  </div>
                  <small>Default = first 4 + last 4 characters of GSTIN. You can edit it.</small>
                </label>

                <div className="saWideField">
                  <span className="saFieldLabel">Financial Years *</span>
                  <div className="saYearPicker">
                    {financialYearOptions().map((year) => (
                      <label key={year} className={`saYearChip ${(form.financialYears || []).includes(year) ? "active" : ""}`}>
                        <input
                          type="checkbox"
                          checked={(form.financialYears || []).includes(year)}
                          onChange={() => toggleFinancialYear(year)}
                        />
                        {year}
                      </label>
                    ))}
                  </div>
                  <div className="saInlineField saYearAdd">
                    <input
                      value={customFinancialYear}
                      onChange={(event) => setCustomFinancialYear(event.target.value)}
                      placeholder="Add FY e.g. 2027-28"
                    />
                    <button type="button" onClick={addCustomFinancialYear}>Add Year</button>
                  </div>
                  {(form.financialYears || []).length > 0 && (
                    <div className="saYearDefaults">
                      <small>Default FY:</small>
                      <select
                        value={form.financialYear}
                        onChange={(event) => setForm({ ...form, financialYear: event.target.value })}
                      >
                        {(form.financialYears || []).map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <label>
                  <span>Plan *</span>
                  <select value={form.planCode} onChange={(event) => setForm({ ...form, planCode: event.target.value })}>
                    <option value="">Select plan</option>
                    {activePlans.map((plan) => (
                      <option key={plan.code} value={plan.code}>
                        {plan.name} • {money(plan.monthlyAmount)}/mo • {money(plan.yearlyAmount)}/yr
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="saBranchBox">
                <label className="saCheckRow">
                  <input
                    type="checkbox"
                    checked={form.hasMultipleBranches}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        hasMultipleBranches: event.target.checked,
                        branchCount: event.target.checked ? Math.max(2, Number(form.branchCount || 2)) : 1,
                      })
                    }
                  />
                  <span>
                    <strong>Multiple branches</strong>
                    <small>Enable when this company has more than one branch.</small>
                  </span>
                </label>

                {form.hasMultipleBranches && (
                  <label className="saBranchCount">
                    <span>Total Branches</span>
                    <input
                      type="number"
                      min="2"
                      value={form.branchCount}
                      onChange={(event) => setForm({ ...form, branchCount: Math.max(2, Number(event.target.value || 2)) })}
                    />
                    <small>
                      Plan limit: {branchLimit === null || branchLimit === undefined ? "Unlimited" : branchLimit}
                    </small>
                  </label>
                )}
              </div>

              {selectedPlan && (
                <div className="saPlanMiniSummary">
                  <ShieldCheck size={17} />
                  <div>
                    <strong>{selectedPlan.name}</strong>
                    <span>
                      {money(selectedPlan.monthlyAmount)} monthly • {money(selectedPlan.yearlyAmount)} yearly
                      {selectedPlan.groupCode ? ` • Group ${selectedPlan.groupCode}` : ""}
                    </span>
                  </div>
                </div>
              )}

              {!activePlans.length && (
                <div className="resultBanner bad">No ACTIVE plan exists. Create/activate a plan before registering a Superadmin.</div>
              )}

              <div className="saFooterActions">
                <button className="saBtn secondary" type="button" onClick={closeCreate}>
                  Cancel
                </button>
                <button
                  className="saBtn primary"
                  type="button"
                  disabled={!stepOneValid}
                  onClick={() => {
                    if (!form.stakeholders.length && form.companyType) {
                      setForm((current) => ({
                        ...current,
                        stakeholders: [blankStakeholder(current.companyType, current.pan)],
                      }));
                    }
                    setStep(2);
                  }}
                >
                  Next: Stakeholders <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="saStepBody">
              <div className="saStakeholderHeading">
                <div className="saSectionTitle">
                  <Users size={17} /> Stakeholders
                </div>
                {form.companyType !== "PROPRIETORSHIP" && (
                  <button className="saBtn secondary" type="button" onClick={addStakeholder}>
                    <Plus size={15} /> Add More
                  </button>
                )}
              </div>

              {form.companyType === "PROPRIETORSHIP" && (
                <div className="saInfoBox">
                  Proprietorship has one proprietor, so Add More is intentionally disabled.
                </div>
              )}

              <div className="saStakeholderList">
                {form.stakeholders.map((stakeholder, index) => (
                  <div className="saStakeholderCard" key={`${stakeholder.roleType}-${index}`}>
                    <div className="saStakeholderCardTop">
                      <strong>{form.companyType === "PROPRIETORSHIP" ? "Proprietor" : `Stakeholder ${index + 1}`}</strong>
                      {form.companyType !== "PROPRIETORSHIP" && form.stakeholders.length > 1 && (
                        <button className="saIconButton danger" type="button" onClick={() => removeStakeholder(index)}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <div className="saFormGrid stakeholderGrid">
                      <label>
                        <span>Full Name *</span>
                        <input
                          value={stakeholder.name}
                          onChange={(event) => updateStakeholder(index, "name", event.target.value)}
                        />
                      </label>

                      <label>
                        <span>Legal Role *</span>
                        <select
                          value={stakeholder.roleType}
                          onChange={(event) => updateStakeholder(index, "roleType", event.target.value)}
                        >
                          {rolesFor(form.companyType).map((role) => (
                            <option key={role} value={role}>
                              {role.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>PAN</span>
                        <input
                          value={stakeholder.pan}
                          onChange={(event) =>
                            updateStakeholder(index, "pan", event.target.value.toUpperCase().slice(0, 10))
                          }
                        />
                      </label>

                      <label>
                        <span>Aadhaar</span>
                        <input
                          value={stakeholder.aadhaar}
                          onChange={(event) =>
                            updateStakeholder(index, "aadhaar", event.target.value.replace(/\D/g, "").slice(0, 12))
                          }
                        />
                      </label>

                      <label>
                        <span>DIN / DPIN</span>
                        <input
                          value={stakeholder.dinDpin}
                          onChange={(event) => updateStakeholder(index, "dinDpin", event.target.value.toUpperCase())}
                        />
                      </label>

                      <label>
                        <span>Mobile</span>
                        <input
                          value={stakeholder.mobile}
                          onChange={(event) =>
                            updateStakeholder(index, "mobile", event.target.value.replace(/\D/g, "").slice(0, 10))
                          }
                        />
                      </label>

                      <label>
                        <span>Email</span>
                        <input
                          type="email"
                          value={stakeholder.email}
                          onChange={(event) => updateStakeholder(index, "email", event.target.value)}
                        />
                      </label>

                      <label>
                        <span>Designation</span>
                        <input
                          value={stakeholder.designation}
                          onChange={(event) => updateStakeholder(index, "designation", event.target.value)}
                        />
                      </label>

                      <label>
                        <span>Ownership %</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={stakeholder.ownershipPct}
                          onChange={(event) => updateStakeholder(index, "ownershipPct", Number(event.target.value || 0))}
                        />
                      </label>

                      <label>
                        <span>Profit Share %</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={stakeholder.profitSharePct}
                          onChange={(event) => updateStakeholder(index, "profitSharePct", Number(event.target.value || 0))}
                        />
                      </label>

                      <label>
                        <span>Contribution</span>
                        <input
                          type="number"
                          min="0"
                          value={stakeholder.contribution}
                          onChange={(event) => updateStakeholder(index, "contribution", Number(event.target.value || 0))}
                        />
                      </label>

                      <label>
                        <span>Opening Capital</span>
                        <input
                          type="number"
                          value={stakeholder.openingCapital}
                          onChange={(event) => updateStakeholder(index, "openingCapital", Number(event.target.value || 0))}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="saFooterActions">
                <button className="saBtn secondary" type="button" onClick={() => setStep(1)}>
                  <ChevronLeft size={15} /> Back
                </button>
                <button className="saBtn primary" type="button" disabled={!stepTwoValid} onClick={() => setStep(3)}>
                  Next: Payment <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="saStepBody">
              <div className="saSectionTitle">
                <CreditCard size={17} /> Payment
              </div>

              <div className="saPaymentGrid">
                <div className="saBillingCard">
                  <span>Billing Cycle</span>
                  <div className="saCycleButtons">
                    <button
                      type="button"
                      className={form.billingCycle === "MONTHLY" ? "active" : ""}
                      onClick={() => {
                        setPaymentRef("");
                        setPaymentVerified(false);
                        setForm({ ...form, billingCycle: "MONTHLY" });
                      }}
                    >
                      Monthly
                      <strong>{money(selectedPlan?.monthlyAmount)}</strong>
                    </button>
                    <button
                      type="button"
                      className={form.billingCycle === "YEARLY" ? "active" : ""}
                      onClick={() => {
                        setPaymentRef("");
                        setPaymentVerified(false);
                        setForm({ ...form, billingCycle: "YEARLY" });
                      }}
                    >
                      Yearly
                      <strong>{money(selectedPlan?.yearlyAmount)}</strong>
                    </button>
                  </div>
                </div>

                <div className="saAmountCard">
                  <BadgeIndianRupee size={22} />
                  <span>Amount Payable</span>
                  <strong>{money(planAmount)}</strong>
                  <small>{selectedPlan?.name || form.planCode}</small>
                </div>
              </div>

              <label className="saSkipPayment">
                <input
                  type="checkbox"
                  checked={form.skipPayment}
                  onChange={(event) => {
                    setPaymentRef("");
                    setPaymentVerified(false);
                    setForm({ ...form, skipPayment: event.target.checked });
                  }}
                />
                <span>
                  <strong>Payment already received — skip Razorpay</strong>
                  <small>MASTER confirms that this plan payment has already been paid/received.</small>
                </span>
              </label>

              {form.skipPayment && (
                <label className="saManualNote">
                  <span>Payment Note / Reference</span>
                  <input
                    value={form.manualPaymentNote}
                    onChange={(event) => setForm({ ...form, manualPaymentNote: event.target.value })}
                    placeholder="Optional receipt / bank / reference note"
                  />
                </label>
              )}

              {!form.skipPayment && planAmount > 0 && !razorpayStatus.configured && (
                <div className="saInfoBox warning">
                  Razorpay is not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env and restart Docker, or use the paid/skip checkbox.
                </div>
              )}

              {paymentVerified && (
                <div className="saPaymentVerified">
                  <CircleCheckBig size={18} />
                  <div>
                    <strong>Payment verified</strong>
                    <span>{paymentRef}</span>
                  </div>
                </div>
              )}

              <div className="saFinalSummary">
                <div><span>Company</span><strong>{form.companyName}</strong></div>
                <div><span>GSTIN</span><strong>{form.gstin}</strong></div>
                <div><span>Plan</span><strong>{selectedPlan?.name || form.planCode}</strong></div>
                <div><span>Branches</span><strong>{form.hasMultipleBranches ? form.branchCount : 1}</strong></div>
                <div><span>Stakeholders</span><strong>{form.stakeholders.length}</strong></div>
                <div><span>Amount</span><strong>{money(planAmount)}</strong></div>
              </div>

              <div className="saFooterActions">
                <button className="saBtn secondary" type="button" disabled={paying || creating} onClick={() => setStep(2)}>
                  <ChevronLeft size={15} /> Back
                </button>
                <button className="saBtn primary large" type="button" disabled={paying || creating} onClick={finish}>
                  {paying || creating ? (
                    <>
                      <Loader2 className="spin" size={16} /> {paying ? "Processing Payment..." : "Creating..."}
                    </>
                  ) : form.skipPayment || planAmount <= 0 || paymentVerified ? (
                    <>
                      <ShieldCheck size={16} /> Create Superadmin
                    </>
                  ) : (
                    <>
                      <CreditCard size={16} /> Pay {money(planAmount)} & Create
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="panel saListPanel">
        <DataTable
          rows={rows}
          empty="No Superadmins created yet"
          columns={[
            {
              key: "company",
              label: "Company",
              render: (row) => (
                <button
                  type="button"
                  className="saCompanyCell saCompanyLink"
                  onClick={() => setSelectedSuperadminId(row._id)}
                  title="Open Superadmin details"
                >
                  <strong>{row.companyProfile?.companyName || row.name}</strong>
                  <small>{row.companyProfile?.gstin || row.tenantKey}</small>
                </button>
              ),
            },
            { key: "email", label: "Email" },
            {
              key: "planCode",
              label: "Plan",
              render: (row) => row.plan?.name || row.companyProfile?.planCode || row.planCode || "—",
            },
            {
              key: "daysLeft",
              label: "Days Left",
              render: (row) => {
                const days = Number(row.subscription?.daysLeft);
                const status = String(row.subscription?.status || "").toUpperCase();
                return (
                  <span className={`saDaysBadge ${status.toLowerCase()}`}>
                    {Number.isFinite(days) ? Math.max(0, days) : "—"}
                  </span>
                );
              },
            },
            {
              key: "renewal",
              label: "Renewal",
              render: (row) => {
                const value = row.subscription?.renewalDate;
                if (!value) return "—";
                const date = new Date(value);
                return Number.isNaN(date.getTime())
                  ? "—"
                  : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
              },
            },
            {
              key: "branches",
              label: "Branches",
              render: (row) => row.companyProfile?.branchCount || 1,
            },
            {
              key: "payment",
              label: "Payment",
              render: (row) => row.companyProfile?.paymentStatus || "—",
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <span className={`saListStatus ${String(row.subscription?.status || row.companyProfile?.status || row.status || "ACTIVE").toLowerCase()}`}>
                  {row.subscription?.status || row.companyProfile?.status || row.status || "ACTIVE"}
                </span>
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="rowActions">
                  <button title="Open details" onClick={() => setSelectedSuperadminId(row._id)}>
                    <Search size={15} />
                  </button>
                  <button title="Reset password" onClick={() => resetPassword(row)}>
                    <KeyRound size={15} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </section>

      {selectedSuperadminId && (
        <SuperadminDetailsPanel
          superadminId={selectedSuperadminId}
          plans={plans}
          onClose={() => setSelectedSuperadminId("")}
          onChanged={load}
          notify={notify}
        />
      )}
    </>
  );
}
