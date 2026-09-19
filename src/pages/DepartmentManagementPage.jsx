import React,{useEffect,useMemo,useRef,useState} from "react";
import {Download,FileSpreadsheet,Pencil,Search,ShieldCheck,Trash2,Upload} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import EditMasterLink from "../components/EditMasterLink.jsx";
import DataTable from "../components/DataTable.jsx";
import {api,apiBlob,getUser} from "../lib/api.js";

const blank={name:"",code:"",description:"",status:"ACTIVE"};
const upper=v=>String(v||"").trim().toUpperCase().replace(/[^A-Z0-9]+/g,"_").replace(/^_|_$/g,"");
const items=v=>Array.isArray(v)?v:Array.isArray(v?.items)?v.items:[];
const csvCell=value=>`"${String(value??"").replace(/"/g,'""')}"`;

export default function DepartmentManagementPage(){
 const current=getUser();
 const isMaster=String(current?.role||"").toUpperCase()==="MASTER";
 const fileRef=useRef(null);
 const[rows,setRows]=useState([]),[form,setForm]=useState(blank),[edit,setEdit]=useState(null),[show,setShow]=useState(false),[listQ,setListQ]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[uploadBusy,setUploadBusy]=useState(false),[report,setReport]=useState(null);

 const load=async()=>{setBusy(true);try{setRows(items(await api("/access/departments")))}catch(e){setMsg(e.message)}finally{setBusy(false)}};
 useEffect(()=>{load()},[]);

 const filtered=useMemo(()=>rows.filter(r=>`${r.name} ${r.code} ${r.reference||""} ${r.description||""}`.toLowerCase().includes(listQ.toLowerCase())),[rows,listQ]);
 const open=r=>{if(!isMaster)return;setEdit(r||null);setForm(r?{...blank,...r}:{...blank});setShow(true);setMsg("")};

 const save=async()=>{
  if(!isMaster)return setMsg("Only MASTER can create or edit Departments");
  if(!form.name.trim())return setMsg("Department name is required");
  setBusy(true);
  try{
   const payload={name:form.name.trim(),code:upper(form.code||form.name),description:String(form.description||"").trim(),status:form.status||"ACTIVE"};
   await api(edit?`/access/departments/${edit._id}`:"/access/departments",{method:edit?"PUT":"POST",body:JSON.stringify(payload)});
   setMsg(edit?"Department updated":"Department created. Download the permission format and configure its permission ceiling.");setShow(false);await load();
  }catch(e){setMsg(e.message)}finally{setBusy(false)}
 };

 const del=async r=>{
  if(!isMaster)return setMsg("Only MASTER can deactivate Departments");
  if(!confirm(`Deactivate department ${r.name}?`))return;
  try{await api(`/access/departments/${r._id}`,{method:"DELETE"});setMsg("Department deactivated");await load()}catch(e){setMsg(e.message)}
 };

 const downloadFormat=async()=>{
  if(!isMaster)return;
  setUploadBusy(true);setMsg("");
  try{
   const {blob,disposition}=await apiBlob("/access/departments/permission-format");
   const match=/filename="?([^";]+)"?/i.exec(disposition||"");
   const filename=match?.[1]||"Department_Permission_Bulk_Upload.xlsx";
   const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
   setMsg("Department permission format downloaded");
  }catch(e){setMsg(e.message)}finally{setUploadBusy(false)}
 };

 const uploadPermissions=async event=>{
  const file=event.target.files?.[0];event.target.value="";
  if(!file||!isMaster)return;
  setUploadBusy(true);setMsg("");setReport(null);
  try{
   const body=new FormData();body.append("file",file);
   const result=await api("/access/departments/bulk-permissions",{method:"POST",body});
   setReport(result||null);
   const applied=Number(result?.appliedDepartments||0),skipped=Number(result?.skippedDepartments||0),invalid=Number(result?.invalid||0);
   setMsg(`Permission upload completed: ${applied} department(s) applied${skipped?`, ${skipped} skipped`:""}${invalid?`, ${invalid} error(s)`:""}.`);
   await load();
  }catch(e){setMsg(e.message)}finally{setUploadBusy(false)}
 };

 const downloadErrors=()=>{
  const errors=Array.isArray(report?.errors)?report.errors:[];if(!errors.length)return;
  const headers=["Row","Department Reference","Department Name","Screen Key","Action","Error"];
  const lines=[headers.map(csvCell).join(","),...errors.map(x=>[x.row,x.departmentReference,x.departmentName,x.screenKey,x.action,x.error].map(csvCell).join(","))];
  const blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="Department_Permission_Upload_Errors.csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
 };

 return <>
  <PageHeader
   title="Department Management"
   description="MASTER owns the fixed Department catalogue and its maximum permission ceiling. Superadmins cannot create/edit Departments and their Roles can never exceed the Department ceiling."
   {...(isMaster?{onAdd:()=>open(null),addLabel:"Create Department"}:{})}
  />
  {msg&&<div className={`resultBanner ${/error|invalid|required|not found|cannot|only master|skipped/i.test(msg)?"bad":"good"}`}>{msg}</div>}
  <div className="resultBanner good"><ShieldCheck size={16}/> Department permissions are a security ceiling: Superadmin Plan/Group permissions ∩ Department permissions ∩ Role permissions = user access.</div>

  {isMaster&&<section className="panel">
   <div className="formTitle"><div><h3>Department Permission Ceiling</h3><span>Download the full matrix, put 1 only on functions allowed for each Department, then upload the complete file.</span></div></div>
   <div className="formActions" style={{justifyContent:"flex-start",flexWrap:"wrap"}}>
    <button className="btn ghost" disabled={uploadBusy} onClick={downloadFormat}><Download size={16}/> Download Permission Format</button>
    <button className="btn primary" disabled={uploadBusy} onClick={()=>fileRef.current?.click()}><Upload size={16}/> Bulk Upload Permissions</button>
    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={uploadPermissions}/>
    {report?.errors?.length>0&&<button className="btn ghost" onClick={downloadErrors}><FileSpreadsheet size={16}/> Download Upload Errors ({report.errors.length})</button>}
   </div>
   {report&&<div className="resultBanner good" style={{marginTop:12}}>
    Applied: <b>{report.appliedDepartments||0}</b> department(s) · Permission entries active: <b>{report.totalPermissions||0}</b> · Roles clamped: <b>{report.rolesClamped||0}</b> · Users synced: <b>{report.usersSynced||0}</b>
   </div>}
  </section>}

  {show&&isMaster&&<section className="panel editorPanel">
   <div className="formTitle"><div><h3>{edit?`Edit ${form.name}`:"Create Department"}</h3><span>Department identity is managed here. Permission ceiling is managed through the bulk matrix.</span></div><button className="btn ghost" onClick={()=>setShow(false)}>Close</button></div>
   <div className="formGrid">
    <label>Department Name *<input value={form.name} onChange={e=>setForm({...form,name:e.target.value,code:edit?form.code:upper(e.target.value)})}/></label>
    <label>Department Code<input disabled={Boolean(edit)} value={form.code||""} onChange={e=>setForm({...form,code:upper(e.target.value)})}/></label>
    <label>Status<select value={form.status||"ACTIVE"} onChange={e=>setForm({...form,status:e.target.value})}><option>ACTIVE</option><option>INACTIVE</option></select></label>
    <label className="wideField">Description<input value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})}/></label>
   </div>
   <div className="formActions"><button className="btn ghost" onClick={()=>setShow(false)}>Cancel</button><button className="btn primary" disabled={busy||!form.name.trim()} onClick={save}>Save Department</button></div>
  </section>}

  <section className="panel">
   <div className="toolbar"><div className="searchBox"><Search/><input value={listQ} onChange={e=>setListQ(e.target.value)} placeholder="Search departments..."/></div></div>
   <DataTable rows={filtered} columns={[
    {key:"name",label:"Department",render:r=><EditMasterLink onClick={()=>open(r)}>{r.name}</EditMasterLink>},
    {key:"reference",label:"Reference",render:r=>r.reference||"—"},
    {key:"code",label:"Code"},
    {key:"permissionStatus",label:"Permission Ceiling",render:r=>r.permissionConfigured?`${r.permissionCount||0} active permissions`:"Not configured"},
    {key:"description",label:"Description"},
    {key:"status",label:"Status",status:true},
    ...(isMaster?[{key:"actions",label:"Actions",render:r=><div className="rowActions"><button onClick={()=>open(r)}><Pencil/></button><button className="danger" onClick={()=>del(r)}><Trash2/></button></div>}]:[])
   ]}/>
  </section>
 </>;
}
