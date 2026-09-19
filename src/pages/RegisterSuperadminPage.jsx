import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronRight,
  CircleCheckBig,
  CreditCard,
  KeyRound,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import { api } from "../lib/api.js";
import "../register-superadmin.css";

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

const currentFinancialYear = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String(year + 1).slice(-2)}`;
};

const yearOptions = () => {
  const current = Number(currentFinancialYear().slice(0, 4));
  return Array.from({ length: 6 }, (_, index) => {
    const start = current - 1 + index;
    return `${start}-${String(start + 1).slice(-2)}`;
  });
};

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

const blankStakeholder = (companyType, pan = "") => ({
  name: "",
  roleType: rolesFor(companyType)[0],
  pan: companyType === "PROPRIETORSHIP" ? pan : "",
  aadhaar: "",
  dinDpin: "",
  mobile: "",
  email: "",
  designation: "",
  ownershipPct: 0,
  profitSharePct: 0,
  contribution: 0,
  openingCapital: 0,
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
  stakeholders: [],
  planCode: "",
  billingCycle: "YEARLY",
  skipPayment: false,
  gstVerified: false,
  gstSource: "",
  gstStatus: "",
  gstTaxpayerType: "",
  gstConstitution: "",
});

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const limitText = (value) =>
  value === null || value === undefined || value === "" ? "Unlimited" : String(value);

export default function RegisterSuperadminPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm());
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [gstLoading, setGstLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordEdited, setPasswordEdited] = useState(false);
  const [customFinancialYear, setCustomFinancialYear] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/registration/plans")
      .then((rows) => setPlans(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingPlans(false));
  }, []);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.code === form.planCode),
    [plans, form.planCode]
  );

  const changeGstin = (raw) => {
    const gstin = gstinClean(raw);
    const pan = panFromGstin(gstin);
    setForm((current) => ({
      ...current,
      gstin,
      pan,
      password: passwordEdited ? current.password : passwordFromGstin(gstin),
      gstVerified: false,
      stakeholders:
        current.companyType === "PROPRIETORSHIP" && current.stakeholders.length
          ? [{ ...current.stakeholders[0], pan }]
          : current.stakeholders,
    }));
  };

  const lookupGst = async () => {
    if (form.gstin.length !== 15) return setError("Enter a complete 15-character GST Number");
    setError("");
    setGstLoading(true);
    try {
      const taxpayer = await api(`/registration/gst/search?gstin=${encodeURIComponent(form.gstin)}`);
      const raw = taxpayer?.principalAddressRaw || {};
      const pin = String(raw.pncd || raw.pincode || "").replace(/\D/g, "").slice(0, 6);
      setForm((current) => ({
        ...current,
        companyName: taxpayer.legalName || taxpayer.tradeName || current.companyName,
        tradeName: taxpayer.tradeName || current.tradeName,
        pan: taxpayer.pan || panFromGstin(current.gstin),
        address: taxpayer.principalAddress || current.address,
        pincode: pin || current.pincode,
        city: raw.city || raw.loc || raw.dst || current.city,
        state: raw.state || raw.stcd || current.state,
        gstVerified: true,
        gstSource: taxpayer.source || "GST_PROVIDER",
        gstStatus: taxpayer.status || "",
        gstTaxpayerType: taxpayer.taxpayerType || "",
        gstConstitution: taxpayer.constitution || "",
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setGstLoading(false);
    }
  };

  const lookupPincode = async () => {
    if (form.pincode.length !== 6) return;
    setPinLoading(true);
    try {
      const rows = await api(`/registration/pincode?pincode=${form.pincode}`);
      const match = Array.isArray(rows) ? rows[0] : null;
      if (match) {
        setForm((current) => ({
          ...current,
          city: match.city || match.district || current.city,
          state: match.state || current.state,
        }));
      }
    } catch {
      // Pincode lookup is an enrichment helper only.
    } finally {
      setPinLoading(false);
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
      stakeholders: current.stakeholders.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const addStakeholder = () => {
    if (form.companyType === "PROPRIETORSHIP") return;
    setForm((current) => ({
      ...current,
      stakeholders: [...current.stakeholders, blankStakeholder(current.companyType)],
    }));
  };

  const removeStakeholder = (index) => {
    if (form.companyType === "PROPRIETORSHIP") return;
    setForm((current) => ({
      ...current,
      stakeholders: current.stakeholders.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const toggleFinancialYear = (year) => {
    setForm((current) => {
      const exists = current.financialYears.includes(year);
      const financialYears = exists
        ? current.financialYears.filter((item) => item !== year)
        : [...current.financialYears, year];
      return {
        ...current,
        financialYears,
        financialYear: financialYears.includes(current.financialYear)
          ? current.financialYear
          : financialYears[0] || "",
      };
    });
  };

  const addFinancialYear = () => {
    const value = customFinancialYear.trim();
    if (!/^20\d{2}-\d{2}$/.test(value)) {
      setError("Financial Year must be in YYYY-YY format, for example 2026-27");
      return;
    }
    setForm((current) => ({
      ...current,
      financialYears: Array.from(new Set([...current.financialYears, value])),
      financialYear: current.financialYear || value,
    }));
    setCustomFinancialYear("");
    setError("");
  };

  const companyValid =
    form.gstin.length === 15 &&
    form.pan.length === 10 &&
    form.companyName.trim() &&
    form.companyType &&
    /^\S+@\S+\.\S+$/.test(form.email) &&
    form.password.length >= 8 &&
    form.financialYears.length > 0 &&
    (!form.hasMultipleBranches || Number(form.branchCount) >= 2);

  const stakeholdersValid =
    form.stakeholders.length > 0 &&
    form.stakeholders.every((stakeholder) => stakeholder.name.trim());

  const submit = async () => {
    setError("");
    if (!form.skipPayment) {
      setError("Tick 'Payment already done / skip payment' to complete registration for now.");
      return;
    }
    setSaving(true);
    try {
      await api("/registration/superadmin", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          branchCount: form.hasMultipleBranches ? Number(form.branchCount || 2) : 1,
        }),
      });
      navigate("/login?registered=success", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="registerPage">
      <div className="registerShell">
        <div className="registerTopbar">
          <Logo />
          <Link to="/login"><ArrowLeft size={15} /> Back to login</Link>
        </div>

        <div className="registerCard">
          <div className="registerHeading">
            <span>Company Registration</span>
            <h1>Create your Rupioo account</h1>
            <p>Company details, stakeholders, plan selection and confirmation.</p>
          </div>

          <div className="registerSteps">
            {[[1,"Company"],[2,"Stakeholders"],[3,"Plan"],[4,"Payment"]].map(([number,label]) => (
              <div key={number} className={step >= number ? "active" : ""}>
                <b>{step > number ? <Check size={13}/> : number}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {error && <div className="registerError">{error}</div>}

          {step === 1 && (
            <section className="registerSection">
              <div className="registerSectionTitle"><Building2 size={17}/> Company & Login Details</div>
              <div className="registerGrid">
                <label className="wide">
                  <span>GST Number *</span>
                  <div className="registerInline">
                    <input value={form.gstin} onChange={(e) => changeGstin(e.target.value)} placeholder="15-character GSTIN" />
                    <button type="button" onClick={lookupGst} disabled={gstLoading || form.gstin.length !== 15}>
                      {gstLoading ? <Loader2 size={14} className="spin"/> : <Search size={14}/>} Fetch GST
                    </button>
                  </div>
                  {form.gstVerified && <small className="good"><CircleCheckBig size={12}/> GST verified</small>}
                </label>
                <label><span>PAN Number *</span><input value={form.pan} readOnly placeholder="Auto from GSTIN"/></label>
                <label><span>Company Name *</span><input value={form.companyName} onChange={(e)=>setForm({...form,companyName:e.target.value})}/></label>
                <label><span>Trade Name</span><input value={form.tradeName} onChange={(e)=>setForm({...form,tradeName:e.target.value})}/></label>
                <label><span>Aadhaar Number</span><input value={form.aadhaar} onChange={(e)=>setForm({...form,aadhaar:e.target.value.replace(/\D/g,"").slice(0,12)})}/></label>
                <label><span>Mobile Number</span><input value={form.mobile} onChange={(e)=>setForm({...form,mobile:e.target.value.replace(/\D/g,"").slice(0,10)})}/></label>
                <label>
                  <span>Company Type *</span>
                  <select value={form.companyType} onChange={(e)=>changeCompanyType(e.target.value)}>
                    <option value="">Select company type</option>
                    {COMPANY_TYPES.map(([value,label])=><option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="wide"><span>Address</span><textarea rows="2" value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})}/></label>
                <label>
                  <span>Pincode</span>
                  <div className="registerInputIcon"><MapPin size={14}/><input value={form.pincode} onChange={(e)=>setForm({...form,pincode:e.target.value.replace(/\D/g,"").slice(0,6)})} onBlur={lookupPincode}/>{pinLoading&&<Loader2 size={13} className="spin"/>}</div>
                </label>
                <label><span>City</span><input value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})}/></label>
                <label><span>State</span><input value={form.state} onChange={(e)=>setForm({...form,state:e.target.value})}/></label>
                <label><span>Email ID *</span><input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value.trim()})}/></label>
                <label>
                  <span>Password *</span>
                  <div className="registerInline">
                    <input value={form.password} onChange={(e)=>{setPasswordEdited(true);setForm({...form,password:e.target.value})}}/>
                    <button type="button" onClick={()=>{setPasswordEdited(false);setForm({...form,password:passwordFromGstin(form.gstin)})}}><KeyRound size={13}/> Auto</button>
                  </div>
                  <small>Default = first 4 + last 4 characters of GSTIN.</small>
                </label>

                <div className="wide">
                  <span className="fieldLabel">Financial Years *</span>
                  <div className="yearChips">
                    {yearOptions().map((year)=><label key={year} className={form.financialYears.includes(year)?"active":""}><input type="checkbox" checked={form.financialYears.includes(year)} onChange={()=>toggleFinancialYear(year)}/>{year}</label>)}
                  </div>
                  <div className="registerInline yearCustom">
                    <input value={customFinancialYear} onChange={(e)=>setCustomFinancialYear(e.target.value)} placeholder="Add FY e.g. 2028-29"/>
                    <button type="button" onClick={addFinancialYear}>Add Year</button>
                  </div>
                  {!!form.financialYears.length && <div className="defaultYear"><small>Default FY</small><select value={form.financialYear} onChange={(e)=>setForm({...form,financialYear:e.target.value})}>{form.financialYears.map((year)=><option key={year}>{year}</option>)}</select></div>}
                </div>
              </div>

              <div className="registerBranch">
                <label><input type="checkbox" checked={form.hasMultipleBranches} onChange={(e)=>setForm({...form,hasMultipleBranches:e.target.checked,branchCount:e.target.checked?Math.max(2,Number(form.branchCount||2)):1})}/><span><b>Multiple branches</b><small>Enable if this company has more than one branch.</small></span></label>
                {form.hasMultipleBranches && <div><span>Total Branches</span><input type="number" min="2" value={form.branchCount} onChange={(e)=>setForm({...form,branchCount:Math.max(2,Number(e.target.value||2))})}/></div>}
              </div>

              <div className="registerActions"><span/><button type="button" disabled={!companyValid} onClick={()=>setStep(2)}>Next: Stakeholders <ChevronRight size={14}/></button></div>
            </section>
          )}

          {step === 2 && (
            <section className="registerSection">
              <div className="registerSectionTitle"><Users size={17}/> Stakeholders</div>
              {form.companyType === "PROPRIETORSHIP" && <div className="registerInfo">Proprietorship has exactly one proprietor. Add More is disabled.</div>}
              <div className="stakeholderList">
                {form.stakeholders.map((stakeholder,index)=><div className="stakeholderCard" key={index}>
                  <div className="stakeholderTop"><b>{form.companyType==="PROPRIETORSHIP"?"Proprietor":`Stakeholder ${index+1}`}</b>{form.companyType!=="PROPRIETORSHIP"&&form.stakeholders.length>1&&<button type="button" onClick={()=>removeStakeholder(index)}><Trash2 size={14}/></button>}</div>
                  <div className="registerGrid compact">
                    <label><span>Full Name *</span><input value={stakeholder.name} onChange={(e)=>updateStakeholder(index,"name",e.target.value)}/></label>
                    <label><span>Legal Role *</span><select value={stakeholder.roleType} onChange={(e)=>updateStakeholder(index,"roleType",e.target.value)}>{rolesFor(form.companyType).map((role)=><option key={role}>{role}</option>)}</select></label>
                    <label><span>PAN</span><input value={stakeholder.pan} onChange={(e)=>updateStakeholder(index,"pan",e.target.value.toUpperCase().slice(0,10))}/></label>
                    <label><span>Aadhaar</span><input value={stakeholder.aadhaar} onChange={(e)=>updateStakeholder(index,"aadhaar",e.target.value.replace(/\D/g,"").slice(0,12))}/></label>
                    <label><span>DIN / DPIN</span><input value={stakeholder.dinDpin} onChange={(e)=>updateStakeholder(index,"dinDpin",e.target.value)}/></label>
                    <label><span>Mobile</span><input value={stakeholder.mobile} onChange={(e)=>updateStakeholder(index,"mobile",e.target.value.replace(/\D/g,"").slice(0,10))}/></label>
                    <label><span>Email</span><input value={stakeholder.email} onChange={(e)=>updateStakeholder(index,"email",e.target.value)}/></label>
                    <label><span>Designation</span><input value={stakeholder.designation} onChange={(e)=>updateStakeholder(index,"designation",e.target.value)}/></label>
                    <label><span>Ownership %</span><input type="number" value={stakeholder.ownershipPct} onChange={(e)=>updateStakeholder(index,"ownershipPct",Number(e.target.value||0))}/></label>
                    <label><span>Profit Share %</span><input type="number" value={stakeholder.profitSharePct} onChange={(e)=>updateStakeholder(index,"profitSharePct",Number(e.target.value||0))}/></label>
                    <label><span>Contribution</span><input type="number" value={stakeholder.contribution} onChange={(e)=>updateStakeholder(index,"contribution",Number(e.target.value||0))}/></label>
                    <label><span>Opening Capital</span><input type="number" value={stakeholder.openingCapital} onChange={(e)=>updateStakeholder(index,"openingCapital",Number(e.target.value||0))}/></label>
                  </div>
                </div>)}
              </div>
              {form.companyType!=="PROPRIETORSHIP"&&<button className="addStakeholder" type="button" onClick={addStakeholder}><Plus size={14}/> Add More</button>}
              <div className="registerActions"><button className="secondary" type="button" onClick={()=>setStep(1)}>Back</button><button type="button" disabled={!stakeholdersValid} onClick={()=>setStep(3)}>Next: Select Plan <ChevronRight size={14}/></button></div>
            </section>
          )}

          {step === 3 && (
            <section className="registerSection">
              <div className="registerSectionTitle"><ShieldCheck size={17}/> Select Plan</div>
              {loadingPlans ? <div className="registerInfo">Loading plans...</div> : !plans.length ? <div className="registerError">No ACTIVE plan is available.</div> : <div className="planGrid">
                {plans.map((plan)=><button type="button" key={plan.code} className={`planCard ${form.planCode===plan.code?"selected":""}`} onClick={()=>setForm({...form,planCode:plan.code})}>
                  <div className="planCardTop"><div><b>{plan.name}</b><small>{plan.groupCode?`Group: ${plan.groupCode}`:"Standard Plan"}</small></div>{form.planCode===plan.code&&<CircleCheckBig size={20}/>}</div>
                  <div className="planPrices"><span><b>{money(plan.monthlyAmount)}</b><small>/ month</small></span><span><b>{money(plan.yearlyAmount)}</b><small>/ year</small></span></div>
                  <div className="planLimits">
                    <span>Users <b>{limitText(plan.limits?.users)}</b></span>
                    <span>Employees <b>{limitText(plan.limits?.employees)}</b></span>
                    <span>Branches <b>{limitText(plan.limits?.companies)}</b></span>
                    <span>Warehouses <b>{limitText(plan.limits?.warehouses)}</b></span>
                    <span>Storage GB <b>{limitText(plan.limits?.storageGb)}</b></span>
                    <span>Roles <b>{plan.roleCount || "All"}</b></span>
                  </div>
                  <div className="planAddons">{Object.entries(plan.addons||{}).filter(([,enabled])=>enabled).map(([key])=><span key={key}>{key}</span>)}</div>
                </button>)}
              </div>}
              {selectedPlan&&<div className="billingChoice"><b>Billing preference</b><button type="button" className={form.billingCycle==="MONTHLY"?"active":""} onClick={()=>setForm({...form,billingCycle:"MONTHLY"})}>Monthly • {money(selectedPlan.monthlyAmount)}</button><button type="button" className={form.billingCycle==="YEARLY"?"active":""} onClick={()=>setForm({...form,billingCycle:"YEARLY"})}>Yearly • {money(selectedPlan.yearlyAmount)}</button></div>}
              <div className="registerActions"><button className="secondary" type="button" onClick={()=>setStep(2)}>Back</button><button type="button" disabled={!form.planCode} onClick={()=>setStep(4)}>Next: Payment <ChevronRight size={14}/></button></div>
            </section>
          )}

          {step === 4 && (
            <section className="registerSection paymentStep">
              <div className="registerSectionTitle"><CreditCard size={17}/> Payment Confirmation</div>
              <div className="paymentSummary"><span>Plan<strong>{selectedPlan?.name || form.planCode}</strong></span><span>Cycle<strong>{form.billingCycle}</strong></span><span>Amount<strong>{money(form.billingCycle==="MONTHLY"?selectedPlan?.monthlyAmount:selectedPlan?.yearlyAmount)}</strong></span></div>
              <label className="paymentCheck"><input type="checkbox" checked={form.skipPayment} onChange={(e)=>setForm({...form,skipPayment:e.target.checked})}/><span><b>Payment already done / skip payment</b><small>For now this records the selected plan amount as paid and completes registration.</small></span></label>
              <div className="registerActions"><button className="secondary" type="button" onClick={()=>setStep(3)}>Back</button><button type="button" disabled={!form.skipPayment||saving} onClick={submit}>{saving?<><Loader2 size={14} className="spin"/> Registering...</>:"Create Superadmin Account"}</button></div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
