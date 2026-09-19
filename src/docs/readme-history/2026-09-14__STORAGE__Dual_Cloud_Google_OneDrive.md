# Rupio V2 — Dual-Cloud Storage + Product Image Delivery

This is the complete V2 patch for the storage design discussed in this chat.

## Final design

**Primary provider:** Google Drive  
**Backup provider:** Microsoft OneDrive  

The two slots are deliberately fixed to different providers. A company cannot accidentally configure two Google Drives as its “dual-cloud” backup.

For the Superadmin/Master the connection screen stays simple:

1. Enter the Google account email → **Connect Google Drive**.
2. Google opens its own secure login/consent window. Rupio never receives the Google password.
3. Enter the Microsoft account email → **Connect Microsoft OneDrive**.
4. Microsoft opens its own secure login/consent window. Rupio never receives the Microsoft password.
5. After both are connected, every private upload is replicated automatically.

---

## What happens when a file is uploaded

```text
Create Product / Customer / User / Transporter / Documents
                         |
                         v
                 Rupio receives file
                         |
              SHA-256 checksum generated
                         |
        encrypted temporary safety copy created
                         |
             +-----------+-----------+
             |                       |
             v                       v
     Google Drive                OneDrive
       PRIMARY                    BACKUP
             |                       |
             +-----------+-----------+
                         |
               checksums/status saved
                         |
             both copies successful?
                         |
                  YES --> remove
                           temporary copy
```

A failed cloud upload does **not** cancel the business transaction. The file remains protected in encrypted temporary storage and the sync worker retries automatically.

---

# 1. Product images

Your current V2 Product controller already expects `req.files[].filename` and saves those names to `Product_image`. This patch deliberately preserves that contract.

When an image is uploaded from **Create Product** or **Edit Product**:

- Original image → Google Drive Primary.
- Same original image → Microsoft OneDrive Backup.
- SHA-256 integrity is tracked for the logical file.
- 160px WebP → thumbnail.
- 480px WebP → Customer App / Sales App catalog image.
- 1000px WebP → product-detail image.
- 1000px compatibility copy → `public/Images/` so existing V2 pages using `Product_image` keep working.
- Maximum 5 active product images.
- Product cannot be published to Customer App/Sales App without at least one active image.
- New product with image is app-ready automatically.

Optimized product images are intentionally served from Rupio persistent storage/cache because Customer App and Sales App need fast catalog browsing even if a cloud provider is temporarily unavailable.

---

# 2. Private documents

The included common `EntityDocuments.jsx` supports:

- Product documents/specification/certificates
- Customer GST/PAN/cheque/shop documents
- User Aadhaar/PAN/certificates/other HR documents
- Transporter documents
- Purchase invoice documents
- Sales invoice documents
- Other documents

Private documents are written through the same dual-cloud engine:

```text
Google Drive Primary + Microsoft OneDrive Backup
```

MongoDB stores metadata, provider file IDs, checksum, versions and replication state—not the full document body.

Delete is logical first. The included document model/controller keeps the 30-day protected recovery flow instead of permanently deleting immediately.

---

# 3. Automatic failover and re-sync

The included worker performs two jobs:

1. Tests Google Drive and OneDrive connection health.
2. Finds files whose replication state is not `healthy` and retries the missing copy.

Examples:

```text
Google ✓ + OneDrive ✓  = HEALTHY
Google ✓ + OneDrive ✕  = DEGRADED; backup automatically retried
Google ✕ + OneDrive ✓  = DEGRADED; OneDrive remains readable; Google retried
Google ✕ + OneDrive ✕  = ENCRYPTED TEMP COPY retained; both retried
```

Downloads also fail over automatically:

```text
Google Primary
      ↓ if unavailable
OneDrive Backup
      ↓ if unavailable
Encrypted temporary copy
```

The temporary copy is removed automatically only after both provider copies are healthy.

---

# 4. V2 header warning

Add the included `StorageHealthBanner.jsx` to the permanent authenticated V2 header/layout.

It polls storage health and stays hidden when everything is healthy.

### Primary Google Drive down, OneDrive still available

```text
RED FLASHING
PRIMARY GOOGLE DRIVE DISCONNECTED — BACKUP ONEDRIVE IS ACTIVE
```

### Backup OneDrive down

```text
ORANGE FLASHING
BACKUP ONEDRIVE DISCONNECTED — FILES ARE SAFE ON PRIMARY
```

### Both providers down

```text
DARK RED FLASHING
BOTH CLOUD STORAGE PROVIDERS ARE DISCONNECTED
```

### Both providers connected but files are waiting for replication

```text
ORANGE FLASHING
N FILE(S) WAITING FOR DUAL-CLOUD BACKUP
```

Clicking the banner opens `/app/storage-settings`.

See `frontend/HEADER_INTEGRATION.txt`.

