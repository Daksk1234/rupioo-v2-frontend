// Must match backend canEditDirectVoucher. These permissions are supplied by
// MASTER Plan/Group and (for employees) their Role and Department ceilings.
export const VOUCHER_EDIT_PAGE = "/dms/transactions/voucher-edit";

export function mayEditPostedVoucher(user, kind, channel = "any") {
  const allowed = new Set(user?.permissions || user?.allowedPermission || []);
  const isMaster = user?.role === "MASTER" || allowed.has("*");
  const page = user?.pageAccess?.[VOUCHER_EDIT_PAGE];
  if (!isMaster && (page?.view !== true || page?.edit !== true)) return false;
  if (kind !== "receipts" && kind !== "payments") return false;
  const typeCode = kind === "receipts" ? "dms.transaction.receipt.edit" : "dms.transaction.payment.edit";
  const cashCodes = ["dms.transaction.cashbook.edit", "dms.transaction.cashaccount.edit"];
  const bankCodes = ["dms.finance_reports.bank_statement.edit"];
  const candidates = channel === "cash" ? [typeCode, ...cashCodes]
    : channel === "bank" ? [typeCode, ...bankCodes]
    : [typeCode, ...cashCodes, ...bankCodes];
  return isMaster || candidates.some(code => allowed.has(code));
}

// Delete is separate from Edit and requires the corresponding Master role
// permission. It never grants access to statement imports, contras or OTP.
export function mayDeletePostedVoucher(user,kind,channel){
  if(!["receipts","payments"].includes(kind))return false;
  const codes=new Set(user?.permissions||user?.allowedPermission||[]);
  if(user?.role==="MASTER"||codes.has("*"))return true;
  const type=kind==="receipts"?"dms.transaction.receipt.delete":"dms.transaction.payment.delete";
  const book=channel==="cash"?["dms.transaction.cashbook.delete","dms.transaction.cashaccount.delete"]
    :["dms.finance_reports.bank_statement.delete"];
  return [type,...book].some(code=>codes.has(code));
}
