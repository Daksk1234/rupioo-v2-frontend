RUPIO V2 — Sales Bulk Upload Rectified

Changed file:
src/components/SalesBulkUploadModal.jsx

Main changes:
1. Supports simple Sales Upload sheet: Date, Invoice No., GST No., Product, Qty, Unit, Rate, Discount %.
2. Resolves customer strictly from GST No. in V2 Customer Master.
3. Resolves exact product first, otherwise calculates nearest V2 Product Master matches.
4. Confused products are highlighted as REVIEW and show the 10 nearest products in a dropdown.
5. REVIEW invoices cannot upload until every confused product is manually confirmed.
6. After product selection, HSN/GST/unit/warehouse/other product master data are taken from selected V2 product.
7. Qty and basic Rate remain from Excel.
8. Multiple rows with same Date + Invoice No. + GST No. are grouped into one invoice.
9. Line Discount % from Excel is included in calculation.
10. This component does not call /api/transactions/sales-with-products/import-preview, avoiding that 404 route dependency.
