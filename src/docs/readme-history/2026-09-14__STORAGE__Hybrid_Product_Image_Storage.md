# Rupio V2 — Hybrid Storage + Mandatory App Product Images

This patch adds the storage architecture discussed for V2 while keeping the current Product Create/Edit API URLs compatible.

## What this patch does

### Product images

When DMS uploads a product image:

1. The original image is stored privately in the Superadmin's connected Google Drive (`RUPIO DMS/...`).
2. If Drive is not connected/unavailable, the original safely falls back to `backend/storage/private/`.
3. Rupio creates optimized WebP copies:
   - 160 px thumbnail
   - 480 px Customer/Sales App image
   - 1000 px product-detail image
4. Optimized copies are stored under `backend/public/catalog/...` for fast app delivery.
5. A 1000 px compatibility copy is also written to `backend/public/Images/` so old V2 screens using `Product_image` continue to work.
6. Maximum 5 active product images are allowed.
7. A product cannot be manually published to Customer App or Sales App unless it has an image.
8. New products with an uploaded image are app-ready automatically. Products created without an image remain in DMS but are not app-published.

### Private documents

The reusable `EntityDocuments.jsx` component supports:

- Product documents
- Customer documents
- User documents
- Transporter documents
- Purchase invoice documents
- Sales invoice documents
- Other documents

Files are private, versioned, stored in the Superadmin's Drive when connected, and only metadata/file references are stored in MongoDB.

Delete requests enter a 30-day recovery state instead of immediate permanent deletion.

### Google Drive security

- Uses Google OAuth; no Google password is requested or stored.
- Requests only the `drive.file` scope, so Rupio manages files it creates/opens for the integration instead of asking for unrestricted Drive access.
- Google refresh token is encrypted with AES-256-GCM before MongoDB storage.
- OAuth state is encrypted and expires after 15 minutes.
- Storage/document management APIs use the existing Rupio login token and database boundary.

### Customer App / Sales App

A fast catalog endpoint is included:

`GET /product/catalog/:database?channel=customer`

or

`GET /product/catalog/:database?channel=sales`

It returns only safe catalog/sale fields. It does not return purchase rate, landed cost, supplier data, or other internal product-cost fields.

The Expo components use `expo-image` with memory+disk caching.

---

# 1. BACKEND FILES

Copy the included files to the same paths in the Rupio V2 backend.

## Replace

- `model/product.model.js`
- `routes/product.route.js`

## Add

- `model/storageConnection.model.js`
- `model/documentAsset.model.js`
- `middleware/productImageUpload.js`
- `middleware/rupioAuth.js`
- `controller/productMedia.controller.js`
- `controller/storageConnection.controller.js`
- `controller/documentAsset.controller.js`
- `services/storage/crypto.js`
- `services/storage/googleDrive.service.js`
- `services/storage/storage.service.js`
- `scripts/migrateLegacyProductImages.js`

The existing `controller/product.controller.js` does not need to be replaced. The upload middleware deliberately keeps its existing `req.files[].filename` contract.

## Install backend packages

```bash
npm install sharp googleapis
```

`multer` is already used by Rupio. If missing:

```bash
npm install multer
```

---

# 2. BACKEND ENVIRONMENT

Add these entries to the existing backend `.env`:

```env
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REDIRECT_URI=https://YOUR_API_DOMAIN/product/storage/google/callback
STORAGE_TOKEN_ENCRYPTION_KEY=PUT_A_LONG_RANDOM_SECRET_HERE
GOOGLE_DRIVE_SUCCESS_REDIRECT=https://YOUR_FRONTEND_DOMAIN/app/storage-settings
```

Do not replace your existing `TOKEN_SECRET_KEY` or database configuration.

For `STORAGE_TOKEN_ENCRYPTION_KEY`, use a long random value and keep it fixed. If it is changed later, already-encrypted Drive refresh tokens cannot be decrypted and Superadmins will have to reconnect Drive.

---

# 3. GOOGLE CLOUD SETUP

1. Create/open a Google Cloud project.
2. Enable **Google Drive API**.
3. Configure OAuth consent screen.
4. Create an OAuth **Web application** credential.
5. Add the exact redirect URI used in `GOOGLE_DRIVE_REDIRECT_URI`.
6. Put Client ID and Client Secret into the backend `.env`.
7. Restart the backend.

Each Superadmin then opens **Rupio Storage Connect**, accepts the storage consent, and connects their own Google account.

---

# 4. FRONTEND FILES

Copy:

