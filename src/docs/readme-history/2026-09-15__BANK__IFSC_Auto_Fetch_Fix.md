# Bank Account IFSC Auto Fetch Fix — 2026-09-15

## Issue
On DMS > Bank Accounts > Create Bank Account, entering a valid 11-character IFSC did not reliably populate Bank Name, Branch/Area, Bank Address, City, State and Contact No.

## Fix
- Added a dedicated authenticated endpoint: `GET /api/banks/ifsc-lookup/:ifsc`.
- The endpoint reads the existing global MASTER IFSC collection through the existing IFSC master service and returns Bank Account-shaped field names.
- Create/Edit Bank Account now calls this bank-specific endpoint automatically once 11 IFSC characters are entered.
- The search button, blur and Enter key use the same lookup.
- Stale bank data is cleared whenever the IFSC changes so old bank details cannot remain against a new IFSC.
- Late network responses are ignored if the user has already changed the IFSC.
- A visible loading state and useful error message were added.

## Changed files
- `frontend/src/pages/BankAccountPage.jsx`
- `backend/src/routes/banks.js`

## No changes
Customer/User IFSC lookup logic and IFSC Master data/import were not modified.
