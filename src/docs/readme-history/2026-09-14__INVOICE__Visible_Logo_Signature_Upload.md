# Visible Company Logo & Authorized Signature Upload

Date: 14-09-2026
Module: INVOICE / SUPERADMIN PROFILE

## Problem
The Master Invoice fields for `logoFileId` and `signatureFileId` existed, but upload controls were available only inside the Edit Profile modal. On the normal Profile screen, the Invoice Print Template card only displayed `Configured` / `Not uploaded`, which made it look like no upload feature existed.

## Fix
The Invoice Print Template card on the Superadmin Profile now contains direct controls for:
- Upload Logo
- Replace Logo
- Remove Logo
- Logo preview
- Upload Signature
- Replace Signature
- Remove Signature
- Signature preview

Uploads are saved immediately to the Superadmin company profile. No additional Edit Profile / Save Changes action is required.

## Validation
- Accepted image types: PNG, JPG/JPEG, WebP.
- Maximum size: 5 MB each.
- Uploaded files remain PRIVATE.
- Master Invoice reads the saved `logoFileId` and `signatureFileId`.
