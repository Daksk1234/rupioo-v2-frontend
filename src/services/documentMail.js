import { getCurrentDatabase, sendCompanyDocumentMail } from "./smartMailApi";

const add = (fd, key, value) => {
  if (value !== undefined && value !== null && value !== "") fd.append(key, String(value));
};

export async function sendInvoiceByCompanyMail({ invoice, pdfBlob, database }) {
  const fd = new FormData();
  const party = invoice?.partyId || {};
  add(fd, "type", "invoice");
  add(fd, "to", party?.email || invoice?.email);
  add(fd, "invoiceId", invoice?.formattedInvoiceNo || invoice?.invoiceNo || invoice?.invoiceId);
  add(fd, "date", invoice?.date);
  add(fd, "total", invoice?.grandTotal);
  add(fd, "partyName", party?.CompanyName || invoice?.CompanyName || invoice?.partyName);
  add(fd, "address", party?.ownerAddress || party?.address || invoice?.address);
  add(fd, "CNDate", invoice?.CNDate);
  add(fd, "CNNumber", invoice?.CNNumber);
  add(fd, "CNQty", invoice?.CNQty);
  if (pdfBlob) fd.append("invoice", pdfBlob, `Invoice-${invoice?.invoiceId || "document"}.pdf`);
  return sendCompanyDocumentMail(database || getCurrentDatabase(), fd);
}

export async function sendLedgerByCompanyMail({ to, customerName, period, openingBalance, closingBalance, pdfBlob, database }) {
  const fd = new FormData();
  add(fd, "type", "ledger");
  add(fd, "to", to);
  add(fd, "customerName", customerName);
  add(fd, "period", period);
  add(fd, "openingBalance", openingBalance);
  add(fd, "closingBalance", closingBalance);
  if (pdfBlob) fd.append("ledger", pdfBlob, `Ledger-${customerName || "Customer"}.pdf`);
  return sendCompanyDocumentMail(database || getCurrentDatabase(), fd);
}

export async function sendPaymentRequestByCompanyMail({ to, customerName, amount, dueDate, invoiceId, upiId, pdfBlob, database }) {
  const fd = new FormData();
  add(fd, "type", "payment_request");
  add(fd, "to", to);
  add(fd, "customerName", customerName);
  add(fd, "amount", amount);
  add(fd, "dueDate", dueDate);
  add(fd, "invoiceId", invoiceId);
  add(fd, "upiId", upiId);
  if (pdfBlob) fd.append("document", pdfBlob, `Payment-Request-${invoiceId || "Outstanding"}.pdf`);
  return sendCompanyDocumentMail(database || getCurrentDatabase(), fd);
}

export async function sendReceiptByCompanyMail({ to, customerName, amount, receiptNo, paymentMode, pdfBlob, database }) {
  const fd = new FormData();
  add(fd, "type", "receipt");
  add(fd, "to", to);
  add(fd, "customerName", customerName);
  add(fd, "amount", amount);
  add(fd, "receiptNo", receiptNo);
  add(fd, "paymentMode", paymentMode);
  if (pdfBlob) fd.append("receipt", pdfBlob, `Receipt-${receiptNo || "Payment"}.pdf`);
  return sendCompanyDocumentMail(database || getCurrentDatabase(), fd);
}

export async function sendGenericCompanyMail({ type = "generic", to, cc, subject, message, fields = {}, files = [], database }) {
  const fd = new FormData();
  add(fd, "type", type);
  add(fd, "to", to);
  add(fd, "cc", cc);
  add(fd, "subject", subject);
  add(fd, "message", message);
  fd.append("fields", JSON.stringify(fields || {}));
  files.forEach((file, index) => fd.append(`attachment_${index + 1}`, file, file?.name || `attachment-${index + 1}`));
  return sendCompanyDocumentMail(database || getCurrentDatabase(), fd);
}