---

# 5. Backend files

## Replace

```text
model/product.model.js
routes/product.route.js
```

## Add / replace

```text
model/storageConnection.model.js
model/storageObject.model.js
model/documentAsset.model.js

middleware/productImageUpload.js
middleware/rupioAuth.js

controller/productMedia.controller.js
controller/storageConnection.controller.js
controller/documentAsset.controller.js

services/storage/crypto.js
services/storage/googleDrive.service.js
services/storage/oneDrive.service.js
services/storage/storage.service.js
services/storage/storageSync.worker.js

scripts/migrateLegacyProductImages.js
scripts/migrateStorageConnectionDual.js
```

Your existing `controller/product.controller.js` does not need to be replaced just for this feature. The upload middleware preserves its existing `req.files[].filename` behavior.

---

# 6. Backend dependencies

From the backend folder:

```bash
npm install sharp googleapis @azure/msal-node
```

If `multer` is not already installed:

```bash
npm install multer
```

Node 20+ is recommended for the OneDrive adapter because it uses the built-in `fetch` implementation.

---

# 7. Backend `.env`

Merge these variables into the existing V2 backend `.env`:

```env
# ---------------- GOOGLE DRIVE / PRIMARY ----------------
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REDIRECT_URI=https://YOUR_API_DOMAIN/product/storage/google/callback

# ---------------- MICROSOFT ONEDRIVE / BACKUP ----------------
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT=common
MICROSOFT_REDIRECT_URI=https://YOUR_API_DOMAIN/product/storage/onedrive/callback

# ---------------- RUPIO STORAGE SECURITY ----------------
STORAGE_TOKEN_ENCRYPTION_KEY=PUT_A_LONG_RANDOM_FIXED_SECRET_HERE
STORAGE_SYNC_INTERVAL_MS=60000
STORAGE_SYNC_BATCH=20
```

Do not change `STORAGE_TOKEN_ENCRYPTION_KEY` after connections have been created unless you deliberately plan to reconnect every storage account. It encrypts provider long-lived authorization material and encrypted temporary file copies.

Do **not** put Google or Microsoft user passwords in `.env`, MongoDB or the frontend.

---

# 8. Google setup — Primary

In Google Cloud Console:

1. Create/open the Rupio project.
2. Enable **Google Drive API**.
3. Configure the OAuth consent screen.
4. Create OAuth **Web application** credentials.
5. Add this exact redirect URI:

```text
https://YOUR_API_DOMAIN/product/storage/google/callback
```

6. Put the Client ID/Secret in the backend `.env`.

Rupio requests `drive.file` and email identity scopes. The Superadmin signs in on Google's own page.

---

# 9. Microsoft setup — Backup

In Microsoft Entra admin center / Azure portal:

1. Create an App Registration for Rupio V2.
2. Add a **Web** redirect URI:

```text
https://YOUR_API_DOMAIN/product/storage/onedrive/callback
```

3. Create a client secret.
4. Add delegated Microsoft Graph permissions required by the included implementation:
   - `User.Read`
   - `Files.ReadWrite.AppFolder`
5. Put the Client ID/Secret into the V2 backend `.env`.
6. `MICROSOFT_TENANT=common` allows supported Microsoft personal/work-account sign-in. If you later want to restrict to one Microsoft tenant, replace `common` with the tenant ID.

Rupio stores the encrypted MSAL token cache, not the Microsoft account password.

---

# 10. Important migration before first start

The earlier single-cloud patch used a one-row-per-database storage connection. The dual-cloud schema uses one row per **database + slot**.

If you deployed the earlier patch, run this once before starting the new backend:

```bash
node scripts/migrateStorageConnectionDual.js
```

The script:

- removes the old `database_1` unique index if present,
- converts an old Google connection into the `primary` slot,
- creates the new `{database, slot}` and `{database, provider}` unique indexes.

If the storage feature was never deployed before, the script is harmless but is not required.

---

# 11. Frontend files

Copy these to your V2 frontend:

```text
src/pages/StorageSettings.jsx
src/pages/ProductCatalogManager.jsx

src/components/StorageHealthBanner.jsx
src/components/EntityDocuments.jsx
src/components/ProductMediaStatus.jsx
src/components/productImage.js
```

## Add routes

Use the routing/permission wrapper already used in your V2 project. The logical routes are:

```jsx
<Route path="/app/storage-settings" element={<StorageSettings />} />
<Route path="/app/product-app-catalog" element={<ProductCatalogManager />} />
```

`StorageSettings.jsx` automatically detects MASTER from `userData.rolename.roleName`. MASTER can enter/select a target Superadmin database; a normal Superadmin is locked to its own database.

---

# 12. Simple cloud connection UI

The included page gives exactly this user flow:

