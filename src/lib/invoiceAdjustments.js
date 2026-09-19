const round2 = (n) => Number((Number(n) || 0).toFixed(2));
const ceil2 = (n) => Math.ceil((Number(n) || 0) * 100) / 100;

export function computeInvoiceAdjustments(base = 0, rows = []) {
  let running = Math.max(0, Number(base) || 0);
  const discounts = (rows || []).filter((r) => String(r?.type || "").toLowerCase().includes("discount"));
  const charges = (rows || []).filter((r) => String(r?.type || "").toLowerCase().includes("charge"));
  const applied = [];
  let discountTotal = 0;
  let chargesTotal = 0;

  discounts.forEach((source) => {
    const row = { ...source };
    const value = Math.max(0, Number(row?.value || 0));
    const isPct = String(row?.method || "").toLowerCase() === "percentage";
    const requested = isPct ? ceil2((running * value) / 100) : round2(value);
    const amount = round2(Math.min(running, requested));
    running = round2(Math.max(0, running - amount));
    discountTotal = round2(discountTotal + amount);
    applied.push({ ...row, applied: amount });
  });

  const discountedTaxable = running;

  charges.forEach((source) => {
    const row = { ...source };
    const value = Math.max(0, Number(row?.value || 0));
    const isPct = String(row?.method || "").toLowerCase() === "percentage";
    const amount = isPct ? round2((running * value) / 100) : round2(value);
    running = round2(running + amount);
    chargesTotal = round2(chargesTotal + amount);
    applied.push({ ...row, applied: amount });
  });

  return {
    base: round2(base),
    discountTotal,
    chargesTotal,
    discountedTaxable: round2(discountedTaxable),
    taxable: round2(running),
    applied,
  };
}

export function buildInvoiceTaxSummary(rows = [], discountTotal = 0, chargesTotal = 0, gstType = "") {
  const groups = new Map();
  let rawBase = 0;
  let maxRate = 0;

  (rows || []).forEach((row) => {
    if (!row?.productId) return;
    const taxable = Math.max(0, Number(row?.taxable || 0));
    const rate = Math.max(0, Number(row?.gstRate || 0));
    const hsn = String(row?.hsnCode || "NA");
    const key = `${hsn}|${rate}`;
    const current = groups.get(key) || { hsn, rate, rawTaxable: 0 };
    current.rawTaxable += taxable;
    groups.set(key, current);
    rawBase += taxable;
    maxRate = Math.max(maxRate, rate);
  });

  const safeDiscount = Math.min(Math.max(0, Number(discountTotal) || 0), rawBase);
  const isIGST = String(gstType || "").toUpperCase() === "IGST";
  const out = [];
  let taxableTotal = 0;
  let taxTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  for (const group of groups.values()) {
    const discountShare = rawBase > 0 ? (group.rawTaxable / rawBase) * safeDiscount : 0;
    const taxable = round2(Math.max(0, group.rawTaxable - discountShare));
    const tax = round2((taxable * group.rate) / 100);
    const cgst = isIGST ? 0 : round2(tax / 2);
    const sgst = isIGST ? 0 : round2(tax - cgst);
    const igst = isIGST ? tax : 0;
    out.push({
      hsn: group.hsn,
      rate: group.rate,
      taxable,
      tax,
      cgst,
      sgst,
      igst,
      total: round2(taxable + tax),
      isCharge: false,
    });
    taxableTotal += taxable;
    taxTotal += tax;
    cgstTotal += cgst;
    sgstTotal += sgst;
    igstTotal += igst;
  }

  const chargeAmount = Math.max(0, Number(chargesTotal) || 0);
  if (chargeAmount > 0) {
    const chargeTax = round2((chargeAmount * maxRate) / 100);
    const cgst = isIGST ? 0 : round2(chargeTax / 2);
    const sgst = isIGST ? 0 : round2(chargeTax - cgst);
    const igst = isIGST ? chargeTax : 0;
    out.push({
      hsn: `CHARGES @ ${maxRate}%`,
      rate: maxRate,
      taxable: round2(chargeAmount),
      tax: chargeTax,
      cgst,
      sgst,
      igst,
      total: round2(chargeAmount + chargeTax),
      isCharge: true,
    });
    taxableTotal += chargeAmount;
    taxTotal += chargeTax;
    cgstTotal += cgst;
    sgstTotal += sgst;
    igstTotal += igst;
  }

  taxableTotal = round2(taxableTotal);
  taxTotal = round2(taxTotal);
  const gross = round2(taxableTotal + taxTotal);
  const grand = Math.round(gross);

  return {
    rows: out,
    maxRate: round2(maxRate),
    taxableTotal,
    taxTotal,
    cgstTotal: round2(cgstTotal),
    sgstTotal: round2(sgstTotal),
    igstTotal: round2(igstTotal),
    gross,
    roundOff: round2(grand - gross),
    grand,
  };
}

export function calculateOldDmsLanded(rows = [], costs = {}, basicPurchaseTotalAfterAdjustments = 0) {
  const transportationCost = Math.max(0, Number(costs?.transportationCost) || 0);
  const labourCost = Math.max(0, Number(costs?.labourCost) || 0);
  const localFreight = Math.max(0, Number(costs?.localFreight) || 0);
  const miscellaneousCost = Math.max(0, Number(costs?.miscellaneousCost) || 0);

  // User-defined landed-expense logic:
  // Landed % = Total landed expenses / Basic purchase total AFTER Discount + Charges * 100
  // Product landed price = Product basic purchase price + same landed % of that price.
  const totalExpense = round2(transportationCost + labourCost + localFreight + miscellaneousCost);
  const rawBasicTotal = round2((rows || []).reduce((s, row) => s + Math.max(0, Number(row?.taxable || 0)), 0));
  const adjustedBasicTotal = round2(Math.max(0, Number(basicPurchaseTotalAfterAdjustments) || 0));
  const calculationBase = adjustedBasicTotal > 0 ? adjustedBasicTotal : rawBasicTotal;
  const expensePercentage = calculationBase > 0 ? (totalExpense / calculationBase) * 100 : 0;

  const itemRates = (rows || []).map((row) => {
    const basicPurchasePrice = Math.max(0, Number(row?.rate || 0));
    const landedLoading = basicPurchasePrice * (expensePercentage / 100);
    return {
      productId: row?.productId || "",
      basicPurchasePrice: round2(basicPurchasePrice),
      landedLoading: round2(landedLoading),
      landedRate: round2(basicPurchasePrice + landedLoading),
    };
  });

  return {
    transportationCost,
    labourCost,
    localFreight,
    miscellaneousCost,
    totalExpense,
    rawBasicTotal,
    adjustedBasicTotal: calculationBase,
    expensePercentage: round2(expensePercentage),
    itemRates,
    // Kept for backward-compatible payload/schema fields. Landed expense GST is NOT added.
    landedTax: 0,
    maxGst: 0,
  };
}
