import React,{useRef,useState} from "react";
import { Upload,Download,PencilLine,Trash2,X,CheckCircle2,AlertTriangle } from "lucide-react";
import { api,getUser } from "../lib/api.js";
import { accessForPath } from "../lib/permissionAccess.js";

const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;

export default function BulkTools({
  endpoint,
  fields=[],
  editFields,
  selectedIds=[],
  onDone,
  onClear,
  extraFormData={},
  extraBody={},
  allowUpload=true,
  allowEdit=true,
  allowDelete=true,
  deleteText="Bulk Delete",
  templateName="bulk-template.csv",
  templateLabel="Template",
  rejectedDownloadName="bulk-upload-errors.csv",
  rejectedColumns,
  schemaForUpload=true
}){
  const currentUser=getUser();
  const currentPath=typeof window!=="undefined"?window.location.pathname:"";
  const assignedAccess=currentUser?.role==="MASTER"?accessForPath(currentPath):currentUser?.pageAccess?.[currentPath];
  const canCreate=!assignedAccess||Boolean(assignedAccess.create);
  const canEdit=!assignedAccess||Boolean(assignedAccess.edit);
  const canDelete=!assignedAccess||Boolean(assignedAccess.delete);
  const canDownload=!assignedAccess||Boolean(assignedAccess.download);
  const input=useRef(null);
  const [busy,setBusy]=useState(false),[summary,setSummary]=useState(null),[error,setError]=useState(""),[editOpen,setEditOpen]=useState(false),[changes,setChanges]=useState({});
  const editable=editFields||fields.filter(f=>!f.noBulkEdit);
  const failedRows=Array.isArray(summary?.rejectedRows)?summary.rejectedRows:[];
  const failedColumns=rejectedColumns||fields.map(f=>({key:f.key,label:f.label||f.key}));
  const hasRejected=failedRows.length>0;

  const saveCsv=(content,fileName)=>{
    const blob=new Blob([`\uFEFF${content}`],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadTemplate=()=>{
    const header=fields.map(f=>esc(f.label||f.key)).join(",");
    const sample=fields.map(f=>esc(f.example??"")).join(",");
    saveCsv(`${header}\n${sample}\n`,templateName);
  };

  const downloadRejected=()=>{
    if(!failedRows.length)return;
    const header=["Row",...failedColumns.map(c=>c.label),"Error"].map(esc).join(",");
    const lines=failedRows.map(row=>[
      row.row??"",
      ...failedColumns.map(c=>row[c.key]??""),
      row.error??""
    ].map(esc).join(","));
    saveCsv([header,...lines].join("\n"),rejectedDownloadName);
  };

  const upload=async(file)=>{
    if(!file)return;
    setBusy(true);setError("");setSummary(null);
    try{
      const fd=new FormData();fd.append("file",file);
      if(schemaForUpload)fd.append("schema",JSON.stringify(fields.map(({key,label,type,options,aliases})=>({key,label,type,options,aliases}))));
      Object.entries(extraFormData||{}).forEach(([k,v])=>fd.append(k,String(v??"")));
      const data=await api(`${endpoint}/bulk-upload`,{method:"POST",body:fd});
      setSummary(data);
      onClear?.();
      await onDone?.();
    }catch(e){setError(e.message);}finally{setBusy(false);if(input.current)input.current.value="";}
  };

  const edit=async()=>{
    if(!selectedIds.length)return;setBusy(true);setError("");
    try{
      const data=await api(`${endpoint}/bulk-edit`,{method:"POST",body:JSON.stringify({selection:{ids:selectedIds},changes,...extraBody})});
      setSummary(data);setEditOpen(false);setChanges({});onClear?.();await onDone?.();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };

  const remove=async()=>{
    if(!selectedIds.length)return;
    if(!confirm(`${deleteText} ${selectedIds.length} selected record(s)?`))return;
    setBusy(true);setError("");
    try{
      const data=await api(`${endpoint}/bulk-delete`,{method:"POST",body:JSON.stringify({selection:{ids:selectedIds},...extraBody})});
      setSummary(data);onClear?.();await onDone?.();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };

  return <>
    <div className="bulkActionBar">
      <div className="bulkActionLeft"><span className="selectionPill">{selectedIds.length} selected</span>{selectedIds.length>0&&<button className="btn ghost compactBtn" onClick={onClear}><X size={14}/>Clear</button>}</div>
      <div className="bulkActionRight">
        {allowUpload&&canCreate&&<>{canDownload&&<button className="btn ghost" onClick={downloadTemplate}><Download size={15}/>{templateLabel}</button>}<button className="btn ghost" disabled={busy} onClick={()=>input.current?.click()}><Upload size={15}/>{busy?"Working...":"Bulk Upload"}</button><input ref={input} hidden type="file" accept=".xlsx,.xls,.csv" onChange={e=>upload(e.target.files?.[0])}/></>}
        {allowEdit&&canEdit&&<button className="btn ghost" disabled={!selectedIds.length||busy} onClick={()=>setEditOpen(true)}><PencilLine size={15}/>Bulk Edit</button>}
        {allowDelete&&canDelete&&<button className="btn dangerBtn" disabled={!selectedIds.length||busy} onClick={remove}><Trash2 size={15}/>{deleteText}</button>}
      </div>
    </div>
    {error&&<div className="resultBanner bad"><AlertTriangle size={15}/>{error}</div>}
    {summary&&<div className={`resultBanner ${hasRejected?"bad":"good"} bulkSummary`}><CheckCircle2 size={16}/><div><strong>Bulk operation completed</strong><span>{summary.received!==undefined?`${summary.received} received • `:""}{summary.valid!==undefined?`${summary.valid} valid • `:""}{summary.inserted!==undefined?`${summary.inserted} inserted • `:""}{summary.updated!==undefined?`${summary.updated} updated • `:""}{summary.unchanged!==undefined?`${summary.unchanged} unchanged • `:""}{summary.duplicates!==undefined?`${summary.duplicates} duplicates skipped • `:""}{summary.deleted!==undefined?`${summary.deleted} deleted/deactivated • `:""}{summary.protected!==undefined&&summary.protected>0?`${summary.protected} protected/skipped • `:""}{summary.invalid!==undefined?`${summary.invalid} invalid`:""}</span>{summary.errors?.length>0&&!hasRejected&&<details><summary>Validation errors ({summary.errors.length})</summary><div className="uploadErrors">{summary.errors.slice(0,100).map((x,i)=><div key={i}>Row {x.row}: {x.error}</div>)}</div></details>}{summary.protectedCustomers?.length>0&&<details><summary>Protected customers ({summary.protectedCustomers.length})</summary><div className="uploadErrors">{summary.protectedCustomers.slice(0,100).map((x,i)=><div key={i}>{x.name||x.id}{x.partyType?` (${x.partyType})`:""} — used in transactions</div>)}</div></details>}</div><button className="iconBtn" onClick={()=>setSummary(null)}><X size={14}/></button></div>}
    {failedRows.length>0&&<section className="panel" style={{marginBottom:14}}>
      <div className="sectionHeader"><div><h3>Rejected / Not Uploaded Rows</h3><span className="tableSubText">These rows were not uploaded. Correct them and upload again.</span></div><button className="btn ghost" onClick={downloadRejected}><Download size={15}/>Download Error File ({failedRows.length})</button></div>
      <div className="tableWrap" style={{maxHeight:360}}><table><thead><tr><th>Row</th>{failedColumns.map(c=><th key={c.key}>{c.label}</th>)}<th>Error</th></tr></thead><tbody>{failedRows.map((row,i)=><tr key={`${row.row||i}-${i}`}><td>{row.row??"—"}</td>{failedColumns.map(c=><td key={c.key}>{String(row[c.key]??"")||"—"}</td>)}<td>{row.error||"Not uploaded"}</td></tr>)}</tbody></table></div>
    </section>}
    {editOpen&&<section className="panel bulkEditPanel"><div className="formTitle"><div><h3>Bulk Edit {selectedIds.length} Record(s)</h3><span>Fill only the fields you want to change. Empty fields are ignored.</span></div><button className="iconBtn" onClick={()=>setEditOpen(false)}><X/></button></div><div className="formGrid dynamicForm">{editable.map(f=><BulkField key={f.key} field={f} value={changes[f.key]??""} onChange={v=>setChanges(x=>({...x,[f.key]:v}))}/>)}</div><div className="formActions"><button className="btn ghost" onClick={()=>setEditOpen(false)}>Cancel</button><button className="btn primary" disabled={busy||!Object.values(changes).some(v=>v!=="")} onClick={edit}>{busy?"Updating...":"Update Selected"}</button></div></section>}
  </>;
}

function BulkField({field,value,onChange}){
  if(field.type==="select")return <label>{field.label}<select value={value} onChange={e=>onChange(e.target.value)}><option value="">— No change —</option>{(field.options||[]).map(o=><option key={o} value={o}>{String(o).replaceAll("_"," ")}</option>)}</select></label>;
  if(field.type==="textarea")return <label className="fullField">{field.label}<textarea rows="3" value={value} onChange={e=>onChange(e.target.value)}/></label>;
  return <label>{field.label}<input type={field.type||"text"} value={value} onChange={e=>onChange(e.target.value)}/></label>;
}
