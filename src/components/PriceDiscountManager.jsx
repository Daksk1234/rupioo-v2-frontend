import React,{useEffect,useState} from "react";
import { api } from "../lib/api.js";

const empty={code:"",name:"",mode:"VARIABLE",defaultPct:"0"};
export default function PriceDiscountManager({onChanged=()=>{}}){
 const [rows,setRows]=useState([]),[show,setShow]=useState(false),[form,setForm]=useState(empty),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 const load=async()=>{try{const d=await api("/catalog/price-discount-rules");setRows(d.items||[]);}catch(e){setMessage(e.message);}};
 useEffect(()=>{load();},[]);
 const save=async()=>{
   try{setSaving(true);if(!form.name?.trim()||!(form.code||form._id))throw new Error("Name and code are required");
     const result=await api(form._id?`/catalog/price-discount-rules/${form._id}`:"/catalog/price-discount-rules",{method:form._id?"PUT":"POST",body:JSON.stringify({...form,defaultPct:Number(form.defaultPct)})});
     setShow(false);setMessage("Discount saved");await load();onChanged(result);
   }catch(e){setMessage(e.message)}finally{setSaving(false)}
 };
 const deactivate=async(row)=>{if(!window.confirm(`Deactivate ${row.name}?`))return;try{await api(`/catalog/price-discount-rules/${row._id}`,{method:"PUT",body:JSON.stringify({status:"INACTIVE"})});await load();onChanged();}catch(e){setMessage(e.message)}};
 return <section className="panel" style={{marginTop:10}}>
   <div className="toolbar"><strong>Additional Discounts</strong><span className="tableSubText">FIXED: always applied • VARIABLE: configurable per product, lowest % first</span><button className="btn ghost" onClick={()=>{setForm(empty);setShow(!show)}}>+ Add Discount</button></div>
   {message&&<div className="resultBanner">{message}</div>}
   {show&&<div className="formGrid" style={{padding:12}}>
    {!form._id&&<label>Code<input value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,"")}))}/></label>}
    <label>Discount Name<input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></label>
    <label>Type<select value={form.mode} onChange={e=>setForm(f=>({...f,mode:e.target.value}))}><option value="FIXED">Fixed (always)</option><option value="VARIABLE">Variable (optional)</option></select></label>
    <label>Default Discount %<input type="number" min="0" max="99.99" step="0.01" value={form.defaultPct} onChange={e=>setForm(f=>({...f,defaultPct:e.target.value}))}/></label>
    <div className="formActions"><button className="btn ghost" onClick={()=>setShow(false)}>Cancel</button><button className="btn primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save Discount"}</button></div>
   </div>}
   <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
   {rows.map(row=><div className="subCard" key={row._id} style={{margin:0,padding:10,minWidth:190}}>
     <div><strong>{row.name} ({row.defaultPct}%)</strong></div><small>{row.code} • {row.mode} • {row.status}</small>
     <div className="rowActions"><button className="btn ghost" onClick={()=>{setForm({...row});setShow(true)}}>Edit</button>{row.status!=="INACTIVE"&&<button className="btn ghost" onClick={()=>deactivate(row)}>Deactivate</button>}</div>
   </div>)}
   {!rows.length&&<span className="tableSubText">No additional discounts. Grade discounts continue to work as before.</span>}
   </div>
 </section>
}
