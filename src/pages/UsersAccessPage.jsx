import React,{useEffect,useMemo,useState} from "react";
import {BookOpen,Download,KeyRound,MapPin,Pencil,Plus,Power,RefreshCw,Search,UserRound,X} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EditMasterLink from "../components/EditMasterLink.jsx";
import {api,apiBlob,getUser} from "../lib/api.js";
import {bankFieldsFromIfsc,lookupIfscMaster,normalizeIfsc} from "../lib/ifscLookup.js";
import PincodeHierarchySelector from "../components/PincodeHierarchySelector.jsx";
import CreateLookupButton,{getLookupEditId,isLookupCreate,notifyLookupCreated} from "../components/CreateLookupButton.jsx";
import ScanAndFill from "../components/ScanAndFill.jsx";

const digits=v=>String(v||"").replace(/\D/g,"");
const idOf=v=>String(v?._id||v||"");
const currentFY=()=>{try{return localStorage.getItem("financialYearSelected")||"2026-27"}catch{return "2026-27"}};
const fyOptions=()=>{const y=new Date().getFullYear();return Array.from({length:8},(_,i)=>{const a=y-3+i;return `${a}-${String(a+1).slice(-2)}`})};
const FALLBACK_TALLY_ACCOUNT_TYPES=[
  ["SYS_BRANCH_DIVISION","Branch/Divisions"],["SYS_CAPITAL","Capital Account"],["SYS_RESERVES_SURPLUS","Reserves & Surplus"],["SYS_SUSPENSE","Suspense A/c"],["SYS_DEPOSIT_ASSET","Deposits (Asset)"],["SYS_PROVISIONS","Provisions"],["SYS_PROPRIETOR_CAPITAL","Proprietor Capital"],["SYS_PARTNER_CAPITAL","Partners Capital"],["SYS_PARTNER_CURRENT","Partners Current Accounts"],["SYS_PARTNER_LOAN","Partner Loans"],["SYS_DRAWINGS","Drawings"],["SYS_SHARE_CAPITAL","Share Capital"],["SYS_DIRECTOR_LOAN","Director Loans"],["SYS_DIRECTOR_ADVANCE","Director Advances"],["SYS_STAFF_ADVANCE","Staff Advances"],["SYS_SALARY_PAYABLE","Salary Payable"],["SYS_CURRENT_ASSETS","Current Assets"],["SYS_CURRENT_LIABILITIES","Current Liabilities"],["SYS_DIRECT_EXPENSE","Direct Expenses"],["SYS_DIRECT_INCOME","Direct Incomes"],["SYS_FIXED_ASSETS","Fixed Assets"],["SYS_INDIRECT_EXPENSE","Indirect Expenses"],["SYS_INDIRECT_INCOME","Indirect Incomes"],["SYS_INVESTMENT","Investments"],["SYS_LOAN_LIABILITY","Loans (Liability)"],["SYS_PURCHASE","Purchase Accounts"],["SYS_SALES","Sales Accounts"],["SYS_BANK_ACCOUNT","Bank Accounts"],["SYS_BANK_OD","Bank OD A/c"],["SYS_CASH","Cash-in-hand"],["SYS_DUTIES_TAXES","Duties & Taxes"],["SYS_LOANS_ADVANCES","Loans & Advances (Asset)"],["SYS_SECURED_LOAN","Secured Loans"],["SYS_STOCK","Stock-in-hand"],["SYS_SUNDRY_CREDITORS","Sundry Creditors"],["SYS_SUNDRY_DEBTORS","Sundry Debtors"],["SYS_UNSECURED_LOAN","Unsecured Loans"]
].map(([systemCode,name])=>({systemCode,name}));

const ROLE_DRIVEN_ACCOUNT_CODES=new Set(["SYS_STAFF_ADVANCE","SYS_SALARY_PAYABLE","SYS_REIMBURSEMENT_PAYABLE"]);
const isStandaloneLedgerAccount=account=>{
 const code=String(account?.systemCode||"").toUpperCase();
 if(!code||ROLE_DRIVEN_ACCOUNT_CODES.has(code))return false;
 const nature=String(account?.nature||"").toUpperCase();
 return account?.allowCompanyLedger===true||["EXPENSE","INCOME","EQUITY"].includes(nature)||code.startsWith("SYS_");
};

const blankUser=()=>({
 name:"",tallyAccountTypeCode:"",dateOfBirth:"",mobile:"",email:"",password:"",loginEnabled:true,
 fatherName:"",fatherMobile:"",motherMobile:"",drivingLicenseNumber:"",aadhaar:"",pan:"",
 bankName:"",bankBranchName:"",bankAddress:"",bankCity:"",bankState:"",bankStdCode:"",bankPhone:"",bankContactNo:"",bankAccountNumber:"",bankAccountName:"",ifsc:"",pincode:"",area:"",city:"",district:"",state:"",country:"India",address:"",
 roleId:"",departmentId:"",assignedToUserId:"",branchId:"",designation:"",appointmentDate:"",salary:0,pfPercentage:0,
 openingFinancialYear:currentFY(),openingBalance:0,openingBalanceType:"DR",ledgerName:"",ledgerLibraryMainHead:"",
 lastWorkingFirmName:"",lastWorkingProfileName:"",lastWorkingAddress:"",lastWorkingContactNumber:"",
 references:[{name:"",relation:"",mobile:""}],pincodes:[],status:"ACTIVE"
});

