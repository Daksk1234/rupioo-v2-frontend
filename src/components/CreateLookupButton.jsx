import React,{useEffect,useRef} from "react";
import {Pencil,Plus} from "lucide-react";

const query=()=>{try{return new URLSearchParams(window.location.search)}catch{return new URLSearchParams()}};

export function isLookupCreate(){
 const p=query();
 return p.get("create")==="1"&&p.get("lookup")==="1";
}

export function getLookupEditId(){
 const p=query();
 return p.get("lookup")==="1"?String(p.get("edit")||""):"";
}

export function isLookupEdit(){return Boolean(getLookupEditId())}

export function notifyLookupCreated(resource,payload={}){
 try{
  if(window.opener&&!window.opener.closed){
   window.opener.postMessage({type:"DMS_LOOKUP_CREATED",resource,payload},window.location.origin);
  }
  if(query().get("lookup")==="1")setTimeout(()=>window.close(),120);
 }catch{}
}

export default function CreateLookupButton({
 to,
 label="Record",
 resource="",
 onReturn,
 title,
 selectedValue="",
 editTitle,
 canEdit=true,
 context=null,
}){
 const waiting=useRef(false);
 useEffect(()=>{
  const message=e=>{
   if(e.origin!==window.location.origin||e.data?.type!=="DMS_LOOKUP_CREATED")return;
   if(resource&&e.data?.resource&&resource!==e.data.resource)return;
   waiting.current=false;
   onReturn?.(e.data?.payload||{});
  };
  const focus=()=>{
   if(!waiting.current)return;
   waiting.current=false;
   setTimeout(()=>onReturn?.({}),220);
  };
  window.addEventListener("message",message);
  window.addEventListener("focus",focus);
  return()=>{window.removeEventListener("message",message);window.removeEventListener("focus",focus)};
 },[onReturn,resource]);

 const openWindow=(mode)=>{
  try{
   const url=new URL(to,window.location.origin);
   url.searchParams.set("lookup","1");
   if(resource)url.searchParams.set("resource",resource);
   if(context&&typeof context==="object"){
    Object.entries(context).forEach(([key,value])=>{if(value!==undefined&&value!==null&&String(value).trim()!=="")url.searchParams.set(`ctx_${key}`,String(value));});
   }
   if(mode==="edit"&&selectedValue){
    url.searchParams.delete("create");
    url.searchParams.set("edit",String(selectedValue));
   }else{
    url.searchParams.delete("edit");
    url.searchParams.set("create","1");
   }
   waiting.current=true;
   const w=window.open(url.toString(),"_blank");
   if(!w){
    waiting.current=false;
    window.alert?.("Please allow pop-ups for this DMS site to create or edit records without losing the current form.");
   }
  }catch{}
 };

 const noun=String(label||"").toLowerCase()==="create"?(resource||"record"):label;
 const createTitle=title||`Create ${noun}`;
 const selected=String(selectedValue||"").trim();
 const editLabel=editTitle||`Edit selected ${noun}`;
 return <div className="lookupActionBar">
  <button type="button" className="lookupCreateBtn" onClick={()=>openWindow("create")} title={createTitle} aria-label={createTitle}><Plus size={14}/></button>
  {canEdit&&selected&&<button type="button" className="lookupEditBtn" onClick={()=>openWindow("edit")} title={editLabel} aria-label={editLabel}><Pencil size={13}/></button>}
 </div>;
}
