# Customer Single / Bulk / Delete All Safe Delete Fix

Date: 2026-09-14
Module: Customer Master

## Problem
Customer deletion was inconsistent:
- Single Delete used an edit/create permission fallback instead of a delete rule.
- Bulk Delete aborted the entire batch if even one selected customer was referenced by a transaction.
- Customer Master had no true Delete All action.
- Legacy migrated customer references could exist under old Previous-DMS identifiers, so checking only the new V2 global customer ID was not sufficient for safe deletion.

## Fixed behaviour
### Single Delete
- Deletes from the active Customer List by soft-deactivating the CustomerLink.
- Checks transaction references before deactivation.
- Checks V2 globalCustomerId plus legacy migration identifiers (_id / id / sId / migration legacyId).
- Transaction-used customers are protected and remain active.

### Bulk Delete
- Selected customers are evaluated individually.
- Safe customers are deactivated.
- Transaction-used customers are skipped instead of blocking the entire batch.
- UI reports deleted and protected/skipped counts and lists protected customers.

### Delete All
- New Customer Master "Delete All" action.
- Applies to the full customer scope accessible to the signed-in user, not only the current page/search.
- Safe customers are deactivated.
- Referenced customers remain protected.
- No Global Customer identity is physically destroyed.

## Safety Rule
Never physically delete a party already used in invoices, receipts, payments, ledger, expenses or other supported transaction references. Customer master deletion is a safe soft-deactivation from the active list.
