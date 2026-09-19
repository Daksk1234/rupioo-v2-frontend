# Quick Multi Invoice Entry — 2026-09-16

Added a manual high-speed multi-invoice entry page to both Sales Invoice and Purchase Invoice.

## Flow
- Open Sales Invoice or Purchase Invoice list.
- Click **Multi Invoice Entry**.
- Enter Invoice No., Date and Party.
- Add one or more product rows with Product, Qty, Basic Price and GST %.
- Basic Total, CGST, SGST, IGST and Invoice Amount are calculated automatically.
- Use **Add Product** for additional products inside the same invoice.
- Use **Add Another Invoice** for the next invoice.
- **Save All Invoices** posts each valid invoice through the normal V2 transaction API.
- Partial success is supported; failed invoices remain on screen with their error.

## Accounting and stock
Sales invoices use the existing Sales Invoice posting engine, warehouse stock-out, GST and customer ledger logic. Purchase invoices use the existing Purchase Invoice posting engine, stock-in, purchase averages/landed cost, GST and supplier ledger logic.

## Sales invoice number
Quick Entry may preserve a manually entered Sales Invoice number using `importSource=QUICK_ENTRY`. If left blank, the normal configured Sales Invoice series is consumed.
