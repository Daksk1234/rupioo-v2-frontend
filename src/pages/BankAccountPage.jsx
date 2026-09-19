import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api, getUser } from "../lib/api.js";
import { bankFieldsFromIfsc, lookupIfscMaster, normalizeIfsc } from "../lib/ifscLookup.js";
import { accessForPath } from "../lib/permissionAccess.js";
import "../profile-bank.css";

const blank = {
  bankName: "", branchName: "", branchAddress: "", city: "", state: "", stdCode: "", phone: "", contactNo: "",
  accountHolderName: "", accountNumber: "", ifsc: "", micr: "", swiftCode: "", upiId: "", accountType: "CURRENT",
  openingBalance: 0, openingBalanceType: "DR", financialYear: "", openingBalances: [], isPrimary: false, status: "ACTIVE", remarks: "",
};

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const maskAccount = (value) => { const text = String(value || ""); return text.length <= 4 ? text : `${"•".repeat(Math.min(8, text.length - 4))}${text.slice(-4)}`; };
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

export default function BankAccountPage() {
  const access = accessForPath("/dms/bank-accounts");
  const session = getUser();
  const selectedFy = localStorage.getItem("financialYearSelected") || session?.companyProfile?.financialYear || "";
  const years = uniq([...(session?.companyProfile?.financialYears || []), session?.companyProfile?.financialYear, selectedFy]);

  const [rows, setRows] = useState([]), [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [q, setQ] = useState(""), [status, setStatus] = useState("ACTIVE"), [page, setPage] = useState(1);
  const [show, setShow] = useState(false), [edit, setEdit] = useState(null), [form, setForm] = useState({ ...blank, financialYear: selectedFy || years[0] || "" });
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const [ifscLoading, setIfscLoading] = useState(false);
  const ifscTimerRef = useRef(null);
  const ifscRequestRef = useRef(0);

  const openingRowsFor = (row = {}) => {
    const map = new Map((row.openingBalances || []).map(x => [String(x.financialYear), { financialYear:String(x.financialYear), amount:Number(x.amount || 0), type:x.type === "CR" ? "CR" : "DR", source:x.source || "MANUAL" }]));
    if (row.financialYear && !map.has(String(row.financialYear))) map.set(String(row.financialYear), { financialYear:String(row.financialYear), amount:Number(row.openingBalance || 0), type:row.openingBalanceType === "CR" ? "CR" : "DR", source:"LEGACY" });
    for (const fy of years) if (!map.has(String(fy))) map.set(String(fy), { financialYear:String(fy), amount:0, type:"DR", source:"MANUAL" });
    return [...map.values()].sort((a,b)=>a.financialYear.localeCompare(b.financialYear));
  };

  const load = async (nextPage = page, nextStatus = status) => {
    setError("");
    try {
      const data = await api(`/banks?q=${encodeURIComponent(q)}&status=${encodeURIComponent(nextStatus)}&financialYear=${encodeURIComponent(selectedFy)}&page=${nextPage}&limit=50`);
      setRows(data.items || []); setMeta(data.meta || { page: nextPage, pages: 1, total: 0 }); setPage(data.meta?.page || nextPage);
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);


  const open = (row = null) => {
    setEdit(row);
    const financialYear = selectedFy || years[0] || session?.companyProfile?.financialYear || "";
    setForm(row ? { ...blank, ...row, financialYear, openingBalances: openingRowsFor(row) } : { ...blank, financialYear, openingBalances: openingRowsFor({}) });
    setShow(true); setError(""); setMessage("");
  };

  const lookupIfsc = async (raw) => {
    const code = normalizeIfsc(raw).slice(0, 11);
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) return;

    const requestId = ++ifscRequestRef.current;
    setIfscLoading(true);
    setError("");
    setMessage("");

    try {
      // Use the same proven MASTER IFSC lookup already used by Customer/User.
      // One exact lookup only = faster and avoids chained/failing routes.
      const row = await lookupIfscMaster(code);
      if (requestId !== ifscRequestRef.current) return;

      const b = bankFieldsFromIfsc(row);
      setForm((current) => {
        // Ignore late responses if the IFSC has changed while the request ran.
        if (normalizeIfsc(current.ifsc) !== code) return current;
        return {
          ...current,
          ifsc: code,
          bankName: b.bankName,
          branchName: b.branchName,
          branchAddress: b.bankAddress,
          city: b.bankCity,
          state: b.bankState,
          stdCode: b.bankStdCode,
          phone: b.bankPhone,
          contactNo: b.bankContactNo,
        };
      });
      setMessage(`Bank details loaded automatically for ${code}`);
    } catch (e) {
      if (requestId !== ifscRequestRef.current) return;
      setError(e?.message || `IFSC ${code} not found in MASTER IFSC database`);
    } finally {
      if (requestId === ifscRequestRef.current) setIfscLoading(false);
    }
  };

  const changeIfsc = (value) => {
    const code = normalizeIfsc(value).slice(0, 11);

    // Cancel any pending auto lookup and invalidate any in-flight response.
    if (ifscTimerRef.current) clearTimeout(ifscTimerRef.current);
    ifscRequestRef.current += 1;
    setIfscLoading(false);
    setError("");
    setMessage("");

    setForm((current) => ({
      ...current,
      ifsc: code,
      // Clear old auto-filled values immediately when IFSC changes.
      bankName: "", branchName: "", branchAddress: "", city: "", state: "",
      stdCode: "", phone: "", contactNo: "",
    }));

    // Auto-fetch almost immediately when the IFSC becomes valid. This tiny
    // delay prevents duplicate calls from fast typing/paste without feeling slow.
    if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
      ifscTimerRef.current = setTimeout(() => lookupIfsc(code), 60);
    }
  };

  useEffect(() => () => {
    if (ifscTimerRef.current) clearTimeout(ifscTimerRef.current);
    ifscRequestRef.current += 1;
  }, []);

  const changeOpening = (fy, patch) => setForm(current => ({ ...current, openingBalances:(current.openingBalances || []).map(row => row.financialYear === fy ? { ...row, ...patch, source:"MANUAL" } : row) }));

  const save = async () => {
    setError(""); setMessage("");
    try {
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizeIfsc(form.ifsc))) throw new Error("IFSC code is mandatory and must be valid");
      const currentOpening=(form.openingBalances || []).find(x=>x.financialYear===form.financialYear) || {amount:0,type:"DR"};
      const payload={...form,openingBalance:Number(currentOpening.amount || 0),openingBalanceType:currentOpening.type || "DR"};
      const saved = await api(edit ? `/banks/${edit._id}` : "/banks", { method: edit ? "PUT" : "POST", body: JSON.stringify(payload) });
      setMessage(edit ? "Bank account updated" : "Bank account created");
      if (edit) { setEdit(saved); setForm({...blank,...saved,financialYear:form.financialYear,openingBalances:openingRowsFor(saved)}); await load(page); }
      else { setShow(false); await load(1); }
    } catch (e) { setError(e.message); }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.bankName} account ending ${String(row.accountNumber || "").slice(-4)}?\n\nThe accounting ledger will be preserved as inactive for audit/history.`)) return;
    try { await api(`/banks/${row._id}`, { method: "DELETE" }); setMessage("Bank account deleted safely"); setShow(false); await load(page); } catch (e) { setError(e.message); }
  };


  const primary = useMemo(() => rows.find((row) => row.isPrimary && row.status === "ACTIVE"), [rows]);
  const fyOpeningTotal = rows.reduce((sum,row)=>sum + (row.fyOpeningBalanceType === "CR" ? -Number(row.fyOpeningBalance || 0) : Number(row.fyOpeningBalance || 0)),0);

  return <>
    <PageHeader title="Bank Accounts" description="Bank master with IFSC lookup and separate opening balance for every financial year." onAdd={() => open(null)} addLabel="Add Bank Account" />
    {message && <div className="resultBanner good">{message}</div>}{error && <div className="resultBanner bad">{error}</div>}

    <section className="bankSummaryStrip">
      <div className="bankSummaryIcon"><Landmark size={22}/></div>
      <div><span>Active Accounts</span><strong>{rows.filter(x => x.status === "ACTIVE").length}</strong></div>
      <div><span>Primary Bank</span><strong>{primary ? `${primary.bankName} • ${String(primary.accountNumber || "").slice(-4)}` : "Not selected"}</strong></div>
      <div><span>{selectedFy || "FY"} Opening Total</span><strong>{money(fyOpeningTotal)}</strong></div>
    </section>

    <section className="panel">
      <div className="toolbar bankToolbar">
        <div className="searchBox"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key === "Enter" && load(1)} placeholder="Search bank, branch, account, IFSC…"/></div>
        <select value={status} onChange={e=>{const value=e.target.value;setStatus(value);load(1,value)}}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ALL">All</option></select>
        <button className="btn ghost" onClick={()=>load(1)}><RefreshCw size={15}/>Refresh</button><span className="recordCount">{meta.total || 0} accounts</span>
      </div>
      <DataTable rows={rows} columns={[
        { key:"bankName", label:"Bank", render:row=><button className="masterLinkButton" onClick={()=>open(row)}><div className="bankNameCell"><span className="bankMiniIcon"><Landmark size={14}/></span><span><strong>{row.bankName}</strong><small>{row.branchName || "—"}</small></span>{row.isPrimary && <Star size={13} className="bankStar"/>}</div></button> },
        { key:"accountHolderName", label:"Account Holder" }, { key:"accountNumber", label:"Account No.", render:row=><span className="monoText">{maskAccount(row.accountNumber)}</span> }, { key:"ifsc", label:"IFSC" }, { key:"accountType", label:"Type" },
        { key:"fyOpeningBalance", label:`Opening ${selectedFy || "FY"}`, render:row=>row.fyOpeningConfigured ? `${money(row.fyOpeningBalance)} ${row.fyOpeningBalanceType || "DR"}` : <span className="textWarning">Not set</span> },
        { key:"status", label:"Status", render:row=><StatusBadge value={row.status}/> },
        { key:"edit", label:"", render:row=>access.edit?<button className="iconBtn" title="Edit bank account" onClick={()=>open(row)}><Pencil size={15}/></button>:null },
      ]}/>
      <div className="paginationBar"><span>Page {page} of {meta.pages || 1}</span><div><button className="btn ghost" disabled={page <= 1} onClick={()=>load(page - 1)}>Previous</button><button className="btn ghost" disabled={page >= (meta.pages || 1)} onClick={()=>load(page + 1)}>Next</button></div></div>
    </section>

    {show && <div className="modalOverlay"><section className="panel modalPanel wideModal bankEditor financeBankEditor">
      <div className="formTitle"><div><h3>{edit ? "Edit" : "Create"} Bank Account</h3><span>Enter account details and type the IFSC; verified bank details fill automatically from IFSC MASTER.</span></div><button className="iconBtn" onClick={()=>setShow(false)}><X/></button></div>
      <div className="sectionLabel"><Landmark size={15}/>Step 1 — Account Details</div>
      <div className="formGrid compactGrid">
        <label>Account Holder Name *<input value={form.accountHolderName} onChange={e=>setForm(current=>({...current,accountHolderName:e.target.value}))}/></label>
        <label>Account Number *<input value={form.accountNumber} onChange={e=>setForm(current=>({...current,accountNumber:e.target.value.replace(/\s/g,"")}))}/></label>
        <label>Account Type<select value={form.accountType} onChange={e=>setForm(current=>({...current,accountType:e.target.value}))}><option>CURRENT</option><option>SAVINGS</option><option>OD</option><option>CC</option><option>OTHER</option></select></label>
      </div>

      <div className="sectionLabel"><Search size={15}/>Step 2 — IFSC Auto Fetch</div>
      <div className="formGrid compactGrid">
        <label>IFSC *<div className="bankIfscRow"><input value={form.ifsc} maxLength={11} autoComplete="off" onChange={e=>changeIfsc(e.target.value)} placeholder="e.g. SBIN0001234"/>{ifscLoading && <span className="ifscInlineLoading" title="Fetching IFSC details"><RefreshCw size={14} className="spin"/></span>}</div><small>{ifscLoading?"Fetching bank details automatically…":"Enter/paste the 11-character IFSC; details fill automatically."}</small></label>
        <label className="bankAutoField">Bank Name<input value={form.bankName} readOnly/></label>
        <label className="bankAutoField">Branch / Area<input value={form.branchName} readOnly/></label>
        <label className="bankAutoField span2">Bank Address<textarea value={form.branchAddress||""} readOnly/></label>
        <label className="bankAutoField">City<input value={form.city||""} readOnly/></label>
        <label className="bankAutoField">State<input value={form.state||""} readOnly/></label>
        <label className="bankAutoField">Contact No.<input value={form.contactNo||""} readOnly/></label>
      </div>

      <div className="sectionLabel">Step 3 — Additional Bank Details</div>
      <div className="formGrid compactGrid">
        <label>MICR<input value={form.micr} onChange={e=>setForm(current=>({...current,micr:e.target.value}))}/></label>
        <label>SWIFT Code<input value={form.swiftCode} onChange={e=>setForm(current=>({...current,swiftCode:e.target.value.toUpperCase()}))}/></label>
        <label>UPI ID<input value={form.upiId} onChange={e=>setForm(current=>({...current,upiId:e.target.value}))}/></label>
        <label>Status<select value={form.status} onChange={e=>setForm(current=>({...current,status:e.target.value}))}><option>ACTIVE</option><option>INACTIVE</option></select></label>
      </div>

      <div className="sectionLabel">Financial Year Opening Balances</div>
      <div className="fyOpeningGrid">
        {(form.openingBalances || []).map(row=><div className="fyOpeningCard" key={row.financialYear}><strong>{row.financialYear}</strong><input type="number" min="0" step="0.01" value={row.amount} onChange={e=>changeOpening(row.financialYear,{amount:Number(e.target.value)})}/><select value={row.type} onChange={e=>changeOpening(row.financialYear,{type:e.target.value})}><option>DR</option><option>CR</option></select><small>{row.source === "STATEMENT" ? "From statement" : "Opening balance"}</small></div>)}
      </div>
      <div className="formGrid compactGrid"><label className="bankPrimaryCheck"><input type="checkbox" checked={Boolean(form.isPrimary)} onChange={e=>setForm({...form,isPrimary:e.target.checked})}/><span>Set as Primary Bank Account</span></label><label className="wideField">Remarks<textarea value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></label></div>


      <div className="formActions">{edit && access.delete && <button className="btn danger" onClick={()=>remove(edit)}><Trash2 size={15}/>Delete</button>}<span className="formActionSpacer"/><button className="btn ghost" onClick={()=>setShow(false)}>Close</button><button className="btn primary" onClick={save} disabled={!form.ifsc || !form.bankName || !form.accountHolderName || !form.accountNumber}><Plus size={15}/>{edit ? "Update Account" : "Create Account"}</button></div>
    </section></div>}
  </>;
}
