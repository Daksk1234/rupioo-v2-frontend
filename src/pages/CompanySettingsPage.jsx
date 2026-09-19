import React,{useEffect,useState} from "react";
import { Building2, Landmark, Plus, Power, RefreshCw, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import { api } from "../lib/api.js";
import { isAdminUser } from "../lib/adminVisibility.js";

const COMPANY_TYPES=[
  ["PROPRIETORSHIP","Proprietorship"],["PARTNERSHIP","Partnership Firm"],["LLP","LLP"],["PRIVATE_LIMITED","Private Limited Company"],
  ["PUBLIC_LIMITED","Public Limited Company"],["OPC","One Person Company (OPC)"],["TRUST","Trust"],["SOCIETY","Society / Association"],["OTHER","Other"]
];
const blankStakeholder={name:"",roleType:"",pan:"",dinDpin:"",mobile:"",email:"",designation:"",ownershipPct:0,profitSharePct:0,contribution:0,openingCapital:0,shareholder:false,systemLoginRequired:false,accountingRelationships:[]};
const roleOptions=type=>({PROPRIETORSHIP:["PROPRIETOR"],PARTNERSHIP:["PARTNER"],LLP:["DESIGNATED_PARTNER","PARTNER"],PRIVATE_LIMITED:["DIRECTOR","SHAREHOLDER","PROMOTER","AUTHORISED_SIGNATORY"],PUBLIC_LIMITED:["DIRECTOR","SHAREHOLDER","PROMOTER","AUTHORISED_SIGNATORY"],OPC:["DIRECTOR","SHAREHOLDER","PROMOTER","AUTHORISED_SIGNATORY"],TRUST:["TRUSTEE","AUTHORISED_SIGNATORY"],SOCIETY:["MEMBER","AUTHORISED_SIGNATORY"],OTHER:["OWNER","MEMBER","AUTHORISED_SIGNATORY"]}[type]||["OWNER"]);

export default function CompanySettingsPage(){
  const admin=isAdminUser();
  const[profile,setProfile]=useState(null),[ledgers,setLedgers]=useState([]),[showStakeholder,setShowStakeholder]=useState(false),[stakeholder,setStakeholder]=useState(blankStakeholder),[editing,setEditing]=useState(null),[message,setMessage]=useState("");
  const[init,setInit]=useState({companyName:"",tradeName:"",companyType:"PROPRIETORSHIP",gstin:"",pan:"",registeredAddress:"",financialYear:"2026-27",stakeholders:[{...blankStakeholder,roleType:"PROPRIETOR"}]});
  const load=async()=>{try{const[p,l]=await Promise.all([api("/company/profile"),api("/company/ledgers")]);setProfile(p);setLedgers(l||[])}catch(e){setMessage(e.message)}};
  useEffect(()=>{load()},[]);
  const saveProfile=async()=>{try{const p=await api("/company/profile",{method:"PUT",body:JSON.stringify(profile)});setProfile(p);setMessage("Company profile updated") }catch(e){setMessage(e.message)}};
  const openStakeholder=row=>{setEditing(row||null);setStakeholder(row?{...blankStakeholder,...row,accountingRelationships:row.accountingRelationships||[]}:({...blankStakeholder,roleType:roleOptions(profile?.companyType)[0]}));setShowStakeholder(true)};
  const relationChoices=(["PRIVATE_LIMITED","PUBLIC_LIMITED","OPC"].includes(profile?.companyType)?[
    {relationshipType:"DIRECTOR_LOAN",systemAccountCode:"SYS_DIRECTOR_LOAN",label:"Director Loan",openingBalanceType:"CR"},
    {relationshipType:"DIRECTOR_ADVANCE",systemAccountCode:"SYS_DIRECTOR_ADVANCE",label:"Director Advance",openingBalanceType:"DR"},
    {relationshipType:"DIRECTOR_REMUNERATION",systemAccountCode:"SYS_DIRECTOR_REMUNERATION",label:"Director Remuneration",openingBalanceType:"CR"}
  ]:[
    {relationshipType:"CAPITAL",systemAccountCode:"SYS_CAPITAL",label:"Capital",openingBalanceType:"CR"},
    {relationshipType:"PARTNER_LOAN",systemAccountCode:"SYS_PARTNER_LOAN",label:"Partner Loan",openingBalanceType:"CR"},
    {relationshipType:"DRAWINGS",systemAccountCode:"SYS_DRAWINGS",label:"Drawings",openingBalanceType:"DR"}
  ]);
  const toggleRelation=choice=>setStakeholder(s=>{const exists=(s.accountingRelationships||[]).some(r=>r.relationshipType===choice.relationshipType);return {...s,accountingRelationships:exists?(s.accountingRelationships||[]).filter(r=>r.relationshipType!==choice.relationshipType):[...(s.accountingRelationships||[]),{relationshipType:choice.relationshipType,systemAccountCode:choice.systemAccountCode,ledgerName:`${s.name||"Stakeholder"} - ${choice.label} A/c`,openingBalance:0,openingBalanceType:choice.openingBalanceType,financialYear:profile?.financialYear||"",status:"ACTIVE"}]}});
  const saveStakeholder=async()=>{try{const url=editing?`/company/stakeholders/${editing.stakeholderId}`:"/company/stakeholders";await api(url,{method:editing?"PUT":"POST",body:JSON.stringify(stakeholder)});setShowStakeholder(false);setMessage(editing?"Stakeholder updated":"Stakeholder created and accounting ledgers generated");load()}catch(e){setMessage(e.message)}};
  const toggle=async row=>{try{await api(`/company/stakeholders/${row.stakeholderId}/status`,{method:"POST",body:JSON.stringify({active:!row.active})});load()}catch(e){setMessage(e.message)}};
  const changeConstitution=async()=>{const next=prompt("New company type code (for example LLP or PRIVATE_LIMITED)",profile?.companyType||"");if(!next||next===profile?.companyType)return;const effectiveDate=prompt("Effective date (YYYY-MM-DD)");if(!effectiveDate)return;const reason=prompt("Reason for legal constitution change");if(!reason)return;try{await api("/company/change-constitution",{method:"POST",body:JSON.stringify({companyType:next,effectiveDate,reason,stakeholders:profile.stakeholders})});setMessage("Legal constitution changed with history preserved");load()}catch(e){setMessage(e.message)}};
  const initialize=async()=>{try{const p=await api("/company/profile",{method:"POST",body:JSON.stringify(init)});setProfile(p);setMessage("Existing company upgraded with legal structure and accounting mappings");load()}catch(e){setMessage(e.message)}};
  const initType=type=>setInit(i=>({...i,companyType:type,stakeholders:[{...blankStakeholder,roleType:roleOptions(type)[0]}]}));
  const initStake=(k,v)=>setInit(i=>({...i,stakeholders:[{...i.stakeholders[0],[k]:v}]}));
  if(!profile)return <><PageHeader title="Initialize Company Setup" description="This tenant was created by an older V2 build. Add its legal constitution once; accounting ledgers will be generated without recreating the Superadmin."/>{message&&<div className="resultBanner bad">{message}</div>}<section className="panel editorPanel"><div className="formGrid"><label>Company Name<input value={init.companyName} onChange={e=>setInit({...init,companyName:e.target.value})}/></label><label>Trade Name<input value={init.tradeName} onChange={e=>setInit({...init,tradeName:e.target.value})}/></label><label>Company Type<select value={init.companyType} onChange={e=>initType(e.target.value)}>{COMPANY_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>GSTIN<input value={init.gstin} onChange={e=>setInit({...init,gstin:e.target.value.toUpperCase()})}/></label><label>PAN<input value={init.pan} onChange={e=>setInit({...init,pan:e.target.value.toUpperCase()})}/></label><label>Financial Year<input value={init.financialYear} onChange={e=>setInit({...init,financialYear:e.target.value})}/></label><label className="wideField">Registered Address<textarea value={init.registeredAddress} onChange={e=>setInit({...init,registeredAddress:e.target.value})}/></label></div><div className="sectionLabel"><UserRound size={16}/>Primary Proprietor / Partner / Director</div><div className="formGrid"><label>Name<input value={init.stakeholders[0].name} onChange={e=>initStake("name",e.target.value)}/></label><label>Role<select value={init.stakeholders[0].roleType} onChange={e=>initStake("roleType",e.target.value)}>{roleOptions(init.companyType).map(x=><option key={x}>{x}</option>)}</select></label><label>PAN<input value={init.stakeholders[0].pan||""} onChange={e=>initStake("pan",e.target.value.toUpperCase())}/></label><label>Opening Capital<input type="number" value={init.stakeholders[0].openingCapital||0} onChange={e=>initStake("openingCapital",Number(e.target.value))}/></label></div><div className="formActions"><button className="btn primary" disabled={!init.companyName||(["PROPRIETORSHIP","PARTNERSHIP","LLP","PRIVATE_LIMITED","PUBLIC_LIMITED","OPC"].includes(init.companyType)&&!init.stakeholders[0].name)} onClick={initialize}>Initialize Legal & Accounting Structure</button></div></section></>;
  return <>
    <PageHeader title="Company & Stakeholders" description="Legal constitution drives proprietor/partner/director accounting relationships. Legal type changes use a protected workflow."/>
    {message&&<div className="resultBanner good">{message}</div>}
    <section className="panel editorPanel">
      <div className="formTitle"><div><h3>{profile.companyName}</h3><span>{COMPANY_TYPES.find(x=>x[0]===profile.companyType)?.[1]||profile.companyType} • Tenant {profile.tenantKey}</span></div><div className="rowActions"><button className="btn ghost" onClick={load}><RefreshCw size={15}/>Refresh</button><button className="btn ghost" onClick={changeConstitution}><ShieldCheck size={15}/>Change Legal Constitution</button><button className="btn primary" onClick={saveProfile}>Save Company</button></div></div>
      <div className="formGrid">
        <label>Company Name<input value={profile.companyName||""} onChange={e=>setProfile({...profile,companyName:e.target.value})}/></label>
        <label>Trade Name<input value={profile.tradeName||""} onChange={e=>setProfile({...profile,tradeName:e.target.value})}/></label>
        <label>Company Type<input value={COMPANY_TYPES.find(x=>x[0]===profile.companyType)?.[1]||profile.companyType} disabled/><small>Use Change Legal Constitution to change this safely.</small></label>
        <label>GSTIN<input value={profile.gstin||""} onChange={e=>setProfile({...profile,gstin:e.target.value.toUpperCase()})}/></label>
        <label>PAN<input value={profile.pan||""} onChange={e=>setProfile({...profile,pan:e.target.value.toUpperCase()})}/></label>
        <label>Financial Year<input value={profile.financialYear||""} onChange={e=>setProfile({...profile,financialYear:e.target.value})} placeholder="2026-27"/></label>
        <label className="wideField">Registered Address<textarea value={profile.registeredAddress||""} onChange={e=>setProfile({...profile,registeredAddress:e.target.value})}/></label>
      </div>
    </section>
    <section className="panel">
      <div className="formTitle"><div><h3>Owners / Partners / Directors</h3><span>One person can have multiple accounting relationships without creating duplicate system identities.</span></div><button className="btn primary" onClick={()=>openStakeholder(null)}><Plus size={15}/>Add Stakeholder</button></div>
      <DataTable rows={profile.stakeholders||[]} columns={[
        {key:"name",label:"Name"},{key:"roleType",label:"Legal Role"},{key:"pan",label:"PAN"},{key:"dinDpin",label:"DIN / DPIN"},...(admin?[{key:"profitSharePct",label:"Profit %",render:r=>r.profitSharePct?`${r.profitSharePct}%`:"—"}]:[]),{key:"openingCapital",label:"Opening Capital",render:r=>Number(r.openingCapital||0).toLocaleString("en-IN")},{key:"active",label:"Status",render:r=>r.active?"ACTIVE":"INACTIVE"},{key:"actions",label:"Actions",render:r=><div className="rowActions"><button onClick={()=>openStakeholder(r)}><UserRound/></button><button onClick={()=>toggle(r)}><Power/></button></div>}
      ]}/>
    </section>
    <section className="panel">
      <div className="formTitle"><div><h3>Generated / Linked Accounting Ledgers</h3><span>MASTER system account code remains fixed; ledger display name remains company-specific.</span></div></div>
      <DataTable rows={ledgers} columns={[{key:"name",label:"Ledger"},{key:"ownerType",label:"Owner Type"},{key:"relationshipType",label:"Relationship"},{key:"systemAccountCode",label:"MASTER Account Head"},{key:"status",label:"Status",status:true}]}/>
    </section>
    <section className="panel">
      <div className="formTitle"><div><h3>Legal Constitution History</h3><span>Company-type changes are never silently overwritten.</span></div></div>
      <DataTable rows={profile.constitutionHistory||[]} columns={[{key:"from",label:"From"},{key:"to",label:"To"},{key:"effectiveDate",label:"Effective Date",render:r=>r.effectiveDate?new Date(r.effectiveDate).toLocaleDateString():"—"},{key:"reason",label:"Reason"},{key:"at",label:"Recorded",render:r=>r.at?new Date(r.at).toLocaleString():"—"}]}/>
    </section>
    {showStakeholder&&<div className="modalOverlay"><section className="panel modalPanel wideModal">
      <div className="formTitle"><div><h3>{editing?"Edit Stakeholder":"Add Stakeholder"}</h3><span>Capital/current accounts are generated automatically for proprietor/partner structures. Director relationships can be selected separately.</span></div></div>
      <div className="formGrid">
        <label>Name<input value={stakeholder.name} onChange={e=>setStakeholder({...stakeholder,name:e.target.value})}/></label>
        <label>Role<select value={stakeholder.roleType} onChange={e=>setStakeholder({...stakeholder,roleType:e.target.value})}>{roleOptions(profile.companyType).map(x=><option key={x}>{x}</option>)}</select></label>
        <label>PAN<input value={stakeholder.pan||""} onChange={e=>setStakeholder({...stakeholder,pan:e.target.value.toUpperCase()})}/></label>
        <label>DIN / DPIN<input value={stakeholder.dinDpin||""} onChange={e=>setStakeholder({...stakeholder,dinDpin:e.target.value.toUpperCase()})}/></label>
        <label>Mobile<input value={stakeholder.mobile||""} onChange={e=>setStakeholder({...stakeholder,mobile:e.target.value})}/></label>
        <label>Email<input value={stakeholder.email||""} onChange={e=>setStakeholder({...stakeholder,email:e.target.value})}/></label>
        <label>Designation<input value={stakeholder.designation||""} onChange={e=>setStakeholder({...stakeholder,designation:e.target.value})}/></label>
        <label>Ownership %<input type="number" value={stakeholder.ownershipPct||0} onChange={e=>setStakeholder({...stakeholder,ownershipPct:Number(e.target.value)})}/></label>
        {admin&&<label>Profit Share %<input type="number" value={stakeholder.profitSharePct||0} onChange={e=>setStakeholder({...stakeholder,profitSharePct:Number(e.target.value)})}/></label>}
        <label>Contribution<input type="number" value={stakeholder.contribution||0} onChange={e=>setStakeholder({...stakeholder,contribution:Number(e.target.value)})}/></label>
        <label>Opening Capital<input type="number" value={stakeholder.openingCapital||0} onChange={e=>setStakeholder({...stakeholder,openingCapital:Number(e.target.value)})}/></label>
      </div>
      <div className="checkGrid"><button type="button" className={stakeholder.shareholder?"checked":""} onClick={()=>setStakeholder({...stakeholder,shareholder:!stakeholder.shareholder})}>Shareholder</button><button type="button" className={stakeholder.systemLoginRequired?"checked":""} onClick={()=>setStakeholder({...stakeholder,systemLoginRequired:!stakeholder.systemLoginRequired})}>System Login Required</button></div>
      <div className="miniLabel">Accounting relationships</div>
      <div className="checkGrid">{relationChoices.map(choice=><button key={choice.relationshipType} type="button" className={(stakeholder.accountingRelationships||[]).some(r=>r.relationshipType===choice.relationshipType)?"checked":""} onClick={()=>toggleRelation(choice)}>{choice.label}</button>)}</div>
      <div className="formActions"><button className="btn ghost" onClick={()=>setShowStakeholder(false)}>Cancel</button><button className="btn primary" disabled={!stakeholder.name||!stakeholder.roleType} onClick={saveStakeholder}>Save Stakeholder</button></div>
    </section></div>}
  </>;
}
