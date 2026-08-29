# Spirit Vault — Go-Live Plan

**Drafted:** 2026-08-29 · **Author:** Claude (implementation lane)
**Basis:** static read of `main` @ `53ce1d8`. **No test/build/DB verification was
possible** — the Mac this was drafted on has no Node and no `node_modules`. Every
"verify" step in Phase 0 exists because of that. Treat runtime claims below as
*read from the source*, not *observed running*.

---

## Verdict in one paragraph

The Spirit Vault is not missing features — it is missing a **last mile**. The
schema, the guest vault, the access gate, the admin editor, flights, placemats
and the membership spine are all built, tested (12 spirit-vault test files inside
a 62-file suite), and the code is careful in the places that matter (timing-safe
code compare, tenant-composite FKs, fail-closed membership lookup, open-redirect
guard on the QR entry point). What does not exist is a **supported path to get
spirit data into a production database**, and the five environment variables the
whole feature depends on are undocumented. Until those two things are fixed,
`/vault` in production serves either a 503 or an empty vault. Everything else on
this plan is downstream of that.

---

## The blocker, stated precisely

`scripts/import-spirit-vault.ts` is the **only** code path that creates
`SpiritDefinition` / `VenueSpirit` / `SpiritPour` rows. (Verified: the only
non-test `.create`/`.upsert` calls on those models live in
`src/lib/spirit-vault/import-spirits.ts`, which only that script invokes.)

That script refuses to write to production **by design**:

- `scripts/import-spirit-vault.ts` — refuses when `NODE_ENV=production`.
- It requires `SPIRIT_VAULT_ALLOWED_TARGETS`, described in its own header as
  "the approved **non-prod** allowlist", and refuses when that list is empty.
- It additionally requires `--confirm-target` to equal the allowlisted ref.

Those guards are good and should not simply be deleted. But their combined effect
is that **no sanctioned production seed exists**. This needs a deliberate
decision, not a workaround (Phase 1, item 2).

A second, smaller edge in the same file: `assertPlanMatchesExpectation()`
hardcodes "expected 110 records / 109 published" and blocks `--apply` on any
mismatch. The moment content changes, `--apply` wedges until someone edits the
script.

---

## Phase 0 — Establish ground truth *(half a day, work computer only)*

Nothing below can be answered from a static read. Do these first and record the
answers in `HANDOFF.md`, because the rest of the plan branches on them.

1. `npm ci && npx tsc --noEmit && npm test && npm run build` — confirm `main` is
   actually green. CI (`.github/workflows/ci.yml`) says it should be; confirm locally.
2. `npx prisma migrate status` against **prod** and against **`outfront-demo`**.
   Six spirit-related migrations must be applied:
   `20260728000000_add_spirit_vault`, `20260809000000_add_spirit_flights`,
   `20260810000000_add_flight_item_pairing_bites`,
   `20260818210000_add_membership_spine`,
   `20260819120000_add_member_marketing_optin`,
   `20260819130000_membership_redemption_tenant_fk`.
   The 2026-07-30 handoff notes PR #138 only *claimed* the demo migration was
   applied and flagged it as needing independent confirmation. It still does.
3. Does a `Restaurant` row for Echo's Reserve exist in **production**? Capture its
   `id` — that is `SPIRIT_VAULT_RESTAURANT_ID`.
4. Where does this app actually deploy? There is no `vercel.json` or
   `netlify.toml` in the repo. `appBaseUrl()` in `day-code.ts` falls back to
   `https://www.outfrontdata.com`. Confirm the hosting target and who holds its
   env config.
5. Count existing `VenueSpirit` rows per tenant in both DBs. This decides whether
   the first production load is a seed or a merge.

**Exit criteria:** the five answers written down. Do not start Phase 2 without them.

---

## Phase 1 — Make production configurable and safe *(≈1 day)*

### 1.1 Document the environment contract

`.env.example` documents **none** of the Spirit Vault variables. All five are
referenced in shipped code:

| Variable | Consumed by | Behaviour when unset |
|---|---|---|
| `SPIRIT_VAULT_RESTAURANT_ID` | `src/app/vault/route.ts` | `/vault` returns **503** |
| `SPIRIT_VAULT_DAY_SECRET` | `src/lib/spirit-vault/day-code.ts` | Gate **disabled — the entire vault is public** (deliberate fail-open) |
| `SPIRIT_VAULT_MEMBERSHIP_PEPPER` | `src/lib/spirit-vault/membership-code.ts` | **Throws** — membership codes cannot be issued or redeemed |
| `SPIRIT_VAULT_TZ` | `day-code.ts` | Defaults to `America/New_York` |
| `SPIRIT_VAULT_ALLOWED_TARGETS` | `scripts/import-spirit-vault.ts` | Importer `--apply` refuses |

