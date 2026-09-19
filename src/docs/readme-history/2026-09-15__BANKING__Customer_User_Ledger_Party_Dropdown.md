# Bank Statement — Customer + User/Ledger Party Dropdown

Date: 2026-09-15

## Change
Bank Statement review now exposes one searchable Party selector containing:
- all active Customer Master parties;
- all active User Master records, including roleless ledger accounts such as Fuel Expense, Travelling Expense and Capital accounts;
- Suspense Account.

## Posting logic
- Customer selections keep the existing customer accounting code (Sundry Debtor/Creditor).
- User/Ledger selections use the User's active Company Ledger/accounting mapping and post with that ledgerId/system account code.
- A User without a configured accounting account is not silently posted to Suspense. Submission returns a clear error asking for the User Accounting Account Type to be configured.
- User refs are stored as `USER:<userId>` so they never collide with customer global IDs.

## Smart detection
Remarks matching now checks both Customer aliases and User/Ledger names. Ambiguous names remain Suspense for manual review.

## Files
- `frontend/src/pages/BankTransactionPage.jsx`
- `backend/src/routes/banks.js`
