# Customer Edit / Update / Delete Fix — 14 Sep 2026

## Problem
Previous-DMS migrated customers could appear in Customer List but Edit/View/Update/Delete did not behave correctly.

## Root causes
1. Older migration code stored `CustomerLink.globalCustomerId` as the MongoDB `_id` of `GlobalCustomer`, while normal V2 customers use `GlobalCustomer.hiddenId`.
2. Customer detail routes looked up only by `hiddenId`, causing migrated records to return Customer Not Found.
3. Edit Save revalidated all new-V2 onboarding requirements (pincode assignment, transporter, IFSC, identity) even when the user only wanted to complete one pending legacy field.
4. Delete was a safe deactivation, but the default Customer List also displayed DEACTIVATED records, making deletion look like it had failed.

## Fixed policy
- Existing migrated records remain valid with their historical reference.
- Backend resolves both old Mongo ObjectId references and new hiddenId references.
- Future migrations use `GlobalCustomer.hiddenId` like normal V2 customers.
- Previous-DMS customers can be updated one field at a time without unrelated missing fields blocking Save.
- Migration completion status is recalculated after each update.
- Delete remains protected: if referenced by invoice/receipt/payment/ledger it is refused; otherwise it is safely deactivated and removed from the normal active Customer List.
- Default Customer List excludes DEACTIVATED customers.

## Files changed
- backend/src/routes/customers.js
- backend/src/services/legacyMigrationService.js
- frontend/src/pages/CustomerPage.jsx

## Rule
Do not hard-delete party masters that are referenced by transactions. Safe deactivation is the standard delete behavior.
