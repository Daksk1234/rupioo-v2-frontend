import { api } from "./api.js";
import { normalizeIfsc } from "./ifscLookup.js";

export const cleanGstin = (value) => String(value || "").toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15);
export const cleanPincode = (value) => String(value || "").replace(/\D/g, "").slice(0, 6);

export function addressText(raw = {}) {
  return [raw.flno, raw.bno, raw.st, raw.bnm, raw.locality, raw.loc, raw.dst]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
}

export function gstCompanyFields(taxpayer = {}, current = {}) {
  const raw = taxpayer.principalAddressRaw || taxpayer?.taxpayerInfo?.pradr?.addr || {};
  const address = taxpayer.principalAddress || addressText(raw);
  return {
    ...current,
    companyName: taxpayer.tradeName || taxpayer.legalName || current.companyName || "",
    tradeName: taxpayer.tradeName || current.tradeName || "",
    pan: taxpayer.pan || current.pan || "",
    address: address || current.address || "",
    registeredAddress: address || current.registeredAddress || current.address || "",
    pincode: cleanPincode(raw.pncd || raw.pincode || current.pincode),
    area: raw.locality || raw.area || current.area || "",
    city: raw.city || raw.loc || current.city || "",
    district: raw.dst || raw.district || current.district || "",
    state: raw.state || raw.stcd || current.state || "",
    gstVerified: true,
    gstSource: taxpayer.source || "GST_PROVIDER",
    gstStatus: taxpayer.status || "",
    gstTaxpayerType: taxpayer.taxpayerType || "",
    gstConstitution: taxpayer.constitution || "",
  };
}

export function pincodeCompanyFields(row = {}, current = {}) {
  return {
    ...current,
    pincode: cleanPincode(row.pincode || current.pincode),
    area: row.area || current.area || "",
    city: row.city || current.city || "",
    district: row.district || current.district || "",
    state: row.state || current.state || "",
  };
}

export function bankDetailsFromIfsc(row = {}, current = {}) {
  return {
    ...current,
    ifsc: normalizeIfsc(row.ifsc || current.ifsc),
    bankName: row.bankName || current.bankName || "",
    branchName: row.branchName || row.branchArea || current.branchName || "",
    branchArea: row.branchArea || row.branchName || current.branchArea || "",
    bankAddress: row.bankAddress || row.address || current.bankAddress || "",
    city: row.city || current.city || "",
    state: row.state || current.state || "",
    stdCode: row.stdCode || current.stdCode || "",
    phone: row.phone || current.phone || "",
    contactNo: row.contactNo || current.contactNo || "",
    accountNumber: current.accountNumber || "",
    accountName: current.accountName || "",
  };
}

export async function fetchGstCompany(gstin, { publicRegistration = false } = {}) {
  const clean = cleanGstin(gstin);
  if (clean.length !== 15) throw new Error("Enter a complete 15-character GST Number");
  return api(`${publicRegistration ? "/registration" : "/reference"}/gst/search?gstin=${encodeURIComponent(clean)}`);
}

export async function fetchPincodeCompany(pincode, { publicRegistration = false } = {}) {
  const pin = cleanPincode(pincode);
  if (pin.length !== 6) throw new Error("Enter a complete 6-digit pincode");
  if (publicRegistration) {
    const rows = await api(`/registration/pincode?pincode=${encodeURIComponent(pin)}`);
    const list = Array.isArray(rows) ? rows : Array.isArray(rows?.items) ? rows.items : [];
    const row = list.find((item) => String(item.pincode) === pin) || list[0];
    if (!row) throw new Error(`Pincode ${pin} not found in MASTER Pincode data`);
    return row;
  }
  return api(`/reference/pincodes/${encodeURIComponent(pin)}`);
}

export async function fetchIfscCompany(ifsc, { publicRegistration = false } = {}) {
  const code = normalizeIfsc(ifsc);
  if (code.length !== 11) throw new Error("Enter a complete 11-character IFSC code");
  return api(`${publicRegistration ? "/registration" : "/reference"}/ifsc/${encodeURIComponent(code)}`);
}
