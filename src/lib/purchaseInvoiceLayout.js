export const PURCHASE_LAYOUT_GROUPS = [
  { title: "Main boxes", unit: "%", min: 25, max: 100, fields: [["partyBox", "Supplier / invoice details"], ["productBox", "Products"], ["adjustBox", "Discount / charges"], ["detailsBox", "Landed cost / HSN details"], ["totalsBox", "Totals"]] },
  { title: "Supplier / invoice fields", unit: "px", min: 80, max: 1200, fields: [["fy", "Financial Year"], ["supplier", "Supplier / Party"], ["invoice", "Invoice Number"], ["date", "Date"], ["gstin", "GSTIN"], ["purchaseType", "Type"]] },
  { title: "Product fields", unit: "px", min: 80, max: 1200, fields: [["product", "Product"], ["warehouse", "Warehouse"], ["hsn", "HSN"], ["grossUnit", "Gross Unit"], ["grossQty", "Gross Qty"], ["netQty", "Net Qty"], ["unit", "Net Unit"], ["gst", "Tax %"], ["basic", "Basic Price"], ["total", "Basic Total"], ["landed", "Landed Price"]] },
  { title: "Landed cost / remarks fields", unit: "px", min: 80, max: 1200, fields: [["transportation", "Transportation"], ["labour", "Labour"], ["localFreight", "Local Freight"], ["miscellaneous", "Miscellaneous"], ["landedPercent", "Landed %"], ["landedTotal", "Landed Total"], ["remarks", "Remarks"]] },
];

export function cleanPurchaseLayout(value) {
  const clean = {};
  for (const group of PURCHASE_LAYOUT_GROUPS) for (const [key] of group.fields) {
    const n = value?.[key];
    if (typeof n === "number" && Number.isFinite(n)) clean[key] = Math.max(group.min, Math.min(group.max, Math.round(n)));
  }
  return clean;
}

export function purchaseLayoutVariables(value) {
  const clean = cleanPurchaseLayout(value);
  return Object.fromEntries(PURCHASE_LAYOUT_GROUPS.flatMap(group => group.fields.filter(([key]) => key in clean).map(([key]) => [`--si-${key}`, `${clean[key]}${group.unit}`])));
}

export function purchaseLayoutStorageKey(user) {
  return `rupio.purchase-invoice.layout.v1:${user?.tenantId || "default"}:${user?._id || user?.id || user?.email || "local"}`;
}
