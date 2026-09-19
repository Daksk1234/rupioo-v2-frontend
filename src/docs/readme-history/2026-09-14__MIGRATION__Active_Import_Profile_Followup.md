# Rupio V2 — Previous DMS Migration: Active Import + Profile Follow-up

Date: 2026-09-14

## New migration rule

Previous-DMS master records are imported into V2 as usable records immediately. Missing newer V2 profile fields do not block the record.

- Source ACTIVE records stay ACTIVE.
- Source inactive/deactive records remain inactive/deactivated on a fresh import.
- Missing fields are recorded as `PENDING_FIELDS` / `IMPORTED_WITH_PENDING_FIELDS`.
- The Pending Profile Fields list is only a follow-up checklist.
- Every imported row increments Imported; pending-field count is additional, not mutually exclusive.
- The raw Previous-DMS row is retained under `migration.sourceData` so source fields are not discarded.

## Customer import improvements

Legacy aliases now include `mobileNumber`, `ownerAddress`, `CompanyName`, `State`, `City`, `comPanNo`, `sId`, `OpeningBalance`, `Type`, `paymentTerm`, `limit`, `lockInTime`, etc.

Customer migration now maps:

- old customer code / sId
- company/legal name
- GSTIN / PAN
- company and owner contact data
- registered/billing address
- pincode/city/state
- party type and registration type
- payment type, credit days and credit limit
- opening balance, DR/CR and financial year
- assigned transporter name/reference when available
- bank details embedded in the legacy customer row
- region/category/service area/shop size/deals-in-products/annual turnover
- Aadhaar only as hash + masked value (not raw Aadhaar)

## Existing blocked migrations

The migration page now shows **Activate Previous Imports** only when old `NEEDS_COMPLETION` records exist. This converts old blocked migration status into the new active + pending-fields policy without deleting the follow-up checklist.

Backend endpoint:

`POST /api/migration/activate-existing`

## UI wording

Old:
- Needs Completion
- incomplete records will not be activated

New:
- Pending Profile Fields
- all detected records will import
- missing fields do not block imported records
- complete the profile fields one by one later

## Uploaded sample validation

For `DMS.customers_GST_only.json`:
- 71 customer rows detected
- old migration rule flagged 67 because Mobile was mandatory and did not recognise `mobileNumber`
- after adding proper legacy aliases, only 22 rows have any of the profile follow-up fields missing
- all 71 rows are importable under the new rule

