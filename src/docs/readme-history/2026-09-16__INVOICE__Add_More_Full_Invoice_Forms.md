# Sales / Purchase Invoice — Add More Full Invoice Forms

Date: 2026-09-16

## Change
- Removed the separate `Multi Invoice Entry` workflow from Sales Invoice and Purchase Invoice list pages.
- Added `Add More Invoices` directly inside the normal Create Sales Invoice and Create Purchase Invoice pages.
- Every added invoice is a separate instance of the exact same existing Create Invoice page logic and UI.
- Each invoice block is expandable/collapsible and has its own complete fields, product rows, discounts/charges, tax/HSN summaries, landed-cost fields, transporter/warehouse logic, validations, and totals.
- Added `Submit All Invoices` when more than one invoice is present.
- Successful invoices can post while an invalid invoice remains available for correction.
- Edit mode remains single-invoice only and does not show Add More Invoices.

## Separate quick-entry page
The old `QuickMultiInvoiceEntry.jsx` component is no longer imported or reachable from Sales/Purchase Invoice pages. It can be deleted from the project if desired; leaving the unused file has no runtime effect.
