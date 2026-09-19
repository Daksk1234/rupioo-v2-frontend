# MASTER README & Change History Library

This release adds a permanent README / change-history viewer to the Rupio V2 MASTER panel.

## Purpose

- Keep old implementation instructions available after later releases.
- Never overwrite earlier README documents.
- Search by module, filename, title, or document contents.
- Read documents directly inside Rupio V2.
- Copy or download an archived README when required.

## Archive rule

Every future README should be copied into:

`src/docs/readme-history/`

Use this filename format:

`YYYY-MM-DD__MODULE__TITLE.md`

Example:

`2026-09-20__CUSTOMER__KYC_OCR_Update.md`

The Master page automatically indexes `.md` and `.txt` files in that folder on the next frontend build.

## Important

Old documents should remain immutable. If instructions change, create a new dated README rather than replacing the previous one.
