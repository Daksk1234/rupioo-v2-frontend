# Rupio V2 — Smart Superadmin Own-Mail Connection

**Date:** 14 September 2026  
**Module:** Email & Communication  
**Status:** New standard architecture

## Why this change was made

The previous invoice mail flow sent the Superadmin email address and `appPassword` from the browser with each invoice. The backend then created a Gmail SMTP transporter from those browser-supplied credentials.

The new standard removes mailbox passwords from normal frontend mail sending.

## New connection order

1. Google / Gmail / Google Workspace — OAuth connection
2. Microsoft Outlook / Microsoft 365 — OAuth connection
3. Other email provider — SMTP/App Password fallback only
4. Existing App Password users — supported as `Legacy`, with a one-click OAuth upgrade path

## Superadmin experience

- Enter email address
- Rupio detects provider
- Click **Connect Email**
- Google/Microsoft secure authorization window opens
- User completes provider password/OTP directly with Google/Microsoft
- Rupio verifies that the authorized mailbox matches the typed email
- Connection becomes `CONNECTED`
- Future invoice/ledger/payment-request mail uses this stored company connection automatically

Rupio never needs the Google/Microsoft mailbox password.

## Common mail service

All document modules send through the same company mail engine:

- Sales Invoice
- Customer Ledger
- Statement of Account
- Payment Request
- Receipt
- Purchase Order
- Sales Order
- Credit Note
- Debit Note
- Delivery communication
- Generic document mail

## Queue and retry

Document sending does not block the business transaction.

If provider delivery fails temporarily:

- message is retained in Mail Outbox
- attachments are encrypted while pending
- worker retries using progressive backoff
- sent attachment queue copies are removed after success
- Superadmin sees a header warning

## V2 header health

- Healthy + zero pending: no banner
- Connected but pending/failed: orange flashing banner
- Disconnected/error/not configured: red flashing banner
- Click banner → Email & Communication settings

## Master visibility

MASTER can view connection health by company/database:

- email
- provider
- connection status
- pending count
- failed count
- last health time
- last error

MASTER cannot see refresh tokens, OAuth access tokens or SMTP passwords.

## Security

- OAuth state is signed and expires after 10 minutes.
- Google/Microsoft authorization result is accepted only if the actual authorized email equals the email requested by the Superadmin.
- OAuth refresh/access tokens are AES-256-GCM encrypted before MongoDB storage.
- SMTP fallback password/app-password is encrypted before MongoDB storage.
- Queue attachment copies are AES-256-GCM encrypted at rest.
- Browser no longer needs to send `email` + `appPassword` for each document.
- OAuth callbacks use a fixed configured V2 frontend origin.

## Legacy migration

Run the optional migration only if your old User records contain `email` + `appPassword`:

```bash
node scripts/migrateLegacyAppPasswords.js
```

Imported accounts remain operational as `smtp_legacy` and show **Upgrade Connection** in the UI. The migration deliberately does not delete the old User field automatically; remove it from the User schema/data only after you have verified that all mail paths are using Smart Mail.

## Main routes

```text
GET    /mail/detect-provider
GET    /mail/status/:database
POST   /mail/connect/:database
GET    /mail/oauth/google/callback
GET    /mail/oauth/microsoft/callback
POST   /mail/connect-smtp/:database
POST   /mail/test/:database
POST   /mail/disconnect/:database
PUT    /mail/settings/:database
POST   /mail/send-document/:database
GET    /mail/outbox/:database
POST   /mail/outbox/:database/:id/retry
GET    /mail/master/overview
```

## Important transition rule

Do not immediately delete the old `/order/send-invoice` route if older builds still call it. Use the supplied `legacyMailBridge.controller.js` first. The bridge ignores any browser-supplied `email`, `appPassword` or password and sends through the new stored company connection.
