# Live V2 Storage Connection Patch

Date: 14-09-2026
Module: Storage & Backup

## Purpose
Wire the already-created dual-cloud system into the actual current Rupio V2 frontend/backend so Superadmin and MASTER can really open the connection page.

## User location
- Superadmin Profile -> **Storage & Backup**
- Top-right user menu -> **Storage & Backup**
- Direct Superadmin route: `/storage-settings`
- Direct MASTER route: `/master/storage-connection`

## Providers
- Primary: Google Drive
- Backup: Microsoft OneDrive

## Connection UX
1. Enter Google Drive email.
2. Accept storage authorization.
3. Click **Connect Google Drive**.
4. Complete Google's secure login/OTP/consent.
5. Enter Microsoft email.
6. Click **Connect Microsoft OneDrive**.
7. Complete Microsoft's secure login/OTP/consent.
8. Both providers show CONNECTED.

Rupio never receives or stores the provider password.

## Header health warning
For Superadmin accounts, V2 polls storage health and displays a flashing warning when:
- both providers are disconnected,
- primary Google Drive is disconnected,
- backup OneDrive is disconnected, or
- files are pending dual-cloud replication.

Clicking the warning opens `/storage-settings`.

## Backend integration
The current V2 server now mounts `/api/storage` before the general company permission middleware because OAuth callbacks return from Google/Microsoft without a Rupio Authorization header.

Current company `tenantKey` is used as the storage namespace. MASTER can enter a target Superadmin tenant key.

## Required environment variables
See backend `.env.example`:
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REDIRECT_URI`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT`
- `MICROSOFT_REDIRECT_URI`
- `STORAGE_TOKEN_ENCRYPTION_KEY`

Local callback URLs:
- `http://localhost:5050/api/storage/google/callback`
- `http://localhost:5050/api/storage/onedrive/callback`

## Files changed
Frontend:
- `src/App.jsx`
- `src/components/AppShell.jsx`
- `src/components/StorageHealthBanner.jsx`
- `src/pages/SuperadminProfilePage.jsx`
- `src/pages/StorageSettings.jsx`

Backend:
- `src/server.js`
- `src/routes/storage.js` (new)
- `package.json`
- `.env.example`
- `START_BACKEND.bat`

Existing storage OAuth/services/models are reused.
