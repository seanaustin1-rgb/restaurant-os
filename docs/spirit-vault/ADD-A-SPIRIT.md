# Spirit Vault Add-a-Spirit Workflow

The current prototype is still a single self-contained HTML file. Adding a
spirit should be a data-entry task only.

## Source File

Edit `docs/spirit-vault/spirit-vault-prototype.html`.

Use the data sections only:

- `SPIRIT_DATA`: core bottle, production, flavor, story, pairing, and shelf
  data.
- `DOSSIER_DETAILS`: dossier summary, review date, top notes, press, carry
  rationale, and compare paths.

Do not edit render functions for a normal new spirit.

## Required Steps

1. Add one object to `SPIRIT_DATA` with a permanent slug `id`.
2. Add a matching object to `DOSSIER_DETAILS` with the same `id`.
3. Fill every flavor axis in `FLAVOR_AXES` with a numeric value from `0` to
   `10`.
4. Add exactly three `topNotes`, in display order.
5. Add `paths.lighter`, `paths.similar`, and `paths.adventurous` arrays.
6. Use `ref` only when the compared bottle already exists in the Vault data.
7. Add press entries as `{ date, type, source, title, summary, verified }`.
8. Add optional Toast/external commerce values under `commerce` only when
   known; null values are valid placeholders.

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

If validation passes, the existing renderer, filters, stable-ID navigation,
drawers, and mobile layout should work without code changes.