Add all five to `.env.example` **with the "when unset" column**. The
`SPIRIT_VAULT_DAY_SECRET` row is the important one: the risky state for this
feature is *shipped but not configured*, not *not shipped*. That is worth an
explicit comment in the file.

### 1.2 Decide and build the production seed path — **needs Sean's call**

- **Option A (recommended): an explicit production-seed mode in the existing
  importer.** Add a `--production-seed` flag that is refused unless *all* hold:
  a separately-named `SPIRIT_VAULT_PROD_TARGET` env var matches the
  `DATABASE_URL`-derived ref; `--confirm-target` matches it too; **and** the
  tenant currently has zero `VenueSpirit` rows (so it can only ever seed, never
  silently overwrite curated production data). Keeps one audited code path,
  keeps every existing guard intact for the normal case.
- **Option B: seed demo, then promote.** Load into `outfront-demo`, verify, run a
  separate promote script. More moving parts and a second code path to trust; the
  guard surface gets larger, not smaller.

### 1.3 Un-wedge the record-count assertion

Replace the hardcoded `110 / 109` in `assertPlanMatchesExpectation()` with
`--expect-records=N --expect-published=N` (still required for `--apply`, so the
operator consciously states the baseline). Content growth should not require a
code edit to unblock an import.

---

## Phase 2 — First production cutover *(≈1 day, sequential, do not parallelise)*

1. **Back up production.** Then `prisma migrate deploy`. Verify tables and
   constraints exist — do not trust the migration log alone.
2. **Generate and set secrets.** `SPIRIT_VAULT_DAY_SECRET` and
   `SPIRIT_VAULT_MEMBERSHIP_PEPPER` — long random values, stored in the deploy
   target's secret manager. ⚠ **Rotating the pepper invalidates every membership
   code ever issued** (`membership-code.ts` says so explicitly). Set it once,
   before any code is handed to a guest.
3. **Dry run the importer against prod and read the whole report** — the
   would-insert/would-update split, validation failures, duplicate canonical
   keys. Do not skim it.
4. **Apply.** Then confirm row counts: `SpiritDefinition`, `VenueSpirit`,
   `SpiritPour`, `SpiritPriceObservation`.
5. **Smoke test, in this order:**
   - `/vault` with the day secret *not yet set* → the full vault renders (~109
     dossiers). Confirms data + engine.
   - Set the day secret → `/vault` now shows the unlock gate.
   - `/admin/spirit-vault/today` → prints today's code + QR.
   - Scan it → `/v/<code>` sets the cookie and lands in the vault.
   - `/admin/spirit-vault` → the list renders with the published count.
   - Create a flight → `/vault/flights/<id>/placemat` prints on US Letter.
   - Issue a membership code → redeem it from a second browser profile → confirm
     off-premise access works with no day code.
6. **Verify the engine file ships.** `/vault` reads
   `docs/spirit-vault/spirit-vault-prototype.html` **from disk at runtime**.
   `next.config.mjs` has `outputFileTracingIncludes` for `/vault` to cover this.
   If the real deploy target doesn't honour it, `/vault` 500s in production while
   working perfectly in dev. Check this explicitly on the deployed URL, not locally.

### Decision to make here: the two guest surfaces

