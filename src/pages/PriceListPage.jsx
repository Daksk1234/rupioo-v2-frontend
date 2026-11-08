import React,{useEffect,useMemo,useState} from "react";
import { RefreshCw,Search } from "lucide-react";
import DataTable from "../components/DataTable.jsx";
import PriceDiscountManager from "../components/PriceDiscountManager.jsx";
import { api } from "../lib/api.js";
import { currentFinancialYear } from "../lib/financialYear.js";
import { isAdminUser } from "../lib/adminVisibility.js";
import { calculateDynamicPrice } from "../lib/dynamicPriceEngine.js";

const money=n=>`₹${Number(n||0).toFixed(2)}`;
const field=(r,k)=>r?.[k]??"";
const draftFrom=(row,grades=[])=>{
 const v=row.priceListSettings||{};
 const highest=[...grades].sort((a,b)=>Number(b.discountPct||0)-Number(a.discountPct||0))[0];
 return {name:row.name||"",sku:row.sku||"",landedCost:row.landedPrice??0,gstRate:row.gstRate??0,minimumSalePrice:v.minimumSalePrice??row.minimumSalePrice??0,
  mode:v.mode||"SALE_TO_MRP",salePrice:v.enabled?(v.salePrice??row.calculatedSalePrice??0):(row.minimumSalePrice||row.salePrice||0),
  mrp:v.enabled?(v.mrp??row.mrp??0):(row.mrp||0),
  targetGradeCode:v.targetGradeCode||highest?.code||"",discountOverrides:v.discountOverrides||{}};
};
export default function PriceListPage(){
 const admin=isAdminUser();
 const [rows,setRows]=useState([]),[grades,setGrades]=useState([]),[rules,setRules]=useState([]),[drafts,setDrafts]=useState({});
 const [dirty,setDirty]=useState({}),[busy,setBusy]=useState(false),[saving,setSaving]=useState({}),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [fy,setFy]=useState(currentFinancialYear()),[q,setQ]=useState(""),[page,setPage]=useState(1),[meta,setMeta]=useState({page:1,pages:1,total:0});
 const load=async(next=1)=>{setBusy(true);setError("");try{
  const d=await api(`/catalog/old-dms-price-list/products?q=${encodeURIComponent(q)}&financialYear=${encodeURIComponent(fy)}&page=${next}&limit=100`);
  const g=d.grades||[];setGrades(g);setRules(d.discountRules||[]);setRows(d.items||[]);setPage(d.meta?.page||next);setMeta(d.meta||{page:next,pages:1,total:(d.items||[]).length});
  setDrafts(Object.fromEntries((d.items||[]).map(r=>[r._id,draftFrom(r,g)])));setDirty({});
 }catch(e){setError(e.message)}finally{setBusy(false)}};
 useEffect(()=>{load(1)},[fy]);
 const change=(id,key,value)=>{setDrafts(p=>({...p,[id]:{...p[id],[key]:value}}));setDirty(p=>({...p,[id]:true}));};
 const switchMode=(id,mode)=>{const d=drafts[id];if(!d)return;
  const p=preview(d);
  setDrafts(cur=>({...cur,[id]:{...cur[id],mode,
    ...(p.error?{}:{salePrice:p.salePrice,mrp:p.mrp})}}));
  setDirty(cur=>({...cur,[id]:true}));
 };
 const setRule=(id,code,update)=>{setDrafts(p=>{const d=p[id];return {...p,[id]:{...d,discountOverrides:{...d.discountOverrides,[code]:{...(d.discountOverrides?.[code]||{}),...update}}}}});setDirty(p=>({...p,[id]:true}));};
 const getGrade=d=>grades.find(g=>g.code===d.targetGradeCode)||grades[0];
 const preview=(d)=>{try{return calculateDynamicPrice({mode:d.mode,salePrice:d.salePrice,mrp:d.mrp,gstRate:d.gstRate,gradePct:getGrade(d)?.discountPct||0,rules,overrides:d.discountOverrides});}catch(e){return {error:e.message}};};
 const saveOne=async(row)=>{
  const d=drafts[row._id];const estimate=preview(d);
  if(estimate.error)throw new Error(`${row.name}: ${estimate.error}`);
  setSaving(p=>({...p,[row._id]:true}));
  try{await api(`/catalog/old-dms-price-list/products/${row._id}/manual`,{method:"PUT",body:JSON.stringify({...d,salePrice:Number(d.salePrice),mrp:Number(d.mrp),gstRate:Number(d.gstRate),landedCost:Number(d.landedCost)})});
    setDirty(p=>{const n={...p};delete n[row._id];return n;});
  }finally{setSaving(p=>({...p,[row._id]:false}));}
 };
 const saveAll=async()=>{const changed=rows.filter(r=>dirty[r._id]);if(!changed.length)return;
  let done=0;const failures=[];for(const row of changed){try{await saveOne(row);done++}catch(e){failures.push(e.message)}}
  setMessage(`${done} product(s) saved.${failures.length?` ${failures.length} failed: ${failures.join("; ")}`:""}`);
  if(!failures.length)await load(page);
 };
 const entry=(row,key,opt={})=>{
   const d=drafts[row._id]||draftFrom(row,grades);
   const calculated=(key==="salePrice"&&d.mode==="MRP_TO_SALE")||(key==="mrp"&&d.mode==="SALE_TO_MRP");
   const estimation=calculated?preview(d):null;
   const value=calculated&&!estimation?.error?estimation[key]:field(d,key);
   return <input type={opt.type||"number"} min={opt.type==="text"?undefined:0} step={opt.type==="text"?undefined:"0.01"}
     title={calculated?"Automatically calculated from the other price and the discount rules":undefined}
     style={{width:opt.width||94,padding:6,background:calculated?"#f1f5f9":undefined}} value={value} readOnly={calculated} disabled={!admin||saving[row._id]}
     onChange={e=>!calculated&&change(row._id,key,e.target.value)} />;
 };
 const columns=useMemo(()=>[
  {key:"name",label:"Product",render:r=>entry(r,"name",{type:"text",width:175})},
  {key:"sku",label:"SKU",render:r=>entry(r,"sku",{type:"text",width:94})},
  {key:"averagePurchaseRate",label:"Avg Purchase (FY)",render:r=>money(r.averagePurchaseRate)},
  {key:"landedPrice",label:"Landed Cost",render:r=>entry(r,"landedCost")},
  {key:"marketSalePrice",label:"Market Sale (FY)",render:r=><span title="Historical invoice average; cannot rewrite posted sales">{money(r.marketSalePrice)}</span>},
  {key:"minimumSalePrice",label:"Minimum Sale Price",render:r=>entry(r,"minimumSalePrice")},
  {key:"profitPct",label:"Projected Profit %",render:r=>{const d=drafts[r._id]||draftFrom(r,grades);const p=preview(d);const cost=Number(d.landedCost||0);return p.error||!cost?"—":`${((p.salePrice-cost)/cost*100).toFixed(2)}%`; }},
  {key:"mode",label:"Calculate From",render:r=><select disabled={!admin} value={drafts[r._id]?.mode||"SALE_TO_MRP"} onChange={e=>switchMode(r._id,e.target.value)}><option value="SALE_TO_MRP">Sale → MRP</option><option value="MRP_TO_SALE">MRP → Sale</option></select>},
  {key:"gradeCode",label:"Grade Baseline",render:r=><select disabled={!admin} value={drafts[r._id]?.targetGradeCode||""} onChange={e=>change(r._id,"targetGradeCode",e.target.value)}><option value="">Highest Grade</option>{grades.map(g=><option value={g.code} key={g.code}>{g.code} ({g.discountPct}%)</option>)}</select>},
  {key:"salePrice",label:"Sale Price ex GST",render:r=><div>{entry(r,"salePrice")}</div>},
  {key:"gstRate",label:"GST %",render:r=>entry(r,"gstRate",{width:69})},
  {key:"mrp",label:"MRP incl GST",render:r=>entry(r,"mrp")},
  {key:"calculated",label:"Preview Result",render:r=>{const p=preview(drafts[r._id]||draftFrom(r,grades));return p.error?<span style={{color:"#b91c1c"}}>{p.error}</span>:<div><strong>Sale {money(p.salePrice)}</strong><small style={{display:"block"}}>MRP {money(p.mrp)} • GST {p.gstRate}%</small><small style={{display:"block"}}>Discount {money(p.totalDiscount)}</small><details><summary>Discount order</summary>{p.discountSteps.map(step=><small key={step.code} style={{display:"block"}}>{step.name}: {step.percent}% (−{money(step.amount)})</small>)}</details></div>;}},
  ...rules.map(rule=>({key:`discount_${rule.code}`,label:`${rule.name} (${rule.mode})`,render:r=>{
    const d=drafts[r._id]||draftFrom(r,grades), override=d.discountOverrides?.[rule.code]||{}, isVariable=rule.mode==="VARIABLE";
    return <div style={{display:"flex",alignItems:"center",gap:4}}>{isVariable&&<input aria-label={`Apply ${rule.name}`} type="checkbox" disabled={!admin} checked={override.enabled!==false} onChange={e=>setRule(r._id,rule.code,{enabled:e.target.checked})}/>}
      <input aria-label={`${rule.name} percent`} type="number" min="0" max="99.99" step="0.01" style={{width:67,padding:5}} disabled={!admin||!isVariable} value={isVariable?(override.percent??rule.defaultPct):rule.defaultPct} onChange={e=>setRule(r._id,rule.code,{percent:e.target.value})}/><span>%</span></div>;
  }})),
  ...grades.map(g=>({key:`grade_${g.code}`,label:`${g.code} Basic (${g.discountPct}%)`,render:r=>{
    const d=drafts[r._id]||draftFrom(r,grades),p=preview(d);if(p.error)return "—";
    try{return money(calculateDynamicPrice({mode:"MRP_TO_SALE",mrp:p.mrp,gstRate:d.gstRate,gradePct:g.discountPct,rules,overrides:d.discountOverrides}).salePrice);}catch{return "—";}
  }})),
  {key:"actions",label:"Save",render:r=><button className="btn primary" disabled={!admin||!dirty[r._id]||saving[r._id]} onClick={async()=>{try{await saveOne(r);setMessage(`${r.name} saved`)}catch(e){setError(e.message)}}}>{saving[r._id]?"Saving...":"Save"}</button>},
 ],[admin,grades,rules,drafts,dirty,saving]);
 return <>
  {error&&<div className="resultBanner bad">{error}</div>}{message&&<div className="resultBanner good">{message}</div>}
  <section className="panel"><div className="toolbar"><div className="searchBox"><Search size={16}/><input placeholder="Search product / SKU" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load(1)}/></div>
   <label>FY <input style={{width:100}} value={fy} onChange={e=>setFy(e.target.value)} /></label>
   <button className="btn ghost" onClick={()=>load(1)} disabled={busy}><RefreshCw size={15}/>Refresh</button>
   <button className="btn ghost" disabled={!admin||busy||!rows.length} onClick={()=>setDirty(Object.fromEntries(rows.map(r=>[r._id,true])))}>Apply Rules to Current Page</button>
   <button className="btn primary" onClick={saveAll} disabled={!admin||busy||!Object.keys(dirty).length}>Save All ({Object.keys(dirty).length})</button>
   <span className="recordCount">{meta.total||0} products</span></div>
   <small>Editable: product details, landed cost, sale price, GST, MRP, discounts. Sale ↔ MRP is reversible. Fixed discounts are always applied; variable discounts are applied lowest first. Historical invoice averages remain factual and read-only.</small>
   <DataTable rows={rows} columns={columns}/>
   <div className="paginationBar"><span>Page {page} / {Math.max(meta.pages||1,1)}</span><div><button className="btn ghost" disabled={page<=1} onClick={()=>load(page-1)}>Previous</button><button className="btn ghost" disabled={page>=meta.pages} onClick={()=>load(page+1)}>Next</button></div></div>
  </section>
  {admin&&<PriceDiscountManager onChanged={()=>load(page)}/>}
  <section className="panel compactActionPanel"><small>Grade discounts are managed in Customer Grades and applied on the ex-GST basic price. Additional fixed/variable discount columns are configured here. Pricing previews do not rewrite historical invoices. Discount rule changes show in previews immediately; click Apply Rules and Save All to persist product prices. Review invoice-specific extra discount settings before billing.</small></section>
 </>;
}
