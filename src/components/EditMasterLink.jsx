import React from "react";

export function openMasterEdit({to,id,resource="",code=""}={}){
  if(!to || (!id && !code)) return;
  try{
    const url=new URL(to,window.location.origin);
    url.searchParams.set("lookup","1");
    if(resource)url.searchParams.set("resource",resource);
    if(id)url.searchParams.set("edit",String(id));
    if(code)url.searchParams.set("editCode",String(code));
    const w=window.open(url.toString(),"_blank");
    if(!w) window.alert?.("Please allow pop-ups for this DMS site to edit the selected record.");
  }catch{}
}

export default function EditMasterLink({children,to,id,resource="",code="",onClick,title,className=""}){
  const clickable=Boolean(onClick || (to && (id || code)));
  if(!clickable) return <span className={className}>{children ?? "—"}</span>;
  return <button
    type="button"
    className={`masterEditLink ${className}`.trim()}
    title={title||"Click to edit"}
    onClick={(event)=>{event.stopPropagation(); if(onClick)onClick(event); else openMasterEdit({to,id,resource,code});}}
  >{children ?? "—"}</button>;
}
