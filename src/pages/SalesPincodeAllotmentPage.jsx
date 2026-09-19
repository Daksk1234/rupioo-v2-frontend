import React,{useEffect,useMemo,useState} from "react";
import {MapPin,Pencil,RefreshCw,Search,Users,X} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import PincodeHierarchySelector from "../components/PincodeHierarchySelector.jsx";
import {api} from "../lib/api.js";

const idOf=v=>String(v?._id||v||"");

export default function SalesPincodeAllotmentPage(){
  const[rows,setRows]=useState([]),[q,setQ]=useState(""),[loading,setLoading]=useState(false),[message,setMessage]=useState("");
  const[edit,setEdit]=useState(null),[pins,setPins]=useState([]),[saving,setSaving]=useState(false);

  const load=async()=>{setLoading(true);setMessage("");try{const data=await api(`/access/sales-pincode-users?q=${encodeURIComponent(q)}`);setRows(Array.isArray(data)?data:[])}catch(e){setMessage(e.message)}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);

  const heads=useMemo(()=>rows.filter(r=>r.roleCode==="SALES_HEAD"),[rows]);
  const persons=useMemo(()=>rows.filter(r=>r.roleCode==="SALES_PERSON"),[rows]);
  const distinctPins=useMemo(()=>new Set(rows.flatMap(r=>r.pincodes||[])).size,[rows]);

  const openEdit=async row=>{
    setMessage("");
    try{const data=await api(`/access/users/${row._id}/pincodes`);setEdit({...row,...data});setPins(data?.pincodes||[])}catch(e){setMessage(e.message)}
  };
  const save=async()=>{if(!edit)return;setSaving(true);setMessage("");try{await api(`/access/users/${edit._id}/pincodes`,{method:"PUT",body:JSON.stringify({pincodes:pins})});setMessage(`${edit.name} pincode allotment updated`);setEdit(null);setPins([]);await load()}catch(e){setMessage(e.message)}finally{setSaving(false)}};

  const renderUserCard=(row,isHead=false)=>{
    const subCount=isHead?persons.filter(p=>idOf(p.salesHeadId)===idOf(row._id)).length:0;
    return <div className="salesPinUserCard" key={row._id}>
      <div className="salesPinUserMain">
        <div className={`salesPinRoleIcon ${isHead?"head":"person"}`}><Users size={17}/></div>
        <div><strong>{row.name}</strong><span>{row.roleName||row.roleCode}{!isHead&&<> • Head: {row.salesHeadName||"Not assigned"}{row.parentName&&row.parentName!==row.salesHeadName?` • Reports to: ${row.parentName}`:""}</>}</span></div>
      </div>
      <div className="salesPinStats">
        <span><b>{(row.pincodes||[]).length.toLocaleString("en-IN")}</b> pincodes</span>
        {isHead&&<span><b>{subCount}</b> Sales Person{SubCountSuffix(subCount)}</span>}
        <StatusBadge value={row.status||"ACTIVE"}/>
      </div>
      <button className="btn ghost compactBtn" onClick={()=>openEdit(row)}><Pencil size={14}/>Edit Allotment</button>
    </div>;
  };

  return <>
    <PageHeader title="Sales Pincode Allotment" description="Manage Sales Head coverage and Sales Person pincode allotment from one place. Multiple Sales Heads are supported."/>
    {message&&<div className="resultBanner good">{message}</div>}
    <section className="summaryCards salesPinSummary">
      <div><Users/><strong>{heads.length}</strong><span>Sales Heads</span></div>
      <div><Users/><strong>{persons.length}</strong><span>Sales Persons</span></div>
      <div><MapPin/><strong>{distinctPins.toLocaleString("en-IN")}</strong><span>Distinct allocated pincodes</span></div>
    </section>
    <section className="panel">
      <div className="toolbar"><div className="searchBox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} placeholder="Search Sales Head / Sales Person..."/></div><button className="btn ghost" onClick={load}><RefreshCw/>{loading?"Loading...":"Refresh"}</button></div>
    </section>

    <section className="panel salesPinSection">
      <div className="sectionLabel">Sales Heads</div>
      <div className="salesPinCards">{heads.length?heads.map(h=>renderUserCard(h,true)):<div className="empty">No Sales Head created yet.</div>}</div>
    </section>

    <section className="panel salesPinSection">
      <div className="sectionLabel">Sales Person Wise Pincode Allotment</div>
      <div className="salesPinCards">{persons.length?persons.map(p=>renderUserCard(p,false)):<div className="empty">No Sales Person created yet.</div>}</div>
    </section>

    {edit&&<div className="modalOverlay"><section className="panel modalPanel extraWideModal"><div className="formTitle"><div><h3>{edit.name} — {edit.roleCode==="SALES_HEAD"?"Sales Head Coverage":"Sales Person Pincode Allotment"}</h3><span>Tick State, District, City or individual Pincode. Selecting a higher level selects every pincode below it.</span></div><button className="iconBtn" onClick={()=>setEdit(null)}><X/></button></div><PincodeHierarchySelector value={pins} onChange={setPins} disabled={saving} scopeUserId={edit.roleCode==="SALES_PERSON"?(edit.salesHeadId||idOf(edit.assignedToUserId)):""}/><div className="formActions"><button className="btn ghost" disabled={saving} onClick={()=>setEdit(null)}>Cancel</button><button className="btn primary" disabled={saving||!pins.length} onClick={save}>{saving?"Saving...":`Save ${pins.length} Pincode(s)`}</button></div></section></div>}
  </>;
}

function SubCountSuffix(count){return count===1?"":"s"}
