import React,{useEffect,useMemo,useState} from "react";
import {Activity,AlertTriangle,CalendarDays,ChevronLeft,ChevronRight,Clock3,Database,MapPin,MessageCircle,Navigation,Pencil,PhoneCall,RefreshCw,Search,Trash2,Upload,UserCheck,X,XCircle} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import ScanAndFill from "../components/ScanAndFill.jsx";
import DataTable from "../components/DataTable.jsx";
import BulkTools from "../components/BulkTools.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EditMasterLink from "../components/EditMasterLink.jsx";
import {api,getUser} from "../lib/api.js";

const blank={companyName:"",contactPerson:"",mobile:"",whatsapp:"",email:"",address:"",pincode:"",city:"",state:"",source:"",sourceReference:"",productInterest:"",priority:"NORMAL",nextFollowUpAt:""};
const bulkFields=[
 {key:"Company Name",label:"Party Name",example:"ABC Traders",noBulkEdit:true},
 {key:"Address",label:"Address",example:"Fancy Bazar, Guwahati",noBulkEdit:true},
 {key:"Mobile",label:"Mobile No.",example:"9876543210",noBulkEdit:true},
 {key:"Pincode",label:"Pincode",example:"781001",noBulkEdit:true},
 {key:"City",label:"City",example:"Guwahati",noBulkEdit:true},
 {key:"State",label:"State",example:"Assam",noBulkEdit:true},
 {key:"Contact Person",label:"Contact Person",example:"Rajesh Sharma",noBulkEdit:true},
 {key:"WhatsApp",label:"WhatsApp",example:"9876543210",noBulkEdit:true},
 {key:"Email",label:"Email",example:"abc@example.com",noBulkEdit:true},
 {key:"Source",label:"Source",example:"Bulk Upload"},
 {key:"Product Interest",label:"Product Interest",example:"Cake Base, Spoon"},
 {key:"Priority",label:"Priority",type:"select",options:["HOT","WARM","NORMAL","COLD"],example:"NORMAL"},
 {key:"Remark",label:"Remark",example:"Call after 4 PM",noBulkEdit:true},
];
const stages=["","NEW","ASSIGNED","CONTACTED","FOLLOW_UP","VISIT_DUE","VISITED","INTERESTED","HOT","REJECTED","CONVERSION_IN_PROGRESS","PENDING_VERIFICATION","CUSTOMER","CANCELLED"];
const priorities=["","HOT","WARM","NORMAL","COLD"];
const qualityFilters=["","INCOMPLETE","MISSING_MOBILE","MISSING_ADDRESS","COMPLETE"];
const dueFilters=["","OVERDUE","TODAY","UPCOMING","NO_FOLLOWUP"];
const followTypes=["","PHYSICAL_VISIT","CALL","WHATSAPP","FOLLOW_UP","OTHER"];
const dt=v=>v?new Date(v).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"—";
const onlyDigits=v=>String(v||"").replace(/\D/g,"");
const isOpen=r=>!["CUSTOMER","CANCELLED","DELETED"].includes(String(r?.stage||"").toUpperCase());
const missingMobile=r=>onlyDigits(r?.mobile).length!==10;
const missingAddress=r=>!String(r?.address||"").trim();

const ymdLocal=(date=new Date())=>{const d=new Date(date);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
const dayBoundaryIso=(ymd,end=false)=>{if(!ymd)return "";const d=new Date(`${ymd}T00:00:00`);if(end)d.setDate(d.getDate()+1);return d.toISOString()};
const dateOnly=v=>v?new Date(v).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";
const timeOnly=v=>v?new Date(v).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):"—";

function lastAction(row){
 const list=Array.isArray(row?.activities)?row.activities:[];
 const last=list.length?list[list.length-1]:null;
 return last?.type?String(last.type).replaceAll("_"," "):row?.lastVisitAt?"VISIT":"—";
}
function followState(row){
 if(!isOpen(row)) return {label:"Closed",cls:"neutral"};
 if(!row?.nextFollowUpAt) return {label:"No Follow-up",cls:"muted"};
 const t=new Date(row.nextFollowUpAt); const now=new Date();
 if(t<now) return {label:"Overdue",cls:"danger"};
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
 if(t>=today&&t<tomorrow)return {label:"Today",cls:"warn"};
 return {label:"Scheduled",cls:"good"};
}

