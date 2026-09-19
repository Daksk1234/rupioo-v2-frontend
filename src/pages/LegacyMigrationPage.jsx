import React,{useEffect,useMemo,useState} from "react";
import {ArchiveRestore,CheckCircle2,Database,FileArchive,RefreshCw,ShieldCheck,UploadCloud,Wrench} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import {api} from "../lib/api.js";

const labels={units:"Units",categories:"Categories",grades:"Customer Grades",warehouses:"Warehouses",branches:"Branches",transporters:"Transporters",bankaccounts:"Bank Accounts",products:"Products",users:"Users",customers:"Customers / Parties"};
const entityPath={units:"/dms/units",categories:"/dms/product-categories",grades:"/dms/customer-grades",warehouses:"/dms/warehouses",branches:"/dms/branches",transporters:"/dms/transporters",bankaccounts:"/dms/bank-accounts",products:"/dms/products",users:"/dms/users",customers:"/dms/customers"};

export default function LegacyMigrationPage(){
 const[file,setFile]=useState(null),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[runs,setRuns]=useState([]),[issues,setIssues]=useState([]);
 const load=async()=>{try{setRuns(await api("/migration/runs"));setIssues(await api("/migration/issues"));}catch(e){setMsg(e.message)}};
 useEffect(()=>{load()},[]);
 const totals=useMemo(()=>({runs:runs.length,issues:issues.length,legacyBlocked:issues.filter(x=>x.status==="NEEDS_COMPLETION").length}),[runs,issues]);
 const doPreview=async()=>{if(!file)return;setBusy(true);setMsg("");try{const fd=new FormData();fd.append("file",file);setPreview(await api("/migration/preview",{method:"POST",body:fd}));}catch(e){setMsg(e.message)}finally{setBusy(false)}};
 const doImport=async()=>{if(!preview?.token)return;setBusy(true);setMsg("");try{const result=await api("/migration/import",{method:"POST",body:JSON.stringify({token:preview.token})});setMsg(`Import complete: ${result.summary?.totalImported||0} records imported and available. ${result.summary?.totalIncomplete||0} record(s) have profile fields that can be completed later.`);setPreview(null);setFile(null);await load();}catch(e){setMsg(e.message)}finally{setBusy(false)}};
 const activatePrevious=async()=>{setBusy(true);setMsg("");try{const result=await api("/migration/activate-existing",{method:"POST",body:JSON.stringify({})});setMsg(`${result.processed||0} previous migration issue(s) updated. Imported records are now usable; remaining fields stay on the follow-up list.`);await load();}catch(e){setMsg(e.message)}finally{setBusy(false)}};
 return <div className="legacyMigrationPage">
  <PageHeader title="Previous DMS → V2" description="Upload old DMS exports once. V2 imports the records as usable masters immediately and keeps missing newer-profile fields as a follow-up checklist." actions={false}/>
  {msg&&<div className="resultBanner">{msg}</div>}
  <section className="migrationHero panel">
   <div className="migrationHeroIcon"><ArchiveRestore size={30}/></div>
   <div><h2>Simple database migration</h2><p>From MongoDB Compass or mongoexport, export your old collections as JSON. Put the files in one ZIP — for example <b>users.json, customers.json, products.json, units.json, categories.json, transporters.json</b> — and upload it here.</p></div>
   <label className="migrationDrop"><FileArchive size={20}/><span>{file?.name||"Choose database export ZIP / JSON / Excel"}</span><input type="file" accept=".zip,.json,.xlsx,.xls,.csv" onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null)}}/></label>
   <button className="btn primary" disabled={!file||busy} onClick={doPreview}><UploadCloud size={16}/>{busy?"Checking…":"Preview Import"}</button>
  </section>

  {preview&&<section className="panel migrationPreview">
   <div className="formTitle"><div><h3>Preview — nothing written yet</h3><span>{preview.fileName} • {preview.total} records detected • all detected records will be imported</span></div><button className="btn primary" disabled={busy} onClick={doImport}><Database size={16}/>Import & Activate</button></div>
   <div className="migrationCards">{Object.entries(preview.entities||{}).filter(([,v])=>v.count).map(([k,v])=><div className="migrationCard" key={k}><strong>{v.count}</strong><span>{labels[k]||k}</span><small><b>{v.count}</b> will import • <em>{v.incomplete}</em> profile follow-up</small></div>)}</div>
   {preview.incomplete>0&&<div className="migrationNotice"><ShieldCheck size={17}/><div><b>Missing fields will NOT block imported records.</b><span>V2 imports/activates the old record according to its previous status. Missing newer-profile fields remain listed below so you can complete them one by one.</span></div></div>}
  </section>}

  <section className="panel">
   <div className="formTitle"><div><h3>Pending Profile Fields</h3><span>{totals.issues} migrated record(s) have fields to complete later — they are not blocked</span></div><div style={{display:"flex",gap:8}}>{totals.legacyBlocked>0&&<button className="btn primary" disabled={busy} onClick={activatePrevious}><Wrench size={15}/>Activate {totals.legacyBlocked} Previous Import(s)</button>}<button className="btn ghost" onClick={load}><RefreshCw size={15}/>Refresh</button></div></div>
   {issues.length===0?<div className="emptyState"><CheckCircle2/>No pending migration profile fields.</div>:<div className="migrationIssueList">{issues.slice(0,200).map(x=><div className="migrationIssue" key={x._id}><div><b>{labels[x.entity]||x.entity} • Previous ID: {x.legacyId}</b><span>{(x.missingFields||[]).join(" • ")||x.message}</span></div><a className="btn ghost" href={entityPath[x.entity]||"/dms/settings"}>Complete Fields</a></div>)}</div>}
  </section>

  <section className="panel">
   <div className="formTitle"><div><h3>Migration History</h3><span>{totals.runs} recent import run(s)</span></div></div>
   <div className="migrationRuns">{runs.map(r=><div className="migrationRun" key={r._id}><div><b>{r.fileName||"Database export"}</b><span>{new Date(r.createdAt).toLocaleString()} • {r.status}</span></div><div><strong>{r.summary?.totalImported||0}</strong><small>Imported</small></div><div><strong>{r.summary?.totalIncomplete||0}</strong><small>Profile follow-up</small></div><div><strong>{r.summary?.totalFailed||0}</strong><small>Failed</small></div></div>)}</div>
  </section>
 </div>;
}
