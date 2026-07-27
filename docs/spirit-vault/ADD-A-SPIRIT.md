# Spirit Vault Add-a-Spirit Workflow

Spirit records now live in an **external data file**, separate from the render
engine. Adding a spirit is a data-entry task in **one place, one record** — the
two-map `SPIRIT_DATA` + `DOSSIER_DETAILS` split has been retired.

## Source File

Edit **`docs/spirit-vault/spirit-vault-data.js`** — never the HTML — for a
normal new spirit. The file exports a factory
`window.SPIRIT_VAULT_DATA({ makeBatchSpirit })` that returns one array of
canonical records; the engine (`spirit-vault-prototype.html`) consumes it
through `normalizeSpiritRecords()` → `BOTTLES`.

Two authoring forms live in that file, both producing one canonical record:

- `BATCH`: helper-backed one-entry records via `makeBatchSpirit({...})` — the
  preferred form for new spirits.
- `LEGACY`: the original five as full single objects (their retired
  `DOSSIER_DETAILS` overlay is now folded in). New spirits do **not** go here.

Deployment note: the guest page now loads **two files** — ship
`spirit-vault-prototype.html` **and** `spirit-vault-data.js` together in the
same directory (the loader uses a relative `<script src>`, so it works under
`file://`, local static preview, and Bluehost static hosting; no `fetch`).

Do not edit render functions for a normal new spirit.

## Required Steps

1. Add one `makeBatchSpirit({...})` object to the `BATCH` array in
   `spirit-vault-data.js`, with a permanent slug `id`.
2. Record `brand`, `expression`, `category`, `subcategory`, country, region,
   distillery/producer, proof, age data, production rows, and source URLs.
3. Fill every flavor axis in `FLAVOR_AXES` with a numeric value from `0` to
   `10`.
4. Add exactly three `topNotes`, in display order.
5. Leave Sean-owned fields as `Pending Sean review` unless Sean supplied the
   language.
6. Add `paths.lighter`, `paths.similar`, and `paths.adventurous` only when the
   recommendation is ready; empty arrays are valid for draft records.
7. Use `ref` only when the compared bottle already exists in the Vault data.
8. Add press entries only as `{ date, type, source, sourceUrl, title, summary,
   verified }`. `verified:true` requires a real `sourceUrl` and source date.
9. Store Sean-confirmed menu price under `commerce.pourPriceUsd` with
   `priceProvenance`; this is a temporary venue value pending Toast.

## Optional Commerce Fields

`commerce` is reserved for future Toast or external commerce linkage:

```js
commerce:{
  toastItemGuid:null,
  toastMenuItemGuid:null,
  toastLocationGuid:null,
  externalSku:null,
  externalProductUrl:null,
  lastSyncedAt:null,
  pourPriceUsd:null,
  priceProvenance:null,
  priceIsTemporary:true,
}
```

These fields are not rendered in the prototype.

## Validation

Open the file locally or run browser tests after data entry. In development
contexts, validation blocks rendering and writes console errors for:

- missing required fields
- duplicate IDs
- invalid comparison `ref` values
- malformed press entries
- flavor-axis values outside `0` to `10`
- body/finish values outside `0` to `10`
- invalid record/publication/verification states
- `publicationStatus` exceeding `recordStatus` (a draft cannot be published)
- verified recognition without source provenance
- malformed temporary price values

If validation passes, the existing renderer, filters, stable-ID navigation,
drawers, and mobile layout should work without code changes.
