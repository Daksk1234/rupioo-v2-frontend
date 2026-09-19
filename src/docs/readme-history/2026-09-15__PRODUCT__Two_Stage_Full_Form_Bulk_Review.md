# Product Two-Stage Bulk Review — 2026-09-15

## Purpose
Product bulk upload no longer writes to the database immediately when a file is selected.

## New flow
1. Select Excel/CSV.
2. Step 1 Quick Preview: editable spreadsheet grid; blank cells are allowed and do not block Continue.
3. Step 2 Full Product Review: every uploaded product is an expandable form matching Create Product fields.
4. Final Import is the only database-write step.

## Step 2 fields
Product identity, category/subcategory, warehouse, barcode/GTIN, status, units/packing, HSN/GST, stock/purchase costs, MRP/sale price, minimum profit for admins, plus the original uploaded row for reference.

## Final import rules
- Product Name is required.
- A valid active Warehouse is required.
- SKU may be blank; V2 auto-generates it.
- HSN is optional, but when supplied it must exist in MASTER.
- Units must exist in DMS/MASTER Units.
- Existing SKU rows are updated; new SKU rows are inserted.
- Partial success is allowed: successful products are saved and rejected products remain in Step 2 for correction.

## Files changed
- `frontend/src/pages/ProductPage.jsx`
- `backend/src/routes/products.js`
