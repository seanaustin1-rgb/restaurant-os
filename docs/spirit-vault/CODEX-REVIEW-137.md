# Codex review brief — PR #137 (Spirit Vault Phase 2 foundation)

**Repo:** `seanaustin1-rgb/restaurant-os`
**Branch:** `claude/previous-session-context-3b3ry8` → base `main`
**PR:** #137

## What this PR is

The DB-backed foundation for the Spirit Vault admin (Phase 2). Everything is
**additive and pure** — no changes to existing tables, and nothing in the live
app imports the new code yet (no runtime wiring). CI is green (Typecheck / Test /
Build); full suite 369 passing.

**Read first for context:** `AGENTS.md`, `CLAUDE.md`, `docs/spirit-vault/HANDOFF.md`.

Key product direction:
- The DB becomes the single source of truth that regenerates the static guest
  vault (`docs/spirit-vault/spirit-vault-data.js`).
- Multi-tenant from day one — every record is tenant-scoped via `restaurantId` —
  because the vault is intended to become a sellable OutFront add-on. Echo's
  Reserve is the only tenant during testing.

## Files changed (5 + 2 tests)

1. `prisma/schema.prisma` — new `Spirit` and `SpiritPour` models (+ `Restaurant`
   back-relations), three enums (`SpiritLifecycleStatus`,
   `SpiritVerificationStatus`, `SpiritCommerceSource`).
2. `prisma/migrations/20260728000000_add_spirit_vault/migration.sql` — the
   migration. Raw-SQL `CHECK` constraints are appended after the Prisma-generated
   DDL. **Not yet applied to any database.**
3. `src/lib/spirit-vault/validate.ts` — pure publish-time validator (the merge
   gate). `validate.test.ts` covers it (20 cases).
4. `src/lib/spirit-vault/transform.ts` — pure `guestRecordToRows()`: a rendered
   guest record → `Spirit` + pour rows.
5. `src/lib/spirit-vault/load-guest-records.ts` — server/script-only loader that
   reconstructs the 110 records by extracting `makeBatchSpirit` / `formatMoney`
   from `spirit-vault-prototype.html` and `eval`-ing `spirit-vault-data.js` via
   `new Function`. `transform.test.ts` runs the transform against the **real**
   vault (all 110 records).

## Prioritize

1. **Data-model design** — is `Spirit` / `SpiritPour` a faithful, lossless
   representation of the fields `makeBatchSpirit` produces (see the function in
   `spirit-vault-prototype.html`) and the five legacy objects in
   `spirit-vault-data.js`? Anything the transform silently drops?
2. **Tenant isolation** — `restaurantId` scoping + cascade on both models;
   `@@unique([restaurantId, slug])` and `@@unique([restaurantId, toastItemGuid])`.
3. **Raw CHECK constraints vs. Prisma drift** *(the change I'm least sure about)*
   — the migration hand-appends `CHECK`s (status ordering via Postgres enum
   declaration order; `body`/`finish` 0–10) that Prisma's schema DSL can't
   express. Confirm `prisma migrate deploy` (forward-only, how this repo applies
   migrations) tolerates them and that a future `migrate diff`/`dev` won't try to
   drop them or flag drift.
4. **The loader's `new Function` eval** — it evaluates first-party committed
   files only (never user input) and is never bundled into a client/page. Is that
   an acceptable boundary, or should `makeBatchSpirit` be extracted into a shared
   `spirit-vault-engine.js` that both the HTML and the loader consume?
5. **Transform correctness** — legacy records (no `commerce` block) parse
   price/size from the `"$14"` / `"2 oz pour"` display strings; batch records
   carry Toast provenance. Legacy maps to `PUBLISHED`. Edge cases: null proof,
   barrel-proof (`proofN` null → `proofDisplay`), missing pours.

## Already reviewed and fixed (earlier block-review)

- Commerce is now one-to-many (`SpiritPour`, not fields on `Spirit`).
- `SpiritPour.syncedAt` added (cached Toast value keeps a sync timestamp).
- `country` / `silo` defaults dropped (nullable — no false metadata for
  Scotch/Irish/agave/etc.).
- Comment-only invariants promoted to DB `CHECK`s + the pure validator.

## Two known deferrals — confirm acceptable, do not fix now

- `SpiritPour.isPrimary` has no DB-level "exactly one primary per spirit"
  guarantee (importer/validator enforces it; a partial unique index would be
  stronger).
- `topNotes`-exactly-3 is a publish-time validator rule, not a DB check (drafts
  legitimately lack them).

## Output

Concrete, actionable findings with `file:line` references; if it's clean, say so.
**Do NOT run the migration.**
