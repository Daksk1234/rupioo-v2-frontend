# Super Admin Ledger Master Library

Date: 2026-09-15
Module: DMS > Users / Ledger Accounts

## Purpose
Adds a Super Admin-only Ledger Master Library before ledger creation. The catalogue is based on the supplied Main Account Head / Common Sub Accounts list.

## Catalogue
- 71 Main Account Heads
- 425 catalogue placements
- 407 unique ledger names
- 18 duplicate names appear under more than one supplied Main Account Head; they stay visible in each group but Import All creates only one physical ledger with that name.

## Super Admin workflow
1. Open DMS > Users.
2. Click **Ledger Library**.
3. Search by Main Account Head or ledger name.
4. Click **Use** to prefill one ledger and review it before saving.
5. Or tick individual ledgers / an entire Main Account Head and click **Import Selected**.
6. Or click **Import All Available** to create every missing unique ledger.

## Import safety
- Existing same-name Users/Ledger Accounts are detected and skipped.
- Import All never creates duplicate same-name ledgers.
- Imported records are roleless `LEDGER_ACCOUNT` records with System Login disabled.
- Opening balance defaults to zero and uses the company/current financial year.
- Each ledger retains its visible Main Account Head in `accountType` while the accounting engine uses the mapped V2 `systemAccountCode`.
- Library-created Staff Advance / Salary Payable style accounts remain roleless because the library explicitly creates ledgers, not employees.

## Examples
- Fuel Expense -> Main Account Head: Vehicle Expenses -> SYS_INDIRECT_EXPENSE
- Travelling Expense -> Main Account Head: Travelling Expenses -> SYS_INDIRECT_EXPENSE
- Partner Capital -> Main Account Head: Capital Account -> SYS_PARTNER_CAPITAL
- GST Payable -> Main Account Head: GST / Duties & Taxes -> SYS_DUTIES_TAXES
- Raw Material Purchase -> Main Account Head: Purchase Accounts -> SYS_PURCHASE
- Factory Power -> Main Account Head: Direct Expenses -> SYS_DIRECT_EXPENSE
- Suspense Account -> Main Account Head: Suspense Account -> SYS_SUSPENSE

## Changed files
- frontend/src/pages/UsersAccessPage.jsx
- backend/src/routes/access.js
- backend/src/config/defaultLedgerLibrary.js
- frontend/src/docs/readme-history/2026-09-15__USER__SuperAdmin_Ledger_Master_Library.md
