import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Progress,
  Spinner,
  Table,
} from "reactstrap";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import swal from "sweetalert";

import {
  _Get,
  _PostSave,
  CreateCustomerList,
  createOrderhistoryviewDATABASE,
} from "../import/ApiEndPoint/ApiCalling";
import {
  Create_Existing_Invoice,
  Create_Warehouse_List,
  PurchaseProductList_Product,
} from "../import/ApiEndPoint/Api";

/*
  Sales bulk upload rules
  -----------------------
  1. The Excel file never needs MongoDB/ObjectId values.
  2. Customer, product and warehouse IDs are resolved from the main database.
  3. Each invoice is automatically routed to <main database>-<financial year>.
  4. Duplicate key = invoice number + invoice date + resolved customer.
  5. Upload is sequential so stock and invoice writes remain predictable.
*/

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const str = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

const canonical = (value) =>
  str(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const digits = (value) => {
  const raw = str(value);
  if (!raw) return "";

  // Excel sometimes returns phone numbers in scientific notation.
  if (/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(raw)) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return String(Math.trunc(parsed));
  }

  return raw.replace(/\D/g, "");
};

const phoneKeys = (value) => {
  const all = digits(value);
  if (!all) return [];
  return Array.from(new Set([all, all.length > 10 ? all.slice(-10) : all]));
};

const gstKey = (value) =>
  str(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
const idOf = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return str(value?._id || value?.id || value?.$oid || value);
};

const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
};

