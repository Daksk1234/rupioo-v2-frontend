// A new cheque permission must be granted through MASTER > Plan Group.
// Banking-enabled company Superadmins can discover the setup page only.
// Discovery NEVER grants read/write access to the cheque register.
export const CHEQUE_CONTROL_PATH = "/dms/cheque-control";

export function hasChequeControlView(user) {
  return user?.pageAccess?.[CHEQUE_CONTROL_PATH]?.view === true;
}

export function canDiscoverChequeControl(user) {
  if (hasChequeControlView(user)) return true;
  if (String(user?.role || "").toUpperCase() !== "SUPERADMIN") return false;
  return user?.pageAccess?.["/dms/banking"]?.view === true ||
    user?.pageAccess?.["/dms/bank-accounts"]?.view === true;
}
