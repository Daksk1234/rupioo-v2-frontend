# Bulk Scan & Fill — Sales and Purchase Invoices

Date: 2026-09-16

## What changed
- Added Sales Invoice document-AI extraction template.
- Added a shared Bulk Invoice Scan review/import UI to Sales Invoice and Purchase Invoice lists.
- Multiple PDF/JPG/PNG/WEBP/GIF invoices can be selected in one batch.
- Every invoice is scanned separately and shown in an expandable editable review before posting.
- Party/customer/supplier matching uses GSTIN/name against Customer Master.
- Product lines are matched to Product Master using SKU/name and remain manually selectable.
- Sales review requires Warehouse and uses the invoice date to select the financial-year database.
- Purchase review supports bill discount, other charges and landed-expense fields.
- Final posting uses the existing Sales/Purchase transaction APIs so stock, accounting, GST and ledgers are updated exactly like manual entry.
- A failure in one invoice does not stop the rest of the batch; failed invoices remain editable.
- Sales Scan & Fill imports can preserve the invoice number printed on the uploaded historical/source invoice. Normal manual Sales Invoice numbering remains unchanged.
- Each document scan remains in the Document Scan audit history.

## Required backend configuration
The existing Scan & Fill engine requires `OPENAI_API_KEY` on the backend. If it is not configured the review screen will show the existing clear configuration error; no invoice will be posted.

## Files
- frontend/src/components/BulkInvoiceScan.jsx
- frontend/src/pages/SalesInvoicePage.jsx
- frontend/src/pages/PurchaseInvoicePage.jsx
- frontend/src/smart-ui.css
- backend/src/config/documentForms.js
- backend/src/routes/documentAi.js
- backend/src/services/documentAiService.js
- backend/src/routes/transactions.js
