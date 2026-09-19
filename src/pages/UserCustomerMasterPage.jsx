import React,{useEffect,useMemo,useState} from "react";
import {UserRound,Users} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import UsersAccessPage from "./UsersAccessPage.jsx";
import CustomerPage from "./CustomerPage.jsx";
import {getUser} from "../lib/api.js";
import {accessForPath} from "../lib/permissionAccess.js";

export default function UserCustomerMasterPage({initialMode="user"}){
  const current=getUser();
  const access=useMemo(()=>{
    const privileged=["MASTER","SUPERADMIN"].includes(String(current?.role||"").toUpperCase());
    return {
      user:privileged||Boolean(accessForPath("/dms/users")?.view),
      customer:privileged||Boolean(accessForPath("/dms/customers")?.view)
    };
  },[current?.role]);
  const firstAllowed=access[initialMode]?initialMode:(access.user?"user":"customer");
  const[mode,setMode]=useState(firstAllowed);
  useEffect(()=>{if(!access[mode])setMode(access.user?"user":"customer")},[access.user,access.customer,mode]);

  return <>
    <PageHeader title="User & Customer Master" description="One page for person/account creation and the complete previous-DMS customer master."/>
    <section className="panel">
      <div className="toolbar" style={{gap:12,justifyContent:"flex-start",flexWrap:"wrap"}}>
        {access.user&&<button className={`btn ${mode==="user"?"primary":"ghost"}`} onClick={()=>setMode("user")}><UserRound size={17}/>USER</button>}
        {access.customer&&<button className={`btn ${mode==="customer"?"primary":"ghost"}`} onClick={()=>setMode("customer")}><Users size={17}/>CUSTOMER</button>}
      </div>
    </section>
    {!access.user&&!access.customer&&<div className="resultBanner bad">You do not have permission to view User or Customer master.</div>}
    {mode==="user"&&access.user&&<UsersAccessPage embedded/>}
    {mode==="customer"&&access.customer&&<CustomerPage embedded autoOpenCreate/>}
  </>;
}
