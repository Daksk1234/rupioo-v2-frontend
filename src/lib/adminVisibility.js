import {getUser} from "./api.js";

const ADMIN_CODES=new Set(["MASTER","SUPERADMIN","COMPANY_ADMIN","DMS_ADMIN","ADMIN","ADMINISTRATOR"]);
const upper=v=>String(v||"").trim().toUpperCase();

export function isAdminUser(user=getUser()){
  if(!user)return false;
  const candidates=[user.role,user.roleCode,user.accountType,user.roleId?.code,user.roleId?.name];
  return candidates.some(value=>ADMIN_CODES.has(upper(value)));
}

export function adminOnly(user=getUser()){
  return isAdminUser(user);
}
