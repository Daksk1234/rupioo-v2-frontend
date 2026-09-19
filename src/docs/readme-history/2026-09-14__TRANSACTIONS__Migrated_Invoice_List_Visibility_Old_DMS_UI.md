# Migrated Invoice List Visibility + Old DMS List UI

## Problem
Migrated Sales and Purchase invoices were present in the FY databases and visible in GST/GSTR reports, but invoice list pages could appear empty.

## Root cause
1. V2 Sales/Purchase list pages defaulted to `MONTHLY`, while the old DMS list defaulted to a full-year/all-data view.
2. V2 list mode queried one FY database at a time, while migrated historical invoices can span multiple FY databases.
3. The newer list columns had drifted from the old DMS operational lists.

## Fix
- List mode now defaults to `YEARLY`.
- Added `All Financial Years` in list mode and aggregates the last 10 FY databases without changing create/edit posting FY logic.
- Sales list restored old-DMS-style columns: status, invoice, invoice number, date, party, party limit, basic total, IGST, CGST, SGST, round-off, grand total; retained V2 user name, master PDF, edit, delivery and admin margin.
- Purchase list restored old-DMS-style columns: S.No, status, invoice no, date, contact, company, owner, builty, packages, vehicle, IGST/CGST/SGST, additional charges, amount, charges, round-off, grand total; retained V2 user name, landed price and edit/delete.
- Month grouping includes FY when viewing all years, preventing same-month collisions between years.

## Important rule
GST report visibility and transaction-list visibility must use the same source invoices. List filters must never make migrated invoices appear missing by default.
