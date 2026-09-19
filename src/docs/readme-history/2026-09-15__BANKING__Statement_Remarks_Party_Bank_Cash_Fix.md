# Bank Statement Upload – Remarks Party + BANK/CASH Fix

Date: 2026-09-15
Module: DMS > Bank Transactions

## Why this change was required
The bank-statement review template uploaded by the user was rejected as "Bank statement has invalid rows" because it contained:
- two demo rows from the old downloadable template,
- an Opening Balance row without Date/Debit/Credit,
- Running Balance values such as `474379.35 Cr` / `71942.65 Dr`,
- Party Name intentionally left blank while the party name was written inside Remarks.

## New behavior
- Party Name column is optional.
- Party is matched from Remarks first; unmatched/ambiguous rows become `Suspense Account`.
- The review row itself shows the matched Party Name or Suspense Account.
- Uploaded NEFT / RTGS / IMPS / cheque / transfer modes are normalized to `BANK`.
- Rows containing cash are normalized to `CASH`.
- Running Balance accepts `Cr` / `Dr`, commas and currency symbols. `Dr` is stored as a negative running balance for reconciliation.
- A final `Opening Balance - FY ...` row is recognized and ignored as a transaction instead of being treated as an invalid row.
- The exact two demo rows from the previous Rupio bank-statement template are ignored for backward compatibility.
- The downloadable template is now header-only so sample rows cannot accidentally be posted in future statements.

## Changed files
- `backend/src/routes/banks.js`
- `frontend/src/pages/BankTransactionPage.jsx`

## Safety
Nothing is posted during upload. The existing Upload -> Review -> Submit workflow remains unchanged. Unknown parties are never guessed; they are posted to Suspense only if the user leaves them as Suspense in review.