There are currently **two** guest vaults — the GitHub Pages static prototype
(Coal's review link, fed by `spirit-vault-data.js`) and the dynamic `/vault`
(fed by the DB). They share the engine HTML but **not the data**, so they will
drift the moment anyone edits a record in the admin. Pick one:

- Retire Pages, redirect the link to `/vault` — one source of truth; costs Coal
  the no-login preview.
- Keep Pages as a frozen preview and accept the drift — then say so in
  `HANDOFF.md` so nobody treats the static data as live.

---

## Phase 3 — Make it operable without an engineer *(2–4 days)*

This is the phase that decides whether the vault is a product or a demo.

### 3.1 Admin "add a bottle" from Toast — **highest leverage missing feature**

`src/lib/spirit-vault/toast-pull.ts` is fully written, documented as powering
"the admin *add a bottle* checklist and the weekly auto-ingest job" — and is
**referenced by nothing**. Confirmed: no import of it anywhere in `src/` or
`scripts/`.

Consequently there is **no way to add a bottle through the UI**. The admin has a
list page and an edit page (`/admin/spirit-vault`, `/admin/spirit-vault/[id]`)
but no create route and no create action. New bottles require the importer
script, which refuses production. After Phase 2, the production vault would be
frozen at whatever was seeded.

Build: a checklist page that calls `pullToastBottles` + `dedupeByName`, lists
Toast bottles not yet in the vault, and on submit creates
`SpiritDefinition` + `VenueSpirit` + `SpiritPour` as **DRAFT**. Sean then fills
the voice fields in the existing editor and publishes. This is exactly the
"Toast-checklist front door" the 2026-07-28 spec already describes.

### 3.2 Price refresh

`SpiritPriceObservation` is written **only** by the importer's initial seed. No
Inngest job references spirits or prices (checked `src/lib/inngest/functions.ts`).
Prices freeze at import and `priceDisplay()` renders `"Pending"` for anything
unpriced — silently, on the guest dossier.

Build a manual "refresh prices from Toast" admin action first (writes a new
`SpiritPriceObservation`, updates `SpiritPour.priceUsd`), then consider a weekly
Inngest job. Manual first: it is testable, and it makes the failure visible to a
human rather than to a log.

### 3.3 Handle bottles that leave the menu

Decide what happens when a bottle is 86'd or removed from Toast. Today nothing
detects it, so the guest vault keeps advertising it. Minimum viable: flag it in
the admin list; do not auto-unpublish (that is a curation call, not a POS call).

---

## Phase 4 — Content *(Sean's time, not engineering)*

The tooling for this already exists; it is data entry in
`/admin/spirit-vault/[id]`.

**Current state of Sean's voice across ~110 records** (counted in
`spirit-vault-data.js`):

| Field | Populated | Gap |
|---|---|---|
| `whyWeCarry` | 94 | ~16 |
| `seanShort` (curator cue) | **5** | ~105 |
| `notes` (Sean's Notes) | **5** | ~105 |

Only the five original legacy records carry the curator cue and Sean's Notes. The
renderer hides both when empty, so this degrades gracefully — but the
"personally curated" character of the vault currently exists on 5 of 110 bottles.

**Recommendation:** do not attempt all 105. Prioritise the ~20 bottles that
actually get poured and the ones that appear in flights. That is a couple of
sittings, not a project.

**Shelf coverage** is whiskey-only: 51 Bourbon, 16 Rye, 10 Scotch, 5 Irish,
3 Canadian, 2 Blended, 2 American Whiskey, and 1 each of Tennessee, Japanese,
American Single Malt, Rum, Agave. Gin, vodka, tequila and rum shelves are not
built. The `silo()` mapper in `vault-payload.ts` already handles tequila / rum /
scotch categories, so those need content only; gin and vodka would also need a
silhouette. The batch research pipeline is documented in `HANDOFF.md`.

---

## Phase 5 — Operational rollout

Run one real service end to end before calling it live: print the today card,
build a real flight, print the placemat, watch an actual guest scan it. The
failure modes that matter here (a printer that won't do US Letter borderless, a
QR that scans to a dead host, a code a guest mistypes) do not appear in tests.

Note on the QR: `appBaseUrl()` deliberately refuses loopback hosts and falls back
to `https://www.outfrontdata.com`, because a printed QR cannot self-correct.
Confirm `NEXT_PUBLIC_APP_URL` is the real public origin before the first print run.

---

## Open decisions for Sean

1. **Production seed path** — Option A (guarded mode in the importer) or B
   (seed demo, promote)? *Blocks Phase 2.*
2. **The GitHub Pages prototype** — retire and redirect, or keep as a frozen
   preview? *Blocks the Phase 2 cutover being clean.*
3. **Membership billing** — `GuestMembership.source` accepts `"billing"` and
   `clerkSubscriptionId` is modelled, but nothing writes either and there is no
   Stripe/Clerk billing wiring anywhere in the repo. Comp codes only for now, or
   is paid membership in scope? *Does not block anything; decide before promising it.*
4. **Non-whiskey scope** — is the vault a whiskey program or the full back bar?
   *Drives Phase 4 size.*

---

## Sharp edges worth remembering

- **Unset `SPIRIT_VAULT_DAY_SECRET` makes the whole vault public.** Fail-open is
  the documented intent (so shipping never locks a live vault), but it means the
  dangerous configuration is the *incomplete* one.
- **The membership pepper is write-once in practice.** Rotating it invalidates
  every code already in a guest's hands.
- **`/vault` depends on a file on disk at runtime**, not on a bundled import.
  This is a deploy-topology dependency, not a code dependency.
- **The importer's 110/109 baseline** blocks `--apply` on any content change.
- **The day cookie is scoped to `/vault`** and re-validated per request, so a
  cookie surviving midnight is still rejected. This is correct — don't "fix" it.
