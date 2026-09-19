# Google Drive Connect — `database is required` Hotfix

**Date:** 14 September 2026  
**Module:** Storage & Backup  
**Affected:** Google Drive primary connection and Microsoft OneDrive backup connection

## Symptom

When a SUPERADMIN opened **Storage & Backup**, entered the Google Drive email, accepted consent, and clicked **Connect Google Drive**, V2 returned:

`database is required`

## Root cause

The V2 backend uses Express 5. The storage identity middleware correctly resolved the signed SUPERADMIN company `tenantKey` and stored it in `req.storageKey`, but it also attempted to inject that value into `req.query.database` for older storage-controller compatibility.

In Express 5 `req.query` is getter-backed. A mutation made by middleware is not a reliable way to pass internal request state to a later controller. The Google/OneDrive connect controllers subsequently read `req.query.database` and could receive an empty value.

## Fix

The provider connection controllers now use the authenticated storage namespace in this order:

1. `req.storageKey` — preferred; bound from the signed Rupio session.
2. `req.rupioAuth.database` — internal compatibility fallback.
3. route/query database — legacy fallback only.

The storage middleware no longer depends on mutating `req.query`.

## Security behavior

For a normal SUPERADMIN, the cloud-storage namespace is taken from the signed JWT `tenantKey`; it is not accepted from a browser-entered database value.

For MASTER, the selected target Superadmin tenant key continues to be required before MASTER can manage that company's storage connection.

## User flow after fix

Storage & Backup → enter Google account email → accept authorization → **Connect Google Drive** → Google login/OTP/consent window → callback → Google Drive connected.

The same fix also applies to **Connect Microsoft OneDrive**.