export default function LeadPage(){
 const[rows,setRows]=useState([]),[stats,setStats]=useState({counts:{},open:0,overdue:0}),[result,setResult]=useState(null),[show,setShow]=useState(false),[showBulk,setShowBulk]=useState(false),[form,setForm]=useState(blank),[q,setQ]=useState(""),[stage,setStage]=useState(""),[priority,setPriority]=useState(""),[quality,setQuality]=useState(""),[due,setDue]=useState(""),[pincode,setPincode]=useState(""),[selected,setSelected]=useState([]),[page,setPage]=useState(1),[meta,setMeta]=useState({page:1,pages:1,total:0});
 const[detail,setDetail]=useState(null),[activityMode,setActivityMode]=useState(""),[editLeadMode,setEditLeadMode]=useState(false),[editLeadForm,setEditLeadForm]=useState(blank),[activityForm,setActivityForm]=useState({outcome:"",note:"",nextFollowUpAt:"",reason:"",latitude:"",longitude:"",accuracy:""});
 const[view,setView]=useState("leads"),[followRows,setFollowRows]=useState([]),[followSalespersons,setFollowSalespersons]=useState([]),[followSalesperson,setFollowSalesperson]=useState(""),[followFrom,setFollowFrom]=useState(ymdLocal()),[followTo,setFollowTo]=useState(ymdLocal()),[followType,setFollowType]=useState(""),[followQ,setFollowQ]=useState(""),[followPage,setFollowPage]=useState(1),[followMeta,setFollowMeta]=useState({page:1,pages:1,total:0}),[followSummary,setFollowSummary]=useState({total:0,physicalVisits:0,calls:0,whatsapp:0,followUps:0,other:0});
 const[creationRequests,setCreationRequests]=useState([]),[conversionRequests,setConversionRequests]=useState([]),[requestBusy,setRequestBusy]=useState("");
 const currentUser=getUser()||{};const superadmin=String(currentUser.role||"").toUpperCase()==="SUPERADMIN";
 const load=async(next=page,overrides={})=>{try{const f={q,stage,priority,quality,due,pincode,...overrides};const params=new URLSearchParams({limit:"50",page:String(next)});Object.entries(f).forEach(([k,v])=>{if(String(v||"").trim())params.set(k,String(v).trim())});const[d,s]=await Promise.all([api(`/leads?${params}`),api("/leads/stats")]);setRows(d.items||[]);setMeta(d.meta||{page:next,pages:1,total:(d.items||[]).length});setPage(d.meta?.page||next);setStats(s||{counts:{},open:0,overdue:0})}catch(e){setResult({error:e.message});setRows([])}};
 const loadFollowSalespersons=async()=>{try{const d=await api("/leads/follow-up-salespersons");setFollowSalespersons(d.items||[])}catch(e){setResult({error:e.message});setFollowSalespersons([])}};
 const loadFollow=async(next=followPage,overrides={})=>{try{const f={salespersonId:followSalesperson,from:followFrom,to:followTo,type:followType,q:followQ,...overrides};const params=new URLSearchParams({limit:"100",page:String(next)});if(f.salespersonId)params.set("salespersonId",f.salespersonId);if(f.from)params.set("fromTs",dayBoundaryIso(f.from,false));if(f.to)params.set("toTs",dayBoundaryIso(f.to,true));if(f.type)params.set("type",f.type);if(String(f.q||"").trim())params.set("q",String(f.q).trim());const d=await api(`/leads/follow-up-register?${params}`);setFollowRows(d.items||[]);setFollowMeta(d.meta||{page:next,pages:1,total:(d.items||[]).length});setFollowPage(d.meta?.page||next);setFollowSummary(d.summary||{total:0,physicalVisits:0,calls:0,whatsapp:0,followUps:0,other:0})}catch(e){setResult({error:e.message});setFollowRows([])}};
 const loadCreationRequests=async()=>{try{const d=await api("/leads/creation-requests?limit=200&status=PENDING");setCreationRequests(d.items||[])}catch(e){setResult({error:e.message});setCreationRequests([])}};
 const loadConversionRequests=async()=>{try{const d=await api("/customers/approvals?limit=200");setConversionRequests(d.items||[])}catch(e){setResult({error:e.message});setConversionRequests([])}};
 const switchView=async(next)=>{setView(next);setResult(null);if(next==="followups"){if(!followSalespersons.length)await loadFollowSalespersons();await loadFollow(1)}if(next==="creationRequests")await loadCreationRequests();if(next==="conversionRequests")await loadConversionRequests()};
 const autoAssign=async()=>{try{setRequestBusy("auto");const d=await api("/leads/auto-assign",{method:"POST",body:"{}"});setResult({message:`Auto assign complete: ${d.reassigned||0} reassigned, ${d.unassigned||0} still unassigned.`});await load(1)}catch(e){setResult({error:e.message})}finally{setRequestBusy("")}};
 const deleteAllLeads=async()=>{
  const first=window.confirm("Delete ALL leads from every status?\n\nThis permanently removes every lead for this company, including NEW, ASSIGNED, FOLLOW UP, REJECTED, CONVERTED/CUSTOMER, CANCELLED and deleted-status lead records. Existing customer records are not deleted.");
  if(!first)return;
  const second=window.confirm("Final confirmation: this cannot be undone. Delete all leads now?");
  if(!second)return;
  try{
    setRequestBusy("delete-all");
    const d=await api("/leads/all",{method:"DELETE"});
    setQ("");setStage("");setPriority("");setQuality("");setDue("");setPincode("");
    setSelected([]);
    setDetail(null);
    setResult({message:`Deleted ${Number(d.deletedLeads||0).toLocaleString("en-IN")} lead(s) from all statuses${d.deletedVisits?` and ${Number(d.deletedVisits).toLocaleString("en-IN")} lead visit record(s)`:""}.`});
    await load(1,{q:"",stage:"",priority:"",quality:"",due:"",pincode:""});
  }catch(e){setResult({error:e.message})}finally{setRequestBusy("")}
 };
 const reviewCreation=async(id,action)=>{try{setRequestBusy(id);await api(`/leads/creation-requests/${id}/review`,{method:"POST",body:JSON.stringify({action})});setResult({message:`Creation request ${action.toLowerCase()}d`});await Promise.all([loadCreationRequests(),load(1)])}catch(e){setResult({error:e.message})}finally{setRequestBusy("")}};
 const reviewConversion=async(globalId,action)=>{try{setRequestBusy(globalId);await api(`/customers/${encodeURIComponent(globalId)}/approval`,{method:"POST",body:JSON.stringify({action})});setResult({message:`Conversion request ${action.toLowerCase()}d`});await Promise.all([loadConversionRequests(),load(1)])}catch(e){setResult({error:e.message})}finally{setRequestBusy("")}};

 useEffect(()=>{load(1)},[]);
 const openCreate=()=>{setForm(blank);setShow(true);setResult(null)};
 const applyLeadScan=(values)=>{setForm(f=>({...f,...Object.fromEntries(Object.entries(values).filter(([k])=>!["visitDate","visitTime","remarks","outcome","nextFollowUpAt","items"].includes(k)))}));};

 const save=async()=>{try{if(!form.companyName.trim())throw new Error("Party Name is required");if(!form.address.trim())throw new Error("Address is required");if(onlyDigits(form.mobile).length!==10)throw new Error("Valid 10-digit Mobile No. is required");if(onlyDigits(form.pincode).length!==6)throw new Error("Valid 6-digit Pincode is required");const d=await api("/leads",{method:"POST",body:JSON.stringify(form)});setResult({message:d?.message||"Lead created"});setShow(false);await load(1)}catch(e){setResult({error:e.message})}};
 const openDetail=async r=>{try{const d=await api(`/leads/${r._id}`);setDetail(d);setEditLeadMode(false);setEditLeadForm({...blank,...d.lead,productInterest:Array.isArray(d.lead?.productInterest)?d.lead.productInterest.join(", "):d.lead?.productInterest||""});setActivityMode("");setActivityForm({outcome:"",note:"",nextFollowUpAt:"",reason:"",latitude:"",longitude:"",accuracy:""})}catch(e){setResult({error:e.message})}};
 const refreshDetail=async()=>{if(detail?.lead?._id){const d=await api(`/leads/${detail.lead._id}`);setDetail(d);setEditLeadForm({...blank,...d.lead,productInterest:Array.isArray(d.lead?.productInterest)?d.lead.productInterest.join(", "):d.lead?.productInterest||""})}};
 const saveLeadEdit=async()=>{try{if(!editLeadForm.companyName?.trim())throw new Error("Party Name is required");if(!editLeadForm.address?.trim())throw new Error("Address is required");if(onlyDigits(editLeadForm.mobile).length!==10)throw new Error("Valid 10-digit Mobile No. is required");if(onlyDigits(editLeadForm.pincode).length!==6)throw new Error("Valid 6-digit Pincode is required");await api(`/leads/${detail.lead._id}`,{method:"PUT",body:JSON.stringify(editLeadForm)});setEditLeadMode(false);await refreshDetail();await load();setResult({message:"Lead details updated"})}catch(e){setResult({error:e.message})}};
 const followUp=async()=>{try{await api(`/leads/${detail.lead._id}/follow-up`,{method:"POST",body:JSON.stringify({type:"FOLLOW_UP",outcome:activityForm.outcome,note:activityForm.note,nextFollowUpAt:activityForm.nextFollowUpAt,stage:"FOLLOW_UP"})});setActivityMode("");await refreshDetail();await load()}catch(e){setResult({error:e.message})}};
 const getGeo=()=>navigator.geolocation?.getCurrentPosition(p=>setActivityForm(f=>({...f,latitude:String(p.coords.latitude),longitude:String(p.coords.longitude),accuracy:String(p.coords.accuracy||"")})),e=>setResult({error:e.message}),{enableHighAccuracy:true});
 const saveVisit=async()=>{try{await api(`/leads/${detail.lead._id}/visit`,{method:"POST",body:JSON.stringify({...activityForm,stage:"VISITED"})});setActivityMode("");await refreshDetail();await load()}catch(e){setResult({error:e.message})}};
 const cancelLead=async()=>{try{if(!activityForm.reason.trim())throw new Error("Cancellation reason is required");await api(`/leads/${detail.lead._id}/cancel`,{method:"POST",body:JSON.stringify({reason:activityForm.reason,note:activityForm.note})});setActivityMode("");await refreshDetail();await load()}catch(e){setResult({error:e.message})}};
 const convert=async()=>{try{const d=await api(`/leads/${detail.lead._id}/start-conversion`,{method:"POST",body:"{}"});window.location.href=d.customerUrl||`/dms/customers?leadId=${encodeURIComponent(detail.lead.leadId)}`}catch(e){setResult({error:e.message})}};
 const toggle=id=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);const toggleAll=(checked,ids)=>setSelected(s=>checked?[...new Set([...s,...ids])]:s.filter(x=>!ids.includes(x)));
 const stageCount=k=>Number(stats?.counts?.[k]||0);
 const applyPreset=(preset)=>{let next={stage:"",quality:"",due:""};if(preset==="OVERDUE")next.due="OVERDUE";if(preset==="MISSING_MOBILE")next.quality="MISSING_MOBILE";if(preset==="UNASSIGNED")next.stage="NEW";if(preset==="CUSTOMER")next.stage="CUSTOMER";setStage(next.stage);setQuality(next.quality);setDue(next.due);load(1,next)};
 const kpis=useMemo(()=>[
  {label:"Open",value:stats.open||0,onClick:()=>{setStage("");setDue("");setQuality("");load(1,{stage:"",due:"",quality:""})}},
  {label:"Overdue",value:stats.overdue||0,alert:true,onClick:()=>applyPreset("OVERDUE")},
  {label:"Due Today",value:stats.dueToday||0,onClick:()=>{setDue("TODAY");load(1,{due:"TODAY"})}},
  {label:"Unassigned",value:stats.unassigned||0,alert:Boolean(stats.unassigned),onClick:()=>applyPreset("UNASSIGNED")},
  {label:"Mobile Missing",value:stats.missingMobile||0,alert:Boolean(stats.missingMobile),onClick:()=>applyPreset("MISSING_MOBILE")},
  {label:"Converted",value:stageCount("CUSTOMER"),onClick:()=>applyPreset("CUSTOMER")},
 ],[stats]);
 const resetFilters=()=>{setQ("");setStage("");setPriority("");setQuality("");setDue("");setPincode("");setSelected([]);load(1,{q:"",stage:"",priority:"",quality:"",due:"",pincode:""})};
 return <div className="leadLegacyPage">
  <PageHeader title="Sales Leads" description="Old-DMS compact lead register with pincode assignment, salesperson follow-up audit and verified customer conversion." onAdd={view==="leads"?openCreate:undefined} addLabel="Add Lead"/>
  <div className="leadRegisterTabs"><button className={view==="leads"?"active":""} onClick={()=>switchView("leads")}><Database/>Lead Register</button><button className={view==="followups"?"active":""} onClick={()=>switchView("followups")}><CalendarDays/>Follow-up Register</button>{superadmin&&<><button className={view==="creationRequests"?"active":""} onClick={()=>switchView("creationRequests")}><UserCheck/>Creation Requests</button><button className={view==="conversionRequests"?"active":""} onClick={()=>switchView("conversionRequests")}><UserCheck/>Conversion Requests</button></>}</div>
  {result&&<div className={`resultBanner ${result.error?"bad":"good"}`}>{result.error||result.message}</div>}
  <div className={`leadViewBlock ${view!=="leads"?"isHidden":""}`}>
  <div className="leadKpiStrip">{kpis.map((k,i)=><button key={i} className={`leadKpi ${k.alert?"alert":""}`} onClick={k.onClick}><span>{k.label}</span><strong>{Number(k.value||0).toLocaleString("en-IN")}</strong></button>)}</div>
  {show&&<section className="panel editorPanel leadCompactEditor"><div className="formTitle"><div><h3>Create Sales Lead</h3><span>Party Name, Address, Mobile and Pincode are compulsory. Pincode assigns the Sales Person automatically.</span></div><div className="formTitleActions"><ScanAndFill documentType="LEAD" targetPath="/dms/leads" onApply={applyLeadScan}/><button className="iconBtn" onClick={()=>setShow(false)}><X/></button></div></div><div className="leadRequiredGrid">
    <label>Party Name *<input autoFocus value={form.companyName} onChange={e=>setForm({...form,companyName:e.target.value})}/></label>
    <label className="leadAddressInput">Address *<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
    <label>Mobile No. *<input inputMode="numeric" maxLength={10} value={form.mobile} onChange={e=>setForm({...form,mobile:onlyDigits(e.target.value).slice(0,10)})}/></label>
    <label>Pincode *<input inputMode="numeric" maxLength={6} value={form.pincode} onChange={e=>setForm({...form,pincode:onlyDigits(e.target.value).slice(0,6)})}/></label>
  </div><div className="formGrid leadOptionalGrid">{[
    ["contactPerson","Contact Person"],["whatsapp","WhatsApp"],["email","Email","email"],["city","City"],["state","State"],["source","Source"],["sourceReference","Source Ref."],["productInterest","Product Interest"]
  ].map(([k,l,t])=><label key={k}>{l}<input type={t||"text"} value={form[k]??""} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}<label>Priority<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{["HOT","WARM","NORMAL","COLD"].map(x=><option key={x}>{x}</option>)}</select></label></div><div className="formActions"><button className="btn ghost" onClick={()=>setShow(false)}>Cancel</button><button className="btn primary" disabled={!form.companyName.trim()||!form.address.trim()||onlyDigits(form.mobile).length!==10||onlyDigits(form.pincode).length!==6} onClick={save}>Save & Auto Assign</button></div></section>}

  <section className="panel leadRegisterPanel"><div className="leadOldToolbar">
    <div className="searchBox leadSearch"><Search/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(setSelected([]),load(1))} placeholder="Party, address, mobile, lead ID, city, pincode..."/></div>
    <input className="leadPinFilter" inputMode="numeric" maxLength={6} value={pincode} onChange={e=>setPincode(onlyDigits(e.target.value).slice(0,6))} onKeyDown={e=>e.key==="Enter"&&load(1)} placeholder="Pincode"/>
    <select value={stage} onChange={e=>{const v=e.target.value;setStage(v);setTimeout(()=>load(1,{stage:v}),0)}}>{stages.map(x=><option key={x} value={x}>{x||"All Stages"}</option>)}</select>
    <select value={priority} onChange={e=>{const v=e.target.value;setPriority(v);setTimeout(()=>load(1,{priority:v}),0)}}>{priorities.map(x=><option key={x} value={x}>{x||"All Priority"}</option>)}</select>
    <select value={due} onChange={e=>{const v=e.target.value;setDue(v);setTimeout(()=>load(1,{due:v}),0)}}>{dueFilters.map(x=><option key={x} value={x}>{x?x.replaceAll("_"," "):"Follow-up: All"}</option>)}</select>
    <select value={quality} onChange={e=>{const v=e.target.value;setQuality(v);setTimeout(()=>load(1,{quality:v}),0)}}>{qualityFilters.map(x=><option key={x} value={x}>{x?`Data: ${x.replaceAll("_"," ")}`:"Data: All"}</option>)}</select>
    <button className="iconBtn leadToolbarIcon" title="Search / apply filters" onClick={()=>load(1)}><Search/></button>
    <button className="iconBtn leadToolbarIcon" title="Reset filters" onClick={resetFilters}><RefreshCw/></button>
    <button className={`iconBtn leadToolbarIcon ${showBulk?"active":""}`} title="Bulk upload" onClick={()=>setShowBulk(v=>!v)}><Upload/></button>
    {superadmin&&<button className="btn ghost leadAutoAssignBtn" disabled={!!requestBusy} onClick={autoAssign}><UserCheck/>{requestBusy==="auto"?"Assigning...":"Auto Assign"}</button>}
    {superadmin&&<button className="btn danger leadDeleteAllBtn" disabled={!!requestBusy} onClick={deleteAllLeads}><Trash2/>{requestBusy==="delete-all"?"Deleting...":"Delete All"}</button>}
    <div className="recordCount">{meta.total||0} leads</div>
  </div>
  {showBulk&&<div className="leadBulkDrawer"><div className="leadBulkHint"><Database/><span><strong>Bulk Lead Import</strong> Your current file can be imported even where Mobile is missing; those rows are retained and clearly marked for data completion instead of being lost.</span></div><BulkTools endpoint="/leads" fields={bulkFields} editFields={[]} selectedIds={selected} onClear={()=>setSelected([])} onDone={()=>load(1)} schemaForUpload={false} allowEdit={false} allowDelete={false} templateName="sales-leads-bulk-template.csv" rejectedColumns={[{key:"Company Name",label:"Party Name"},{key:"Address",label:"Address"},{key:"Mobile",label:"Mobile No."},{key:"Pincode",label:"Pincode"}]}/></div>}

   <div className="leadOldTable"><DataTable mobileCards stickyFirstColumn selectable selectedIds={selected} onToggle={toggle} onToggleAll={toggleAll} rowClassName={r=>{const f=followState(r);if(!isOpen(r))return "leadRowClosed";if(missingMobile(r)||missingAddress(r))return "leadRowIncomplete";if(f.cls==="danger")return "leadRowOverdue";if(f.cls==="warn")return "leadRowToday";return ""}} columns={[
    {key:"companyName",label:"Party Name *",width:190,className:"leadRequiredCol leadPartyCol",render:r=><EditMasterLink onClick={()=>openDetail(r)}>{r.companyName||"PARTY REQUIRED"}</EditMasterLink>},
    {key:"address",label:"Address *",width:300,className:"leadRequiredCol leadAddressCol",render:r=><span className={missingAddress(r)?"leadMissingRequired":"leadAddressText"} title={r.address||"Address required"}>{r.address||"ADDRESS REQUIRED"}</span>},
    {key:"mobile",label:"Mobile No. *",width:130,className:"leadRequiredCol leadMobileCol",render:r=>missingMobile(r)?<span className="leadMissingRequired"><AlertTriangle/>MOBILE REQUIRED</span>:<div className="leadPhoneCell"><a className="tableClickLink" href={`tel:${onlyDigits(r.mobile)}`}>{r.mobile}</a><a className="leadMiniAction" title="WhatsApp" href={`https://wa.me/91${onlyDigits(r.whatsapp||r.mobile)}`} target="_blank" rel="noreferrer"><MessageCircle/></a></div>},
    {key:"pincode",label:"Pincode",width:82},{key:"city",label:"City",width:110},
    {key:"assigned",label:"Sales Person",width:130,render:r=>r.assignedUser?.name?<EditMasterLink to="/dms/users" id={r.assignedUser._id} resource="user">{r.assignedUser.name}</EditMasterLink>:<span className="leadMissingRequired">UNASSIGNED</span>},
    {key:"stage",label:"Stage",width:115,render:r=><StatusBadge value={r.stage}/>},
    {key:"priority",label:"Priority",width:80,render:r=><span className={`leadPriority ${String(r.priority||"NORMAL").toLowerCase()}`}>{r.priority||"NORMAL"}</span>},
    {key:"follow",label:"Next Follow-up",width:155,render:r=>{const f=followState(r);return <div className="leadFollowCell"><span className={`leadFollowBadge ${f.cls}`}>{f.label}</span><small>{dt(r.nextFollowUpAt)}</small></div>}},
    {key:"last",label:"Last Action",width:105,render:r=><span title={dt(r.lastActivityAt)}>{lastAction(r)}</span>},
    {key:"visits",label:"Visits",width:55,render:r=>r.visitCount||0},
    {key:"actions",label:"Actions",width:92,render:r=><div className="rowActions leadRowActions">{!missingMobile(r)&&<a className="iconBtn" title="Call" href={`tel:${onlyDigits(r.mobile)}`}><PhoneCall/></a>}<button className="iconBtn" title="Timeline / Follow-up / Visit / Convert" onClick={()=>openDetail(r)}><Activity/></button></div>}
   ]} rows={rows}/></div>
   <div className="paginationBar"><span>Page {meta.page||page} of {Math.max(1,meta.pages||1)} • {meta.total||0} leads</span><div><button className="btn ghost" disabled={(meta.page||page)<=1} onClick={()=>load((meta.page||page)-1)}><ChevronLeft size={15}/>Previous</button><button className="btn ghost" disabled={(meta.page||page)>=(meta.pages||1)} onClick={()=>load((meta.page||page)+1)}>Next<ChevronRight size={15}/></button></div></div>
  </section>
  </div>

  {view==="followups"&&<section className="panel leadRegisterPanel leadFollowRegister">
    <div className="leadFollowAuditHead"><div><strong>Salesperson Follow-up Register</strong><span>Date/time audit of every visit, call, WhatsApp and follow-up entered by the Sales Person.</span></div><div className="recordCount">{followMeta.total||0} activities</div></div>
    <div className="leadKpiStrip leadFollowKpis">
      {[{label:"Total",value:followSummary.total},{label:"Physical Visits",value:followSummary.physicalVisits},{label:"Calls",value:followSummary.calls},{label:"WhatsApp",value:followSummary.whatsapp},{label:"Follow-ups",value:followSummary.followUps}].map((k,i)=><div key={i} className="leadKpi"><span>{k.label}</span><strong>{Number(k.value||0).toLocaleString("en-IN")}</strong></div>)}
    </div>
    <div className="leadOldToolbar leadFollowToolbar">
      <label className="leadFilterLabel"><span>Sales Person</span><select value={followSalesperson} onChange={e=>{const v=e.target.value;setFollowSalesperson(v);setTimeout(()=>loadFollow(1,{salespersonId:v}),0)}}><option value="">All Sales Persons</option>{followSalespersons.map(u=><option key={u._id} value={u._id}>{u.name}{u.mobile?` — ${u.mobile}`:""}</option>)}</select></label>
      <label className="leadFilterLabel"><span>From</span><input type="date" value={followFrom} onChange={e=>setFollowFrom(e.target.value)}/></label>
      <label className="leadFilterLabel"><span>To</span><input type="date" value={followTo} onChange={e=>setFollowTo(e.target.value)}/></label>
      <label className="leadFilterLabel"><span>Activity</span><select value={followType} onChange={e=>setFollowType(e.target.value)}>{followTypes.map(x=><option key={x} value={x}>{x?x.replaceAll("_"," "):"All Activities"}</option>)}</select></label>
      <div className="searchBox leadSearch"><Search/><input value={followQ} onChange={e=>setFollowQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&loadFollow(1)} placeholder="Party, address, mobile, city, pincode..."/></div>
      <button className="iconBtn leadToolbarIcon" title="Apply filters" onClick={()=>loadFollow(1)}><Search/></button>
      <button className="iconBtn leadToolbarIcon" title="Today" onClick={()=>{const t=ymdLocal();setFollowFrom(t);setFollowTo(t);setTimeout(()=>loadFollow(1,{from:t,to:t}),0)}}><CalendarDays/></button>
      <button className="iconBtn leadToolbarIcon" title="Refresh" onClick={()=>loadFollow(followPage)}><RefreshCw/></button>
    </div>
    <div className="leadOldTable leadFollowTable"><DataTable mobileCards rows={followRows} rowClassName={r=>r.nextVisitAt&&new Date(r.nextVisitAt)<new Date()?"leadRowOverdue":""} columns={[
      {key:"date",label:"Date",width:92,render:r=><strong>{dateOnly(r.visitAt)}</strong>},
      {key:"time",label:"Time",width:72,render:r=><span className="leadAuditTime">{timeOnly(r.visitAt)}</span>},
      {key:"salesperson",label:"Sales Person",width:145,render:r=>r.salesperson?<EditMasterLink to="/dms/users" id={r.salesperson._id} resource="user">{r.salesperson.name}</EditMasterLink>:"—"},
      {key:"party",label:"Party Name",width:190,render:r=>r.party?<EditMasterLink onClick={()=>openDetail({_id:r.party._id})}>{r.party.name||"—"}</EditMasterLink>:"—"},
      {key:"mobile",label:"Mobile",width:112,render:r=>r.party?.mobile?<a className="tableClickLink" href={`tel:${onlyDigits(r.party.mobile)}`}>{r.party.mobile}</a>:"—"},
      {key:"place",label:"City / Pincode",width:125,render:r=><span>{[r.party?.city,r.party?.pincode].filter(Boolean).join(" / ")||"—"}</span>},
      {key:"type",label:"Activity",width:112,render:r=><span className={`leadAuditType ${String(r.type||"").toLowerCase()}`}>{String(r.type||"OTHER").replaceAll("_"," ")}</span>},
      {key:"remarks",label:"Remarks",width:280,render:r=><span className="leadAuditRemarks" title={r.remarks||""}>{r.remarks||"—"}</span>},
      {key:"outcome",label:"Outcome",width:150,render:r=>r.outcome||"—"},
      {key:"next",label:"Next Visit / Follow-up",width:150,render:r=><span className={r.nextVisitAt&&new Date(r.nextVisitAt)<new Date()?"leadAuditOverdue":""}>{dt(r.nextVisitAt)}</span>},
      {key:"verify",label:"Verify",width:86,render:r=><div className="leadAuditVerify">{r.gpsVerified&&<span title="GPS verified"><Navigation/>GPS</span>}{r.otpVerified&&<span>OTP</span>}{!r.gpsVerified&&!r.otpVerified&&"—"}</div>}
    ]}/></div>
    <div className="paginationBar"><span>Page {followMeta.page||followPage} of {Math.max(1,followMeta.pages||1)} • {followMeta.total||0} activities</span><div><button className="btn ghost" disabled={(followMeta.page||followPage)<=1} onClick={()=>loadFollow((followMeta.page||followPage)-1)}><ChevronLeft size={15}/>Previous</button><button className="btn ghost" disabled={(followMeta.page||followPage)>=(followMeta.pages||1)} onClick={()=>loadFollow((followMeta.page||followPage)+1)}>Next<ChevronRight size={15}/></button></div></div>
  </section>}


  {view==="creationRequests"&&<section className="panel leadRegisterPanel"><div className="leadFollowAuditHead"><strong>Lead Creation Requests</strong><span>Approve to allot the unassigned pincode to the requesting Sales Person and create the lead in the same tenant.</span></div><div className="leadOldTable"><DataTable stickyFirstColumn rows={creationRequests} columns={[
    {key:"requestId",label:"Request",width:130},
    {key:"companyName",label:"Party Name",width:190},
    {key:"mobile",label:"Mobile",width:115},
    {key:"pincode",label:"Pincode",width:85},
    {key:"city",label:"City",width:120},
    {key:"requestedBy",label:"Sales Person",width:150,render:r=>r.requestedBy?.name||r.requestedByName||"—"},
    {key:"createdAt",label:"Requested At",width:150,render:r=>dt(r.createdAt)},
    {key:"actions",label:"Actions",width:180,render:r=><div className="rowActions"><button className="btn primary" disabled={requestBusy===r._id} onClick={()=>reviewCreation(r._id,"APPROVE")}>Accept</button><button className="btn danger" disabled={requestBusy===r._id} onClick={()=>reviewCreation(r._id,"REJECT")}>Reject</button></div>}
  ]}/></div>{!creationRequests.length&&<div className="empty">No pending lead creation requests.</div>}</section>}

  {view==="conversionRequests"&&<section className="panel leadRegisterPanel"><div className="leadFollowAuditHead"><strong>Lead Conversion Requests</strong><span>These are customer profiles submitted from assigned leads and waiting for Superadmin verification.</span></div><div className="leadOldTable"><DataTable stickyFirstColumn rows={conversionRequests} columns={[
    {key:"localName",label:"Party Name",width:190,render:r=>r.localName||r.global?.legalName||r.global?.tradeName||"—"},
    {key:"sourceLeadId",label:"Lead ID",width:130},
    {key:"identity",label:"Identity",width:170,render:r=>r.global?.gstins?.[0]?.value||r.global?.pan||r.global?.aadhaarMasked||"—"},
    {key:"salespersonId",label:"Sales Person ID",width:150},
    {key:"status",label:"Status",width:125,render:r=><StatusBadge value={r.status}/>},
    {key:"createdAt",label:"Submitted At",width:150,render:r=>dt(r.approval?.submittedAt||r.createdAt)},
    {key:"actions",label:"Actions",width:180,render:r=><div className="rowActions"><button className="btn primary" disabled={requestBusy===r.globalCustomerId} onClick={()=>reviewConversion(r.globalCustomerId,"APPROVE")}>Accept</button><button className="btn danger" disabled={requestBusy===r.globalCustomerId} onClick={()=>reviewConversion(r.globalCustomerId,"REJECT")}>Reject</button></div>}
  ]}/></div>{!conversionRequests.length&&<div className="empty">No pending conversion requests.</div>}</section>}

  {detail&&<div className="modalOverlay"><section className="panel modalPanel extraWideModal leadTimelineModal"><div className="formTitle"><div><h3>{detail.lead.companyName}</h3><span>{detail.lead.leadId} • {detail.lead.mobile||"Mobile missing"} • {detail.lead.address||"Address missing"} • Assigned: {detail.assignedUser?.name||"Unassigned"}</span></div><button className="iconBtn" onClick={()=>setDetail(null)}><X/></button></div>
   <div className="leadQuickActions"><button className="btn ghost" disabled={["CUSTOMER","CANCELLED"].includes(detail.lead.stage)} onClick={()=>setEditLeadMode(v=>!v)}><Pencil/>Edit Details</button><button className="btn ghost" disabled={["CUSTOMER","CANCELLED"].includes(detail.lead.stage)} onClick={()=>setActivityMode("follow")}><PhoneCall/>Follow-up</button><button className="btn ghost" disabled={["CUSTOMER","CANCELLED"].includes(detail.lead.stage)} onClick={()=>{setActivityMode("visit");getGeo()}}><MapPin/>Visit</button><button className="btn primary" disabled={["CUSTOMER","CANCELLED","PENDING_VERIFICATION"].includes(detail.lead.stage)||missingMobile(detail.lead)||missingAddress(detail.lead)} onClick={convert}><UserCheck/>Convert to Customer</button><button className="btn ghost danger" disabled={["CUSTOMER","CANCELLED","PENDING_VERIFICATION"].includes(detail.lead.stage)} onClick={()=>setActivityMode("cancel")}><XCircle/>Cancel Lead</button></div>
   {(missingMobile(detail.lead)||missingAddress(detail.lead))&&<div className="leadDataWarning"><AlertTriangle/><span>Complete the mandatory lead data before conversion: {missingAddress(detail.lead)?"Address ":""}{missingMobile(detail.lead)?"Mobile No.":""}</span></div>}
   {editLeadMode&&<div className="subCard leadInlineEdit"><div className="sectionLabel">Lead Basic Details</div><div className="leadRequiredGrid"><label>Party Name *<input value={editLeadForm.companyName||""} onChange={e=>setEditLeadForm(f=>({...f,companyName:e.target.value}))}/></label><label className="leadAddressInput">Address *<input value={editLeadForm.address||""} onChange={e=>setEditLeadForm(f=>({...f,address:e.target.value}))}/></label><label>Mobile No. *<input inputMode="numeric" maxLength={10} value={editLeadForm.mobile||""} onChange={e=>setEditLeadForm(f=>({...f,mobile:onlyDigits(e.target.value).slice(0,10)}))}/></label><label>Pincode *<input inputMode="numeric" maxLength={6} value={editLeadForm.pincode||""} onChange={e=>setEditLeadForm(f=>({...f,pincode:onlyDigits(e.target.value).slice(0,6)}))}/></label></div><div className="formGrid leadOptionalGrid"><label>Contact Person<input value={editLeadForm.contactPerson||""} onChange={e=>setEditLeadForm(f=>({...f,contactPerson:e.target.value}))}/></label><label>WhatsApp<input value={editLeadForm.whatsapp||""} onChange={e=>setEditLeadForm(f=>({...f,whatsapp:onlyDigits(e.target.value).slice(0,10)}))}/></label><label>Email<input type="email" value={editLeadForm.email||""} onChange={e=>setEditLeadForm(f=>({...f,email:e.target.value}))}/></label><label>City<input value={editLeadForm.city||""} onChange={e=>setEditLeadForm(f=>({...f,city:e.target.value}))}/></label><label>State<input value={editLeadForm.state||""} onChange={e=>setEditLeadForm(f=>({...f,state:e.target.value}))}/></label><label>Source<input value={editLeadForm.source||""} onChange={e=>setEditLeadForm(f=>({...f,source:e.target.value}))}/></label><label>Product Interest<input value={editLeadForm.productInterest||""} onChange={e=>setEditLeadForm(f=>({...f,productInterest:e.target.value}))}/></label><label>Priority<select value={editLeadForm.priority||"NORMAL"} onChange={e=>setEditLeadForm(f=>({...f,priority:e.target.value}))}>{["HOT","WARM","NORMAL","COLD"].map(x=><option key={x}>{x}</option>)}</select></label></div><div className="formActions"><button className="btn ghost" onClick={()=>setEditLeadMode(false)}>Close</button><button className="btn primary" onClick={saveLeadEdit}>Update Lead</button></div></div>}
   <div className="approvalCards"><div><span>Stage</span><strong>{detail.lead.stage}</strong></div><div><span>Priority</span><strong>{detail.lead.priority}</strong></div><div><span>Visits</span><strong>{detail.lead.visitCount||0}</strong></div><div><span>Next Follow-up</span><strong>{dt(detail.lead.nextFollowUpAt)}</strong></div></div>
   {activityMode==="follow"&&<div className="subCard"><div className="sectionLabel">Follow-up</div><div className="formGrid"><label>Outcome<input value={activityForm.outcome} onChange={e=>setActivityForm(f=>({...f,outcome:e.target.value}))}/></label><label>Next Follow-up<input type="datetime-local" value={activityForm.nextFollowUpAt} onChange={e=>setActivityForm(f=>({...f,nextFollowUpAt:e.target.value}))}/></label><label className="span2">Note<textarea value={activityForm.note} onChange={e=>setActivityForm(f=>({...f,note:e.target.value}))}/></label></div><div className="formActions"><button className="btn ghost" onClick={()=>setActivityMode("")}>Close</button><button className="btn primary" onClick={followUp}>Save Follow-up</button></div></div>}
   {activityMode==="visit"&&<div className="subCard"><div className="sectionLabel">Visit Entry</div><div className="formGrid"><label>Outcome<input value={activityForm.outcome} onChange={e=>setActivityForm(f=>({...f,outcome:e.target.value}))}/></label><label>Next Follow-up<input type="datetime-local" value={activityForm.nextFollowUpAt} onChange={e=>setActivityForm(f=>({...f,nextFollowUpAt:e.target.value}))}/></label><label>Latitude<input value={activityForm.latitude} readOnly/></label><label>Longitude<input value={activityForm.longitude} readOnly/></label><label className="span2">Visit Note<textarea value={activityForm.note} onChange={e=>setActivityForm(f=>({...f,note:e.target.value}))}/></label></div><div className="formActions"><button className="btn ghost" onClick={getGeo}><MapPin/>Refresh GPS</button><button className="btn primary" onClick={saveVisit}>Save Visit</button></div></div>}
   {activityMode==="cancel"&&<div className="subCard"><div className="sectionLabel">Cancel Lead</div><div className="formGrid"><label>Reason *<select value={activityForm.reason} onChange={e=>setActivityForm(f=>({...f,reason:e.target.value}))}><option value="">Select Reason</option>{["NOT_INTERESTED","BUSINESS_CLOSED","WRONG_DATA","DUPLICATE","OUT_OF_SERVICE_AREA","COMPETITOR_LOCKED","NO_REQUIREMENT","OTHER"].map(x=><option key={x}>{x}</option>)}</select></label><label className="span2">Note<textarea value={activityForm.note} onChange={e=>setActivityForm(f=>({...f,note:e.target.value}))}/></label></div><div className="formActions"><button className="btn ghost" onClick={()=>setActivityMode("")}>Back</button><button className="btn danger" onClick={cancelLead}>Confirm Cancel</button></div></div>}
   <div className="leadTimeline"><div className="sectionLabel">Complete Timeline</div>{[
    ...(detail.visits||[]).map(v=>({at:v.visitAt,type:v.type,note:v.note,outcome:v.outcome,gps:v.gpsVerified,otp:v.otpVerified})),
    ...(detail.lead.activities||[]).map(a=>({at:a.at,type:a.type,note:a.note,outcome:a.outcome,gps:a.gpsVerified,otp:a.otpVerified}))
   ].sort((a,b)=>new Date(b.at)-new Date(a.at)).map((a,i)=><div className="timelineRow" key={`${a.at}-${i}`}><div className="timelineDot"><Clock3 size={14}/></div><div><strong>{String(a.type||"ACTIVITY").replaceAll("_"," ")}</strong><span>{dt(a.at)}</span><p>{[a.outcome,a.note].filter(Boolean).join(" — ")||"—"}</p>{(a.gps||a.otp)&&<small>{a.gps?"GPS verified":""}{a.gps&&a.otp?" • ":""}{a.otp?"OTP verified":""}</small>}</div></div>)}{!(detail.visits||[]).length&&!(detail.lead.activities||[]).length&&<div className="empty">No activity yet.</div>}</div>
  </section></div>}
 </div>;
}
