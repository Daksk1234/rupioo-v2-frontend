# Remove Scan Feature from Sales & Purchase Invoice

Date: 2026-09-16

## Changed
- Removed Bulk Scan / Bulk Scan & Fill from Sales Invoice list.
- Removed Bulk Scan / Bulk Scan & Fill from Purchase Invoice list.
- Removed Scan & Fill from Purchase Invoice create/edit page.
- Removed Scan & Fill from Sales Invoice delivery proof modal.
- Kept normal manual Sales/Purchase invoice creation, editing, stock, GST, ledger, PDF and delivery upload flows unchanged.

## Files changed
- frontend/src/pages/SalesInvoicePage.jsx
- frontend/src/pages/PurchaseInvoicePage.jsx

## Notes
The shared ScanAndFill/BulkInvoiceScan components and backend document-AI routes are not deleted because they may be used by other modules. They are no longer referenced by the Sales Invoice or Purchase Invoice pages.
