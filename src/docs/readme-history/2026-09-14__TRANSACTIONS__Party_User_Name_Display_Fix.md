# Transaction Party + User Name Display Fix

Date: 14-09-2026
Modules: Sales Invoice, Purchase Invoice, Bank Statement / Bank Transactions

## Problem
Sales Invoice, Purchase Invoice and Bank Transactions could contain only stored party/user IDs or old snapshots. After Previous-DMS migration, some old records therefore showed blank Party Name and there was no reliable User Name column.

## Permanent rule
Transaction lists must resolve display names from the current V2 masters at read time while also preserving snapshots for audit/history.

- Party ID -> CustomerLink / GlobalCustomer -> current Party Name
- createdBy / submittedBy -> User Master -> current User Name
- New transactions also save name snapshots.
- Existing transactions do not require migration/re-upload; their stored IDs are enriched while reading.
- Legacy GlobalCustomer Mongo ObjectId references and V2 hiddenId references are both supported.

## Sales Invoice
List/API now returns `partyNameDisplay` and `userNameDisplay`.
New invoices save `createdByNameSnapshot`.
The Sales Invoice table and CSV export show Party Name + User Name.

## Purchase Invoice
Supplier/Party name is resolved from the Customer master instead of trusting a blank frontend snapshot.
List/API now returns `partyNameDisplay` and `userNameDisplay`.
New invoices save `createdByNameSnapshot`.

## Bank Statement / Bank Transactions
Posted statement rows show the selected current Party Name.
User Name is the statement submitter; if not yet submitted, the uploader is used.
New statement rows/imports keep user IDs + name snapshots.
Manual receipts/payments created after this update also keep createdBy + name snapshot.

## Compatibility
No existing FY database needs to be recreated. Mongoose adds the optional snapshot fields for new writes while old transactions are resolved dynamically when listed.
