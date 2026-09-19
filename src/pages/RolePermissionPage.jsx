import React,{useEffect,useMemo,useState} from "react";
import {ChevronDown,ChevronRight,Pencil,Search,Trash2} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import EditMasterLink from "../components/EditMasterLink.jsx";
import DataTable from "../components/DataTable.jsx";
import {api} from "../lib/api.js";
import {getLookupEditId,isLookupCreate,notifyLookupCreated} from "../components/CreateLookupButton.jsx";
import "../role-permissions.css";

const blank={name:"",code:"",description:"",permissions:[],status:"ACTIVE"};
const upper=v=>String(v||"").trim().toUpperCase().replace(/[^A-Z0-9]+/g,"_").replace(/^_|_$/g,"");
const items=v=>Array.isArray(v)?v:Array.isArray(v?.items)?v.items:[];
const emptyCatalogue={actions:[],groups:[],department:null};
const isMasterRole=r=>Boolean(r?.isMasterRole||r?.sourceTemplateCode||r?.canDelete===false);

export default function RolePermissionPage(){
 const[rows,setRows]=useState([]),[baseCatalogue,setBaseCatalogue]=useState(emptyCatalogue),[catalogue,setCatalogue]=useState(emptyCatalogue),[form,setForm]=useState(blank),[edit,setEdit]=useState(null),[show,setShow]=useState(false),[expanded,setExpanded]=useState({}),[q,setQ]=useState(""),[listQ,setListQ]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);

 const load=async()=>{
  setBusy(true);
  try{
   const[c,r]=await Promise.all([api("/access/permission-catalogue"),api("/access/roles")]);
   const loaded=items(r);setBaseCatalogue(c||emptyCatalogue);setCatalogue(c||emptyCatalogue);setRows(loaded);return loaded;
  }catch(e){setMsg(e.message)}finally{setBusy(false)}
 };
 useEffect(()=>{(async()=>{const loaded=await load();const lookupEditId=getLookupEditId();if(lookupEditId){const row=(loaded||[]).find(r=>String(r._id)===String(lookupEditId));if(row)await open(row);else setMsg("Selected role could not be loaded for editing")}else if(isLookupCreate())open(null)})()},[]);

 const permissionCodes=useMemo(()=>{const out=[];for(const g of catalogue.groups||[])for(const s of g.screens||[])for(const a of s.allowedActions||[])out.push(`${s.key}.${a}`);return new Set(out)},[catalogue]);
 const selected=useMemo(()=>new Set((form.permissions||[]).filter(x=>permissionCodes.has(x))),[form.permissions,permissionCodes]);
 const filtered=useMemo(()=>rows.filter(r=>`${r.name} ${r.code} ${r.description||""} ${r.departmentId?.name||""}`.toLowerCase().includes(listQ.toLowerCase())),[rows,listQ]);
 const groups=useMemo(()=>(catalogue.groups||[]).map(g=>({...g,screens:(g.screens||[]).filter(s=>`${g.category} ${s.label}`.toLowerCase().includes(q.toLowerCase()))})).filter(g=>g.screens.length),[catalogue,q]);

 const open=async r=>{
  setBusy(true);setMsg("");setExpanded({});setQ("");
  try{
   let nextCatalogue=baseCatalogue;
   if(!(nextCatalogue?.groups||[]).length)nextCatalogue=await api("/access/permission-catalogue");
   const departmentId=r?.departmentId?._id||r?.departmentId?.id||"";
   if(departmentId)nextCatalogue=await api(`/access/permission-catalogue?departmentId=${encodeURIComponent(departmentId)}`);
   setCatalogue(nextCatalogue||emptyCatalogue);
   setEdit(r||null);
   setForm(r?{...blank,...r,permissions:r.permissions||[]}:{...blank});
   setShow(true);
  }catch(e){setMsg(e.message)}finally{setBusy(false)}
 };

 const toggle=(code,on)=>{const next=new Set(selected);on?next.add(code):next.delete(code);setForm(f=>({...f,permissions:[...next]}))};
 const many=(codes,on)=>{const next=new Set(selected);codes.forEach(c=>on?next.add(c):next.delete(c));setForm(f=>({...f,permissions:[...next]}))};

 const save=async()=>{
  if(!form.name.trim())return setMsg("Role name is required");
  setBusy(true);
  try{
   const master=isMasterRole(edit);
   const payload=master
    ?{permissions:[...selected]}
    :{name:form.name.trim(),code:upper(form.code||form.name),description:String(form.description||"").trim(),permissions:[...selected],status:form.status||"ACTIVE"};
   const saved=await api(edit?`/access/roles/${edit._id}`:"/access/roles",{method:edit?"PUT":"POST",body:JSON.stringify(payload)});
   setMsg(master?"MASTER Role permissions updated":edit?"Role updated":"Role created. Now add it to a Department and set its rank from Department Role Assignment.");setShow(false);setCatalogue(baseCatalogue);await load();if(isLookupCreate()||getLookupEditId())notifyLookupCreated("role",{id:saved?._id||edit?._id,name:saved?.name||form.name,code:saved?.code||form.code});
  }catch(e){setMsg(e.message)}finally{setBusy(false)}
 };

 const del=async r=>{if(isMasterRole(r))return setMsg("MASTER predefined Roles cannot be deleted. Their permissions and Department hierarchy can still be managed.");if(!window.confirm(`Delete role ${r.name}?`))return;try{await api(`/access/roles/${r._id}`,{method:"DELETE"});setMsg("Role deleted");await load()}catch(e){setMsg(e.message)}};
 const masterEdit=isMasterRole(edit);
 const assignedDepartment=edit?.departmentId?.name||"";
 const deptInfo=catalogue?.department||null;

 return <>
  <PageHeader title="Role Management" description="Shows both MASTER predefined Roles from the company Plan and Roles created by this Superadmin. MASTER Role identity is read-only; its permissions and Department hierarchy remain manageable within the allowed ceilings." onAdd={()=>open(null)} addLabel="Create Role"/>
  {msg&&<div className={`resultBanner ${/error|invalid|required|not found|cannot|not assigned|outside/i.test(msg)?"bad":"good"}`}>{msg}</div>}
  <div className="resultBanner good">MASTER Roles assigned through the company Plan are loaded automatically. They cannot be renamed or deleted, but their permissions can be edited. Superadmin-created Roles remain fully editable. Department assignment and rank are managed from Department Role Assignment.</div>

  {show&&<section className="panel editorPanel rpEditor">
   <div className="formTitle"><div><h3>{edit?`${masterEdit?"MASTER Role":"Edit Role"} — ${form.name}`:"Create Role"}</h3><span>{masterEdit?"Role identity is controlled by MASTER. You can edit permissions only.":`${selected.size} permission(s) selected from the effective allowed permission list.`}</span></div><button className="btn ghost" onClick={()=>{setShow(false);setCatalogue(baseCatalogue)}}>Close</button></div>
   {assignedDepartment&&<div className="resultBanner good">
    Department: <b>{assignedDepartment}</b> · Department ceiling: <b>{deptInfo?.permissionConfigured?`${deptInfo.permissionCount||0} active permissions`:"not configured yet"}</b>. Only permissions surviving both the Superadmin and Department ceilings are shown below.
   </div>}
   <div className="formGrid">
    <label>Role Name *<input disabled={masterEdit} value={form.name} onChange={e=>setForm({...form,name:e.target.value,code:edit?form.code:upper(e.target.value)})}/></label>
    <label>Role Code *<input disabled={Boolean(edit)||masterEdit} value={form.code||""} onChange={e=>setForm({...form,code:upper(e.target.value)})}/></label>
    <label>Status<select disabled={masterEdit} value={form.status||"ACTIVE"} onChange={e=>setForm({...form,status:e.target.value})}><option>ACTIVE</option><option>INACTIVE</option></select></label>
    <label className="wideField">Description<input disabled={masterEdit} value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})}/></label>
   </div>

   <div className="rpPermissionToolbar"><div className="searchBox"><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search permission..."/></div><span className="rpCount">{selected.size} selected</span></div>
   <div className="rpMatrix">{groups.map(g=>{const gid=`${g.app}:${g.category}`,codes=(g.screens||[]).flatMap(s=>(s.allowedActions||[]).map(a=>`${s.key}.${a}`)),opened=Boolean(expanded[gid]);return <div className="rpGroup" key={gid}>
    <div className="rpGroupHead"><button className="rpExpand" onClick={()=>setExpanded(x=>({...x,[gid]:!x[gid]}))}>{opened?<ChevronDown/>:<ChevronRight/>}</button><div className="rpGroupTitle"><strong>{g.category}</strong><span>{g.screens.length} screen(s)</span></div><label className="rpSelectAll"><input type="checkbox" checked={codes.length>0&&codes.every(c=>selected.has(c))} onChange={e=>many(codes,e.target.checked)}/><span>Select All</span></label></div>
    {opened&&<div className="rpTableWrap"><table className="rpTable"><thead><tr><th className="rpScreenCol">Screen</th>{(catalogue.actions||[]).map(a=><th key={a.key}>{a.label}</th>)}</tr></thead><tbody>{g.screens.map(s=><tr key={s.key}><td className="rpScreenCol"><strong>{s.label}</strong></td>{(catalogue.actions||[]).map(a=>{const enabled=(s.allowedActions||[]).includes(a.key),code=`${s.key}.${a.key}`;return <td key={a.key} className={!enabled?"rpDisabled":""}><input type="checkbox" disabled={!enabled} checked={enabled&&selected.has(code)} onChange={e=>toggle(code,e.target.checked)}/></td>})}</tr>)}</tbody></table></div>}
   </div>})}</div>

   <div className="formActions"><button className="btn ghost" onClick={()=>{setShow(false);setCatalogue(baseCatalogue)}}>Cancel</button><button className="btn primary" disabled={busy||!form.name.trim()} onClick={save}>Save Role</button></div>
  </section>}

  <section className="panel"><div className="toolbar"><div className="searchBox"><Search/><input value={listQ} onChange={e=>setListQ(e.target.value)} placeholder="Search roles..."/></div></div><DataTable rows={filtered} columns={[
   {key:"name",label:"Role",render:r=><EditMasterLink onClick={()=>open(r)}>{r.name}</EditMasterLink>},
   {key:"code",label:"Code"},
   {key:"source",label:"Source",render:r=>isMasterRole(r)?"MASTER":"SUPERADMIN"},
   {key:"department",label:"Department",render:r=>r.departmentId?.name||"Not assigned"},
   {key:"description",label:"Description"},
   {key:"permissions",label:"Permissions",render:r=>(r.permissions||[]).length},
   {key:"rank",label:"Rank",render:r=>Number(r.hierarchyOrder||0)>0?r.hierarchyOrder:"Not ranked"},
   {key:"status",label:"Status",status:true},
   {key:"actions",label:"Actions",render:r=><div className="rowActions"><button title={isMasterRole(r)?"Edit permissions":"Edit role"} onClick={()=>open(r)}><Pencil/></button>{!isMasterRole(r)&&<button className="danger" title="Delete role" onClick={()=>del(r)}><Trash2/></button>}</div>}
  ]}/></section>
 </>;
}
