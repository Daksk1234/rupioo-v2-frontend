import React,{useEffect,useMemo,useState} from "react";
import {FileText,Printer,QrCode,RefreshCw,ScanLine} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import {api,getUser} from "../lib/api.js";

const formIdFor=(type)=>`${type}-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
export default function FormLibraryPage(){
 const[templates,setTemplates]=useState([]),[active,setActive]=useState(null),[formId,setFormId]=useState(""),[qr,setQr]=useState(""),[msg,setMsg]=useState("");
 const user=getUser();
 const company=user?.companyProfile?.companyName||user?.companyName||"RUPIO DMS V2";
 const load=()=>api("/document-ai/templates").then(setTemplates).catch(e=>setMsg(e.message));
 useEffect(()=>{load()},[]);
 const printForm=async t=>{const id=formIdFor(t.type);setActive(t);setFormId(id);setQr(`/forms/qr_${t.type}.png`);setTimeout(()=>window.print(),120)};
 return <>
  <PageHeader title="AI Scan & QR Forms" description="Print blank QR-coded forms, fill them by hand, then use Scan & Fill to populate DMS V2."/>
  {msg&&<div className="resultBanner bad">{msg}</div>}
  <section className="panel noPrint"><div className="scanFormIntro"><div><ScanLine/><strong>Print → Fill → Photo/Scan → Review → Save</strong><span>QR and Form ID identify the document type/version. AI never posts directly.</span></div><button className="btn ghost" onClick={load}><RefreshCw/>Refresh</button></div></section>
  <section className="scanFormLibrary noPrint">{templates.map(t=><article className="scanTemplateCard" key={t.type}><div className="scanTemplateIcon"><QrCode/></div><div><h3>{t.title}</h3><p>{t.sections.reduce((n,s)=>n+(s.fields?.length||0),0)} fields{t.table?" + item table":""} • Version {t.version}</p><small>{t.subtitle}</small></div><button className="btn primary" onClick={()=>printForm(t)}><Printer/>Print</button></article>)}</section>
  {active&&<div className="printOnly scanPrintPage"><header><div><h1>{company}</h1><h2>{active.title}</h2><p>{active.subtitle}</p></div><div className="scanPrintQr"><img src={qr}/><b>{formId}</b><span>{active.type} • V{active.version}</span></div></header><div className="scanPrintInstruction">Write clearly in BLOCK LETTERS where possible. Keep numbers inside boxes. This form will be read by DMS V2 Scan & Fill.</div>{active.sections.map((section,si)=><section key={si}><h3>{section.title}</h3><div className="scanPrintFields">{section.fields.map(field=><div key={field.key} className={`scanPrintField ${field.type==="textarea"?"wide tall":""}`}><label>{field.label}{field.required?" *":""}</label><div className="writeBox"/></div>)}</div></section>)}{active.table&&<section><h3>{active.table.title}</h3><table className="scanPrintTable"><thead><tr>{active.table.columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{Array.from({length:10},(_,i)=><tr key={i}>{active.table.columns.map(c=><td key={c.key}/>)}</tr>)}</tbody></table></section>}<footer><span>Form ID: {formId}</span><span>Checked By: __________________</span><span>Date: __________</span></footer></div>}
 </>;
}
