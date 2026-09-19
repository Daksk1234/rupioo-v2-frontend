import React,{useMemo,useRef,useState} from "react";
import {Camera,CheckCircle2,FileImage,ScanLine,Sparkles,Upload,X,AlertTriangle} from "lucide-react";
import {api} from "../lib/api.js";

const confidenceClass=(v)=>Number(v||0)>=0.85?"scanConfidenceHigh":Number(v||0)>=0.6?"scanConfidenceMedium":"scanConfidenceLow";
const fieldList=t=>(t?.sections||[]).flatMap(s=>s.fields||[]);

export default function ScanAndFill({documentType,onApply,label="Scan & Fill",compact=false,targetPath=""}){
 const[file,setFile]=useState(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[result,setResult]=useState(null),[values,setValues]=useState({}),[items,setItems]=useState([]),[msg,setMsg]=useState("");
 const cameraRef=useRef(null),fileRef=useRef(null);
 const fields=useMemo(()=>fieldList(result?.template),[result]);
 const analyze=async chosen=>{const f=chosen||file;if(!f)return setMsg("Choose a photo, scan or PDF first");setBusy(true);setMsg("");try{const data=new FormData();data.append("document",f);data.append("documentType",documentType);const d=await api("/document-ai/extract",{method:"POST",body:data});setResult(d);setValues(d.extraction?.values||{});setItems(d.extraction?.items||[]);setFile(f)}catch(e){setMsg(e.message)}finally{setBusy(false)}};
 const updateItem=(i,k,v)=>setItems(xs=>xs.map((x,n)=>n===i?{...x,[k]:v}:x));
 const apply=async()=>{try{await api(`/document-ai/scans/${encodeURIComponent(result.scanId)}/review`,{method:"POST",body:JSON.stringify({status:"APPLIED_TO_FORM",values,items,targetPath})});onApply?.({...values,items},{scanId:result.scanId,fileId:result.fileId,confidence:result.extraction?.confidence||{},warnings:result.extraction?.warnings||[]});setOpen(false);setResult(null);setValues({});setItems([]);setFile(null)}catch(e){setMsg(e.message)}};
 return <>
  <button type="button" className={`btn scanFillTrigger ${compact?"ghost":"primary"}`} onClick={()=>setOpen(true)} title="Read printed or handwritten form and fill this screen"><ScanLine size={16}/>{!compact&&label}</button>
  {open&&<div className="modalOverlay scanFillOverlay"><section className="panel modalPanel extraWideModal scanFillModal">
   <div className="formTitle"><div><h3><Sparkles size={19}/>AI Scan & Fill</h3><span>Upload the filled printed form, a supplier document, or take a photo. Nothing is saved automatically.</span></div><button className="iconBtn" onClick={()=>setOpen(false)}><X/></button></div>
   {!result&&<div className="scanDropZone"><ScanLine size={34}/><strong>{documentType.replaceAll("_"," ")}</strong><span>PDF, JPG, PNG, WEBP or phone camera</span><div className="scanSourceButtons"><button className="btn ghost" type="button" onClick={()=>cameraRef.current?.click()}><Camera/>Camera</button><button className="btn ghost" type="button" onClick={()=>fileRef.current?.click()}><Upload/>Upload</button></div><input ref={cameraRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f);analyze(f)}}}/><input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f);analyze(f)}}}/>{file&&<small><FileImage size={13}/>{file.name}</small>}{busy&&<div className="scanWorking"><span className="spinnerDot"/>Reading text, handwriting and form fields…</div>}</div>}
   {msg&&<div className="resultBanner bad">{msg}</div>}
   {result&&<><div className="scanReviewHeader"><div><strong>Review before applying</strong><span>Green = confident · Yellow = check · Red = missing/unclear</span></div><div>{result.extraction?.formId&&<span className="scanFormId">Form {result.extraction.formId}</span>}<button className="btn ghost" onClick={()=>{setResult(null);setFile(null)}}>Rescan</button></div></div>
    {(result.extraction?.warnings||[]).length>0&&<div className="scanWarnings"><AlertTriangle size={16}/><div>{result.extraction.warnings.map((w,i)=><div key={i}>{w}</div>)}</div></div>}
    <div className="scanReviewGrid">{fields.map(field=>{const c=Number(result.extraction?.confidence?.[field.key]||0);return <label key={field.key} className={`scanReviewField ${confidenceClass(c)}`}><span>{field.label}{field.required?" *":""}<b>{Math.round(c*100)}%</b></span>{field.type==="textarea"?<textarea value={values[field.key]??""} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}/>:<input type={field.type==="date"?"date":field.type==="number"?"number":"text"} value={values[field.key]??""} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}/>}</label>})}</div>
    {result.template?.table&&<div className="scanItemReview"><div className="sectionLabel">{result.template.table.title}</div><div className="scanItemTable"><table><thead><tr>{result.template.table.columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{items.map((row,i)=><tr key={i}>{result.template.table.columns.map(c=><td key={c.key}><input value={row[c.key]??""} onChange={e=>updateItem(i,c.key,e.target.value)}/>{c.key==="name"&&row.productMatches?.length>0&&<select onChange={e=>{const m=row.productMatches.find(x=>x.id===e.target.value);if(m)setItems(xs=>xs.map((x,n)=>n===i?{...x,productId:m.id,name:m.name,hsnCode:x.hsnCode||m.hsnCode,unit:x.unit||m.unit,gstRate:x.gstRate||m.gstRate}:x))}}><option value="">Product match…</option>{row.productMatches.map(m=><option key={m.id} value={m.id}>{m.name} • {m.sku}</option>)}</select>}</td>)}</tr>)}</tbody></table></div></div>}
    <div className="formActions"><button className="btn ghost" onClick={()=>setOpen(false)}>Cancel</button><button className="btn primary" onClick={apply}><CheckCircle2/>Apply to Form</button></div>
   </>}
  </section></div>}
 </>;
}
