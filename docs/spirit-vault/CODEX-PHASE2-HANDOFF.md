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
npx dotenv -e .env.local -o -- node scripts/demo-db.cjs "npx tsx scripts/import-spirit-vault.ts --restaurant=cmqnyvbab0000osvwrxhaovxo --require-db"
```

This must print the outfront-demo target from `DEMO_DATABASE_URL` / `DEMO_DIRECT_URL`; do not run the importer through the default `DATABASE_URL`.
It must also print `tenant: EXISTS`; `PLANNED (DB-free)` or `existence NOT verified` is a stop condition, not an acceptable dry-run.
For apply, `DEMO_DIRECT_URL` must be the real Supabase direct host (`db.jzjscsoasfjsxekyfrgi.supabase.co:5432`), not `aws-1-us-west-2.pooler.supabase.com`. The importer uses an interactive transaction; a pooler host can fail mid-import with Prisma `P2028 Transaction not found`.

Current applied baseline after #140/#139:

- 110 definitions
- 110 venue listings
- 110 offers
- 110 initial price observations
- 109 published
- 1 draft
- no validation failures
- no duplicate keys

Expected after `feat/spirit-vault-draft-loader` is reviewed, merged, dry-run verified,
and explicitly approved for apply:

- 200 definitions
- 200 venue listings
- 200 offers
- 193 initial price observations (7 draft website-only records have no matched price)
- 109 published
- 91 drafts
- no validation failures
- no duplicate keys

If any count differs, stop and ask Claude/Codex to inspect before apply.

Apply only after dry-run matches and Sean explicitly authorizes the write:

```powershell
$env:SPIRIT_VAULT_ALLOWED_TARGETS="jzjscsoasfjsxekyfrgi"
npx dotenv -e .env.local -o -- node scripts/demo-db.cjs "npx tsx scripts/import-spirit-vault.ts --restaurant=cmqnyvbab0000osvwrxhaovxo --apply --confirm-target=jzjscsoasfjsxekyfrgi"
```

Post-apply verification for the 110-record baseline:

- Count all four tables.
- Confirm 110 definitions/listings/offers/observations.
- Confirm 109 guest-visible listings and 1 draft.
- Rerun dry-run to prove idempotency.
- Confirm no duplicate price observations.
- Record results before any dependent merge.

Post-apply verification for the 200-record draft-loader branch:

- Count all four tables.
- Confirm 200 definitions/listings/offers and 193 price observations.
- Confirm 109 guest-visible listings and 91 drafts.
- Rerun dry-run to prove idempotency.
- Confirm no duplicate price observations.
- Record results before any dependent merge or publication pass.

Known DB gate:

- `outfront-demo` tables/FKs were read-only verified by Claude.
- Do not treat that as permission to write.

---

## Claude Phase 2 Progress — 2026-07-30 (session 2)

**▶ NEXT SESSION: read THIS file first, then work from `feat/spirit-vault-admin-phase1` (`git fetch && git checkout feat/spirit-vault-admin-phase1 && git pull`). Stay in the Claude Lane above.**

### ⚠ Import target — verified & decided (2026-07-30)
Read-only query of `outfront-demo` (project `jzjscsoasfjsxekyfrgi`) found **one** Restaurant:
`cmqnyvbab0000osvwrxhaovxo` (**Demo Bistro**). The originally-intended import id
`cmpvtkou90000syl9ziir8nlj` (**Stone Grille**) is **ABSENT from outfront-demo** — it lives in
the prod/main DB only. Spirit Vault tables in outfront-demo are currently **empty**
(0 definitions / listings / offers).

**DECISION (Claude, per Sean's delegation): import against the existing Demo Bistro row
`cmqnyvbab0000osvwrxhaovxo`. Do NOT create a Stone Grille row in outfront-demo.** Why:
demo envs should use demo tenants (don't replicate a prod tenant into demo); creating a
`Restaurant` row is a fragile out-of-lane write (owner role / business access / Clerk org);
and `SpiritDefinition` (objective knowledge) is shared/tenant-agnostic, so the content
renders fully under Demo Bistro — only voice/overrides are tenant-scoped. All restaurant-ids
in this doc (incl. the Operator Checklist below) now use `cmqnyvbab0000osvwrxhaovxo`.

**Prod is a separate, later track:** Stone Grille's real vault → apply the migration to the
**prod** DB and import against `cmpvtkou90000syl9ziir8nlj` **there**. Distinct Sean-gated step.

### Done — branch `feat/spirit-vault-admin-phase1`, tip `8948170`, PR #142 (draft), CI green
- **Flag 4** — draft PR #142 opened (review/CI trackable).
- **Flag 2** — operator sensory edits (body/finish/flavor/topNotes/pairings) now write to `VenueSpirit.overrides`, NOT shared `SpiritDefinition`. `actions.ts` persists overrides + validates EFFECTIVE (override ?? definition) values; `admin/spirit-vault/[id]/page.tsx` pre-fills effective values; `vault-payload.ts` `listingToVaultRecord` merges override → definition → default (new `VaultOverridesInput`; listing field typed `unknown` to accept the Prisma Json column, narrowed at use).
- **Flag 3** — `vault-payload.test.ts` parity: definition-only mapping (Codex) + overrides-win, partial-override fall-through, null-overrides, and 0-valued override (Claude).
- **Flag 1** (config) — env `SPIRIT_VAULT_RESTAURANT_ID` = `cmqnyvbab0000osvwrxhaovxo` (demo tenant on outfront-demo). No code change (the `/vault` route already reads it).
- **Admin-write test** — `actions.test.ts` asserts `updateSpirit` writes `VenueSpirit.overrides`, never mutates `SpiritDefinition`, persists trimmed voice/status, and rejects publish>record (Clerk/prisma/validate mocked).
- Verify (tip `d7bcddb`): `tsc --noEmit` clean, full vitest **418/418**, `npm run build` ok. No migrations / importer `--apply` / DB writes.
- **Operator import / runtime DB parity (2026-08-09)** — APPLIED to
  outfront-demo project `jzjscsoasfjsxekyfrgi`, restaurant Demo Bistro
  `cmqnyvbab0000osvwrxhaovxo`, via direct host through `scripts/demo-db.cjs`.
  Apply inserted 110 `SpiritDefinition`, 110 `VenueSpirit`, 110 `SpiritPour`,
  and 110 `SpiritPriceObservation` rows; validation failures 0; unresolved
  identities / duplicate keys 0. Post-apply idempotency dry-run: 110 records,
  109 published, 0 validation failures, 0 duplicate keys, price observations
  inserted 0 / skipped 110. Post-apply counts: definitions 110, venue listings
  110, offers 110, price observations 110, guest-visible listings 109, draft
  listings 1, duplicate price observations 0.

### Flight Builder split → #143 (Claude, per Sean 2026-07-30)
Codex's `c15111f "Add Spirit Vault flight builder"` (SpiritFlight/SpiritFlightItem
migration `20260809000000_add_spirit_flights` + `admin/spirit-vault/flights/*` UI +
`flight-pricing` + nav/roles) was OUT OF SCOPE for this PR (Claude Lane → "Flight Builder
UI"). Per Sean it was SPLIT:
- **#143** `feat/spirit-vault-flight-builder` (= `c15111f`, stacked on #142) — flight work preserved.
- **#142** `feat/spirit-vault-admin-phase1` reset `c15111f` → **`f26ab2c`**: the flight commit,
  its migration, and the `SpiritFlight`/`SpiritFlightItem` models are REMOVED. #142 is now
  purely the in-scope admin/vault/overrides + importer work.
- The flight migration is **NOT applied to any DB** (verified 0 flight tables in outfront-demo);
  `/admin/spirit-vault/flights` 500s until applied — a deliberate later step on #143.

⚠ **CODEX SYNC REQUIRED:** if your local `feat/spirit-vault-admin-phase1` is still at `c15111f`,
do NOT push it (a fast-forward would re-add the flight commit). Sync with:
`git fetch origin && git checkout feat/spirit-vault-admin-phase1 && git reset --hard origin/feat/spirit-vault-admin-phase1`.

### Deployed demo runtime — LIVE (Codex, 2026-08-09)
Vercel outfront-demo envs point at the demo DB (`DATABASE_URL` pooler + `DIRECT_URL` direct);
the exposed DB password was rotated and envs updated. **GET `/vault` → 200, renders 109 spirits.**
Non-blocking cleanup fixed in follow-up: `/favicon.ico` now serves as a static asset, so missing-favicon requests do not fall through Clerk-aware rendering.

### Open / next (in-lane)
- **Runtime verified:** Vercel outfront-demo serves `/vault` with `SPIRIT_VAULT_RESTAURANT_ID=cmqnyvbab0000osvwrxhaovxo`; guest-visible count is 109.
- **Draft inventory loader branch:** `feat/spirit-vault-draft-loader` stages Agave/Rum/Vodka draft inventory as hidden, unverified records. Do not apply until dry-run projects 200 total records, 109 published, 91 drafts, no validation failures, and no duplicate keys.
- **When Sean directs:** Toast pull → `SpiritPour` price/availability/observation wiring; admin list polish.

### Sean's audit answers encoded — 2026-08-18 (stacked on the draft-loader branch)
All seven `DRAFT-CONTENT-AUDIT.md` open questions are answered and encoded; the decision
table and the reasoning live at the top of that file. Corpus shape is untouched — still
200 records, 91 drafts, and the same guest-visible set. Two new record states were added
(`identityConfirmedDraft`, `shelfOnlyListing`) so "we know the bottle but not its facts"
and "listed, never dossiered" stop being implied by silence.

**⛔ One answer could NOT be delivered: the flavor radar (question 7).** Sean asked for the
axes to be derived from tasting notes found online. This container's network egress blocks
every producer and reference domain (herradura.com, cuervo.com, ketelone.com,
diffordsguide.com, Wikipedia — all fail through the proxy). Web search returns summaries
only, and writing axis values from a snippet while citing a page nobody opened is the exact
failure mode this lane guards against. **Next session needs an environment with outbound
web access** to do question 7 and the remaining Tier-A sourcing.

Two findings worth a decision when that happens:
- All 26 Batch-2 sourced drafts still carry the **identical** scaffold radar
  (`Sweet:5 Oak:5 Spice:5 Fruit:4 Smoke:1 Earth:3 Herbal:2`, body/finish 5). Malibu and
  Herradura Añejo render the same shape today.
- The engine has **no way to express "radar not set"** — the record validator in
  `spirit-vault-prototype.html` requires all seven axes to be finite 0–10 numbers, so an
  untasted record is indistinguishable from a profiled one. Giving the radar an absent
  state is an engine change and was left alone rather than done quietly.

### Decisions locked (Sean, 2026-07-30)
- Sensory edits → `VenueSpirit.overrides` (venue-local; shared knowledge stays canonical).
- `/vault` serves demo tenant `cmqnyvbab0000osvwrxhaovxo` on `outfront-demo`.

### Coordination note
Codex handed off `feat/spirit-vault-admin-phase1` after `1caa36d`; Claude owns it now and pushes **fast-forward only** (never force over Codex). Claude worktree: `C:/Users/Default_50/restaurant-os-spirit-migration` on branch `claude/sv-phase2-overrides` (has `node_modules`; untracked `backups/` — leave it).
