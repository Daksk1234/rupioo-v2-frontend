import { api } from "./api.js";

const ALLOWED_PARTY_TYPES = new Set(["DEBITOR", "CREDITOR", "ECOMMERCE", "BUYER", "SUPPLIER"]);

export function normalizePartyType(value) {
  return String(value || "").trim().toUpperCase();
}

export function isTransactionParty(row) {
  if (!row) return false;
  const status = String(row.status || "ACTIVE").trim().toUpperCase();
  if (status && status !== "ACTIVE") return false;
  const type = normalizePartyType(row.partyType);
  // Keep legacy active party records with a blank type visible as well.
  return !type || ALLOWED_PARTY_TYPES.has(type);
}

export function partyOptionLabel(row) {
  const name = row?.localName || row?.legalName || row?.tradeName || "Party";
  const type = normalizePartyType(row?.partyType) || "PARTY";
  const identifier = row?.displayIdentifier || row?.gstin || row?.globalCustomerId || "";
  return `${name} • ${type}${identifier ? ` • ${identifier}` : ""}`;
}

export function partyGstin(row) {
  const direct = row?.gstin || row?.gstNumber || row?.gstinSnapshot || row?.global?.gstins?.[0]?.value || "";
  if (direct) return String(direct).toUpperCase();
  const display = String(row?.displayIdentifier || "").trim().toUpperCase();
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(display) ? display : "";
}

export async function fetchTransactionParties(limit = 200) {
  const first = await api(`/customers?status=ACTIVE&page=1&limit=${limit}`);
  const items = Array.isArray(first?.items) ? [...first.items] : [];
  const pages = Math.max(1, Number(first?.meta?.pages || 1));

  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, index) =>
        api(`/customers?status=ACTIVE&page=${index + 2}&limit=${limit}`),
      ),
    );
    rest.forEach((result) => {
      if (Array.isArray(result?.items)) items.push(...result.items);
    });
  }

  const seen = new Set();
  return items
    .filter(isTransactionParty)
    .filter((row) => {
      const key = String(row.globalCustomerId || row._id || row.displayIdentifier || row.localName || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(a.localName || a.legalName || "").localeCompare(String(b.localName || b.legalName || ""), "en", { sensitivity: "base" }));
}
