import React,{Suspense,lazy,useEffect,useMemo,useState} from "react";
import {UserRound,Users} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import UsersAccessPage from "./UsersAccessPage.jsx";
import {getUser} from "../lib/api.js";
import {accessForPath} from "../lib/permissionAccess.js";

const CustomerPage = lazy(() => import("./CustomerPage.jsx"));

class CustomerPageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Customer page render error", error, info);
  }
  render() {
    if (this.state.error) {
      const message = String(this.state.error?.message || this.state.error || "Unknown customer page error");
      return (
        <div className="resultBanner bad" style={{ marginTop: 12 }}>
          <div>
            <strong>Customer page could not render one record.</strong>
            <div style={{ marginTop: 4 }}>{message}</div>
          </div>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Reload Customer Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    {mode==="customer"&&access.customer&&<CustomerPageErrorBoundary><Suspense fallback={<div className="muted" style={{padding:12}}>Loading customer list...</div>}><CustomerPage embedded/></Suspense></CustomerPageErrorBoundary>}
  </>;
}
