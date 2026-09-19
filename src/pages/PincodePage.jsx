import React,{useEffect,useMemo,useRef,useState} from "react";
import { ChevronDown,ChevronRight,Download,Edit3,FileSpreadsheet,MapPinned,RefreshCw,Search,Trash2,Upload,X } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { api } from "../lib/api.js";

const blank={pincode:"",area:"",city:"",district:"",state:"",status:"ACTIVE"};
const keyState=s=>`STATE|${s}`;
const keyDistrict=(s,d)=>`DISTRICT|${s}|${d}`;
const keyArea=(s,d,a)=>`AREA|${s}|${d}|${a}`;

export default function PincodePage(){
  const fileRef=useRef(null);
  const [rows,setRows]=useState([]),[meta,setMeta]=useState({page:1,pages:1,total:0,limit:100});
  const [states,setStates]=useState([]),[districts,setDistricts]=useState({}),[areas,setAreas]=useState({});
  const [expandedStates,setExpandedStates]=useState(new Set()),[expandedDistricts,setExpandedDistricts]=useState(new Set());
  const [selectedScopes,setSelectedScopes]=useState(new Map()),[selectedIds,setSelectedIds]=useState(new Set());
  const [filters,setFilters]=useState({q:"",state:"",district:"",area:""});
  const [loading,setLoading]=useState(false),[message,setMessage]=useState(""),[messageType,setMessageType]=useState("good");
  const [editor,setEditor]=useState(null),[form,setForm]=useState(blank),[bulkEditor,setBulkEditor]=useState(false),[bulkForm,setBulkForm]=useState({pincode:"",area:"",city:"",district:"",state:"",status:""});
  const [uploading,setUploading]=useState(false),[uploadSummary,setUploadSummary]=useState(null);

  const query=useMemo(()=>{
    const p=new URLSearchParams({page:String(meta.page||1),limit:String(meta.limit||100)});
    Object.entries(filters).forEach(([k,v])=>{if(v)p.set(k,v)});
    return p.toString();
  },[filters,meta.page,meta.limit]);

  const load=async()=>{
    setLoading(true);
    try{
      const data=await api(`/master/pincodes?${query}`);
      setRows(data.items||[]);setMeta(m=>({...m,...(data.meta||{})}));
      const s=await api("/master/pincodes/states");setStates(s||[]);
    }catch(e){showMessage(e.message,"bad")}finally{setLoading(false)}
  };
  useEffect(()=>{load()},[query]);

  const showMessage=(m,type="good")=>{setMessage(m);setMessageType(type)};
  const reloadFromFirst=()=>{setMeta(m=>({...m,page:1})); if(meta.page===1)load()};

  const loadDistricts=async state=>{
    const key=keyState(state);
    setExpandedStates(prev=>{const n=new Set(prev);n.has(key)?n.delete(key):n.add(key);return n});
    if(!districts[state]){
      try{const data=await api(`/master/pincodes/districts?state=${encodeURIComponent(state)}`);setDistricts(x=>({...x,[state]:data||[]}))}catch(e){showMessage(e.message,"bad")}
    }
  };
  const loadAreas=async(state,district)=>{
    const key=keyDistrict(state,district);
    setExpandedDistricts(prev=>{const n=new Set(prev);n.has(key)?n.delete(key):n.add(key);return n});
    if(!areas[key]){
      try{const data=await api(`/master/pincodes/areas?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}`);setAreas(x=>({...x,[key]:data||[]}))}catch(e){showMessage(e.message,"bad")}
    }
  };

  const scopeObj=(type,state,district="",area="")=>({type,state,district,area});
  const isAncestorSelected=(type,state,district="",area="")=>{
    if(selectedScopes.has(keyState(state)))return true;
    if(type!=="STATE"&&selectedScopes.has(keyDistrict(state,district)))return true;
    if(type==="AREA"&&selectedScopes.has(keyArea(state,district,area)))return true;
    return false;
  };
  const toggleScope=(scope)=>{
    const key=scope.type==="STATE"?keyState(scope.state):scope.type==="DISTRICT"?keyDistrict(scope.state,scope.district):keyArea(scope.state,scope.district,scope.area);
    setSelectedScopes(prev=>{const n=new Map(prev); if(n.has(key))n.delete(key);else n.set(key,scope);return n});
  };
  const rowCovered=r=>selectedScopes.has(keyState(r.state))||selectedScopes.has(keyDistrict(r.state,r.district))||selectedScopes.has(keyArea(r.state,r.district,r.area));
  const rowChecked=r=>rowCovered(r)||selectedIds.has(r._id);
  const toggleRow=r=>{if(rowCovered(r))return;setSelectedIds(prev=>{const n=new Set(prev);n.has(r._id)?n.delete(r._id):n.add(r._id);return n})};
  const clearSelection=()=>{setSelectedScopes(new Map());setSelectedIds(new Set())};
  const selection=()=>({ids:[...selectedIds],scopes:[...selectedScopes.values()]});
  const selectedLabel=selectedScopes.size||selectedIds.size?`${selectedScopes.size} group selection(s) + ${selectedIds.size} individual row(s)`:"No selection";

  const openNew=()=>{setEditor("new");setForm(blank)};
  const openEdit=r=>{setEditor(r);setForm({pincode:r.pincode,area:r.area,city:r.city||"",district:r.district,state:r.state,status:r.status||"ACTIVE"})};
  const save=async()=>{
    try{
      const url=editor==="new"?"/master/pincodes":`/master/pincodes/${editor._id}`;
      await api(url,{method:editor==="new"?"POST":"PUT",body:JSON.stringify(form)});
      showMessage(editor==="new"?"Pincode added":"Pincode updated");setEditor(null);setForm(blank);reloadFromFirst();
    }catch(e){showMessage(e.message,"bad")}
  };
  const removeOne=async r=>{if(!confirm(`Delete ${r.pincode} - ${r.area}?`))return;try{await api(`/master/pincodes/${r._id}`,{method:"DELETE"});showMessage("Pincode deleted");load()}catch(e){showMessage(e.message,"bad")}};

  const onUpload=async e=>{
    const file=e.target.files?.[0];e.target.value="";if(!file)return;
    setUploading(true);setUploadSummary(null);
    try{const fd=new FormData();fd.append("file",file);const data=await api("/master/pincodes/bulk-upload",{method:"POST",body:fd});setUploadSummary(data);showMessage(`Upload complete: ${data.inserted} new, ${data.updated} updated, ${data.invalid} invalid`);clearSelection();reloadFromFirst();}
    catch(err){showMessage(err.message,"bad")}finally{setUploading(false)}
  };
  const downloadTemplate=()=>{
    const csv="Pincode,Area,City,District,State\n781001,Pan Bazaar,Guwahati,Kamrup Metropolitan,Assam\n781028,Beltola,Guwahati,Kamrup Metropolitan,Assam\n";
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="Pincode_Bulk_Upload_Template.csv";a.click();URL.revokeObjectURL(a.href);
  };

  const bulkEdit=async()=>{
    try{const data=await api("/master/pincodes/bulk-edit",{method:"POST",body:JSON.stringify({selection:selection(),changes:bulkForm})});showMessage(`${data.updated} record(s) updated`);setBulkEditor(false);setBulkForm({pincode:"",area:"",city:"",district:"",state:"",status:""});clearSelection();load()}
    catch(e){showMessage(e.message,"bad")}
  };
  const bulkDelete=async()=>{
    if(!selectedScopes.size&&!selectedIds.size){showMessage("Select records first","bad");return}
    if(!confirm(`Delete all pincodes covered by the current selection?\n\n${selectedLabel}\n\nThis cannot be undone.`))return;
    try{const data=await api("/master/pincodes/bulk-delete",{method:"POST",body:JSON.stringify({selection:selection()})});showMessage(`${data.deleted} record(s) deleted`);clearSelection();setStates([]);setDistricts({});setAreas({});load()}
    catch(e){showMessage(e.message,"bad")}
  };

  return <>
    <PageHeader title="Pincode & Geography" description="Bulk upload and maintain MASTER pincodes. Select a State, District or Area checkbox to select every pincode below it." onAdd={openNew} onUpload={()=>fileRef.current?.click()} addLabel="Add Pincode"/>
    <input ref={fileRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={onUpload}/>
    {message&&<div className={`resultBanner ${messageType}`}>{message}</div>}

    <section className="panel pincodeActionBar">
      <div className="pincodeActionLeft">
        <button className="btn ghost" onClick={()=>fileRef.current?.click()} disabled={uploading}><Upload size={16}/>{uploading?"Uploading...":"Bulk Upload Excel/CSV"}</button>
        <button className="btn ghost" onClick={downloadTemplate}><Download size={16}/>Download Template</button>
        <span className="selectionPill">{selectedLabel}</span>
      </div>
      <div className="pincodeActionRight">
        {(selectedScopes.size>0||selectedIds.size>0)&&<><button className="btn ghost" onClick={()=>setBulkEditor(true)}><Edit3 size={16}/>Bulk Edit</button><button className="btn dangerBtn" onClick={bulkDelete}><Trash2 size={16}/>Bulk Delete</button><button className="iconBtn" title="Clear selection" onClick={clearSelection}><X size={17}/></button></>}
      </div>
    </section>

    {uploadSummary&&<section className="panel uploadSummary"><FileSpreadsheet/><div><strong>Last upload</strong><span>{uploadSummary.received} rows received • {uploadSummary.valid} valid • {uploadSummary.inserted} inserted • {uploadSummary.updated} updated • {uploadSummary.invalid} invalid</span></div>{uploadSummary.errors?.length>0&&<details><summary>View first validation errors</summary><div className="uploadErrors">{uploadSummary.errors.map((x,i)=><div key={i}>Row {x.row}: {x.error}</div>)}</div></details>}</section>}

    {editor&&<section className="panel editorPanel"><div className="formTitle"><div><h3>{editor==="new"?"Add Pincode":"Edit Pincode"}</h3><span>Fields: Pincode, Area, City, District and State.</span></div><button className="btn ghost" onClick={()=>setEditor(null)}>Close</button></div><div className="formGrid"><label>Pincode<input value={form.pincode} maxLength={6} onChange={e=>setForm({...form,pincode:e.target.value.replace(/\D/g,"").slice(0,6)})}/></label><label>Area<input value={form.area} onChange={e=>setForm({...form,area:e.target.value})}/></label><label>City<input value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label><label>District<input value={form.district} onChange={e=>setForm({...form,district:e.target.value})}/></label><label>State<input value={form.state} onChange={e=>setForm({...form,state:e.target.value})}/></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>ACTIVE</option><option>INACTIVE</option></select></label></div><div className="formActions"><button className="btn ghost" onClick={()=>setEditor(null)}>Cancel</button><button className="btn primary" disabled={!/^\d{6}$/.test(form.pincode)||!form.area.trim()||!form.city.trim()||!form.district.trim()||!form.state.trim()} onClick={save}>Save</button></div></section>}

    {bulkEditor&&<section className="panel editorPanel bulkEditPanel"><div className="formTitle"><div><h3>Bulk Edit Pincodes</h3><span>Blank fields remain unchanged. Pincode number can be changed only when exactly one individual row is selected.</span></div><button className="btn ghost" onClick={()=>setBulkEditor(false)}>Close</button></div><div className="formGrid"><label>Pincode (single row only)<input value={bulkForm.pincode} maxLength={6} onChange={e=>setBulkForm({...bulkForm,pincode:e.target.value.replace(/\D/g,"").slice(0,6)})}/></label><label>Area<input value={bulkForm.area} placeholder="Leave blank to keep" onChange={e=>setBulkForm({...bulkForm,area:e.target.value})}/></label><label>City<input value={bulkForm.city} placeholder="Leave blank to keep" onChange={e=>setBulkForm({...bulkForm,city:e.target.value})}/></label><label>District<input value={bulkForm.district} placeholder="Leave blank to keep" onChange={e=>setBulkForm({...bulkForm,district:e.target.value})}/></label><label>State<input value={bulkForm.state} placeholder="Leave blank to keep" onChange={e=>setBulkForm({...bulkForm,state:e.target.value})}/></label><label>Status<select value={bulkForm.status} onChange={e=>setBulkForm({...bulkForm,status:e.target.value})}><option value="">Keep unchanged</option><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></label></div><div className="formActions"><button className="btn ghost" onClick={()=>setBulkEditor(false)}>Cancel</button><button className="btn primary" onClick={bulkEdit}>Apply to Selection</button></div></section>}

    <div className="pincodeLayout">
      <section className="panel geoTreePanel">
        <div className="geoTreeHeader"><div><MapPinned size={17}/><strong>Geography Selection</strong></div><span>{states.reduce((n,s)=>n+s.count,0).toLocaleString("en-IN")} records</span></div>
        <div className="geoTreeHint">Selecting a parent automatically includes every pincode under it.</div>
        <div className="geoTree">
          {states.map(s=>{const sk=keyState(s.name),sChecked=selectedScopes.has(sk);return <div className="treeState" key={sk}>
            <div className="treeRow levelState"><button className="treeExpand" onClick={()=>loadDistricts(s.name)}>{expandedStates.has(sk)?<ChevronDown/>:<ChevronRight/>}</button><input type="checkbox" checked={sChecked} onChange={()=>toggleScope(scopeObj("STATE",s.name))}/><button className="treeName" onClick={()=>{setFilters({q:"",state:s.name,district:"",area:""});setMeta(m=>({...m,page:1}))}}>{s.name}</button><span>{s.count.toLocaleString("en-IN")}</span></div>
            {expandedStates.has(sk)&&(districts[s.name]||[]).map(d=>{const dk=keyDistrict(s.name,d.name),covered=sChecked,checked=covered||selectedScopes.has(dk);return <div key={dk} className="treeDistrict"><div className="treeRow levelDistrict"><button className="treeExpand" onClick={()=>loadAreas(s.name,d.name)}>{expandedDistricts.has(dk)?<ChevronDown/>:<ChevronRight/>}</button><input type="checkbox" checked={checked} disabled={covered} onChange={()=>toggleScope(scopeObj("DISTRICT",s.name,d.name))}/><button className="treeName" onClick={()=>{setFilters({q:"",state:s.name,district:d.name,area:""});setMeta(m=>({...m,page:1}))}}>{d.name}</button><span>{d.count.toLocaleString("en-IN")}</span></div>
              {expandedDistricts.has(dk)&&(areas[dk]||[]).map(a=>{const ak=keyArea(s.name,d.name,a.name),ancestor=covered||selectedScopes.has(dk),checkedArea=ancestor||selectedScopes.has(ak);return <div className="treeRow levelArea" key={ak}><span className="treeSpacer"/><input type="checkbox" checked={checkedArea} disabled={ancestor} onChange={()=>toggleScope(scopeObj("AREA",s.name,d.name,a.name))}/><button className="treeName" onClick={()=>{setFilters({q:"",state:s.name,district:d.name,area:a.name});setMeta(m=>({...m,page:1}))}}>{a.name}</button><span>{a.count.toLocaleString("en-IN")}</span></div>})}
            </div>})}
          </div>})}
          {!states.length&&!loading&&<div className="empty">No pincodes uploaded yet.</div>}
        </div>
      </section>

      <section className="panel pincodeTablePanel">
        <div className="toolbar pincodeToolbar"><div className="searchBox"><Search size={16}/><input value={filters.q} onChange={e=>setFilters(x=>({...x,q:e.target.value}))} placeholder="Search pincode, area, city, district or state..."/></div><button className="btn ghost" onClick={load}><RefreshCw size={15}/>{loading?"Loading":"Refresh"}</button>{(filters.state||filters.district||filters.area)&&<button className="btn ghost" onClick={()=>{setFilters({q:filters.q,state:"",district:"",area:""});setMeta(m=>({...m,page:1}))}}>Clear Geography Filter</button>}</div>
        <div className="activeGeoFilter">{filters.state?<><strong>{filters.state}</strong>{filters.district&&<> / <strong>{filters.district}</strong></>}{filters.area&&<> / <strong>{filters.area}</strong></>}</>:"All India"}<span>{meta.total?.toLocaleString("en-IN")||0} records</span></div>
        <div className="tableWrap"><table><thead><tr><th className="checkCol">✓</th><th>Pincode</th><th>Area</th><th>City</th><th>District</th><th>State</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r._id}><td><input type="checkbox" checked={rowChecked(r)} disabled={rowCovered(r)} onChange={()=>toggleRow(r)}/></td><td><strong>{r.pincode}</strong></td><td>{r.area}</td><td>{r.city||"—"}</td><td>{r.district}</td><td>{r.state}</td><td><span className={`miniStatus ${r.status==="INACTIVE"?"inactive":""}`}>{r.status}</span></td><td><div className="rowActions"><button title="Edit" onClick={()=>openEdit(r)}><Edit3/></button><button className="danger" title="Delete" onClick={()=>removeOne(r)}><Trash2/></button></div></td></tr>):<tr><td colSpan="8"><div className="empty">No records found.</div></td></tr>}</tbody></table></div>
        <div className="paginationBar"><span>Page {meta.page||1} of {meta.pages||1}</span><div><button className="btn ghost" disabled={(meta.page||1)<=1} onClick={()=>setMeta(m=>({...m,page:m.page-1}))}>Previous</button><button className="btn ghost" disabled={(meta.page||1)>=(meta.pages||1)} onClick={()=>setMeta(m=>({...m,page:m.page+1}))}>Next</button></div></div>
      </section>
    </div>
  </>;
}
