# Spirit Vault Add-a-Spirit Workflow

The current prototype is still a single self-contained HTML file. Adding a
spirit should be a data-entry task only. New Batch 1 records use one helper
entry, `makeBatchSpirit({...})`, which generates the renderer-compatible
fields from one logical spirit record.

## Source File

Edit `docs/spirit-vault/spirit-vault-prototype.html`.

Use the data sections only:

- `SPIRIT_DATA`: core bottle, production, flavor, story, pairing, and shelf
  data for legacy records.
- `BOURBON_BATCH_1`: helper-backed one-entry records for the first production
  batch.
- `DOSSIER_DETAILS`: legacy overlay for the original five only. Do not add
  new production-batch records here unless a later migration explicitly
  requires it.

Do not edit render functions for a normal new spirit.

## Required Steps

1. Add one `makeBatchSpirit({...})` object with a permanent slug `id`.
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
- verified recognition without source provenance
- malformed temporary price values

If validation passes, the existing renderer, filters, stable-ID navigation,
drawers, and mobile layout should work without code changes.