- `src/components/productImage.js`
- `src/components/ProductMediaStatus.jsx`
- `src/components/EntityDocuments.jsx`
- `src/pages/StorageSettings.jsx`
- `src/pages/ProductCatalogManager.jsx`

Your existing Add Product and Edit Product pages can continue sending files with the current multipart key `files`. No change is required just to activate the hybrid product-image pipeline.

## Add routes to your existing App.js

Add imports:

```jsx
import StorageSettings from "./pages/StorageSettings";
import ProductCatalogManager from "./pages/ProductCatalogManager";
```

Inside the authenticated app routes add:

```jsx
<Route
  path="/app/storage-settings"
  element={
    <RequireAuth>
      <StorageSettings />
    </RequireAuth>
  }
/>

<Route
  path="/app/product-app-catalog"
  element={
    <RequirePerm page="Product Creation" action="View">
      <ProductCatalogManager />
    </RequirePerm>
  }
/>
```

Add menu entries wherever you maintain the V2 sidebar/header:

- **Storage Settings** → `/app/storage-settings`
- **Product App Catalog** → `/app/product-app-catalog`

---

# 5. ADD DOCUMENTS TO PRODUCT / CUSTOMER / USER / TRANSPORTER

Import the common component:

```jsx
import EntityDocuments from "../components/EntityDocuments";
```

Use it only after the record has an `_id`.

Product edit/view:

```jsx
<EntityDocuments
  entityType="product"
  entityId={id}
  defaultDocumentType="Specification"
/>
```

Customer edit/view:

```jsx
<EntityDocuments
  entityType="customer"
  entityId={customerId}
  defaultDocumentType="GST Certificate"
/>
```

User edit/view:

```jsx
<EntityDocuments
  entityType="user"
  entityId={userId}
  defaultDocumentType="Aadhaar"
/>
```

Transporter edit/view:

```jsx
<EntityDocuments
  entityType="transporter"
  entityId={transporterId}
  defaultDocumentType="GST Certificate"
/>
```

Because the same component is used everywhere, document versioning/storage/deletion behaviour stays consistent.

---

# 6. CUSTOMER APP / SALES APP

Copy the `mobile/src` files into each Expo app:

- `src/utils/productCatalog.js`
- `src/components/ProductCatalogImage.jsx`
- `src/components/ProductCatalogCard.jsx`
- `src/screens/ProductCatalogScreen.example.jsx` (reference screen; rename/use as required)

Install:

```bash
npx expo install expo-image
```

Customer App:

```js
loadPublishedProductCatalog({
  apiBase: API_URL,
  database: customer.database,
  channel: "customer",
});
```

Sales App:

```js
loadPublishedProductCatalog({
  apiBase: API_URL,
  database: salesPerson.database,
  channel: "sales",
});
```

`ProductCatalogImage` automatically prefers the optimized app image and falls back to legacy `Product_image` when needed.

---

# 7. MIGRATE EXISTING PRODUCT IMAGES

After deploying the patch and connecting the Superadmin's Drive, run once per company database from the backend folder:

```bash
node scripts/migrateLegacyProductImages.js YOUR_SUPERADMIN_DATABASE
```

This reads existing images from `public/Images`, stores the original privately, creates the three optimized WebP sizes, updates the product media metadata, and marks image-ready legacy products for Customer/Sales App.

After migration, use **Product App Catalog** to unpublish any internal/raw products that should not appear in the apps.

---

# 8. VPS / DOCKER PERSISTENCE — IMPORTANT

Optimized catalog images are intentionally tiny and served by Rupio for speed. The following backend directories must be persistent across deployments/container rebuilds:

```text
public/catalog/
public/Images/
storage/private/
```

If using Docker, mount them to persistent VPS volumes. `storage/private/` is primarily the fallback when Drive is not connected; `public/catalog/` is required for app images.

---

# 9. RESULTING STORAGE FLOW

```text
Product upload from DMS
        |
        +--> Original --> Superadmin Google Drive
        |                 (local private fallback)
        |
        +--> 160 WebP  --> Rupio public/catalog --> lists / thumbnails
        +--> 480 WebP  --> Rupio public/catalog --> Customer & Sales apps
        +--> 1000 WebP --> Rupio public/catalog --> product detail
        +--> compatibility copy --> public/Images --> old DMS pages

Customer/User/Transporter documents
        |
        +--> Superadmin Google Drive
        +--> MongoDB stores metadata/reference only
```

This keeps large/private files out of your Rupio database while keeping product browsing fast enough for ordering apps.
