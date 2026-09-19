# Bank Account — Fast IFSC Auto Fetch (No Fetch Button)

Date: 2026-09-15
Module: DMS > Bank Accounts

## Change
- Removed the manual Fetch button from Create/Edit Bank Account.
- IFSC lookup runs automatically as soon as a valid 11-character IFSC is typed or pasted.
- Uses the existing shared MASTER IFSC lookup used by Customer/User: `/reference/ifsc/:ifsc` through `lookupIfscMaster()`.
- Removed chained Bank-specific/fallback lookup requests from the page so lookup is a single fast exact request.
- Adds a very small 60ms debounce to avoid duplicate requests while typing/pasting.
- Cancels/ignores stale responses when the IFSC is changed before a request finishes.
- Clears previous bank auto-filled data immediately when IFSC changes.
- Auto-fills Bank Name, Branch/Area, Bank Address, City, State, STD, Phone and Contact.

## Files changed
- `frontend/src/pages/BankAccountPage.jsx`

## Backend
No backend change is required. This uses the existing current V2 reference IFSC endpoint.
