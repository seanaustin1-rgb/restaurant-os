# Spirit Vault Phase 2 - Codex Handoff

Last updated: 2026-07-30

## Current State

- PR #139 is merged into `main` at `a3efe5b`.
- Local `main` was fast-forwarded to `origin/main`.
- Stale docs PR #141 was closed because it said #139 was still blocked.
- The completed importer worktree and local `claude/spirit-vault-importer` branch were removed.
- `C:/Users/Default_50/restaurant-os-spirit-migration` was left untouched because it contains untracked `backups/`.

## Phase 2 Branch

- Branch: `feat/spirit-vault-admin-phase1`
- Current pushed head before this handoff file: `5a45726`
- Rebased onto current `main`.
- The obsolete `BeverageItem` schema commit was dropped during rebase.
- Existing Phase 2 implementation was adapted toward the canonical model:
  - `/vault` reads `VenueSpirit` + `SpiritDefinition` + primary `SpiritPour`.
  - Admin list/detail/actions use `VenueSpirit` and `SpiritDefinition`.
  - Form/action types use `SpiritLifecycleStatus`.
  - Obsolete `scripts/migrate-spirit-vault.ts` was removed.

## Verification

Completed on `feat/spirit-vault-admin-phase1` before this handoff file:

- `npx.cmd tsc --noEmit` - clean
- `npm.cmd run test` - clean, 408/408
- `npm.cmd run build` - success

No migrations, importer `--apply`, or database writes were run.

## Claude Lane

Stay in Spirit Vault Phase 2 implementation only.

Allowed scope:

- Rebase/adapt existing `feat/spirit-vault-admin-phase1` work onto the canonical model.
- Admin editor for existing Spirit Vault records.
- Dynamic `/vault` backed by canonical Spirit Vault tables.
- Toast bottle/pour pull plumbing only as it relates to `SpiritPour` identity, price, availability, and observations.
- Tests, CI, PR prep, and documentation updates directly required for that work.

Out of scope unless Sean explicitly reopens it:

- Broader product/admin redesign.
- Raven.
- Flight Builder UI.
- QR backend.
- Guest accounts, rewards, passport.
- New durable `BeverageItem` model or parallel beverage catalog.
- Production migrations, importer `--apply`, or database writes.
- Merging PRs without Sean approval.

Decision rule:

- If an agent is unsure whether work belongs in this lane, stop and ask Sean/Codex before building it.

## Phase 2 Review Checklist

- No durable `BeverageItem`.
- No parallel beverage catalog.
- Tenant boundary is explicit via `restaurantId`.
- Guest visibility is `VenueSpirit.recordStatus === "PUBLISHED"` and `VenueSpirit.publicationStatus === "PUBLISHED"`.
- Admin edits are clearly split:
  - venue voice/status on `VenueSpirit`;
  - shared knowledge on `SpiritDefinition` only if intentionally allowed;
  - otherwise use `VenueSpirit.overrides`.
- Toast work maps only to `SpiritPour` identity, price, availability, and `SpiritPriceObservation`.
- `/vault` tenant selection is explicit and deployable.
- Tests cover payload composition, admin writes, tenant isolation, guest visibility, and no `BeverageItem` regressions.

## Open Flags For Claude

1. `/vault` now requires `SPIRIT_VAULT_RESTAURANT_ID`.
   - Solution: confirm intended env name and deployment value before runtime verification.

2. Admin action currently edits shared sensory fields directly on `SpiritDefinition`.
   - Solution: confirm this is intended, or move these edits into `VenueSpirit.overrides`.

3. Payload builder was adapted structurally but not parity-tested against live imported DB rows.
   - Solution: add focused tests comparing canonical rows into `buildVaultPayloadScript` against expected guest-engine fields.

4. `feat/spirit-vault-admin-phase1` has no PR open yet.
   - Solution: open a draft PR before spinning agents so review and CI state are trackable.

## Operator Checklist

Do not run until Claude's Phase 2/importer path is explicitly ready.

Dry-run first, no writes:

```powershell
npx dotenv -e .env.local -o -- tsx scripts/import-spirit-vault.ts --restaurant=cmpvtkou90000syl9ziir8nlj
```

Expected after #140/#139:

- 110 definitions
- 110 venue listings
- 110 offers
- 110 initial price observations
- 109 published
- 1 draft
- no validation failures
- no duplicate keys

If any count differs, stop and ask Claude/Codex to inspect before apply.

Apply only after dry-run matches and Sean explicitly authorizes the write:

```powershell
$env:SPIRIT_VAULT_ALLOWED_TARGETS="<outfront-demo-ref>"
npx dotenv -e .env.local -o -- tsx scripts/import-spirit-vault.ts --restaurant=cmpvtkou90000syl9ziir8nlj --apply --confirm-target=<outfront-demo-ref>
```

Post-apply verification:

- Count all four tables.
- Confirm 110 definitions/listings/offers/observations.
- Confirm 109 guest-visible listings and 1 draft.
- Rerun dry-run to prove idempotency.
- Confirm no duplicate price observations.
- Record results before any dependent merge.

Known DB gate:

- `outfront-demo` tables/FKs were read-only verified by Claude.
- Do not treat that as permission to write.
