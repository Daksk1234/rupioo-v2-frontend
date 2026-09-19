# Old DMS Ledger Port — 2026-09-15

## Purpose
Replaces the generic V2 `/dms/ledger` report screen with the old DMS ledger workflow and presentation while using V2 accounting data.

## Old DMS behaviour retained
- Party/account selector.
- Financial-year selection and opening balance carry-forward.
- Start/end date filter.
- Ledger columns: Date, Particular, Voucher Type, Voucher No, Debit, Credit.
- Opening Balance row.
- Closing Balance shown on the balancing side.
- Equal Debit/Credit Total row.
- Excel download.
- PDF download and print.
- Customer/supplier ledger email.
- Sales Invoice voucher number opens the invoice PDF.

## V2 accounting correction
The previous generic V2 Ledger query selected every posted journal line containing the same `partyGlobalId`. Since V2 balanced journals attach that party ID to both the party line and its counter-entries, this could make a party ledger cancel incorrectly. The new ledger filters the party by its actual configured Sundry Debtor/Creditor `accountCode` so the statement reflects the party account only.

## New report APIs
- `GET /api/reports/ledger/options`
- `GET /api/reports/ledger/statement`
- `GET /api/reports/ledger/export.xlsx`
- `GET /api/reports/ledger/pdf`
- Existing `POST /api/reports/ledger/email` now uses the old-style statement.

## Changed files
- `frontend/src/pages/LedgerPage.jsx`
- `frontend/src/pages/ModulePage.jsx`
- `backend/src/routes/reports.js`
- `backend/src/services/simplePdfService.js`
