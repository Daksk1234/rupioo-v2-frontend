import React,{useEffect,useState} from "react";
import { api } from "../lib/api.js";

const previousMonth=()=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const qty=value=>Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:3});

/** DMS Superadmin review of immutable, warehouse-specific physical counts. */
export default function WarehouseClosingReview({warehouses=[]}){
 const [warehouseId,setWarehouseId]=useState(""),[monthKey,setMonthKey]=useState(previousMonth),[report,setReport]=useState(null),[loading,setLoading]=useState(false),[message,setMessage]=useState(""),[remarks,setRemarks]=useState("");
 useEffect(()=>{if(!warehouseId&&warehouses.length)setWarehouseId(String(warehouses[0]._id))},[warehouseId,warehouses]);
 const load=async()=>{
  if(!warehouseId||!monthKey)return;
  setLoading(true);setMessage("");try{const result=await api(`/sales-app/order-flow/monthly-closings?warehouseId=${encodeURIComponent(warehouseId)}&monthKey=${encodeURIComponent(monthKey)}`);setReport(result)}catch(e){setReport(null);setMessage(e.message)}finally{setLoading(false)}
 };
 useEffect(()=>{load()},[warehouseId,monthKey]);
 const review=async()=>{
  if(!report||report.status!=="SUBMITTED")return;
  try{setLoading(true);const next=await api(`/sales-app/order-flow/monthly-closings/${report._id}/review`,{method:"POST",body:JSON.stringify({monthKey,remarks})});setReport(next);setMessage("Monthly warehouse reconciliation reviewed successfully.")}catch(e){setMessage(e.message)}finally{setLoading(false)}
 };
 const input={padding:"8px 10px",border:"1px solid #cbd5e1",borderRadius:7,fontSize:12};
 return <section style={{border:"1px solid #e2e8f0",borderRadius:12,padding:16,background:"white"}}>
  <h3 style={{margin:"0 0 6px",fontSize:16}}>Warehouse Monthly Closing Stock Reconciliation</h3>
  <p style={{color:"#64748b",fontSize:12}}>Each warehouse submits its actual physical quantities on the first of the month. Review expected vs actual and shortage/excess reasons for that warehouse only.</p>
  <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap",marginBottom:14}}>
   <label style={{fontSize:12}}>Warehouse<br/><select style={input} value={warehouseId} onChange={e=>setWarehouseId(e.target.value)}><option value="">Select Warehouse</option>{warehouses.map(w=><option key={w._id} value={w._id}>{w.title||w.reference}</option>)}</select></label>
   <label style={{fontSize:12}}>Closing Month<br/><input style={input} type="month" value={monthKey} onChange={e=>setMonthKey(e.target.value)}/></label>
   <button type="button" disabled={loading} onClick={load} style={input}>{loading?"Loading...":"Refresh"}</button>
  </div>
  {message?<p style={{fontSize:12,color:"#0f766e"}}>{message}</p>:null}
  {report&&<>
   <p style={{fontSize:12,fontWeight:700}}>Status: {report.status} • {report.rows?.length||0} products {report.submittedAt?`• Submitted ${new Date(report.submittedAt).toLocaleString("en-IN")}`:"• Waiting for warehouse entry"}</p>
   <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:680,fontSize:12}}><thead><tr style={{background:"#f1f5f9",textAlign:"left"}}>{["Product","System Expected","Actual Count","Difference","Shortage / Excess Reason"].map(s=><th key={s} style={{padding:9}}>{s}</th>)}</tr></thead><tbody>{(report.rows||[]).map(r=><tr key={r.productId} style={{borderTop:"1px solid #e2e8f0"}}><td style={{padding:9,fontWeight:600}}>{r.productName}</td><td style={{padding:9}}>{qty(r.expected)}</td><td style={{padding:9}}>{r.actual===null||r.actual===undefined?"Awaiting Entry":qty(r.actual)}</td><td style={{padding:9,color:Math.abs(Number(r.variance||0))>0.001?"#b91c1c":"inherit"}}>{r.actual===null||r.actual===undefined?"—":qty(r.variance)}</td><td style={{padding:9}}>{r.reason||"—"}</td></tr>)}</tbody></table></div>
   {report.status==="SUBMITTED"&&<div style={{marginTop:16,display:"flex",gap:10,flexWrap:"wrap"}}><input value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Superadmin review notes (optional)" style={{...input,minWidth:280,flex:1}}/><button type="button" disabled={loading} onClick={review} style={{...input,background:"#0f766e",color:"white"}}>Mark Reviewed</button></div>}
   {report.status==="REVIEWED"&&<p style={{fontSize:12,color:"#15803d"}}>Reviewed by Superadmin. {report.reviewRemarks||""}</p>}
  </>}
 </section>;
}
