# MASTER INVOICE TEMPLATE — V2 STANDARD

Date: 14-09-2026
Module: INVOICE
Status: ACTIVE / MASTER STANDARD

## Source template
The uploaded old-DMS `LastestInvoice(1).js` is the visual and calculation reference for the V2 Master Invoice Template.
A reference copy is preserved at:
`frontend/docs/master-invoice-reference/LastestInvoice_MASTER_REFERENCE.js`

## Rule
Do not create separate Sales Invoice designs for View, Print, Download or Email.
All Sales Invoice outputs must use the backend Master Invoice PDF generator:
`backend/src/services/masterInvoicePdfService.js`

## Current integrations
- Sales Invoice number click -> View/Print Master Invoice PDF.
- Sales Invoice row PDF button -> View/Print.
- Sales Invoice row Download button -> Download the same PDF.
- Delivered + Send Mail -> attaches the same Master Invoice PDF.
- Dynamic UPI payment QR -> Primary Bank UPI + invoice amount + invoice number.
- Company Logo / Authorized Signature / GPay number / Terms -> configured in Superadmin Profile.
- Ledger closing balance -> current V2 accounting ledger.
- Last payment -> most recent posted receipt for the customer in the selected financial year.

## Template sections retained
- Generated-in-Rupio banner
- Company logo/company details/GSTIN
- Payment QR
- Bill To / Ship To
- Invoice number/date/E-Way/ledger/last payment/transporter
- Product table
- HSN-wise GST summary
- Basic/discount/charges/taxable/CGST/SGST/IGST/round-off/grand total
- Primary bank account details
- Terms & conditions
- Payment details
- Authorized signature
- Cancelled invoice watermark

## Files changed
Frontend:
- `src/pages/SalesInvoicePage.jsx`
- `src/pages/SuperadminProfilePage.jsx`
- `src/docs/readme-history/2026-09-14__INVOICE__Master_Invoice_Template_Standard.md`

Backend:
- `src/services/masterInvoicePdfService.js` (new)
- `src/routes/transactions.js`
- `src/routes/profile.js`
- `src/models/index.js`
- `package.json`
- `START_BACKEND.bat`

## Dependencies
Backend requires:
- `pdfkit`
- `qrcode`

Run `npm install` in the backend folder after applying this release. `START_BACKEND.bat` also checks for these packages.
