import React,{useEffect,useMemo,useState} from "react";
import {ArrowDown,ArrowUp,ChevronDown,ChevronRight,Save,UsersRound} from "lucide-react";
import DataTable from "../components/DataTable.jsx";
import PageHeader from "../components/PageHeader.jsx";
import EditMasterLink,{openMasterEdit} from "../components/EditMasterLink.jsx";
import {api} from "../lib/api.js";

const id=v=>String(v?._id||v||"");
const codeOf=r=>String(r?.code||"").trim().toUpperCase();
const roleIdOfUser=u=>id(u?.roleId);
const parentIdOfUser=u=>id(u?.assignedToUserId);
const deptIdOfUser=u=>id(u?.departmentId);
const roleNameOfUser=u=>u?.roleId?.name||u?.accountType||u?.role||"—";
const branchNameOfUser=u=>u?.branchId?.name||u?.branch||"—";
const statusOfUser=u=>String(u?.status||"ACTIVE").toUpperCase();
const roleStatus=r=>String(r?.status||"ACTIVE").toUpperCase();
const roleDepartmentId=r=>id(r?.departmentId);

export default function DepartmentRoleAssignmentPage(){
 const[departments,setDepartments]=useState([]),[departmentId,setDepartmentId]=useState(""),[roles,setRoles]=useState([]),[selected,setSelected]=useState([]),[stage,setStage]=useState(1),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 const[departmentUsers,setDepartmentUsers]=useState([]),[usersBusy,setUsersBusy]=useState(false),[selectedRoleId,setSelectedRoleId]=useState(""),[expandedUsers,setExpandedUsers]=useState({}),[roleCounts,setRoleCounts]=useState({total:0,current:0,unassigned:0,otherDepartment:0,inactive:0});

 useEffect(()=>{api("/access/departments").then(r=>setDepartments((Array.isArray(r)?r:[]).filter(x=>x.status==="ACTIVE"))).catch(e=>setMsg(e.message))},[]);

 const loadDepartmentUsers=async did=>{
  if(!did){setDepartmentUsers([]);return []}
  setUsersBusy(true);
  try{
   let page=1,pages=1,all=[];
   do{
    const result=await api(`/access/users?page=${page}&limit=200`);
    all.push(...(Array.isArray(result?.items)?result.items:[]));
    pages=Math.max(1,Number(result?.meta?.pages||1));
    page+=1;
   }while(page<=pages&&page<=100);
   const scoped=all.filter(u=>deptIdOfUser(u)===String(did)&&statusOfUser(u)!=="DELETED");
   setDepartmentUsers(scoped);
   return scoped;
  }catch(e){setDepartmentUsers([]);setMsg(e.message);return []}finally{setUsersBusy(false)}
 };

 const load=async did=>{
  setDepartmentId(did);setStage(1);setMsg("");setSelectedRoleId("");setExpandedUsers({});
  if(!did){setRoles([]);setSelected([]);setDepartmentUsers([]);setRoleCounts({total:0,current:0,unassigned:0,otherDepartment:0,inactive:0});return;}
  try{
   const [data]=await Promise.all([api(`/access/department-role-assignment/${did}`),loadDepartmentUsers(did)]);
   const all=data.roles||[];
   setRoles(all);
   setRoleCounts(data.roleCounts||{total:all.length,current:0,unassigned:0,otherDepartment:0,inactive:0});
   setSelected((data.assigned||[]).sort((a,b)=>Number(a.hierarchyOrder||0)-Number(b.hierarchyOrder||0)).map(r=>id(r._id)));
  }catch(e){setRoles([]);setSelected([]);setDepartmentUsers([]);setRoleCounts({total:0,current:0,unassigned:0,otherDepartment:0,inactive:0});setMsg(e.message)}
 };

 const selectedRows=useMemo(()=>selected.map(x=>roles.find(r=>id(r._id)===x)).filter(Boolean),[selected,roles]);
 const selectedDepartment=useMemo(()=>departments.find(d=>id(d._id)===departmentId)||null,[departments,departmentId]);
 const userCountByRole=useMemo(()=>{
  const m=new Map();
  departmentUsers.forEach(u=>{const key=roleIdOfUser(u);m.set(key,(m.get(key)||0)+1)});
  return m;
 },[departmentUsers]);
 const selectedRole=useMemo(()=>roles.find(r=>id(r._id)===selectedRoleId)||null,[roles,selectedRoleId]);
 const selectedRoleUsers=useMemo(()=>selectedRoleId?departmentUsers.filter(u=>roleIdOfUser(u)===selectedRoleId):[],[departmentUsers,selectedRoleId]);
 const usersByParent=useMemo(()=>{
  const m=new Map();
  departmentUsers.forEach(u=>{const key=parentIdOfUser(u);if(!key)return;if(!m.has(key))m.set(key,[]);m.get(key).push(u)});
  for(const list of m.values())list.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
  return m;
 },[departmentUsers]);

 const addRequired=(next,requiredCode)=>{
  const rr=roles.find(x=>codeOf(x)===requiredCode);
  if(!rr||roleStatus(rr)!=="ACTIVE")return;
  const rDept=roleDepartmentId(rr);
  if(rDept&&rDept!==String(departmentId))return;
  if(!next.includes(id(rr._id)))next.push(id(rr._id));
 };

 const toggle=r=>{
  const rid=id(r._id),code=codeOf(r),rDept=roleDepartmentId(r);
  if(roleStatus(r)!=="ACTIVE")return setMsg(`${r.name} is INACTIVE. Activate it from Role Management before assigning it.`);
  if(rDept&&rDept!==String(departmentId))return setMsg(`${r.name} is already assigned to ${r.assignedDepartmentName||"another Department"}. Remove it from that Department first.`);
  setMsg("");
  setSelected(v=>{
   if(v.includes(rid)){
    let next=v.filter(x=>x!==rid);
    if(code==="SALES_PERSON")next=next.filter(x=>!["CUSTOMER"].includes(codeOf(roles.find(r=>id(r._id)===x))));
    return next;
   }
   const next=[...v,rid];
   if(code==="SALES_PERSON"){
    addRequired(next,"SALES_MANAGER");
    addRequired(next,"CUSTOMER");
   }
   if(code==="CUSTOMER")addRequired(next,"SALES_PERSON");
   return next;
  });
 };

 const orderedForRank=useMemo(()=>{
  const arr=[...selectedRows];
  const sm=arr.findIndex(r=>codeOf(r)==="SALES_MANAGER"),sp=arr.findIndex(r=>codeOf(r)==="SALES_PERSON"),cu=arr.findIndex(r=>codeOf(r)==="CUSTOMER");
  if(sp>=0&&sm>=0&&sm>sp){const [r]=arr.splice(sm,1);arr.splice(Math.max(0,sp),0,r)}
  const sp2=arr.findIndex(r=>codeOf(r)==="SALES_PERSON"),cu2=arr.findIndex(r=>codeOf(r)==="CUSTOMER");
  if(sp2>=0&&cu2>=0&&cu2!==sp2+1){const [r]=arr.splice(cu2,1);const pos=arr.findIndex(x=>codeOf(x)==="SALES_PERSON");arr.splice(pos+1,0,r)}
  return arr;
 },[selectedRows]);

 useEffect(()=>{if(stage===2){const ids=orderedForRank.map(r=>id(r._id));if(ids.join("|")!==selected.join("|"))setSelected(ids)}},[stage]);
 useEffect(()=>{
  if(stage!==2)return;
  if(selectedRoleId&&selected.includes(selectedRoleId))return;
  setSelectedRoleId(selected[0]||"");
 },[stage,selected,selectedRoleId]);

 const move=(idx,dir)=>{
  const next=[...selected],j=idx+dir;if(j<0||j>=next.length)return;
  [next[idx],next[j]]=[next[j],next[idx]];
  const rows=next.map(x=>roles.find(r=>id(r._id)===x)).filter(Boolean);
  const codes=rows.map(codeOf),sp=codes.indexOf("SALES_PERSON"),cu=codes.indexOf("CUSTOMER"),sm=codes.indexOf("SALES_MANAGER");
  if(cu>=0&&cu!==sp+1)return setMsg("CUSTOMER must remain immediately below SALES_PERSON.");
  if(sm>=0&&sp>=0&&sm>=sp)return setMsg("SALES_MANAGER must remain above SALES_PERSON.");
  setMsg("");setSelected(next);
 };

 const validate=()=>{
  const codes=selectedRows.map(codeOf),sp=codes.indexOf("SALES_PERSON"),cu=codes.indexOf("CUSTOMER"),sm=codes.indexOf("SALES_MANAGER");
  if(cu>=0&&sp<0)return "CUSTOMER can only be used below SALES_PERSON.";
  if(sp>=0&&roles.some(r=>codeOf(r)==="CUSTOMER")&&cu<0)return "CUSTOMER must be included with SALES_PERSON.";
  if(cu>=0&&cu!==sp+1)return "CUSTOMER must be immediately below SALES_PERSON.";
  if(sp>=0&&roles.some(r=>codeOf(r)==="SALES_MANAGER")&&sm<0)return "SALES_MANAGER must be in the same Department as SALES_PERSON.";
  if(sm>=0&&sp>=0&&sm>=sp)return "SALES_MANAGER must be above SALES_PERSON.";
  return "";
 };

 const next=()=>{if(!selected.length)return setMsg("Select at least one Role");setStage(2);setSelectedRoleId(selected[0]||"");setMsg("")};
 const save=async()=>{const e=validate();if(e)return setMsg(e);setBusy(true);try{const result=await api(`/access/department-role-assignment/${departmentId}`,{method:"PUT",body:JSON.stringify({roleIds:selected})});const removed=Number(result?.permissionsRemoved||0);setMsg(removed?`Department Role hierarchy saved. ${removed} permission assignment(s) outside the Department ceiling were removed.`:"Department Role hierarchy saved");await load(departmentId);setStage(2)}catch(err){setMsg(err.message)}finally{setBusy(false)}};

 const descendantsOf=rootId=>{
  const out=[],seen=new Set([String(rootId)]),walk=(parent,depth)=>{
   for(const child of usersByParent.get(String(parent))||[]){
    const cid=id(child);if(!cid||seen.has(cid))continue;seen.add(cid);out.push({...child,_mappingDepth:depth});walk(cid,depth+1);
   }
  };walk(rootId,1);return out;
 };
 const toggleUser=idValue=>setExpandedUsers(v=>({...v,[idValue]:!v[idValue]}));

 return <>
  <PageHeader title="Department Role Assignment" description="Choose a Department, rank its Roles, and inspect every user mapped under each parent Role."/>
  {msg&&<div className={`resultBanner ${/error|invalid|required|must|cannot|not found|another department/i.test(msg)?"bad":"good"}`}>{msg}</div>}

  <section className="panel editorPanel"><div className="formTitle"><div><h3>Select Department</h3><span>Select any Department to see its Role hierarchy and the users mapped under each Role.</span></div></div><div className="formGrid"><label>Department<select value={departmentId} onChange={e=>load(e.target.value)}><option value="">Select Department</option>{departments.map(d=><option key={d._id} value={d._id}>{d.name}</option>)}</select></label></div></section>
  {selectedDepartment&&<div className="resultBanner good">MASTER Department permission ceiling: <b>{selectedDepartment.permissionConfigured?`${selectedDepartment.permissionCount||0} active permissions`:"Not configured yet"}</b> · Department users: <b>{departmentUsers.length}</b> · Roles visible: <b>{roleCounts.total}</b> ({roleCounts.current} here, {roleCounts.unassigned} unassigned, {roleCounts.otherDepartment} in other departments, {roleCounts.inactive} inactive)</div>}

  {departmentId&&stage===1&&<section className="panel">
   <div className="panelHead"><div><h3>Step 1 — Add Roles to Department</h3><p>Every company Role is shown here. Roles already assigned to another Department and inactive Roles stay visible but cannot be selected until they are made available.</p></div></div>
   {roles.length?<div className="checkGrid">{roles.map(r=>{
    const rid=id(r._id),rDept=roleDepartmentId(r),inactive=roleStatus(r)!=="ACTIVE",otherDepartment=Boolean(rDept)&&rDept!==String(departmentId),disabled=inactive||otherDepartment;
    const assignmentLabel=inactive?"INACTIVE":otherDepartment?`Assigned to ${r.assignedDepartmentName||"another Department"}`:rDept===String(departmentId)?"In this Department":"Unassigned";
    return <button type="button" key={r._id} disabled={disabled} title={disabled?assignmentLabel:"Click to include/exclude this Role"} className={selected.includes(rid)?"checked":""} onClick={()=>toggle(r)}>{r.name} • {r.code} • {r.sourceTemplateCode?"MASTER":"SUPERADMIN"} • {assignmentLabel} • {userCountByRole.get(rid)||0} user(s)</button>;
   })}</div>:<div className="emptyState">No Roles found for this company. Create Roles from Role Management first.</div>}
   <div className="formActions"><button className="btn primary" disabled={!roles.length||!selected.length} onClick={next}>Continue to Ranks</button></div>
  </section>}

  {departmentId&&stage===2&&<section className="panel">
   <div className="panelHead"><div><h3>Step 2 — Set Role Ranks</h3><p>Rank 1 is highest. Use the Users button on any Role to inspect its mapped people and reporting chain.</p></div></div>
   <DataTable rows={selectedRows.map((r,i)=>({...r,rank:i+1}))} columns={[
    {key:"rank",label:"Rank"},{key:"name",label:"Role",render:r=><EditMasterLink to="/dms/roles" id={id(r._id)} resource="role">{r.name}</EditMasterLink>},{key:"code",label:"Code"},
    {key:"users",label:"Users",render:r=><button type="button" className={`btn ${selectedRoleId===id(r._id)?"primary":"ghost"} compactRoleUsersBtn`} onClick={()=>setSelectedRoleId(id(r._id))}><UsersRound size={14}/>{userCountByRole.get(id(r._id))||0}</button>},
    {key:"actions",label:"Move",render:r=>{const i=selectedRows.findIndex(x=>id(x._id)===id(r._id));const locked=codeOf(r)==="CUSTOMER";return <div className="rowActions"><button disabled={locked||i===0} onClick={()=>move(i,-1)}><ArrowUp/></button><button disabled={locked||i===selectedRows.length-1} onClick={()=>move(i,1)}><ArrowDown/></button></div>}}
   ]}/>
   <div className="formActions"><button className="btn ghost" onClick={()=>setStage(1)}>Back</button><button className="btn primary" disabled={busy} onClick={save}><Save size={15}/>Save Hierarchy</button></div>
  </section>}

  {departmentId&&stage===2&&selectedRole&&<section className="panel departmentUserMapPanel">
   <div className="panelHead departmentUserMapHead"><div><h3>{selectedRole.name} — User Mapping</h3><p>All users holding this Role are shown first. Expand any person to see every user mapped below that person through the reporting hierarchy.</p></div><div className="roleUserCounter"><UsersRound size={16}/><b>{selectedRoleUsers.length}</b><span>role user(s)</span></div></div>
   <div className="departmentRolePicker"><span>View Role</span><select value={selectedRoleId} onChange={e=>setSelectedRoleId(e.target.value)}>{selectedRows.map(r=><option key={r._id} value={r._id}>{r.name} ({userCountByRole.get(id(r._id))||0})</option>)}</select></div>
   {usersBusy?<div className="emptyState">Loading users…</div>:!selectedRoleUsers.length?<div className="emptyState">No user is mapped to <b>{selectedRole.name}</b> in this Department yet.</div>:<div className="departmentUserTree">
    {selectedRoleUsers.map(root=>{
     const rootId=id(root),mapped=descendantsOf(rootId),isOpen=expandedUsers[rootId]!==false;
     return <article className="departmentUserRoot" key={rootId}>
      <button type="button" className="departmentUserRootHead" onClick={()=>toggleUser(rootId)}>
       <span className="treeToggle">{mapped.length?(isOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>):<span className="treeDot"/>}</span>
       <span className="userPrimary"><strong className="masterEditLink" role="button" tabIndex={0} onClick={e=>{e.stopPropagation();openMasterEdit({to:"/dms/users",id:rootId,resource:"user"})}} onKeyDown={e=>{if(e.key==="Enter"){e.stopPropagation();openMasterEdit({to:"/dms/users",id:rootId,resource:"user"})}}}>{root.name||"Unnamed User"}</strong><small>{root.designation||roleNameOfUser(root)}</small></span>
       <span className="userContact"><b>{root.mobile||"—"}</b><small>{root.email||"No email"}</small></span>
       <span className="userMeta"><b>{branchNameOfUser(root)}</b><small>{statusOfUser(root)}</small></span>
       <span className="mappedCount">{mapped.length} mapped</span>
      </button>
      {isOpen&&mapped.length>0&&<div className="departmentMappedUsers">
       <div className="mappedUsersHeader"><span>User</span><span>Role / Designation</span><span>Reports To</span><span>Contact</span><span>Branch</span><span>Status</span></div>
       {mapped.map(u=>{
        const parent=departmentUsers.find(x=>id(x)===parentIdOfUser(u));
        return <div className="mappedUserRow" key={id(u)} style={{"--map-depth":Math.min(5,Number(u._mappingDepth||1))}}>
         <span className="mappedUserName" data-label="User"><i/><EditMasterLink to="/dms/users" id={id(u)} resource="user">{u.name||"—"}</EditMasterLink></span>
         <span data-label="Role / Designation"><b>{roleNameOfUser(u)}</b><small>{u.designation||"—"}</small></span>
         <span data-label="Reports To"><EditMasterLink to="/dms/users" id={id(parent||u.assignedToUserId)} resource="user">{parent?.name||u.assignedToUserId?.name||"—"}</EditMasterLink></span>
         <span data-label="Contact"><b>{u.mobile||"—"}</b><small>{u.email||"—"}</small></span>
         <span data-label="Branch">{branchNameOfUser(u)}</span>
         <span data-label="Status" className={`mappingStatus ${statusOfUser(u)==="ACTIVE"?"active":"inactive"}`}>{statusOfUser(u)}</span>
        </div>
       })}
      </div>}
     </article>
    })}
   </div>}
  </section>}
 </>;
}
