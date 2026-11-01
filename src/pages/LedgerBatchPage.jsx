import React, {useEffect, useMemo, useRef, useState} from "react";
import {ArrowLeft, Download, Pencil, Plus, RefreshCw, Save, Trash2, X} from "lucide-react";
import {api, apiBlob} from "../lib/api.js";
import {currentFinancialYear} from "../lib/financialYear.js";
import "../ledger-batch.css";

const idOf = v => String(v?._id || v || "");
const clean = v => String(v || "").trim().replace(/\s+/g, " ");
const norm = v => clean(v).toLocaleLowerCase("en-IN");
const isGroup = item => (item?.ledgerNodeKind || "LEDGER") === "GROUP";
const levelOf = item => Number(item?.ledgerNodeLevel || (isGroup(item) ? 1 : 4));
const currentFY = currentFinancialYear();
const newRow = (key, defaults = {}) => ({
  key: String(key), main: "", sub: "", subsub: "", ledger: "", openingFinancialYear: currentFY,
  openingBalance: "0", openingBalanceType: "DR", ...defaults
});
const fiscalYears = () => {
  const year = Number(currentFY.slice(0, 4));
  return Array.from({length: 11}, (_, i) => {const y = year + 3 - i; return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;});
};

export default function LedgerBatchPage({accountHeads = [], onBack, onSaved, onEdit, onDelete}) {
  const nextId = useRef(0);
  const [rows, setRows] = useState([newRow("0")]);
  const [existing, setExisting] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filterMain, setFilterMain] = useState("");
  const [reportFy, setReportFy] = useState(currentFY);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingName, setEditingName] = useState("");

  const mainOptions = useMemo(() => accountHeads.filter(a => {
    const code = String(a.systemCode || "").toUpperCase();
    return code && !["SYS_STAFF_ADVANCE", "SYS_SALARY_PAYABLE", "SYS_REIMBURSEMENT_PAYABLE"].includes(code)
      && (code.startsWith("SYS_") || a.allowCompanyLedger || ["EXPENSE", "INCOME", "EQUITY"].includes(String(a.nature || "").toUpperCase()));
  }), [accountHeads]);
  const typeNames = useMemo(() => new Map(mainOptions.map(x => [x.systemCode, x.name])), [mainOptions]);
  const byId = useMemo(() => new Map(existing.map(x => [idOf(x), x])), [existing]);
  const activeGroups = useMemo(() => existing.filter(x => x.status === "ACTIVE" && isGroup(x)), [existing]);

  const load = async () => {
    setLoading(true);
    try {const response = await api("/access/users/ledger-accounts"); setExisting(response?.items || []);}
    catch (e) {setError(e.message || "Unable to load accounts");}
    finally {setLoading(false);}
  };
  useEffect(() => {load();}, []);

  const ancestors = item => {
    const list = [], seen = new Set();
    let current = item;
    while (current && !seen.has(idOf(current))) {
      seen.add(idOf(current)); list.unshift(current);
      current = byId.get(idOf(current.parentLedgerAccountId));
    }
    return list;
  };
  const fullRow = item => {
    const groups = ancestors(item).filter(isGroup);
    // For legacy records with three grouping levels, display the final two
    // groups in the third column rather than losing part of their path.
    return {
      main: typeNames.get(item.tallyAccountTypeCode) || item.tallyAccountTypeName || item.tallyAccountTypeCode || "—",
      mainCode: item.tallyAccountTypeCode,
      sub: groups[0]?.name || "",
      subsub: groups.slice(1).map(x => x.name).join(" › "),
      ledger: isGroup(item) ? "" : item.name,
      level: levelOf(item),
      isGroup: isGroup(item),
    };
  };
  const sorted = useMemo(() => {
    const paths = new Map();
    for (const item of existing) {
      const path = []; const visited = new Set(); let cursor = item;
      while (cursor && !visited.has(idOf(cursor))) {visited.add(idOf(cursor)); path.unshift(cursor.name); cursor = byId.get(idOf(cursor.parentLedgerAccountId));}
      paths.set(idOf(item), `${typeNames.get(item.tallyAccountTypeCode) || item.tallyAccountTypeCode} > ${path.join(" > ")}`);
    }
    return [...existing].sort((a,b) => (paths.get(idOf(a)) || "").localeCompare(paths.get(idOf(b)) || "", "en", {sensitivity:"base"}));
  }, [existing, byId, typeNames]);
  const visible = sorted.filter(x => {
    const r = fullRow(x);
    if (filterMain && r.mainCode !== filterMain) return false;
    return !search || norm([r.main, r.sub, r.subsub, r.ledger].join(" ")).includes(norm(search));
  });

  const patch = (key, changes) => setRows(prev => prev.map(r => r.key === key ? {...r, ...changes} : r));
  const addRow = () => {
    const last = rows.at(-1);
    setRows(prev => [...prev, newRow(String(++nextId.current), {main: last?.main || "", sub: last?.sub || "", subsub: last?.subsub || ""})]);
    setError("");
  };
  const removeRow = key => setRows(prev => prev.length === 1 ? [newRow(String(++nextId.current))] : prev.filter(x => x.key !== key));
  const groupsFor = (type, level, parent) => activeGroups.filter(x => x.tallyAccountTypeCode === type && levelOf(x) === level
    && (parent === undefined || idOf(x.parentLedgerAccountId) === parent));
  const level1 = (r) => groupsFor(r.main, 1);
  const level2 = (r) => {
    const parents = level1(r).filter(x => norm(x.name) === norm(r.sub));
    return parents.flatMap(p => groupsFor(r.main, 2, idOf(p)));
  };

  const save = async () => {
    setError("");setMessage("");
    const staged = [], stagedGroups = new Map(), stagedLedgers = new Set();
    const groupIndex = new Map();
    for (const item of activeGroups) {
      const chain = ancestors(item).filter(isGroup);
      const token = [item.tallyAccountTypeCode, ...chain.map(x => norm(x.name))].join("|");
      groupIndex.set(token, `existing:${idOf(item)}`);
    }
    const getGroup = (type, names) => {
      const token = [type, ...names.map(norm)].join("|");
      const existingRef = groupIndex.get(token);
      if (existingRef) return existingRef;
      const parentRef = names.length > 1 ? getGroup(type, names.slice(0, -1)) : "";
      const clientKey = `new-${++nextId.current}`;
      const row = {clientKey, name: names.at(-1), tallyAccountTypeCode: type,
        ledgerNodeKind: "GROUP", ledgerNodeLevel: names.length, openingFinancialYear: currentFY,
        openingBalance: 0, openingBalanceType: "DR",
        parentClientKey: parentRef.startsWith("row:") ? parentRef.slice(4) : "",
        parentLedgerAccountId: parentRef.startsWith("existing:") ? parentRef.slice(9) : ""};
      stagedGroups.set(token, row);
      staged.push(row);
      groupIndex.set(token, `row:${clientKey}`);
      return `row:${clientKey}`;
    };
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i], sub = clean(r.sub), subsub = clean(r.subsub), ledger = clean(r.ledger);
        if (!r.main) throw new Error(`Row ${i + 1}: Select Main Account`);
        if (subsub && !sub) throw new Error(`Row ${i + 1}: Enter Sub Account before Sub-sub Account`);
        if (!sub && !ledger) throw new Error(`Row ${i + 1}: Enter at least a Sub Account or Ledger`);
        if ([sub,subsub,ledger].some(v => v.length > 160)) throw new Error(`Row ${i + 1}: Names cannot exceed 160 characters`);
        if (Number(r.openingBalance) < 0 || !Number.isFinite(Number(r.openingBalance))) throw new Error(`Row ${i + 1}: Invalid opening balance`);
        const path = [sub, subsub].filter(Boolean);
        let parent = path.length ? getGroup(r.main, path) : "";
        if (ledger) {
          const key = `${r.main}|${path.map(norm).join("|")}|${norm(ledger)}`;
          if (stagedLedgers.has(key)) throw new Error(`Row ${i + 1}: Duplicate ledger under this account path`);
          stagedLedgers.add(key);
          const existingParent = parent.startsWith("existing:") ? parent.slice(9) : "";
          const matches = existing.some(x => !isGroup(x) && x.tallyAccountTypeCode === r.main && norm(x.name) === norm(ledger)
            && idOf(x.parentLedgerAccountId) === existingParent && !parent.startsWith("row:"));
          if (matches) throw new Error(`Row ${i + 1}: ${ledger} already exists in the selected account. Use Edit on its saved row.`);
          staged.push({clientKey: `new-${++nextId.current}`, name: ledger, tallyAccountTypeCode: r.main,
            ledgerNodeKind:"LEDGER", ledgerNodeLevel:4, openingFinancialYear:r.openingFinancialYear,
            openingBalance:Number(r.openingBalance || 0), openingBalanceType:r.openingBalanceType,
            parentClientKey:parent.startsWith("row:") ? parent.slice(4) : "",
            parentLedgerAccountId:parent.startsWith("existing:") ? parent.slice(9) : ""});
        }
      }
      if (!staged.length) throw new Error("Nothing new to save: add a Ledger name or enter a new subaccount");
      if (staged.length > 200) throw new Error("Maximum 200 new groups and ledgers per save. Split the rows into smaller batches.");
      // All checks run before creating any records. The backend also validates
      // the parent path and duplicate sibling names before inserting.
      setSaving(true);
      const result = await api("/access/users/ledger-accounts/bulk", {method:"POST", body:JSON.stringify({rows:staged})});
      setRows([newRow(String(++nextId.current))]);
      await load();await onSaved?.();
      setMessage(`Saved ${result?.groups || 0} new subaccounts and ${result?.ledgers || 0} ledgers. Existing account headings were reused.`);
    } catch(e) {setError(e.message || "Unable to save accounts");}
    finally {setSaving(false);}
  };

  const updateGroup = async () => {
    if (!editingGroup) return;
    const name = clean(editingName);
    if (!name) {setError("Enter a subaccount name");return;}
    setSaving(true);setError("");
    try {
      await api(`/access/users/ledger-accounts/${idOf(editingGroup)}/group`, {method:"PUT", body:JSON.stringify({name,parentLedgerAccountId:idOf(editingGroup.parentLedgerAccountId)})});
      setEditingGroup(null);await load();await onSaved?.();setMessage("Subaccount renamed. All its child ledger paths are updated.");
    } catch(e) {setError(e.message || "Unable to update group");}
    finally {setSaving(false);}
  };

  const downloadReport = async () => {
    setDownloading(true);setError("");
    try {
      const data = await apiBlob(`/access/users/ledger-accounts/report.xlsx?financialYear=${encodeURIComponent(reportFy)}`);
      const blob = data?.blob instanceof Blob ? data.blob : data;
      if (!(blob instanceof Blob)) throw new Error("Unable to download report");
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href=url;anchor.download=`account-ledger-hierarchy-${reportFy}.xlsx`;
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch(e) {setError(e.message || "Report download failed");}
    finally {setDownloading(false);}
  };

  return <div className="ledgerHierarchyPage ledgerRowsPage">
    <div className="ledgerEntryTopRow ledgerOneToolbar">
      <button className="btn ghost" onClick={onBack}><ArrowLeft size={15}/> Back</button>
      <input aria-label="Search all accounts" placeholder="Search account or ledger..." value={search} onChange={e=>setSearch(e.target.value)}/>
      <select aria-label="Filter main account" value={filterMain} onChange={e=>setFilterMain(e.target.value)}><option value="">All Main Accounts</option>{mainOptions.map(x=><option key={x.systemCode} value={x.systemCode}>{x.name}</option>)}</select>
      <button className="btn ghost" disabled={loading} onClick={load}><RefreshCw size={15}/></button>
      <select aria-label="Report financial year" value={reportFy} onChange={e=>setReportFy(e.target.value)}>{fiscalYears().map(x=><option key={x} value={x}>{x}</option>)}</select>
      <button className="btn ghost" onClick={downloadReport} disabled={downloading}><Download size={15}/>{downloading ? "Preparing..." : "Excel Report"}</button>
      <button className="btn ghost" onClick={addRow}><Plus size={15}/> Add More Row</button>
      <button className="btn primary" onClick={save} disabled={saving || loading}><Save size={15}/>{saving ? "Saving..." : `Save All (${rows.length})`}</button>
    </div>
    {error && <div className="resultBanner bad" role="alert">{error}</div>}
    {message && <div className="resultBanner good" role="status">{message}</div>}
    <section className="panel ledgerEntryPanel">
      <div className="ledgerWideTable"><table className="ledgerEntryTable ledgerFourColumnTable">
        <thead><tr><th>Main Account</th><th>Sub Account</th><th>Sub-sub Account</th><th>Ledger / Party Name</th><th>Edit</th><th>Delete</th></tr></thead>
        <tbody>
          {rows.map((r,i)=><tr key={r.key} className="ledgerPendingRow">
            <td><select aria-label={`Main Account row ${i+1}`} value={r.main} onChange={e=>patch(r.key,{main:e.target.value,sub:"",subsub:""})}><option value="">Select Main Account</option>{mainOptions.map(x=><option key={x.systemCode} value={x.systemCode}>{x.name}</option>)}</select></td>
            <td><input aria-label={`Sub Account row ${i+1}`} list={`ledger-sub-${r.key}`} value={r.sub} onChange={e=>patch(r.key,{sub:e.target.value,subsub:""})} placeholder="Select or type new..."/><datalist id={`ledger-sub-${r.key}`}>
              {[...new Set([...level1(r).map(x=>x.name),...rows.filter(x=>x.main===r.main&&clean(x.sub)).map(x=>clean(x.sub))])].map((name,j)=><option key={`${name}-${j}`} value={name}/>)}</datalist></td>
            <td><input aria-label={`Sub-sub Account row ${i+1}`} list={`ledger-subsub-${r.key}`} value={r.subsub} disabled={!clean(r.sub)} onChange={e=>patch(r.key,{subsub:e.target.value})} placeholder="Select or type new..."/><datalist id={`ledger-subsub-${r.key}`}>
              {[...new Set([...level2(r).map(x=>x.name),...rows.filter(x=>x.main===r.main&&norm(x.sub)===norm(r.sub)&&clean(x.subsub)).map(x=>clean(x.subsub))])].map((name,j)=><option key={`${name}-${j}`} value={name}/>)}</datalist></td>
            <td><div className="ledgerPartyCell"><input aria-label={`Ledger/Party name row ${i+1}`} value={r.ledger} onChange={e=>patch(r.key,{ledger:e.target.value})} placeholder="Person / firm receiving or paying"/>
              <details className="ledgerOpeningDetails"><summary>Opening balance (optional)</summary><div><select aria-label={`Opening FY row ${i+1}`} value={r.openingFinancialYear} onChange={e=>patch(r.key,{openingFinancialYear:e.target.value})}>{fiscalYears().map(x=><option key={x}>{x}</option>)}</select><input type="number" min="0" step=".01" aria-label={`Opening amount row ${i+1}`} value={r.openingBalance} onChange={e=>patch(r.key,{openingBalance:e.target.value})}/><select aria-label={`Opening DR or CR row ${i+1}`} value={r.openingBalanceType} onChange={e=>patch(r.key,{openingBalanceType:e.target.value})}><option>DR</option><option>CR</option></select></div></details></div></td>
            <td><span className="ledgerPendingLabel">New</span></td><td><button className="ledgerIconButton" onClick={()=>removeRow(r.key)} title="Remove unsaved row" aria-label={`Remove row ${i+1}`}><X size={15}/></button></td>
          </tr>)}
          {visible.map(item=>{const r=fullRow(item);return <tr key={idOf(item)} className="ledgerSavedRow">
            <td>{r.main}</td><td>{r.sub || "—"}</td><td>{r.subsub || "—"}</td><td>{r.ledger ? <strong>{r.ledger}</strong> : <span className="ledgerGroupLabel">Account heading</span>}</td>
            <td><button className="ledgerIconButton" title={r.isGroup ? "Rename subaccount" : "Edit ledger"} aria-label={`Edit ${item.name}`} onClick={()=>{if(r.isGroup){setEditingGroup(item);setEditingName(item.name);}else onEdit?.(item);}}><Pencil size={16}/></button></td>
            <td><button className="ledgerIconButton" title="Delete account (only if unused)" aria-label={`Delete ${item.name}`} onClick={async()=>{const result=await onDelete?.(item);if(result?.error)setError(result.error);if(result?.deleted)await load();}}><Trash2 size={16}/></button></td>
          </tr>;})}
          {!visible.length && <tr><td colSpan={6}>No saved accounts match this filter</td></tr>}
        </tbody></table></div>
      <div className="ledgerEntryActions"><small>One row per account path. Existing headings can be selected again; new names are created on Save All. Only Ledger/Party accounts receive accounting entries. Select the exact ledger when posting a payment or receipt.</small><button className="btn ghost" onClick={addRow}><Plus size={15}/> Add More Row</button></div>
    </section>
    {editingGroup && <div className="ledgerEditOverlay" role="dialog" aria-modal="true" aria-label="Edit subaccount"><div className="ledgerEditCard">
      <div className="ledgerEditHeading">Rename Account Heading<button className="ledgerIconButton" onClick={()=>setEditingGroup(null)} aria-label="Close"><X size={16}/></button></div>
      <label>Subaccount name<input autoFocus maxLength={160} value={editingName} onChange={e=>setEditingName(e.target.value)}/></label>
      <small>Renaming this heading updates its displayed path for all child ledgers. It does not change transactions or balances.</small>
      <div className="ledgerEditActions"><button className="btn ghost" onClick={()=>setEditingGroup(null)}>Cancel</button><button className="btn primary" disabled={saving} onClick={updateGroup}>Save</button></div>
    </div></div>}
  </div>;
}
