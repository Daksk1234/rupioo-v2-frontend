import {apiBlob} from "./api.js";
// Bank and Cash exports: native XLSX/PDF downloads from backend, print locally.
const escapeHtml=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
export async function exportTransactionList(kind,format,headers,records,scope,printWindow=null){
 const heading=`${kind} · ${scope}`;
 const table=`<table><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${records.map(row=>`<tr>${row.map(v=>`<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
 const style=`<style>@page{size:A4 landscape;margin:10mm}body{font:11px Arial,sans-serif;color:#111827}h2{font-size:15px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d1d5db;padding:6px;text-align:center;word-break:break-word}th{background:#eef2f7}tr{break-inside:avoid}</style>`;
 const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(heading)}</title>${style}</head><body><h2>${escapeHtml(heading)}</h2>${table}</body></html>`;
 const name=`${kind.toLowerCase()}-${scope.replace(/[^\w-]+/g,"-")}`;
 if(format==="excel"){
  const {blob}=await apiBlob("/transactions/export-table-xlsx",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,scope,headers,rows:records})});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${name}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
 }
 if(format==="pdf"){
  const {blob}=await apiBlob("/transactions/export-table-pdf",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,scope,headers,rows:records})});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${name}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
 }
 const win=printWindow||window.open("","_blank");if(!win)throw new Error("Allow pop-ups to use Print.");
 win.onload=()=>win.print();
 win.document.open();win.document.write(html);win.document.close();win.focus();
 // Print opens the system dialog; PDF is downloaded directly from backend.
}
