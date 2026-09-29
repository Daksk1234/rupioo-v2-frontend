export const LAYOUT_GROUPS = [
  { title: 'Main boxes', unit: '%', min: 25, max: 100, fields: [ ['partyBox', 'Party / invoice details'], ['productBox', 'Products'], ['adjustBox', 'Discount / charges'], ['detailsBox', 'GST / delivery details'], ['totalsBox', 'Totals'] ] },
  { title: 'Party / invoice fields', unit: 'px', min: 80, max: 1200, fields: [ ['buyer','Buyer / Party'], ['date','Order Date'], ['invoice','Invoice Number'], ['warehouse','Warehouse'], ['arn','ARN Number'], ['sanction','Sanction Amount'], ['pending','Pending Amount'], ['balance','Balance Amount'], ['net','Net Balance'], ['payment','Payment Mode'], ['transport','Assigned Transport'] ] },
  { title: 'Product fields', unit: 'px', min: 80, max: 1200, fields: [ ['product','Product'], ['hsn','HSN'], ['grossUnit','Gross Unit'], ['grossQty','Gross Qty'], ['available','Available'], ['netQty','Net Qty'], ['unit','Unit'], ['mrp','MRP'], ['grade','Grade %'], ['sale','Sale incl GST'], ['basic','Basic ex GST'], ['discount','Discount %'], ['gst','GST %'], ['total','Total'] ] },
  { title: 'GST / delivery fields', unit: 'px', min: 80, max: 1200, fields: [ ['gstType','GST Type'], ['order','Order No.'], ['packages','Packages'], ['delivery','Delivery Boy'], ['remarks','Remarks'], ['eStatus','e-Invoice Status'], ['irn','IRN'], ['ack','Ack No.'], ['ackDate','Ack Date'], ['qr','Signed QR Payload'] ] },
];
export function cleanLayout(value) {
  const clean = {};
  for (const group of LAYOUT_GROUPS) for (const [key] of group.fields) {
    const n = value?.[key];
    if (typeof n === 'number' && Number.isFinite(n)) clean[key] = Math.max(group.min, Math.min(group.max, Math.round(n)));
  }
  return clean;
}
export function layoutVariables(value) {
  const clean = cleanLayout(value);
  return Object.fromEntries(LAYOUT_GROUPS.flatMap(group => group.fields.filter(([key]) => key in clean).map(([key]) => [`--si-${key}`, `${clean[key]}${group.unit}`])));
}
export function layoutStorageKey(user) {
  return `rupio.sales-invoice.layout.v1:${user?.tenantId || 'default'}:${user?._id || user?.id || user?.email || 'local'}`;
}