```text
STORAGE & BACKUP

PRIMARY — GOOGLE DRIVE
Email: [ accounts@company.com ]
[ CONNECT GOOGLE DRIVE ]
Status: Connected / Disconnected

BACKUP — MICROSOFT ONEDRIVE
Email: [ backup@company.com ]
[ CONNECT MICROSOFT ONEDRIVE ]
Status: Connected / Disconnected

[ TEST BOTH ]
```

The email is used as a login hint. Password/OTP is typed only into the provider's own secure popup.

---

# 13. Header integration

In the permanent authenticated Header/App Layout:

```jsx
import StorageHealthBanner from "./components/StorageHealthBanner";
```

Render it at the top of the application shell:

```jsx
<StorageHealthBanner />
```

If the header file is in a different folder, adjust only the import path.

---

# 14. Add documents to Product / Customer / User / Transporter

Use the common component after the record has an ID.

```jsx
import EntityDocuments from "../components/EntityDocuments";
```

Product:

```jsx
<EntityDocuments
  entityType="product"
  entityId={productId}
  defaultDocumentType="Specification"
/>
```

Customer:

```jsx
<EntityDocuments
  entityType="customer"
  entityId={customerId}
  defaultDocumentType="GST Certificate"
/>
```

User:

```jsx
<EntityDocuments
  entityType="user"
  entityId={userId}
  defaultDocumentType="Aadhaar"
/>
```

Transporter:

```jsx
<EntityDocuments
  entityType="transporter"
  entityId={transporterId}
  defaultDocumentType="GST Certificate"
/>
```

Uploads from these forms automatically enter the same Google + OneDrive replication engine.

---

# 15. Product Create/Edit behavior

No separate Drive button is needed in Product Create.

Your existing frontend keeps doing what it already does:

```text
Choose image → submit product form (`files`) → backend upload middleware
```

The middleware then automatically:

```text
Original → Google Drive
Original → OneDrive
Optimized copies → Rupio app image cache
Product_image → maintained for old V2 compatibility
```

If either cloud is disconnected, Product creation still succeeds and the header warning tells the Superadmin what must be reconnected.

---

# 16. Customer App / Sales App

Copy the included mobile files into both Expo apps:

```text
src/utils/productCatalog.js
src/components/ProductCatalogImage.jsx
src/components/ProductCatalogCard.jsx
src/screens/ProductCatalogScreen.example.jsx
```

Install:

```bash
npx expo install expo-image
```

Customer App loads:

```js
loadPublishedProductCatalog({
  apiBase: API_URL,
  database: customer.database,
  channel: "customer",
});
```

Sales App loads:

```js
loadPublishedProductCatalog({
  apiBase: API_URL,
  database: salesPerson.database,
  channel: "sales",
});
```

Images use memory + disk cache so salespeople can browse much faster and previously loaded catalog images remain available through app caching.

---

# 17. Existing product image migration

Once the new storage accounts are connected, run once per Superadmin/company database:

```bash
node scripts/migrateLegacyProductImages.js YOUR_SUPERADMIN_DATABASE
```

This migrates old `public/Images` product images into the new product media flow and produces app-optimized sizes.

---

# 18. Persistent VPS/Docker volumes

These directories must survive deployments/container rebuilds:

```text
public/catalog/
public/Images/
storage/private/
```

`storage/private/` contains encrypted temporary safety copies when one/both providers are not fully synchronized. Do not use ephemeral container storage for it.

---

# 19. Storage-health states saved in MongoDB

Each physical logical file gets a `StorageObject` record with two copies:

```js
copies: [
  {
    slot: "primary",
    provider: "google_drive",
    status: "synced | pending | error | missing",
    fileId: "...",
    checksum: "..."
  },
  {
    slot: "backup",
    provider: "onedrive",
    status: "synced | pending | error | missing",
    fileId: "...",
    checksum: "..."
  }
]
```

Overall state is one of:

```text
healthy   = both clouds synchronized
degraded  = one cloud synchronized
pending   = waiting for replication
failed    = no provider copy currently synchronized
```

---

# 20. Final V2 behavior

```text
SUPERADMIN / MASTER
        |
        +--> Connect Google Drive (Primary)
        |
        +--> Connect Microsoft OneDrive (Backup)
        |
        v
EVERY PRIVATE UPLOAD
        |
        +--> encrypted temporary safety copy
        +--> Google Drive
        +--> OneDrive
        +--> automatic retry
        +--> SHA-256 integrity tracking
        +--> header warning if unhealthy

PRODUCT IMAGE
        |
        +--> same dual-cloud original backup
        +--> Rupio optimized image cache
              |
              +--> DMS
              +--> Customer App
              +--> Sales App
```

This gives V2 provider diversity, automatic backup, failover, re-sync, app-ready product images and a visible storage-health warning without storing Superadmin Google/Microsoft passwords.
