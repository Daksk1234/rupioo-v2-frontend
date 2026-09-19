import { api } from "./api.js";

export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const normalizeIfsc = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");

export async function lookupIfscMaster(value) {
  const ifsc = normalizeIfsc(value);
  if (!IFSC_PATTERN.test(ifsc)) throw new Error("Enter a valid 11-character IFSC code");
  return api(`/reference/ifsc/${encodeURIComponent(ifsc)}`);
}

export function bankFieldsFromIfsc(row = {}) {
  return {
    ifsc: normalizeIfsc(row.ifsc),
    bankName: row.bankName || "",
    branchName: row.branchName || row.branchArea || "",
    branchArea: row.branchArea || row.branchName || "",
    bankAddress: row.bankAddress || row.address || "",
    bankCity: row.city || "",
    bankState: row.state || "",
    bankStdCode: row.stdCode || "",
    bankPhone: row.phone || "",
    bankContactNo: row.contactNo || "",
  };
}