const userDownloadFields=[
 {key:"name",label:"Name"},{key:"tallyAccountTypeCode",label:"Account Type"},{key:"dateOfBirth",label:"DOB"},{key:"mobile",label:"Mobile Number"},{key:"email",label:"Email"},{key:"password",label:"Password"},
 {key:"fatherName",label:"Father Name"},{key:"fatherMobile",label:"Father Mobile Number"},{key:"motherMobile",label:"Mother Mobile Number"},{key:"drivingLicenseNumber",label:"Driving License Number"},{key:"aadhaar",label:"Aadhaar Number"},{key:"pan",label:"PAN Number"},
 {key:"ifsc",label:"IFSC Code"},{key:"bankName",label:"Bank Name"},{key:"bankBranchName",label:"Branch / Area"},{key:"bankAddress",label:"Bank Address"},{key:"bankCity",label:"Bank City"},{key:"bankState",label:"Bank State"},{key:"bankContactNo",label:"Bank Contact"},{key:"bankAccountNumber",label:"Account Number"},{key:"bankAccountName",label:"Account Name"},
 {key:"pincode",label:"Pin Code"},{key:"area",label:"Area / Post Office"},{key:"city",label:"City"},{key:"district",label:"District"},{key:"state",label:"State"},{key:"country",label:"Country"},{key:"address",label:"Address"},
 {key:"roleId",label:"Role ID"},{key:"departmentId",label:"Department ID"},{key:"assignedToUserId",label:"Assigned To User ID"},{key:"branchId",label:"Branch ID"},{key:"designation",label:"Designation"},{key:"appointmentDate",label:"Appointment Date"},{key:"salary",label:"Base Salary / Month"},{key:"pfPercentage",label:"PF Percentage"},
 {key:"openingFinancialYear",label:"Opening Financial Year"},{key:"openingBalance",label:"Opening Balance"},{key:"openingBalanceType",label:"O/P Balance Type"},{key:"ledgerName",label:"Ledger Name"},{key:"status",label:"Status"},{key:"loginEnabled",label:"System Login"},
 {key:"lastWorkingFirmName",label:"Last Working Firm Name"},{key:"lastWorkingProfileName",label:"Last Working Profile Name"},{key:"lastWorkingAddress",label:"Last Working Address"},{key:"lastWorkingContactNumber",label:"Last Working Contact Number"},{key:"references",label:"References JSON"}
];
const csvCell=v=>`"${String(v??"").replaceAll('"','""')}"`;
const saveCsv=(fields,rows,fileName)=>{const header=fields.map(f=>csvCell(f.label||f.key)).join(",");const lines=rows.map(row=>fields.map(f=>csvCell(row?.[f.key]??"")).join(","));const blob=new Blob([`\uFEFF${[header,...lines].join("\n")}`],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fileName;a.click();URL.revokeObjectURL(a.href);};
const dateText=v=>v?String(v).slice(0,10):"";

export default function UsersAccessPage({embedded=false}){
 const currentUser=getUser();
 const isSuperAdmin=String(currentUser?.role||"").toUpperCase()==="SUPERADMIN";
 const[users,setUsers]=useState([]),[roles,setRoles]=useState([]),[departments,setDepartments]=useState([]),[branches,setBranches]=useState([]),[branchInfo,setBranchInfo]=useState({limit:0,used:0}),[accountHeads,setAccountHeads]=useState(FALLBACK_TALLY_ACCOUNT_TYPES),[q,setQ]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[downloadingData,setDownloadingData]=useState(false);
 const[ledgerLibrary,setLedgerLibrary]=useState({groups:[],totals:{mainAccountHeads:0,templates:0,created:0,available:0}}),[ledgerLibraryOpen,setLedgerLibraryOpen]=useState(false),[ledgerLibraryBusy,setLedgerLibraryBusy]=useState(false),[ledgerLibraryImporting,setLedgerLibraryImporting]=useState(false),[ledgerLibrarySearch,setLedgerLibrarySearch]=useState(""),[ledgerLibrarySelected,setLedgerLibrarySelected]=useState([]);
 const[form,setForm]=useState(blankUser()),[editing,setEditing]=useState(null),[creating,setCreating]=useState(false),[hierarchy,setHierarchy]=useState({department:null,parentRole:null,users:[],requiresParent:false});
 const[pinAreas,setPinAreas]=useState([]),[pinModal,setPinModal]=useState(false);

 const load=async()=>{setBusy(true);try{const[u,r,d,b,a]=await Promise.all([api(`/access/users?q=${encodeURIComponent(q)}&limit=200`),api("/access/roles"),api("/access/departments"),api("/access/branches").catch(()=>({items:[]})),api("/reference/accounts").catch(()=>[])]);setUsers(u?.items||[]);setRoles(Array.isArray(r)?r:[]);setDepartments(Array.isArray(d)?d:[]);setBranches(Array.isArray(b)?b:(b?.items||[]));setBranchInfo(Array.isArray(b)?{limit:b.length,used:b.length}:{limit:b?.limit||0,used:b?.used||0});const m=new Map(FALLBACK_TALLY_ACCOUNT_TYPES.map(x=>[x.systemCode,x]));(Array.isArray(a)?a:[]).forEach(x=>x?.systemCode&&m.set(x.systemCode,{...m.get(x.systemCode),...x}));setAccountHeads([...m.values()].sort((x,y)=>String(x.name).localeCompare(String(y.name))));return u?.items||[];}catch(e){setMsg(e.message);return []}finally{setBusy(false)}};
 const loadLedgerLibrary=async()=>{
  if(!isSuperAdmin)return null;
  setLedgerLibraryBusy(true);
  try{
   const data=await api("/access/ledger-library");
   const next={groups:Array.isArray(data?.groups)?data.groups:[],totals:data?.totals||{mainAccountHeads:0,templates:0,created:0,available:0}};
   setLedgerLibrary(next);return next;
  }catch(e){setMsg(e.message);return null}finally{setLedgerLibraryBusy(false)}
 };
 const openLedgerLibrary=async()=>{if(!isSuperAdmin)return;setLedgerLibraryOpen(true);setLedgerLibrarySearch("");setLedgerLibrarySelected([]);await loadLedgerLibrary()};
 const useLedgerTemplate=item=>{setLedgerLibraryOpen(false);setLedgerLibrarySelected([]);openCreate({name:item.name,ledgerName:item.name,tallyAccountTypeCode:item.systemAccountCode,ledgerLibraryMainHead:item.mainAccountHead,openingFinancialYear:currentFY(),openingBalance:0,openingBalanceType:"DR",status:"ACTIVE",loginEnabled:false})};
 const toggleLedgerTemplate=(key,checked)=>setLedgerLibrarySelected(prev=>checked?[...new Set([...prev,key])]:prev.filter(x=>x!==key));
 const selectLedgerGroup=(group,checked)=>{const keys=(group?.ledgers||[]).filter(x=>!x.created).map(x=>x.templateKey);setLedgerLibrarySelected(prev=>checked?[...new Set([...prev,...keys])]:prev.filter(x=>!keys.includes(x)))};
 const importLedgerTemplates=async(importAll=false)=>{
  if(!isSuperAdmin||ledgerLibraryImporting)return;
  const available=Number(ledgerLibrary?.totals?.available||0);
  if(importAll&&available>0&&!window.confirm(`Import all ${available} available ledgers? Existing ledgers will be skipped.`))return;
  if(!importAll&&!ledgerLibrarySelected.length){setMsg("Select at least one ledger from the library");return}
  setLedgerLibraryImporting(true);setMsg("");
  try{
   const result=await api("/access/ledger-library/import",{method:"POST",body:JSON.stringify({importAll,templateKeys:ledgerLibrarySelected,financialYear:currentFY()})});
   const c=result?.counts||{};
   setMsg(`Ledger import completed: ${c.created||0} created, ${c.skipped||0} already existed${c.errors?`, ${c.errors} failed`:""}.`);
   setLedgerLibrarySelected([]);await Promise.all([load(),loadLedgerLibrary()]);
  }catch(e){setMsg(e.message)}finally{setLedgerLibraryImporting(false)}
 };
 const downloadUserData=async()=>{
  if(!isSuperAdmin)return;setDownloadingData(true);setMsg("");
  try{
   const file=await apiBlob("/access/users/export-data.xlsx");
   const blob=file?.blob instanceof Blob?file.blob:file;
   if(!(blob instanceof Blob))throw new Error("Invalid user export response");
   const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`users-data-${new Date().toISOString().slice(0,10)}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
   setMsg("User data downloaded in Excel template format. Mobile/contact columns are stored as Text. Password and full Aadhaar remain blank for security.");
  }catch(e){setMsg(e.message)}finally{setDownloadingData(false)}
 };
 useEffect(()=>{(async()=>{const loaded=await load();const lookupEditId=getLookupEditId();if(lookupEditId){const user=(loaded||[]).find(u=>idOf(u)===idOf(lookupEditId));if(user)await openEdit(user);else setMsg("Selected user could not be loaded for editing")}else if(isLookupCreate())openCreate()})()},[]);
 const roleMap=useMemo(()=>new Map(roles.map(r=>[idOf(r),r])),[roles]);
 const selectedAccountHead=useMemo(()=>accountHeads.find(a=>String(a.systemCode)===String(form.tallyAccountTypeCode))||null,[accountHeads,form.tallyAccountTypeCode]);
 const ledgerOnlyMode=Boolean(form.ledgerLibraryMainHead)||isStandaloneLedgerAccount(selectedAccountHead);
 const deptName=id=>departments.find(d=>idOf(d)===idOf(id))?.name||"";
 const filteredLedgerGroups=useMemo(()=>{const term=ledgerLibrarySearch.trim().toLowerCase();if(!term)return ledgerLibrary.groups||[];return (ledgerLibrary.groups||[]).map(group=>({...group,ledgers:(group.ledgers||[]).filter(item=>String(item.name||"").toLowerCase().includes(term)||String(group.mainAccountHead||"").toLowerCase().includes(term))})).filter(group=>group.ledgers.length)},[ledgerLibrary,ledgerLibrarySearch]);

 const loadHierarchy=async(roleId,currentParent="",showPincodePicker=false)=>{if(!roleId){setHierarchy({department:null,parentRole:null,users:[],requiresParent:false});return;}try{const h=await api(`/access/user-assignment-options?roleId=${encodeURIComponent(roleId)}`);setHierarchy(h);const validParent=(h.users||[]).some(u=>idOf(u)===idOf(currentParent))?idOf(currentParent):"";setForm(f=>({...f,departmentId:idOf(h.department),assignedToUserId:validParent||((h.users||[]).some(u=>idOf(u)===idOf(f.assignedToUserId))?idOf(f.assignedToUserId):"")}));const code=String(roleMap.get(String(roleId))?.code||"").toUpperCase();if(showPincodePicker&&code==="SALES_HEAD")setPinModal(true);else if(showPincodePicker&&code==="SALES_PERSON"&&!h.requiresParent)setPinModal(true);}catch(e){setMsg(e.message);setHierarchy({department:null,parentRole:null,users:[],requiresParent:false})}};
 const lookupPin=async raw=>{const pin=digits(raw).slice(0,6);setForm(f=>({...f,pincode:pin}));if(pin.length!==6){setPinAreas([]);return;}try{const r=await api(`/access/pincode-lookup/${pin}`);const alternatives=r.alternatives||[];setPinAreas(alternatives);const chosen=alternatives[0]||r;setForm(f=>({...f,pincode:pin,area:chosen.area||r.area||"",city:chosen.city||r.city||chosen.area||"",district:chosen.district||r.district||"",state:chosen.state||r.state||"",country:r.country||"India"}));}catch(e){setMsg(e.message)}};
 const chooseArea=area=>{const x=pinAreas.find(a=>a.area===area);setForm(f=>({...f,area,city:x?.city||area,district:x?.district||f.district,state:x?.state||f.state}))};

 const openCreate=(prefill={})=>{setEditing(null);setForm({...blankUser(),...(prefill||{})});setHierarchy({department:null,parentRole:null,users:[],requiresParent:false});setPinAreas([]);setCreating(true);setMsg("")};
 const applyUserScan=(values)=>{setForm(f=>({...f,...values,bankAccountNumber:values.bankAccountNumber||values.accountNumber||f.bankAccountNumber,bankAccountName:values.bankAccountName||values.accountName||f.bankAccountName,bankName:values.bankName||f.bankName,bankAddress:values.bankAddress||f.bankAddress,ifsc:values.ifsc||f.ifsc}));if(values.pincode)setTimeout(()=>lookupPin(values.pincode),0);if(values.ifsc)setTimeout(async()=>{try{const row=await lookupIfscMaster(values.ifsc);setForm(f=>({...f,...bankFieldsFromIfsc(row)}))}catch{}},40)};

 const openEdit=async u=>{let existingPins=[];try{const p=await api(`/access/users/${u._id}/pincodes`);existingPins=p?.pincodes||[]}catch{}const f={...blankUser(),...u,ledgerLibraryMainHead:u.role==="LEDGER_ACCOUNT"&&u.accountType&&u.accountType!==u.tallyAccountTypeName?u.accountType:"",roleId:idOf(u.roleId),departmentId:idOf(u.departmentId),assignedToUserId:idOf(u.assignedToUserId),branchId:idOf(u.branchId),dateOfBirth:u.dateOfBirth?String(u.dateOfBirth).slice(0,10):"",appointmentDate:u.appointmentDate?String(u.appointmentDate).slice(0,10):"",aadhaar:"",password:"",bankName:u.bankDetails?.bankName||"",bankBranchName:u.bankDetails?.branchName||u.bankDetails?.branchArea||"",bankAddress:u.bankDetails?.bankAddress||"",bankCity:u.bankDetails?.city||"",bankState:u.bankDetails?.state||"",bankStdCode:u.bankDetails?.stdCode||"",bankPhone:u.bankDetails?.phone||"",bankContactNo:u.bankDetails?.contactNo||"",bankAccountNumber:u.bankDetails?.accountNumber||"",bankAccountName:u.bankDetails?.accountName||u.name||"",ifsc:u.bankDetails?.ifsc||"",lastWorkingFirmName:u.lastWorkingDetails?.firmName||"",lastWorkingProfileName:u.lastWorkingDetails?.profileName||"",lastWorkingAddress:u.lastWorkingDetails?.address||"",lastWorkingContactNumber:u.lastWorkingDetails?.contactNumber||"",references:u.references?.length?u.references:[{name:"",relation:"",mobile:""}],pincodes:existingPins};setEditing(u);setForm(f);setCreating(true);setPinAreas([]);await loadHierarchy(f.roleId,f.assignedToUserId,false)};

 const openPinModal=()=>setPinModal(true);

 const lookupUserIfsc=async raw=>{try{const code=normalizeIfsc(raw);const row=await lookupIfscMaster(code);const b=bankFieldsFromIfsc(row);setForm(f=>({...f,ifsc:b.ifsc,bankName:b.bankName,bankBranchName:b.branchName,bankAddress:b.bankAddress,bankCity:b.bankCity,bankState:b.bankState,bankStdCode:b.bankStdCode,bankPhone:b.bankPhone,bankContactNo:b.bankContactNo,bankAccountName:f.bankAccountName||f.name}));setMsg(`Bank details loaded from MASTER for ${code}`)}catch(e){setMsg(e.message)}};
 const changeUserIfsc=value=>{const code=normalizeIfsc(value).slice(0,11);setForm(f=>({...f,ifsc:code}));if(code.length===11)lookupUserIfsc(code)};

 const addReference=()=>setForm(f=>({...f,references:[...f.references,{name:"",relation:"",mobile:""}]}));
 const updateRef=(i,k,v)=>setForm(f=>({...f,references:f.references.map((r,n)=>n===i?{...r,[k]:v}:r)}));
 const removeRef=i=>setForm(f=>({...f,references:f.references.filter((_,n)=>n!==i)}));

 const save=async()=>{try{
  if(!form.name.trim())throw new Error(ledgerOnlyMode?"Account / Ledger Name is required":"Name is required");
  const role=roleMap.get(String(form.roleId)),roleCode=String(role?.code||"").toUpperCase();
  if(!ledgerOnlyMode){
   if(!form.roleId)throw new Error("Role is required");
   if(branches.length&&!form.branchId)throw new Error("Branch is required");
   if(hierarchy.requiresParent&&!form.assignedToUserId)throw new Error(`Select a user under parent role ${hierarchy.parentRole?.name||""}`);
   if(["SALES_HEAD","SALES_PERSON"].includes(roleCode)&&!form.pincodes.length)throw new Error(`Select at least one pincode for the ${roleCode==="SALES_HEAD"?"Sales Head":"Sales Person"}`);
   if(form.loginEnabled&&(!form.email||(!editing&&String(form.password).length<8)))throw new Error("Email and password of at least 8 characters are required for System Login");
   if((form.bankAccountNumber||form.bankAccountName||form.bankName||form.ifsc)&&!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizeIfsc(form.ifsc)))throw new Error("IFSC code is mandatory and must be valid for bank details");
  }
  const payload={...form,ledgerOnly:ledgerOnlyMode,pan:String(form.pan||"").toUpperCase(),aadhaar:digits(form.aadhaar),pincode:digits(form.pincode).slice(0,6),salary:Number(form.salary||0),pfPercentage:Number(form.pfPercentage||0),openingBalance:Number(form.openingBalance||0)};
  if(ledgerOnlyMode)Object.assign(payload,{roleId:"",departmentId:"",assignedToUserId:"",branchId:"",designation:"",appointmentDate:"",salary:0,pfPercentage:0,loginEnabled:false,email:"",password:"",dateOfBirth:"",mobile:"",fatherName:"",fatherMobile:"",motherMobile:"",drivingLicenseNumber:"",aadhaar:"",pan:"",ifsc:"",bankName:"",bankBranchName:"",bankAddress:"",bankCity:"",bankState:"",bankContactNo:"",bankAccountNumber:"",bankAccountName:"",pincode:"",area:"",city:"",district:"",state:"",address:"",lastWorkingFirmName:"",lastWorkingProfileName:"",lastWorkingAddress:"",lastWorkingContactNumber:"",references:[],pincodes:[]});
  if(editing&&!payload.password)delete payload.password;
  const saved=await api(editing?`/access/users/${editing._id}`:"/access/users",{method:editing?"PUT":"POST",body:JSON.stringify(payload)});
  setMsg(editing?(ledgerOnlyMode?"Ledger account updated":"User updated"):(ledgerOnlyMode?"Ledger account created":"User created"));setCreating(false);setEditing(null);setForm(blankUser());await load();if(isLookupCreate()||getLookupEditId())notifyLookupCreated("user",{id:saved?._id||editing?._id,name:saved?.name||form.name})
 }catch(e){setMsg(e.message)}};
 const resetPassword=async u=>{const password=prompt(`New password for ${u.name} (minimum 8 characters)`);if(!password)return;try{await api(`/access/users/${u._id}/reset-password`,{method:"POST",body:JSON.stringify({password})});setMsg("Password reset successfully")}catch(e){setMsg(e.message)}};
 const toggleStatus=async u=>{try{await api(`/access/users/${u._id}/status`,{method:"POST",body:JSON.stringify({status:u.status==="ACTIVE"?"INACTIVE":"ACTIVE"})});await load()}catch(e){setMsg(e.message)}};

 if(creating)return <>
  {!embedded&&<PageHeader title={editing?(ledgerOnlyMode?"Edit Ledger Account":"Edit User"):(ledgerOnlyMode?"Create Ledger Account":"Create User")} description={ledgerOnlyMode?"Accounting-only record. Role, hierarchy and employee fields are not required.":"Single-page person, accounting, assignment and official information."}/>}
  {msg&&<div className="resultBanner bad">{msg}</div>}
  <section className="panel"><div className="formTitle"><div><h3>{editing?(ledgerOnlyMode?"Edit Ledger Account":"Edit User"):(ledgerOnlyMode?"Create Ledger Account":"Create User")}</h3><span>{ledgerOnlyMode?"Only accounting fields are shown for this Account Type.":"No tabs. Complete the sections below and save once."}</span></div><div className="formTitleActions">{!ledgerOnlyMode&&<ScanAndFill documentType="USER" targetPath="/dms/users" onApply={applyUserScan}/>}<button className="iconBtn" onClick={()=>setCreating(false)}><X/></button></div></div></section>

  <section className="panel"><div className="sectionLabel">{ledgerOnlyMode?"Account Information":"Personal Information"}</div><div className="formGrid">
   <label>{ledgerOnlyMode?"Account / Ledger Name *":"Full Name *"}<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
   {form.ledgerLibraryMainHead&&<label>Main Account Head<input value={form.ledgerLibraryMainHead} readOnly/></label>}
   <label>{ledgerOnlyMode?"Accounting Type *":"Account Type (Optional)"}<select value={form.tallyAccountTypeCode} onChange={e=>{const tallyAccountTypeCode=e.target.value;const head=accountHeads.find(a=>String(a.systemCode)===String(tallyAccountTypeCode));const ledger=isStandaloneLedgerAccount(head);setForm(f=>({...f,tallyAccountTypeCode,...(ledger?{roleId:"",departmentId:"",assignedToUserId:"",branchId:"",loginEnabled:false,pincodes:[]}: {})}));if(ledger){setHierarchy({department:null,parentRole:null,users:[],requiresParent:false});setPinModal(false)}}}><option value="">Select Account</option>{accountHeads.map(a=><option key={a.systemCode} value={a.systemCode}>{a.name}</option>)}</select></label>
   {!ledgerOnlyMode&&<>
    <label>DOB<input type="date" value={form.dateOfBirth} onChange={e=>setForm({...form,dateOfBirth:e.target.value})}/></label>
    <label>Mobile Number<input value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})}/></label>
    <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
    <label>{editing?"New Password":"Password"}<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
    <label>Father Name<input value={form.fatherName} onChange={e=>setForm({...form,fatherName:e.target.value})}/></label>
    <label>Father Mobile Number<input value={form.fatherMobile} onChange={e=>setForm({...form,fatherMobile:e.target.value})}/></label>
    <label>Mother Mobile Number<input value={form.motherMobile} onChange={e=>setForm({...form,motherMobile:e.target.value})}/></label>
    <label>Driving License Number<input value={form.drivingLicenseNumber} onChange={e=>setForm({...form,drivingLicenseNumber:e.target.value.toUpperCase()})}/></label>
    <label>Aadhaar Number<input value={form.aadhaar} onChange={e=>setForm({...form,aadhaar:digits(e.target.value).slice(0,12)})} placeholder={editing?form.aadhaarMasked||"Leave blank to keep":""}/></label>
    <label>PAN Number<input value={form.pan||""} onChange={e=>setForm({...form,pan:e.target.value.toUpperCase().slice(0,10)})}/></label>
    <label>IFSC Code *<div className="bankIfscRow"><input value={form.ifsc} maxLength={11} onChange={e=>changeUserIfsc(e.target.value)} onBlur={()=>form.ifsc&&lookupUserIfsc(form.ifsc)} onKeyDown={e=>e.key==="Enter"&&lookupUserIfsc(form.ifsc)}/><button type="button" className="gstLookupButton iconOnlyLookup" onClick={()=>lookupUserIfsc(form.ifsc)} title="Find IFSC in MASTER"><Search size={14}/></button></div></label>
    <label className="bankAutoField">Bank Name<input value={form.bankName} readOnly/></label>
    <label className="bankAutoField">Branch / Area<input value={form.bankBranchName} readOnly/></label>
    <label className="bankAutoField span2">Bank Address<textarea value={form.bankAddress} readOnly/></label>
    <label className="bankAutoField">Bank City<input value={form.bankCity} readOnly/></label>
    <label className="bankAutoField">Bank State<input value={form.bankState} readOnly/></label>
    <label className="bankAutoField">Bank Contact<input value={form.bankContactNo} readOnly/></label>
    <label>Account Number<input value={form.bankAccountNumber} onChange={e=>setForm({...form,bankAccountNumber:e.target.value})}/></label>
    <label>Account Name<input value={form.bankAccountName} onChange={e=>setForm({...form,bankAccountName:e.target.value})}/></label>
    <label>Pin Code<input value={form.pincode} onChange={e=>lookupPin(e.target.value)} maxLength={6}/></label>
    <label>Area / Post Office{pinAreas.length>1?<select value={form.area} onChange={e=>chooseArea(e.target.value)}><option value="">Select Area</option>{pinAreas.map((a,i)=><option key={`${a.area}-${i}`} value={a.area}>{a.area}</option>)}</select>:<input value={form.area} readOnly/>}</label>
    <label>City<input value={form.city} readOnly/></label><label>District<input value={form.district} readOnly/></label><label>State<input value={form.state} readOnly/></label><label>Country<input value={form.country} onChange={e=>setForm({...form,country:e.target.value})}/></label>
    <label className="span2">Address<textarea value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
   </>}
  </div>{ledgerOnlyMode&&<div className="resultBanner good"><b>Ledger Account mode:</b> Role, Department, Parent Role, Branch, salary, login, personal KYC, bank, previous employment and references are hidden and not required for this account.</div>}</section>

  {!ledgerOnlyMode&&<section className="panel"><div className="sectionLabel">Assignment</div><div className="formGrid">
   <label>Role *<div className="lookupSelectRow"><select value={form.roleId} onChange={e=>{const roleId=e.target.value;setForm(f=>({...f,roleId,assignedToUserId:"",departmentId:""}));loadHierarchy(roleId,"",true)}}><option value="">Select Role</option>{roles.filter(r=>r.status==="ACTIVE"&&String(r.code).toUpperCase()!=="CUSTOMER").map(r=><option key={r._id} value={r._id}>{r.name}{r.sourceTemplateCode?" (MASTER)":""} — {r.departmentId?.name||deptName(r.departmentId)||"Unassigned"}</option>)}</select><CreateLookupButton to="/dms/roles" label="Create" resource="role" selectedValue={form.roleId} onReturn={load}/></div></label>
   <label>Department<input value={hierarchy.department?.name||deptName(form.departmentId)||""} readOnly/></label>
   <label>Parent Role<input value={hierarchy.parentRole?.name||"Top Role / Superadmin"} readOnly/></label>
   <label>Assigned To {hierarchy.requiresParent&&"*"}<div className="lookupSelectRow"><select value={form.assignedToUserId} onChange={e=>{const assignedToUserId=e.target.value;const code=String(roleMap.get(String(form.roleId))?.code||"").toUpperCase();setForm(f=>({...f,assignedToUserId,...(code==="SALES_PERSON"?{pincodes:[]}: {})}));if(code==="SALES_PERSON"&&assignedToUserId)setPinModal(true)}} disabled={!hierarchy.requiresParent}><option value="">{hierarchy.requiresParent?`Select ${hierarchy.parentRole?.name||"Parent"}`:"No parent required"}</option>{(hierarchy.users||[]).map(u=><option key={u._id} value={u._id}>{u.name}{u.designation?` — ${u.designation}`:""}</option>)}</select><CreateLookupButton to="/dms/users" label="Create" resource="user" selectedValue={form.assignedToUserId} onReturn={()=>form.roleId&&loadHierarchy(form.roleId,form.assignedToUserId,false)} title="Create Reporting User"/></div></label>
  </div>{hierarchy.requiresParent&&!(hierarchy.users||[]).length&&<div className="resultBanner bad">No user exists in parent role <b>{hierarchy.parentRole?.name}</b>. Create that parent-role user first. You cannot create this lower-level user directly.</div>}
  {["SALES_HEAD","SALES_PERSON"].includes(String(roleMap.get(String(form.roleId))?.code||"").toUpperCase())&&<div className="toolbar"><button type="button" className="btn ghost" onClick={openPinModal}><MapPin/>Select Pincodes ({form.pincodes.length})</button><span className="mutedText">{String(roleMap.get(String(form.roleId))?.code||"").toUpperCase()==="SALES_HEAD"?"Select the Sales Head coverage. You can create one or more Sales Heads.":"Select the Sales Person's customer/lead allotment."}</span></div>}
  </section>}

  <section className="panel"><div className="sectionLabel">{ledgerOnlyMode?"Accounting Information":"Official Information"}</div><div className="formGrid">
   {!ledgerOnlyMode&&<><label>Designation<input value={form.designation} onChange={e=>setForm({...form,designation:e.target.value})}/></label><label>Branch<div className="lookupSelectRow"><select value={form.branchId} onChange={e=>setForm({...form,branchId:e.target.value})}><option value="">Select Branch</option>{branches.map(b=><option key={b._id} value={b._id}>{b.name}</option>)}</select><CreateLookupButton to="/dms/branches" label="Create" resource="branch" selectedValue={form.branchId} onReturn={load}/></div></label><label>Appointment Date<input type="date" value={form.appointmentDate} onChange={e=>setForm({...form,appointmentDate:e.target.value})}/></label><label>Base Salary / Month<input type="number" value={form.salary} onChange={e=>setForm({...form,salary:e.target.value})}/></label><label>PF Percentage<input type="number" value={form.pfPercentage} onChange={e=>setForm({...form,pfPercentage:e.target.value})}/></label></>}
   <label>Opening Financial Year<select value={form.openingFinancialYear} onChange={e=>setForm({...form,openingFinancialYear:e.target.value})}>{fyOptions().map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Opening Balance<input type="number" value={form.openingBalance} onChange={e=>setForm({...form,openingBalance:e.target.value})}/></label>
   <label>O/P Balance Type<select value={form.openingBalanceType} onChange={e=>setForm({...form,openingBalanceType:e.target.value})}><option>DR</option><option>CR</option></select></label>
   <label>Ledger Name<input value={form.ledgerName} onChange={e=>setForm({...form,ledgerName:e.target.value})} placeholder={form.name?`${form.name} A/c`:""}/></label>
   <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>ACTIVE</option><option>INACTIVE</option></select></label>
   {!ledgerOnlyMode&&<label>System Login<select value={form.loginEnabled?"YES":"NO"} onChange={e=>setForm({...form,loginEnabled:e.target.value==="YES"})}><option value="YES">Enabled</option><option value="NO">Disabled</option></select></label>}
  </div>{!ledgerOnlyMode&&<div className="resultBanner good">Branch capacity: {branchInfo.used} / {branchInfo.limit||"∞"}. Rules and Shift are intentionally removed from User creation.</div>}</section>

  {!ledgerOnlyMode&&<><section className="panel"><div className="sectionLabel">Last Working Details</div><div className="formGrid"><label>Firm Name<input value={form.lastWorkingFirmName} onChange={e=>setForm({...form,lastWorkingFirmName:e.target.value})}/></label><label>Profile Name<input value={form.lastWorkingProfileName} onChange={e=>setForm({...form,lastWorkingProfileName:e.target.value})}/></label><label>Address<input value={form.lastWorkingAddress} onChange={e=>setForm({...form,lastWorkingAddress:e.target.value})}/></label><label>Contact Number<input value={form.lastWorkingContactNumber} onChange={e=>setForm({...form,lastWorkingContactNumber:e.target.value})}/></label></div></section>
  <section className="panel"><div className="sectionLabel">Reference Information</div>{form.references.map((r,i)=><div className="formGrid" key={i}><label>Name<input value={r.name} onChange={e=>updateRef(i,"name",e.target.value)}/></label><label>Relation<input value={r.relation} onChange={e=>updateRef(i,"relation",e.target.value)}/></label><label>Mobile<input value={r.mobile} onChange={e=>updateRef(i,"mobile",e.target.value)}/></label><div className="formActions"><button type="button" className="btn ghost danger" onClick={()=>removeRef(i)} disabled={form.references.length===1}>Remove</button></div></div>)}<button type="button" className="btn ghost" onClick={addReference}><Plus/>Add More</button></section></>}
  <div className="formActions" style={{marginBottom:24}}><button className="btn ghost" onClick={()=>setCreating(false)}>Cancel</button><button className="btn primary" onClick={save}>{editing?(ledgerOnlyMode?"Update Ledger Account":"Update User"):(ledgerOnlyMode?"Create Ledger Account":"Create User")}</button></div>

  {!ledgerOnlyMode&&pinModal&&<div className="modalOverlay"><section className="panel modalPanel extraWideModal"><div className="formTitle"><div><h3>Assign Pincodes to {String(roleMap.get(String(form.roleId))?.code||"").toUpperCase()==="SALES_HEAD"?"Sales Head":"Sales Person"}</h3><span>Tick State, District, City or individual Pincode. Selecting a higher level selects every pincode below it.</span></div><button className="iconBtn" onClick={()=>setPinModal(false)}><X/></button></div><PincodeHierarchySelector value={form.pincodes} onChange={pincodes=>setForm(f=>({...f,pincodes}))} scopeUserId={String(roleMap.get(String(form.roleId))?.code||"").toUpperCase()==="SALES_PERSON"?form.assignedToUserId:""} requireScope={String(roleMap.get(String(form.roleId))?.code||"").toUpperCase()==="SALES_PERSON"&&hierarchy.requiresParent}/><div className="formActions"><button className="btn primary" onClick={()=>setPinModal(false)}>Use Selected Pincodes ({form.pincodes.length})</button></div></section></div>}
 </>;

 return <>
  {!embedded&&<PageHeader title="Users" description="Role hierarchy, person accounts and pincode ownership."/>}
  {msg&&<div className="resultBanner good">{msg}</div>}
  <PageHeader title="User Master" description="Create users, ledger accounts and accounting masters. Super Admin can select/import ledgers from the Ledger Library." onAdd={()=>openCreate()} addLabel="Create User"/>
  <section className="panel"><div className="toolbar"><div className="searchBox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} placeholder="Search name, role, department, PAN, pincode..."/></div>{isSuperAdmin&&<button className="btn ghost" onClick={openLedgerLibrary}><BookOpen size={15}/>Ledger Library</button>}{isSuperAdmin&&<button className="btn ghost" disabled={downloadingData} onClick={downloadUserData}><Download size={15}/>{downloadingData?"Downloading...":"Download Data"}</button>}<button className="btn ghost" onClick={load}><RefreshCw/>Refresh</button><span>{users.length} records</span></div><DataTable rows={users} columns={[
   {key:"name",label:"Name",render:u=><div className="customerCell"><EditMasterLink onClick={()=>openEdit(u)}>{u.name}</EditMasterLink><small>{u.email||u.mobile||"No login"}</small></div>},
   {key:"accountType",label:"Main Account / Type",render:u=>u.role==="LEDGER_ACCOUNT"?(u.accountType||u.tallyAccountTypeName||"—"):(u.tallyAccountTypeName||"—")},{key:"role",label:"Role",render:u=>u.role==="LEDGER_ACCOUNT"?"Not Required":(u.roleId?.name||u.accountType||u.role||"—")},{key:"department",label:"Department",render:u=>u.departmentId?.name||u.department||"—"},{key:"assigned",label:"Assigned To",render:u=><EditMasterLink to="/dms/users" id={idOf(u.assignedToUserId)} resource="user">{u.assignedToUserId?.name||"—"}</EditMasterLink>},{key:"branch",label:"Branch",render:u=>u.branchId?.name||u.branch||"—"},{key:"status",label:"Status",render:u=><StatusBadge value={u.status}/>},{key:"actions",label:"Actions",render:u=><div className="rowActions"><button title="Edit" onClick={()=>openEdit(u)}><Pencil/></button>{u.loginEnabled!==false&&u.role!=="LEDGER_ACCOUNT"&&<button title="Reset Password" onClick={()=>resetPassword(u)}><KeyRound/></button>}<button title="Toggle Status" onClick={()=>toggleStatus(u)}><Power/></button></div>}
  ]}/></section>
  {ledgerLibraryOpen&&<div className="modalOverlay"><section className="panel modalPanel extraWideModal" style={{maxWidth:1180,width:"96vw",maxHeight:"92vh",overflow:"auto"}}>
   <div className="formTitle"><div><h3>Ledger Master Library</h3><span>{ledgerLibrary.totals.mainAccountHeads||0} Main Account Heads • {ledgerLibrary.totals.templates||0} templates • {ledgerLibrary.totals.created||0} already created • {ledgerLibrary.totals.available||0} available</span></div><button className="iconBtn" onClick={()=>setLedgerLibraryOpen(false)}><X/></button></div>
   <div className="toolbar" style={{position:"sticky",top:0,zIndex:2,background:"var(--panel, #fff)",paddingTop:8,paddingBottom:8}}>
    <div className="searchBox"><Search/><input value={ledgerLibrarySearch} onChange={e=>setLedgerLibrarySearch(e.target.value)} placeholder="Search Main Account Head or ledger..."/></div>
    <button className="btn ghost" onClick={()=>{setLedgerLibraryOpen(false);openCreate()}} disabled={ledgerLibraryImporting}>Custom Ledger</button>
    <button className="btn ghost" onClick={()=>importLedgerTemplates(false)} disabled={ledgerLibraryImporting||!ledgerLibrarySelected.length}>{ledgerLibraryImporting?"Importing...":`Import Selected (${ledgerLibrarySelected.length})`}</button>
    <button className="btn primary" onClick={()=>importLedgerTemplates(true)} disabled={ledgerLibraryImporting||!ledgerLibrary.totals.available}>{ledgerLibraryImporting?"Importing...":"Import All Available"}</button>
    <button className="btn ghost" onClick={loadLedgerLibrary} disabled={ledgerLibraryBusy}><RefreshCw size={14}/>{ledgerLibraryBusy?"Loading...":"Refresh"}</button>
   </div>
   <div className="resultBanner good"><b>How to use:</b> Click <b>Use</b> to prefill one ledger and review it before saving, tick multiple ledgers and Import Selected, or Import All. Existing same-name ledgers are never duplicated.</div>
   {ledgerLibraryBusy&&!ledgerLibrary.groups.length?<div className="panel">Loading Ledger Library...</div>:filteredLedgerGroups.map(group=>{
    const available=(group.ledgers||[]).filter(x=>!x.created);
    const allSelected=available.length>0&&available.every(x=>ledgerLibrarySelected.includes(x.templateKey));
    return <details key={group.mainAccountHead} className="panel" style={{marginBottom:10}} open={Boolean(ledgerLibrarySearch)}>
     <summary style={{cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",gap:10}}>
      <input type="checkbox" checked={allSelected} disabled={!available.length} onClick={e=>e.stopPropagation()} onChange={e=>selectLedgerGroup(group,e.target.checked)}/>
      <span style={{flex:1}}>{group.mainAccountHead}</span>
      <small>{group.created}/{group.total} created</small>
     </summary>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:8,marginTop:10}}>
      {(group.ledgers||[]).map(item=><div key={item.templateKey} style={{border:"1px solid var(--border,#ddd)",borderRadius:10,padding:10,display:"flex",alignItems:"center",gap:8,opacity:item.created?.72:1}}>
       <input type="checkbox" checked={item.created||ledgerLibrarySelected.includes(item.templateKey)} disabled={item.created} onChange={e=>toggleLedgerTemplate(item.templateKey,e.target.checked)}/>
       <div style={{flex:1,minWidth:0}}><b>{item.name}</b><div className="mutedText">{item.systemAccountCode}</div></div>
       {item.created?<span className="statusBadge">Created</span>:<button className="btn ghost" onClick={()=>useLedgerTemplate(item)}>Use</button>}
      </div>)}
     </div>
    </details>
   })}
  </section></div>}
 </>;
}