const getFinancialYearLabel = (dateValue) => {
  const date = new Date(`${dateValue}T00:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const toISODate = (value) => {
  if (!value && value !== 0) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const text = str(value);
  if (!text) return "";

  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  }

  const indian = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (indian) {
    return `${indian[3]}-${String(indian[2]).padStart(2, "0")}-${String(indian[1]).padStart(2, "0")}`;
  }

  const parsedDate = new Date(text);
  if (Number.isNaN(parsedDate.getTime())) return "";
  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;
};

const normalizedHeader = (value) =>
  str(value)
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[^a-z0-9]+/g, "");

const normalizeExcelRow = (row = {}) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizedHeader(key), value]),
  );

const read = (row, ...aliases) => {
  for (const alias of aliases) {
    const value = row?.[normalizedHeader(alias)];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
};

const normalizedSheetName = (value) => normalizedHeader(value);
const findSheet = (workbook, aliases) => {
  const aliasSet = new Set(aliases.map(normalizedSheetName));
  const sheetName = workbook.SheetNames.find((name) =>
    aliasSet.has(normalizedSheetName(name)),
  );
  return sheetName ? workbook.Sheets[sheetName] : null;
};

const sheetRows = (sheet) =>
  sheet
    ? XLSX.utils
        .sheet_to_json(sheet, { defval: "", raw: true })
        .map(normalizeExcelRow)
        .filter((row) => Object.values(row).some((value) => str(value) !== ""))
    : [];

const getCustomerName = (customer) =>
  str(firstValue(customer?.CompanyName, customer?.fullName, customer?.name));
const getCustomerGST = (customer) =>
  gstKey(
    firstValue(
      customer?.gstNumber,
      customer?.GSTNumber,
      customer?.GSTIN,
      customer?.gstin,
    ),
  );
const getCustomerPhone = (customer) =>
  firstValue(
    customer?.contactNumber,
    customer?.MobileNo,
    customer?.mobile,
    customer?.phone,
  );

const getProductName = (product) =>
  str(
    firstValue(
      product?.Product_Title,
      product?.productName,
      product?.ProductName,
      product?.name,
    ),
  );
const getProductCode = (product) =>
  canonical(
    firstValue(
      product?.Product_Code,
      product?.productCode,
      product?.SKU,
      product?.sku,
      product?.ItemCode,
      product?.itemCode,
    ),
  );
const getProductHSN = (product) =>
  canonical(firstValue(product?.HSN_Code, product?.HSN, product?.hsn));
const getProductGST = (product) =>
  num(
    firstValue(
      product?.GSTRate,
      product?.gstPercentage,
      product?.gstRate,
      product?.GST,
    ),
  );

const resolveUnique = (list, label) => {
  if (list.length === 1) return { value: list[0], error: "" };
  if (!list.length)
    return { value: null, error: `${label} was not found in master data.` };
  return {
    value: null,
    error: `${label} matched more than one master record. Add GSTIN/mobile/HSN/SKU to make the match unique.`,
  };
};

const resolveCustomer = (invoice, customers) => {
  const gst = gstKey(invoice.customerGSTIN);
  const phones = phoneKeys(invoice.customerMobile);
  const name = canonical(invoice.customerName);

  if (gst) {
    const gstMatches = customers.filter(
      (customer) => getCustomerGST(customer) === gst,
    );
    if (gstMatches.length)
      return resolveUnique(
        gstMatches,
        `Customer GSTIN ${invoice.customerGSTIN}`,
      );

    // When GSTIN is supplied it is the primary customer identity.
    // Never silently fall back to a similarly named party.
    return {
      value: null,
      error: `Customer GSTIN ${invoice.customerGSTIN} was not found in V2 Customer Master.`,
    };
  }

  if (phones.length) {
    const phoneMatches = customers.filter((customer) =>
      phoneKeys(getCustomerPhone(customer)).some((key) => phones.includes(key)),
    );
    if (phoneMatches.length === 1) return { value: phoneMatches[0], error: "" };
    if (phoneMatches.length > 1 && name) {
      const narrowed = phoneMatches.filter(
        (customer) => canonical(getCustomerName(customer)) === name,
      );
      if (narrowed.length)
        return resolveUnique(narrowed, `Customer ${invoice.customerName}`);
    }
  }

  if (name) {
    const nameMatches = customers.filter(
      (customer) => canonical(getCustomerName(customer)) === name,
    );
    return resolveUnique(nameMatches, `Customer ${invoice.customerName}`);
  }

  return { value: null, error: "Customer Name/GSTIN/Mobile is required." };
};

const PRODUCT_GENERIC_WORDS = new Set([
  "base",
  "cake",
  "board",
  "product",
  "item",
  "pcs",
  "pc",
  "piece",
  "pieces",
]);

const productTokens = (value) =>
  str(value)
    .toLowerCase()
    .replace(/(\d+)\s*[x×]\s*(\d+)/g, "$1 x $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const levenshtein = (a, b) => {
  const left = canonical(a);
  const right = canonical(b);
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const old = previous[j];
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + cost,
      );
      diagonal = old;
    }
  }
  return previous[right.length];
};

const textSimilarity = (left, right) => {
  const a = canonical(left);
  const b = canonical(right);
  if (!a || !b) return 0;
  if (a === b) return 100;
  const maxLength = Math.max(a.length, b.length) || 1;
  return Math.max(0, 100 - (levenshtein(a, b) / maxLength) * 100);
};

const scoreProductMatch = (query, product) => {
  const productName = getProductName(product);
  const qCanonical = canonical(query);
  const pCanonical = canonical(productName);
  if (!qCanonical || !pCanonical) return 0;
  if (qCanonical === pCanonical) return 100;

  const rawQueryTokens = productTokens(query);
  const meaningfulQueryTokens = rawQueryTokens.filter(
    (token) => !PRODUCT_GENERIC_WORDS.has(token),
  );
  const queryTokens = meaningfulQueryTokens.length
    ? meaningfulQueryTokens
    : rawQueryTokens;
  const targetTokens = new Set(productTokens(productName));

  const matched = queryTokens.filter((token) => targetTokens.has(token)).length;
  const coverage = queryTokens.length ? matched / queryTokens.length : 0;

  const queryNumbers = queryTokens.filter((token) => /^\d+(?:\.\d+)?$/.test(token));
  const numberMatches = queryNumbers.filter((token) => targetTokens.has(token)).length;
  const numberCoverage = queryNumbers.length
    ? numberMatches / queryNumbers.length
    : 1;

  const editScore = textSimilarity(query, productName);
  let score = coverage * 76 + editScore * 0.24;

  if (coverage === 1 && queryTokens.length >= 2) score = Math.max(score, 91);
  if (numberCoverage < 1) score -= 25 * (1 - numberCoverage);

  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
};

const getNearestProducts = (item, products) => {
  const code = canonical(item.productCode);
  const hsn = canonical(item.hsn);
  const name = str(item.productName);

  return products
    .map((product) => {
      let score = scoreProductMatch(name, product);
      if (code && getProductCode(product) === code) score = 100;
      if (hsn && getProductHSN(product) === hsn) score = Math.min(100, score + 3);
      return {
        product,
        productId: idOf(product),
        productName: getProductName(product),
        productCode: firstValue(
          product?.Product_Code,
          product?.productCode,
          product?.SKU,
          product?.sku,
          product?.ItemCode,
        ),
        hsn: firstValue(product?.HSN_Code, product?.HSN, product?.hsn),
        score,
      };
    })
    .filter((candidate) => candidate.productId)
    .sort((a, b) => b.score - a.score || a.productName.localeCompare(b.productName))
    .slice(0, 10);
};

const resolveProduct = (item, products, manualProductId = "") => {
  if (manualProductId) {
    const selected = products.find(
      (product) => idOf(product) === str(manualProductId),
    );
    if (selected) {
      return {
        value: selected,
        error: "",
        confused: false,
        manualConfirmed: true,
        score: 100,
        candidates: getNearestProducts(item, products),
      };
    }
  }

  const code = canonical(item.productCode);
  const hsn = canonical(item.hsn);
  const name = canonical(item.productName);

  if (code) {
    const codeMatches = products.filter(
      (product) => getProductCode(product) === code,
    );
    if (codeMatches.length === 1) {
      return {
        value: codeMatches[0],
        error: "",
        confused: false,
        score: 100,
        candidates: getNearestProducts(item, products),
      };
    }
  }

  if (name && hsn) {
    const exactMatches = products.filter(
      (product) =>
        canonical(getProductName(product)) === name &&
        getProductHSN(product) === hsn,
    );
    if (exactMatches.length === 1) {
      return {
        value: exactMatches[0],
        error: "",
        confused: false,
        score: 100,
        candidates: getNearestProducts(item, products),
      };
    }
  }

  if (name) {
    const exactNameMatches = products.filter(
      (product) => canonical(getProductName(product)) === name,
    );
    if (exactNameMatches.length === 1) {
      return {
        value: exactNameMatches[0],
        error: "",
        confused: false,
        score: 100,
        candidates: getNearestProducts(item, products),
      };
    }
  }

  if (!item.productName && !item.productCode) {
    return {
      value: null,
      error: "Product Name or Product Code/SKU is required.",
      confused: false,
      candidates: [],
    };
  }

  const candidates = getNearestProducts(item, products);
  if (!candidates.length) {
    return {
      value: null,
      error: `No V2 products are available to match ${item.productName || item.productCode}.`,
      confused: false,
      candidates: [],
    };
  }

  const best = candidates[0];
  const second = candidates[1];
  const gap = second ? best.score - second.score : 100;

  // Only a very strong and clearly separated fuzzy match is auto-accepted.
  // Everything else is highlighted for manual confirmation.
  const autoAccepted = best.score >= 96 && gap >= 8;

  return {
    value: best.product,
    error: "",
    confused: !autoAccepted,
    score: best.score,
    candidates,
  };
};

const warehouseName = (warehouse) =>
  str(firstValue(warehouse?.warehouseName, warehouse?.name, warehouse?.title));

const resolveWarehouse = (requestedName, product, warehouses) => {
  const requested = canonical(requestedName);
  if (requested) {
    const matches = warehouses.filter(
      (warehouse) => canonical(warehouseName(warehouse)) === requested,
    );
    if (matches.length === 1) return { id: idOf(matches[0]), error: "" };
    if (!matches.length) {
      return { id: "", error: `Warehouse ${requestedName} was not found.` };
    }
    return {
      id: "",
      error: `Warehouse ${requestedName} matched more than one record.`,
    };
  }

  const productWarehouse = firstValue(
    product?.warehouse?._id,
    product?.warehouse,
    product?.warehouseId?._id,
    product?.warehouseId,
  );
  if (productWarehouse) return { id: idOf(productWarehouse), error: "" };

  return {
    id: "",
    error: `No warehouse was provided and ${getProductName(product)} has no default warehouse.`,
  };
};

const getPartyStateCode = (party) => {
  const gst = getCustomerGST(party);
  if (/^\d{2}/.test(gst)) return gst.slice(0, 2);
  return canonical(firstValue(party?.State, party?.state));
};

const getCompanyStateCode = (company) => {
  const gst = gstKey(
    firstValue(
      company?.gstNumber,
      company?.GSTNumber,
      company?.GSTIN,
      company?.gstin,
    ),
  );
  if (/^\d{2}/.test(gst)) return gst.slice(0, 2);
  return canonical(firstValue(company?.State, company?.state));
};

const applyAdjustments = (base, adjustmentRows) => {
  let running = round2(base);
  const discounts = [];
  const charges = [];

  const applyRow = (row, type) => {
    const calculationType = canonical(row.calculationType);
    const value = Math.max(0, num(row.value));
    const applied =
      calculationType === "percentage"
        ? round2((running * value) / 100)
        : round2(value);

    const finalApplied =
      type === "Discount" ? Math.min(running, applied) : applied;
    running =
      type === "Discount"
        ? round2(Math.max(0, running - finalApplied))
        : round2(running + finalApplied);

    return {
      title: row.title || type,
      type,
      discounttype: calculationType === "percentage" ? "Percentage" : "Amount",
      percentage: calculationType === "percentage" ? value : 0,
      amount: finalApplied,
      discountedAmount: finalApplied,
      discountedValue: calculationType === "percentage" ? value : finalApplied,
      __applied: finalApplied,
    };
  };

  adjustmentRows
    .filter((row) => canonical(row.type) === "discount")
    .forEach((row) => discounts.push(applyRow(row, "Discount")));

  adjustmentRows
    .filter((row) => canonical(row.type) === "charges")
    .forEach((row) => charges.push(applyRow(row, "Charges")));

  return {
    running,
    discounts,
    charges,
    discountTotal: round2(
      discounts.reduce((sum, row) => sum + row.__applied, 0),
    ),
    chargesTotal: round2(charges.reduce((sum, row) => sum + row.__applied, 0)),
    discountDetails: [...discounts, ...charges].map(
      ({ __applied, ...row }) => row,
    ),
  };
};

const buildTaxPayload = ({ items, party, company, adjustments }) => {
  const lineBases = items.map((item) =>
    round2(num(item.qty) * num(item.basicPrice)),
  );
  const lineDiscounts = items.map((item, index) =>
    round2(
      (lineBases[index] * Math.max(0, num(item.discountPercentage))) / 100,
    ),
  );
  const netLineBases = lineBases.map((lineBase, index) =>
    round2(Math.max(0, lineBase - lineDiscounts[index])),
  );
  const baseTotal = round2(netLineBases.reduce((sum, value) => sum + value, 0));
  const adjustmentResult = applyAdjustments(baseTotal, adjustments);
  const discountTotal = adjustmentResult.discountTotal;

  let allocatedSoFar = 0;
  const discountAllocations = netLineBases.map((lineBase, index) => {
    if (!discountTotal || !baseTotal) return 0;
    if (index === netLineBases.length - 1) {
      return round2(discountTotal - allocatedSoFar);
    }
    const allocated = round2((discountTotal * lineBase) / baseTotal);
    allocatedSoFar = round2(allocatedSoFar + allocated);
    return allocated;
  });

  const partyStateCode = getPartyStateCode(party);
  const companyStateCode = getCompanyStateCode(company);
  const igstTaxType = Boolean(
    partyStateCode && companyStateCode && partyStateCode !== companyStateCode,
  );

  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  const gstDetails = [];
  const orderItems = [];

  items.forEach((item, index) => {
    const lineBase = lineBases[index];
    const netLineBase = netLineBases[index];
    const taxable = round2(
      Math.max(0, netLineBase - discountAllocations[index]),
    );
    const gstPercentage = Math.max(0, num(item.gstPercentage));
    const gstAmount = round2((taxable * gstPercentage) / 100);
    const igst = igstTaxType ? gstAmount : 0;
    const cgst = igstTaxType ? 0 : round2(gstAmount / 2);
    const sgst = igstTaxType ? 0 : round2(gstAmount - cgst);
    const grandTotal = round2(taxable + igst + cgst + sgst);
    const hsn = str(
      item.hsn || item.product?.HSN_Code || item.product?.hsn || "NA",
    );

    cgstTotal = round2(cgstTotal + cgst);
    sgstTotal = round2(sgstTotal + sgst);
    igstTotal = round2(igstTotal + igst);

    gstDetails.push({
      hsn,
      taxable,
      gstPercentage,
      centralTax: [{ rate: igstTaxType ? 0 : gstPercentage / 2, amount: cgst }],
      stateTax: [{ rate: igstTaxType ? 0 : gstPercentage / 2, amount: sgst }],
      igstTax: [{ rate: igstTaxType ? gstPercentage : 0, amount: igst }],
      cgstRate: cgst,
      sgstRate: sgst,
      igstRate: igst,
      discountPercentage: round2(
        Math.max(0, num(item.discountPercentage)) +
          (netLineBase > 0
            ? (discountAllocations[index] / netLineBase) * 100
            : 0),
      ),
      withoutDiscountAmount: lineBase,
      withDiscountAmount: taxable,
      withoutTaxablePrice: lineBase,
      basicPrice: taxable,
      grandTotal,
      igstTaxType,
    });

    orderItems.push({
      productId: idOf(item.product),
      warehouse: item.warehouseId,
      discountPercentage: Math.max(0, num(item.discountPercentage)),
      qty: num(item.qty),
      price: num(item.basicPrice),
      salePrice: round2(num(item.basicPrice) * (1 + gstPercentage / 100)),
      primaryUnit: item.primaryUnit,
      secondaryUnit: item.secondaryUnit,
      secondarySize: num(item.secondarySize),
      totalPrice: lineBase,
      sgstRate: sgst,
      cgstRate: cgst,
      gstPercentage,
      igstRate: igst,
      grandTotal,
      taxableAmount: taxable,
      totalPriceWithDiscount: grandTotal,
      igstTaxType,
    });
  });

  const highestGST = items.reduce(
    (highest, item) => Math.max(highest, num(item.gstPercentage)),
    0,
  );
  const chargesTax = round2((adjustmentResult.chargesTotal * highestGST) / 100);
  const chargesIgst = igstTaxType ? chargesTax : 0;
  const chargesCgst = igstTaxType ? 0 : round2(chargesTax / 2);
  const chargesSgst = igstTaxType ? 0 : round2(chargesTax - chargesCgst);

  cgstTotal = round2(cgstTotal + chargesCgst);
  sgstTotal = round2(sgstTotal + chargesSgst);
  igstTotal = round2(igstTotal + chargesIgst);

  const amount = round2(adjustmentResult.running);
  const grossBeforeRound = round2(amount + cgstTotal + sgstTotal + igstTotal);
  const roundedGrandTotal = Math.round(grossBeforeRound);
  const roundOff = round2(roundedGrandTotal - grossBeforeRound);

  const hsnMap = new Map();
  gstDetails.forEach((detail) => {
    const key = `${detail.hsn}__${detail.gstPercentage}`;
    const current = hsnMap.get(key) || {
      hsn: detail.hsn,
      taxable: 0,
      gstPercentage: detail.gstPercentage,
      centralTax: [{ rate: detail.centralTax?.[0]?.rate || 0, amount: 0 }],
      stateTax: [{ rate: detail.stateTax?.[0]?.rate || 0, amount: 0 }],
      igstTax: [{ rate: detail.igstTax?.[0]?.rate || 0, amount: 0 }],
      basicPrice: 0,
      grandTotal: 0,
    };
    current.taxable = round2(current.taxable + detail.taxable);
    current.centralTax[0].amount = round2(
      current.centralTax[0].amount + num(detail.centralTax?.[0]?.amount),
    );
    current.stateTax[0].amount = round2(
      current.stateTax[0].amount + num(detail.stateTax?.[0]?.amount),
    );
    current.igstTax[0].amount = round2(
      current.igstTax[0].amount + num(detail.igstTax?.[0]?.amount),
    );
    current.basicPrice = round2(current.basicPrice + detail.basicPrice);
    current.grandTotal = round2(current.grandTotal + detail.grandTotal);
    hsnMap.set(key, current);
  });

  return {
    baseTotal,
    amount,
    grandTotal: roundedGrandTotal,
    roundOff,
    cgstTotal,
    sgstTotal,
    igstTotal,
    chargesCgst,
    chargesSgst,
    chargesIgst,
    igstTaxType,
    gstDetails,
    hsnData: Array.from(hsnMap.values()),
    orderItems,
    discountDetails: adjustmentResult.discountDetails,
  };
};

const customerIdentityKeys = (customer, fallbackRow = {}) => {
  const keys = [];
  const customerId = idOf(customer);
  const gst = getCustomerGST(customer) || gstKey(fallbackRow?.gstNumber);
  const phones = [
    ...phoneKeys(getCustomerPhone(customer)),
    ...phoneKeys(firstValue(fallbackRow?.MobileNo, fallbackRow?.contactNumber)),
  ];
  const name = canonical(getCustomerName(customer) || fallbackRow?.fullName);

  if (customerId) keys.push(`id:${canonical(customerId)}`);
  if (gst) keys.push(`gst:${canonical(gst)}`);
  phones.forEach((phone) => keys.push(`phone:${canonical(phone)}`));
  if (name) keys.push(`name:${name}`);

  return Array.from(new Set(keys.filter(Boolean)));
};

const duplicateKeysFor = (invoiceNumber, date, customer, fallbackRow = {}) => {
  const prefix = `${canonical(invoiceNumber)}__${toISODate(date)}__`;
  return customerIdentityKeys(customer, fallbackRow).map(
    (key) => `${prefix}${key}`,
  );
};

const existingRowsFromResponse = (response) => [
  ...(Array.isArray(response?.b2bData) ? response.b2bData : []),
  ...(Array.isArray(response?.b2csData) ? response.b2csData : []),
  ...(Array.isArray(response?.b2clData) ? response.b2clData : []),
  ...(Array.isArray(response?.orderHistory) ? response.orderHistory : []),
];

const existingKeysForRow = (row) =>
  duplicateKeysFor(row?.invoiceId, row?.date, row?.partyId || {}, row);

const getUserInfo = () => {
  const userData = JSON.parse(localStorage.getItem("userData") || "{}");
  const company = JSON.parse(localStorage.getItem("Companydetail") || "{}");
  const mainDatabase =
    userData?.database ||
    userData?.Database ||
    localStorage.getItem("database") ||
    localStorage.getItem("Database") ||
    "";
  return { userData, company, mainDatabase };
};

const loadMasters = async () => {
  const { userData, company, mainDatabase } = getUserInfo();
  if (!mainDatabase)
    throw new Error("Main database was not found in localStorage userData.");

  const ownerId =
    userData?.rolename?.roleName === "SuperAdmin"
      ? userData?._id
      : userData?.created_by || userData?._id;

  const [customerResult, productResult, warehouseResult] = await Promise.all([
    CreateCustomerList(ownerId, mainDatabase),
    _Get(PurchaseProductList_Product, mainDatabase),
    _Get(Create_Warehouse_List, mainDatabase).catch(() => ({ Warehouse: [] })),
  ]);

  return {
    userData,
    company,
    mainDatabase,
    customers: Array.isArray(customerResult?.Customer)
      ? customerResult.Customer
      : [],
    products: Array.isArray(productResult?.Product)
      ? productResult.Product
      : [],
    warehouses: Array.isArray(warehouseResult?.Warehouse)
      ? warehouseResult.Warehouse
      : [],
  };
};

const setWidths = (sheet, widths) => {
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  sheet["!autofilter"] = {
    ref: sheet["!ref"] || `A1:${XLSX.utils.encode_col(widths.length - 1)}1`,
  };
};

export const downloadSalesBulkFormat = async () => {
  try {
    const { customers, products } = await loadMasters();
    const workbook = XLSX.utils.book_new();

    const instructions = [
      ["SALES INVOICE BULK UPLOAD — SIMPLE FORMAT"],
      [],
      ["Rule", "Details"],
      ["Customer", "GST No. is searched first in V2 Customer Master. The customer _id is resolved automatically."],
      ["Product", "Enter the old/simple product description. Rupio finds the nearest V2 Product Master matches."],
      ["Confused product", "If the product match is not certain, the preview row is highlighted and the nearest V2 products appear in a dropdown for manual confirmation."],
      ["Qty / Rate", "Qty and Rate are transaction values from Excel. HSN, GST %, units, warehouse and other product fields come from the selected V2 Product Master."],
      ["Multiple products", "Repeat Date + Invoice No. + GST No. for every product row. Those rows are grouped into one invoice."],
      ["Date", "Use YYYY-MM-DD."],
      ["Discount %", "Optional line discount. Use 0 or leave blank when there is no discount."],
      ["IDs", "Do not enter MongoDB customer/product IDs."],
    ];
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
    setWidths(instructionSheet, [24, 110]);
    XLSX.utils.book_append_sheet(workbook, instructionSheet, "Instructions");

    const uploadHeaders = [
      "Date",
      "Invoice No.",
      "GST No.",
      "Product",
      "Qty",
      "Unit",
      "Rate",
      "Discount %",
    ];
    const uploadSheet = XLSX.utils.aoa_to_sheet([uploadHeaders]);
    setWidths(uploadSheet, [14, 16, 20, 42, 14, 16, 16, 14]);
    XLSX.utils.book_append_sheet(workbook, uploadSheet, "Sales Upload");

    const customerRows = customers.map((customer) => ({
      "Customer Name": getCustomerName(customer),
      GSTIN: getCustomerGST(customer),
      Mobile: digits(getCustomerPhone(customer)),
    }));
    const customerSheet = XLSX.utils.json_to_sheet(customerRows, {
      header: ["Customer Name", "GSTIN", "Mobile"],
    });
    setWidths(customerSheet, [40, 20, 18]);
    XLSX.utils.book_append_sheet(workbook, customerSheet, "Customer Reference");

    const productRows = products.map((product) => ({
      "V2 Product Name": getProductName(product),
      "Product Code/SKU": firstValue(
        product?.Product_Code,
        product?.productCode,
        product?.SKU,
        product?.sku,
        product?.ItemCode,
      ),
      HSN: firstValue(product?.HSN_Code, product?.HSN, product?.hsn),
      "GST %": getProductGST(product),
      "Primary Unit": product?.primaryUnit || "",
    }));
    const productSheet = XLSX.utils.json_to_sheet(productRows, {
      header: ["V2 Product Name", "Product Code/SKU", "HSN", "GST %", "Primary Unit"],
    });
    setWidths(productSheet, [46, 22, 14, 12, 18]);
    XLSX.utils.book_append_sheet(workbook, productSheet, "Product Reference");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "Sales_Invoice_Bulk_Upload_Format.xlsx",
    );
  } catch (error) {
    console.error("Download sales bulk format error:", error);
    swal(
      "Unable to download format",
      error?.message || "Please try again.",
      "error",
    );
  }
};

const parseWorkbook = async (file) => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: true });

  // Preferred simple format used by the current DMS migration sheet.
  const simpleSheet = findSheet(workbook, [
    "Sales Upload",
    "Sales Bulk Upload",
    "Bulk Upload",
  ]);

  if (simpleSheet) {
    const rows = sheetRows(simpleSheet);
    const invoicesByKey = new Map();
    const items = [];
    let lastDate = "";
    let lastInvoiceNo = "";
    let lastGST = "";

    rows.forEach((row, index) => {
      const date = toISODate(read(row, "Date", "Invoice Date")) || lastDate;
      const invoiceNumber =
        str(read(row, "Invoice No.", "Invoice No", "Invoice Number", "invoiceId")) ||
        lastInvoiceNo;
      const customerGSTIN =
        str(read(row, "GST No.", "GST No", "GST Number", "GSTIN", "Customer GSTIN")) ||
        lastGST;

      if (date) lastDate = date;
      if (invoiceNumber) lastInvoiceNo = invoiceNumber;
      if (customerGSTIN) lastGST = customerGSTIN;

      const productName = str(read(row, "Product", "Product Name", "Item Name"));
      const qty = num(read(row, "Qty", "Quantity"));
      const basicPrice = num(read(row, "Rate", "Basic Price", "Price"));
      const unit = str(read(row, "Unit", "Primary Unit"));
      const discountPercentage = num(read(row, "Discount %", "Discount Percentage"));

      // Ignore completely blank carry-forward rows.
      if (!date && !invoiceNumber && !customerGSTIN && !productName) return;

      const key = `${date}__${canonical(invoiceNumber)}__${gstKey(customerGSTIN)}`;
      const importReference = key;

      if (!invoicesByKey.has(key)) {
        invoicesByKey.set(key, {
          sourceRow: index + 2,
          importReference,
          invoiceNumber,
          invoiceDate: date,
          customerName: "",
          customerGSTIN,
          customerMobile: "",
          remark: "",
          arn: "",
          paidAmount: 0,
          paymentVerified: false,
          expectedGrandTotal: 0,
        });
      }

      if (productName || qty || basicPrice) {
        items.push({
          sourceRow: index + 2,
          importReference,
          productName,
          productCode: "",
          hsn: "",
          qty,
          basicPrice,
          discountPercentage,
          gstPercentage: 0,
          warehouseName: "",
          primaryUnit: unit,
          secondaryUnit: "",
          secondarySize: 0,
        });
      }
    });

    return {
      format: "simple",
      invoices: Array.from(invoicesByKey.values()),
      items,
      adjustments: [],
    };
  }

  // Backward compatibility with the older multi-sheet format.
  const invoiceSheet = findSheet(workbook, [
    "Sales Invoices",
    "Sales Invoice",
    "Invoices",
    "Invoice",
  ]);
  const itemSheet = findSheet(workbook, [
    "Invoice Items",
    "Sales Invoice Items",
    "Items",
    "Products",
  ]);
  const adjustmentSheet = findSheet(workbook, [
    "Adjustments",
    "Discount Charges",
    "Discounts and Charges",
  ]);

  if (!invoiceSheet)
    throw new Error('Sheet "Sales Upload" or "Sales Invoices" was not found.');
  if (!itemSheet) throw new Error('Sheet "Invoice Items" was not found.');

  const rawInvoices = sheetRows(invoiceSheet);
  const rawItems = sheetRows(itemSheet);
  const rawAdjustments = sheetRows(adjustmentSheet);

  const invoices = rawInvoices.map((row, index) => ({
    sourceRow: index + 2,
    importReference: str(
      read(row, "Import Reference", "Import Ref", "Reference"),
    ),
    invoiceNumber: str(read(row, "Invoice Number", "Invoice No", "invoiceId")),
    invoiceDate: toISODate(read(row, "Invoice Date", "Date")),
    customerName: str(read(row, "Customer Name", "Party Name", "fullName")),
    customerGSTIN: str(read(row, "Customer GSTIN", "GSTIN", "GST Number")),
    customerMobile: str(
      read(row, "Customer Mobile", "Mobile", "Mobile No", "Phone"),
    ),
    remark: str(read(row, "Remark", "Remarks")),
    arn: str(read(row, "ARN")),
    paidAmount: num(read(row, "Paid Amount")),
    paymentVerified: ["yes", "true", "1", "paid", "verified"].includes(
      canonical(read(row, "Payment Verified", "Paid")),
    ),
    expectedGrandTotal: num(read(row, "Expected Grand Total", "Grand Total")),
  }));

  const items = rawItems.map((row, index) => ({
    sourceRow: index + 2,
    importReference: str(
      read(row, "Import Reference", "Import Ref", "Reference"),
    ),
    productName: str(read(row, "Product Name", "Item Name", "Product")),
    productCode: str(
      read(row, "Product Code/SKU", "Product Code", "SKU", "Item Code"),
    ),
    hsn: str(read(row, "HSN", "HSN Code")),
    qty: num(read(row, "Quantity", "Qty")),
    basicPrice: num(read(row, "Basic Price", "Price", "Rate")),
    discountPercentage: num(read(row, "Discount %", "Discount Percentage")),
    gstPercentage: num(read(row, "GST %", "GST Percentage", "GST Rate")),
    warehouseName: str(read(row, "Warehouse Name", "Warehouse")),
    primaryUnit: str(read(row, "Primary Unit", "Unit")),
    secondaryUnit: str(read(row, "Secondary Unit")),
    secondarySize: num(read(row, "Secondary Size")),
  }));

  const adjustments = rawAdjustments.map((row, index) => ({
    sourceRow: index + 2,
    importReference: str(
      read(row, "Import Reference", "Import Ref", "Reference"),
    ),
    type: str(read(row, "Type")),
    title: str(read(row, "Title")),
    calculationType: str(
      read(row, "Calculation Type", "Calculation", "Value Type"),
    ),
    value: num(read(row, "Value", "Percentage", "Amount")),
  }));

  return { format: "legacy", invoices, items, adjustments };
};

const validateAndPrepare = async (
  parsed,
  manualSelections = {},
  masterOverride = null,
) => {
  const master = masterOverride || (await loadMasters());
  const itemsByReference = new Map();
  const adjustmentsByReference = new Map();

  parsed.items.forEach((item) => {
    const key = canonical(item.importReference);
    if (!itemsByReference.has(key)) itemsByReference.set(key, []);
    itemsByReference.get(key).push(item);
  });

  parsed.adjustments.forEach((adjustment) => {
    const key = canonical(adjustment.importReference);
    if (!adjustmentsByReference.has(key)) adjustmentsByReference.set(key, []);
    adjustmentsByReference.get(key).push(adjustment);
  });

  const financialYears = Array.from(
    new Set(
      parsed.invoices
        .map((invoice) => invoice.invoiceDate)
        .filter(Boolean)
        .map(getFinancialYearLabel),
    ),
  );

  const existingByDatabase = new Map();
  await Promise.all(
    financialYears.map(async (financialYear) => {
      const database = `${master.mainDatabase}-${financialYear}`;
      try {
        const response = await createOrderhistoryviewDATABASE(database);
        existingByDatabase.set(
          database,
          new Set(
            existingRowsFromResponse(response).flatMap(existingKeysForRow),
          ),
        );
      } catch (error) {
        // A new FY database may legitimately have no records yet.
        if (error?.response?.status === 404 || error?.status === 404) {
          existingByDatabase.set(database, new Set());
          return;
        }
        throw error;
      }
    }),
  );

  const importReferences = new Set();
  const fileDuplicateKeys = new Set();
  const results = [];

  for (const invoice of parsed.invoices) {
    const messages = [];
    const referenceKey = canonical(invoice.importReference);

    if (!invoice.importReference)
      messages.push("Import Reference is required.");
    if (referenceKey && importReferences.has(referenceKey)) {
      messages.push(
        `Import Reference ${invoice.importReference} is repeated in Sales Invoices.`,
      );
    }
    if (referenceKey) importReferences.add(referenceKey);

    if (!invoice.invoiceNumber) messages.push("Invoice Number is required.");
    if (!invoice.invoiceDate)
      messages.push("A valid Invoice Date is required.");
    if (
      !invoice.customerName &&
      !invoice.customerGSTIN &&
      !invoice.customerMobile
    ) {
      messages.push("Customer Name, GSTIN or Mobile is required.");
    }

    const sourceItems = itemsByReference.get(referenceKey) || [];
    if (!sourceItems.length)
      messages.push("No rows were found in Invoice Items.");

    const customerResolution = resolveCustomer(invoice, master.customers);
    if (customerResolution.error) messages.push(customerResolution.error);
    const party = customerResolution.value;

    const resolvedItems = [];
    const reviewItems = [];
    sourceItems.forEach((sourceItem) => {
      const prefix = `Invoice Items row ${sourceItem.sourceRow}: `;
      if (sourceItem.qty <= 0)
        messages.push(`${prefix}Quantity must be greater than zero.`);
      if (sourceItem.basicPrice < 0)
        messages.push(`${prefix}Basic Price cannot be negative.`);
      if (sourceItem.gstPercentage < 0)
        messages.push(`${prefix}GST % cannot be negative.`);

      const reviewKey = `${referenceKey}__${sourceItem.sourceRow}`;
      const productResolution = resolveProduct(
        sourceItem,
        master.products,
        manualSelections[reviewKey],
      );
      if (productResolution.error) {
        messages.push(`${prefix}${productResolution.error}`);
        return;
      }

      const product = productResolution.value;
      if (productResolution.confused) {
        reviewItems.push({
          reviewKey,
          sourceRow: sourceItem.sourceRow,
          excelProduct: sourceItem.productName || sourceItem.productCode,
          nearestProductId: idOf(product),
          nearestProductName: getProductName(product),
          score: productResolution.score || 0,
          candidates: productResolution.candidates || [],
        });
      }
      const warehouseResolution = resolveWarehouse(
        sourceItem.warehouseName,
        product,
        master.warehouses,
      );
      if (warehouseResolution.error) {
        messages.push(`${prefix}${warehouseResolution.error}`);
        return;
      }

      resolvedItems.push({
        ...sourceItem,
        product,
        warehouseId: warehouseResolution.id,
        productName: sourceItem.productName || getProductName(product),
        hsn:
          sourceItem.hsn ||
          firstValue(product?.HSN_Code, product?.HSN, product?.hsn),
        gstPercentage: sourceItem.gstPercentage || getProductGST(product),
        discountPercentage: Math.max(0, num(sourceItem.discountPercentage)),
        primaryUnit: sourceItem.primaryUnit || product?.primaryUnit || "",
        secondaryUnit: sourceItem.secondaryUnit || product?.secondaryUnit || "",
        secondarySize: sourceItem.secondarySize || num(product?.secondarySize),
      });
    });

    const sourceAdjustments = adjustmentsByReference.get(referenceKey) || [];
    sourceAdjustments.forEach((adjustment) => {
      const type = canonical(adjustment.type);
      const calculation = canonical(adjustment.calculationType);
      if (!["discount", "charges"].includes(type)) {
        messages.push(
          `Adjustments row ${adjustment.sourceRow}: Type must be Discount or Charges.`,
        );
      }
      if (!["percentage", "amount"].includes(calculation)) {
        messages.push(
          `Adjustments row ${adjustment.sourceRow}: Calculation Type must be Percentage or Amount.`,
        );
      }
      if (adjustment.value < 0) {
        messages.push(
          `Adjustments row ${adjustment.sourceRow}: Value cannot be negative.`,
        );
      }
    });

    let payload = null;
    let duplicate = false;
    let warning = "";
    let database = "";
    let keys = [];

    if (!messages.length && party && resolvedItems.length) {
      const financialYear = getFinancialYearLabel(invoice.invoiceDate);
      database = `${master.mainDatabase}-${financialYear}`;
      keys = duplicateKeysFor(
        invoice.invoiceNumber,
        invoice.invoiceDate,
        party,
        invoice,
      );

      const duplicateInFile = keys.some((key) =>
        fileDuplicateKeys.has(`${database}__${key}`),
      );
      const duplicateInDatabase = keys.some((key) =>
        existingByDatabase.get(database)?.has(key),
      );

      if (duplicateInFile) {
        duplicate = true;
        warning = "Duplicate invoice inside this Excel file.";
      } else if (duplicateInDatabase) {
        duplicate = true;
        warning = "Invoice already exists in the destination database.";
      }
      keys.forEach((key) => fileDuplicateKeys.add(`${database}__${key}`));

      const tax = buildTaxPayload({
        items: resolvedItems,
        party,
        company: master.company,
        adjustments: sourceAdjustments,
      });

      if (
        invoice.expectedGrandTotal > 0 &&
        Math.abs(invoice.expectedGrandTotal - tax.grandTotal) > 1
      ) {
        warning = `${warning ? `${warning} ` : ""}Calculated total ₹${tax.grandTotal.toFixed(2)} differs from Expected Grand Total ₹${invoice.expectedGrandTotal.toFixed(2)}.`;
      }

      const bank = master.company?.bankDetails?.[0] || {};
      const arnStatus = tax.grandTotal > 49999;
      const partyCreatedBy = idOf(party?.created_by) || master.userData?._id;

      payload = {
        userId: partyCreatedBy,
        partyId: idOf(party),
        invoiceId: invoice.invoiceNumber,
        basicPrice: tax.amount,
        database,
        financialYear,
        ARN: arnStatus ? invoice.arn : "",
        ARNStatus: arnStatus,
        discountPercentage: 0,
        SuperAdmin:
          idOf(master.company?.created_by) ||
          idOf(master.userData?.created_by) ||
          master.userData?._id,
        fullName: getCustomerName(party),
        address: firstValue(party?.address, party?.ownerAddress),
        igstTaxType: tax.igstTaxType,
        grandTotal: tax.grandTotal,
        roundOff: tax.roundOff,
        ChargesCgst: tax.chargesCgst,
        ChargesSgst: tax.chargesSgst,
        ChargesIgst: tax.chargesIgst,
        amount: tax.amount,
        sgstTotal: tax.sgstTotal,
        cgstTotal: tax.cgstTotal,
        igstTotal: tax.igstTotal,
        gstDetails: tax.gstDetails,
        hsnData: tax.hsnData,
        MobileNo: firstValue(party?.contactNumber, party?.MobileNo),
        pincode: firstValue(party?.pincode, party?.Pincode),
        state: firstValue(party?.State, party?.state),
        date: invoice.invoiceDate,
        city: firstValue(party?.City, party?.city),
        orderItems: tax.orderItems,
        DateofDelivery: "",
        geotagging: "",
        discountDetails: tax.discountDetails,
        upiId: bank?.upiId || "",
        accountNumber: bank?.accountNumber || "",
        bankDetails: bank?._id || "",
        bankIFSC: bank?.bankIFSC || "",
        merchantName: master.company?.name || "",
        Remark: invoice.remark,
        paidAmount: invoice.paidAmount,
        paymentVerified: invoice.paymentVerified,
        status: "completed",
        invoiceType: "sales",
      };
    }

    if (reviewItems.length && !messages.length && !duplicate) {
      warning = `${reviewItems.length} product match${
        reviewItems.length > 1 ? "es need" : " needs"
      } manual confirmation.`;
    }

    results.push({
      ...invoice,
      customerName: getCustomerName(party) || invoice.customerName,
      customerGSTIN: getCustomerGST(party) || invoice.customerGSTIN,
      party,
      database,
      duplicateKeys: keys,
      itemCount: sourceItems.length,
      reviewItems,
      calculatedGrandTotal: payload?.grandTotal || 0,
      status: messages.length
        ? "ERROR"
        : duplicate
          ? "SKIP"
          : reviewItems.length
            ? "REVIEW"
            : "READY",
      messages,
      warning,
      payload,
    });
  }

  const usedReferences = new Set(
    parsed.invoices.map((invoice) => canonical(invoice.importReference)),
  );
  parsed.items.forEach((item) => {
    if (
      item.importReference &&
      !usedReferences.has(canonical(item.importReference))
    ) {
      results.push({
        importReference: item.importReference,
        invoiceNumber: "-",
        invoiceDate: "",
        customerName: "",
        itemCount: 1,
        calculatedGrandTotal: 0,
        status: "ERROR",
        messages: [
          `Invoice Items row ${item.sourceRow} refers to an Import Reference not present in Sales Invoices.`,
        ],
        warning: "",
        payload: null,
      });
    }
  });

  return { results, master };
};

const statusColor = {
  READY: "success",
  REVIEW: "warning",
  SKIP: "warning",
  ERROR: "danger",
  UPLOADED: "primary",
  FAILED: "danger",
};

export default function SalesBulkUploadModal({ isOpen, toggle, onUploaded }) {
  const inputRef = useRef(null);
  const masterRef = useRef(null);
  const [manualSelections, setManualSelections] = useState({});
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [results, setResults] = useState([]);
  const [reading, setReading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    const count = (status) =>
      results.filter((row) => row.status === status).length;
    return {
      total: results.length,
      ready: count("READY"),
      review: count("REVIEW"),
      skip: count("SKIP"),
      error: count("ERROR"),
      uploaded: count("UPLOADED"),
      failed: count("FAILED"),
    };
  }, [results]);

  const reset = () => {
    setFile(null);
    setParsed(null);
    setResults([]);
    setReading(false);
    setValidating(false);
    setUploading(false);
    setProgress(0);
    setError("");
    setManualSelections({});
    masterRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    if (uploading) return;
    reset();
    toggle();
  };

  const onFileChange = async (event) => {
    const selected = event.target.files?.[0];
    reset();
    if (!selected) return;

    if (!/\.(xlsx|xls)$/i.test(selected.name)) {
      setError("Please select an Excel .xlsx or .xls file.");
      return;
    }

    setFile(selected);
    setReading(true);
    try {
      const nextParsed = await parseWorkbook(selected);
      setParsed(nextParsed);
    } catch (parseError) {
      console.error("Sales bulk parse error:", parseError);
      setError(parseError?.message || "Unable to read the Excel file.");
    } finally {
      setReading(false);
    }
  };

  const validate = async () => {
    if (!parsed) return;
    setValidating(true);
    setError("");
    setResults([]);
    try {
      const prepared = await validateAndPrepare(
        parsed,
        manualSelections,
        masterRef.current,
      );
      masterRef.current = prepared.master;
      setResults(prepared.results);
    } catch (validationError) {
      console.error("Sales bulk validation error:", validationError);
      setError(
        validationError?.response?.data?.message ||
          validationError?.message ||
          "Unable to validate the bulk upload file.",
      );
    } finally {
      setValidating(false);
    }
  };

  const confirmProductSelection = async (reviewKey, productId) => {
    if (!parsed || !productId) return;
    const nextSelections = {
      ...manualSelections,
      [reviewKey]: productId,
    };
    setManualSelections(nextSelections);
    setValidating(true);
    setError("");
    try {
      const prepared = await validateAndPrepare(
        parsed,
        nextSelections,
        masterRef.current,
      );
      masterRef.current = prepared.master;
      setResults(prepared.results);
    } catch (selectionError) {
      console.error("Product match confirmation error:", selectionError);
      setError(
        selectionError?.response?.data?.message ||
          selectionError?.message ||
          "Unable to apply the selected product.",
      );
    } finally {
      setValidating(false);
    }
  };

  const upload = async () => {
    const readyRows = results.filter(
      (row) => row.status === "READY" && row.payload,
    );
    if (!readyRows.length) {
      swal("Nothing to upload", "There are no Ready invoices.", "info");
      return;
    }

    const confirm = await swal({
      title: `Upload ${readyRows.length} invoices?`,
      text: "Invoices will be uploaded sequentially. Existing duplicates will be skipped.",
      icon: "warning",
      buttons: ["Cancel", "Upload"],
    });
    if (!confirm) return;

    setUploading(true);
    setProgress(0);
    setError("");

    const refreshedSets = new Map();
    const databases = Array.from(new Set(readyRows.map((row) => row.database)));

    try {
      for (const database of databases) {
        try {
          const response = await createOrderhistoryviewDATABASE(database);
          refreshedSets.set(
            database,
            new Set(
              existingRowsFromResponse(response).flatMap(existingKeysForRow),
            ),
          );
        } catch (refreshError) {
          if (
            refreshError?.response?.status === 404 ||
            refreshError?.status === 404
          )
            refreshedSets.set(database, new Set());
          else throw refreshError;
        }
      }

      let completed = 0;
      const nextResults = [...results];

      for (const row of readyRows) {
        const resultIndex = nextResults.findIndex(
          (item) =>
            item.importReference === row.importReference &&
            item.invoiceNumber === row.invoiceNumber &&
            item.status === "READY",
        );

        const databaseSet = refreshedSets.get(row.database) || new Set();
        const becameDuplicate = (row.duplicateKeys || []).some((key) =>
          databaseSet.has(key),
        );
        if (becameDuplicate) {
          nextResults[resultIndex] = {
            ...nextResults[resultIndex],
            status: "SKIP",
            warning:
              "Invoice was created after validation and has now been skipped as a duplicate.",
          };
        } else {
          try {
            const response = await _PostSave(
              Create_Existing_Invoice,
              row.payload,
            );
            const failed = response?.status === false;
            if (failed) {
              throw new Error(
                response?.message || "Server rejected the invoice.",
              );
            }

            (row.duplicateKeys || []).forEach((key) => databaseSet.add(key));
            refreshedSets.set(row.database, databaseSet);
            nextResults[resultIndex] = {
              ...nextResults[resultIndex],
              status: "UPLOADED",
              warning: response?.message || "Invoice uploaded successfully.",
            };
          } catch (uploadError) {
            const message =
              uploadError?.response?.data?.message ||
              uploadError?.message ||
              "Upload failed.";
            const duplicateError =
              /duplicate|already exists|invoice.*exist/i.test(message);
            nextResults[resultIndex] = {
              ...nextResults[resultIndex],
              status: duplicateError ? "SKIP" : "FAILED",
              warning: message,
            };
            if (duplicateError) {
              (row.duplicateKeys || []).forEach((key) => databaseSet.add(key));
            }
          }
        }

        completed += 1;
        setProgress(Math.round((completed / readyRows.length) * 100));
        setResults([...nextResults]);
      }

      setResults(nextResults);
      const uploadedCount = nextResults.filter(
        (row) => row.status === "UPLOADED",
      ).length;
      const skippedCount = nextResults.filter(
        (row) => row.status === "SKIP",
      ).length;
      const failedCount = nextResults.filter(
        (row) => row.status === "FAILED",
      ).length;

      await swal(
        "Bulk upload completed",
        `${uploadedCount} uploaded, ${skippedCount} skipped, ${failedCount} failed.`,
        failedCount ? "warning" : "success",
      );

      if (uploadedCount && typeof onUploaded === "function") {
        await onUploaded();
      }
    } catch (uploadBatchError) {
      console.error("Sales bulk upload error:", uploadBatchError);
      setError(
        uploadBatchError?.response?.data?.message ||
          uploadBatchError?.message ||
          "Bulk upload could not be completed.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      toggle={close}
      size="xl"
      backdrop={uploading ? "static" : true}
    >
      <ModalHeader toggle={close}>Bulk Upload Sales Invoices</ModalHeader>
      <ModalBody>
        {error && <Alert color="danger">{error}</Alert>}

        <div
          style={{
            border: "1px solid #dbe3ef",
            borderRadius: 12,
            padding: 12,
            background: "#f8fafc",
            marginBottom: 12,
          }}
        >
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <Button
              color="success"
              outline
              onClick={downloadSalesBulkFormat}
              disabled={uploading}
            >
              Download Bulk Format
            </Button>
            <Input
              innerRef={inputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={onFileChange}
              disabled={reading || validating || uploading}
              style={{ maxWidth: 430 }}
            />
            <Button
              color="primary"
              onClick={validate}
              disabled={!parsed || reading || validating || uploading}
            >
              {validating ? <Spinner size="sm" /> : "Validate File"}
            </Button>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
            {file ? (
              <>
                File: <strong>{file.name}</strong>
                {parsed && (
                  <span>
                    {` — ${parsed.invoices.length} invoice rows, ${parsed.items.length} item rows, ${parsed.adjustments.length} adjustment rows`}
                  </span>
                )}
              </>
            ) : (
              "Use the downloaded format. MongoDB IDs are not required."
            )}
          </div>
        </div>

        {reading && (
          <div className="text-center py-4">
            <Spinner />
            <div className="mt-2">Reading Excel file…</div>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div className="d-flex flex-wrap gap-2 mb-2">
              <Badge color="dark">Total {summary.total}</Badge>
              <Badge color="success">Ready {summary.ready}</Badge>
              <Badge color="warning">Review {summary.review}</Badge>
              <Badge color="warning">Skipped {summary.skip}</Badge>
              <Badge color="danger">Errors {summary.error}</Badge>
              {summary.uploaded > 0 && (
                <Badge color="primary">Uploaded {summary.uploaded}</Badge>
              )}
              {summary.failed > 0 && (
                <Badge color="danger">Failed {summary.failed}</Badge>
              )}
            </div>

            {uploading && (
              <div className="mb-3">
                <Progress value={progress}>{progress}%</Progress>
              </div>
            )}

            <div
              style={{
                maxHeight: 440,
                overflow: "auto",
                border: "1px solid #e5e7eb",
              }}
            >
              <Table size="sm" bordered hover responsive className="mb-0">
                <thead
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    background: "#f1f5f9",
                  }}
                >
                  <tr>
                    <th>Status</th>
                    <th>Import Reference</th>
                    <th>Invoice No.</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Product Match</th>
                    <th>Calculated Total</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, index) => (
                    <tr
                      key={`${row.importReference}-${row.invoiceNumber}-${index}`}
                      style={{
                        background:
                          row.status === "REVIEW"
                            ? "#fff7ed"
                            : row.status === "ERROR"
                              ? "#fef2f2"
                              : undefined,
                      }}
                    >
                      <td>
                        <Badge color={statusColor[row.status] || "secondary"}>
                          {row.status}
                        </Badge>
                      </td>
                      <td>{row.importReference || "-"}</td>
                      <td>{row.invoiceNumber || "-"}</td>
                      <td>{row.invoiceDate || "-"}</td>
                      <td>{row.customerName || "-"}</td>
                      <td className="text-center">{row.itemCount || 0}</td>
                      <td style={{ minWidth: 330 }}>
                        {row.reviewItems?.length ? (
                          <div className="d-flex flex-column gap-2">
                            {row.reviewItems.map((reviewItem) => (
                              <div
                                key={reviewItem.reviewKey}
                                style={{
                                  border: "1px solid #fdba74",
                                  background: "#fffbeb",
                                  borderRadius: 8,
                                  padding: 8,
                                }}
                              >
                                <div style={{ fontSize: 11, fontWeight: 700 }}>
                                  Excel: {reviewItem.excelProduct || "-"}
                                </div>
                                <div style={{ fontSize: 11, color: "#92400e" }}>
                                  Nearest: {reviewItem.nearestProductName} ({Number(
                                    reviewItem.score || 0,
                                  ).toFixed(1)}%)
                                </div>
                                <Input
                                  type="select"
                                  bsSize="sm"
                                  value={manualSelections[reviewItem.reviewKey] || ""}
                                  disabled={validating || uploading}
                                  onChange={(event) =>
                                    confirmProductSelection(
                                      reviewItem.reviewKey,
                                      event.target.value,
                                    )
                                  }
                                  style={{ marginTop: 5 }}
                                >
                                  <option value="">
                                    Select / confirm nearest V2 product
                                  </option>
                                  {reviewItem.candidates.map((candidate) => (
                                    <option
                                      key={candidate.productId}
                                      value={candidate.productId}
                                    >
                                      {candidate.productName} — {Number(
                                        candidate.score || 0,
                                      ).toFixed(1)}%
                                    </option>
                                  ))}
                                </Input>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#15803d", fontWeight: 700 }}>
                            Matched
                          </span>
                        )}
                      </td>
                      <td className="text-end">
                        {row.calculatedGrandTotal
                          ? Number(row.calculatedGrandTotal).toFixed(2)
                          : "-"}
                      </td>
                      <td style={{ minWidth: 320 }}>
                        {row.messages?.length > 0 && (
                          <div style={{ color: "#b91c1c" }}>
                            {row.messages.join(" | ")}
                          </div>
                        )}
                        {row.warning && (
                          <div style={{ color: "#92400e" }}>{row.warning}</div>
                        )}
                        {!row.messages?.length &&
                          !row.warning &&
                          "Ready to upload"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          color="primary"
          onClick={upload}
          disabled={!summary.ready || validating || reading || uploading}
        >
          {uploading ? (
            <>
              <Spinner size="sm" className="me-2" /> Uploading…
            </>
          ) : (
            `Upload Ready Invoices (${summary.ready})`
          )}
        </Button>
        <Button color="secondary" onClick={close} disabled={uploading}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
