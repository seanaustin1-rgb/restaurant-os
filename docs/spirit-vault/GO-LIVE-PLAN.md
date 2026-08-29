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

---

# Update — 2026-08-29, later the same day

Sean answered all four open decisions, and answering them surfaced a large piece
of unmerged work the original assessment above did not account for. **Read this
section as amending the plan above**, not replacing it.

## Decisions, recorded

| # | Decision | Sean's call |
|---|---|---|
| 1 | Production seed path | **Option A** — a guarded seed mode in the existing importer. *Implemented, see below.* |
| 2 | GitHub Pages prototype | **Retire and redirect** to `/vault`. |
| 3 | Membership billing | **No paid tier.** The account exists to track and reward what a guest tastes. |
| 4 | Shelf scope | **Everything** — the full back bar, not a whiskey program. Drafts for the rest already exist. |

## 1 · Option A is built

`--production-seed` is implemented in `scripts/import-spirit-vault.ts`, with the
guard decisions extracted into pure, unit-tested functions
(`src/lib/spirit-vault/import-guards.ts`, 25 tests). The mode is refused unless
**all** hold:

- `SPIRIT_VAULT_PROD_TARGET` is set and names **exactly one** database ref —
  deliberately a *different* variable from the non-prod allowlist, so a production
  ref pasted onto the everyday allowlist grants nothing;
- that ref matches the one derived from `DATABASE_URL`;
- `--confirm-target` matches it too;
- the tenant holds **zero `VenueSpirit` rows**, so the mode can only ever seed an
  empty vault and can never overwrite curated production records.

`NODE_ENV` is deliberately *not* consulted in this mode — it describes the process,
never the database, and a seed is legitimately run from an operator machine.

Two related changes shipped with it:

- **1.3 done.** The hardcoded `110 / 109` baseline is replaced by required
  `--expect-records` / `--expect-published` flags. The safety it provided (you
  cannot apply a plan nobody looked at) is preserved by *requiring* both numbers;
  the brittleness is gone. Dry runs now print the exact flags the apply will need.
  Decision 4 makes this immediately load-bearing: the shelf is about to grow.
- **1.1 done.** All six `SPIRIT_VAULT_*` variables are documented in
  `.env.example`, each with what breaks when it is missing.

## 2 · Retiring Pages has one non-obvious catch

The file Coal's link points at — `docs/spirit-vault/spirit-vault-prototype.html` —
is **the same file `/vault` reads from disk at runtime** as its rendering engine.
So "retire the Pages site" cannot mean replacing that file with a redirect stub;
that would break the production vault.

Retire it one of these ways instead:

- **Move the engine out of `docs/`** (say to `src/engine/spirit-vault-engine.html`),
  update `ENGINE_PATH` in `src/app/vault/route.ts` and the
  `outputFileTracingIncludes` entry in `next.config.mjs`, and leave a redirect stub
  at the old Pages path. Cleanest — the engine is app source, not a published doc —
  and it ends the two-guest-surfaces drift permanently.
- **Or** simply disable Pages in repo settings and send Coal the new URL. The old
  link then 404s rather than redirecting.

Either way this belongs in Phase 2, after the deploy is verified — a redirect to a
`/vault` that isn't serving yet is worse than the current preview.

## 3 · Membership is a tasting passport, and it is not built

Sean's answer removes a scope question and opens a real gap. The membership
account is meant to **track the pours a guest tastes and reward that usage**.
Checked against the schema: there is **no model for any of it**. No
`GuestTasting`, no favourites, no rewards, no visit or pour log. `SpiritPour` is a
*menu offer* (a sellable size and price), not a record that someone drank
something.

What exists today is the access half only: `GuestProfile`, `GuestMembership`,
`MembershipCode`, `MembershipRedemption` — enough to sign a member in and unlock
the vault off-premise, and nothing more. The billing fields
(`source: "billing"`, `clerkSubscriptionId`) can stay dormant; they aren't the gap.

**This is new scope, not a loose end.** A minimum tasting passport needs a
`GuestTasting` model (guest × venue spirit × when, optionally the flight it came
from and a rating), a way to record a pour — the flight placemat QR is the natural
capture point, since the guest already scans it — and a guest-facing "what I've
tasted" view. Sizing that is its own conversation; it should not be smuggled into
the go-live sequence. **Recommendation: launch the vault without it.** Access and
comp codes work today; the passport is the reason to come back, and it is better
designed against a live vault than guessed at before one.

## 4 · The rest of the shelf exists — in an open PR, with caveats

The drafts Sean is referring to are real and I found them: **`spirits-import.json`
on `claude/spirit-vault-flight-builder-x71qai` — PR #162, open, 37 commits ahead
of `main` and 0 behind.** 200 records: the 109 already published, plus **91
drafts** — Agave 43, Rum 24, Vodka 23, Bourbon 1. Every draft is fully populated,
including `whyWeCarry`, `seanShort` and `notes`, which closes most of the content
gap the table in Phase 4 above describes.

PR #162 is much larger than the catalog, and the plan above is out of date about
several things because of it. It also adds: a web-based import route and button, a
matching export route, custom flight templates (with a migration), dynamic flight
groupings, availability filtering, a spirit list table with filters, and an admin
shell layout.

### ⚠ Blocker on PR #162 — cross-tenant write in the import route

`src/app/admin/spirit-vault/import/route.ts` authenticates the caller and looks up
their `role.restaurantId` — **and then never uses it.** `processSpirit()` resolves
records by `prisma.venueSpirit.findUnique({ where: { id: s.venueSpirit_id } })`
with no tenant filter, using the *target record's own* `restaurantId` for
downstream writes. The caller's tenant is never compared to the target's.

So an operator of any `RESTAURANT` tenant can POST a payload carrying another
tenant's `venueSpirit_id` values and overwrite that tenant's `whyWeCarry`,
`seanShort`, `notes` and sensory overrides, create a `SpiritPour`, and flip records
to `PUBLISHED`. The sibling export route in the same PR scopes correctly
(`where: { restaurantId: role.restaurantId }`), which is what makes this read as an
oversight rather than a decision.

**Fix before merge:** scope the lookup to the caller's tenant —
`findFirst({ where: { id: s.venueSpirit_id, restaurantId: role.restaurantId } })` —
and treat a non-match as `skipped`, exactly as a missing record is treated now.

Two smaller things to settle in the same review:

- The route **auto-publishes**: creating a priced pour writes
  `recordStatus/publicationStatus = "PUBLISHED"` directly, bypassing the
  `updateSpirit` action's publish rules (publication may not exceed record status;
  a published record needs at least one pairing). Decide whether an import may
  publish at all, or should only ever land content as `DRAFT` for a human to
  publish.
- It is a **second write path** into the spirit tables, with different guards from
  the CLI importer this plan just hardened. That is defensible — one is a seed, one
  is an operator tool — but it should be a stated decision, and the CLI importer's
  header should stop implying it is the only way in.

### Editorial gate on the 91 drafts

The catalog commit describes the content as merged Gemini output; the pour prices
came from Sean. Before these drafts go guest-visible, two things need a human call
— they are exactly what `HANDOFF.md`'s audit gate was written for:

- **No sources.** The records carry no `sourceUrl`, verification status, awards or
  press fields at all, while asserting hard facts — proof, mash bill, production
  method, and specifics like "double-filtration through coconut shell charcoal" or
  "eighteen months in repurposed white oak". The binding rule in `HANDOFF.md` is
  real sources on every claim before publishing.
- **The curator voice is generated.** `notes` and `seanShort` are written in Sean's
  first person ("I love how the agave doesn't hide behind the oak here") on all 91
  drafts. That is the owner's voice, machine-authored, on a page whose whole premise
  is personal curation — and it cuts against the recorded 2026-07-27 deferral, where
  Sean asked to fill these himself through the admin tool. This is Sean's call, not
  a technical one, but it should be a *conscious* call before publish, not a
  side-effect of an import.

A reasonable middle path: import all 91 as `DRAFT` with the factual fields, treat
the generated `notes`/`seanShort` as a first draft Sean edits in
`/admin/spirit-vault/[id]`, and publish per bottle rather than in bulk.

### Still missing from "everything"

The 91 drafts cover agave, rum and vodka. **There is no gin in the catalog at
all** (0 records), and no liqueurs, cordials or brandy. Worth a Toast pull to size
what is left before calling the shelf complete. Note also that gin and vodka have
no bottle silhouette — `silo()` in `vault-payload.ts` maps tequila, rum and the
whisky families and falls through to `bourbon` for everything else, so vodka
records are currently drawn on a bourbon silo.

## Revised sequence

1. **Fix and merge PR #162** — the cross-tenant write first. It carries the
   catalog, the admin shell and the flight work, so almost everything else sits
   behind it.
2. **Phase 0** verification (unchanged, and now also: confirm the
   `20260824230000_add_custom_flight_templates` migration).
3. **Phase 2** cutover, using `--production-seed`, followed by retiring Pages.
4. **Publish the 91 drafts** per the editorial gate above — not in bulk.
5. **Phase 3** operability: the Toast add-a-bottle checklist is still unbuilt
   (`toast-pull.ts` remains referenced by nothing, on both branches), and price
   refresh still does not exist.
6. **Then** scope the tasting passport.

---

# Update — accolades, distilleries, and the voice fields (2026-08-29)

Sean settled the content question from the editorial gate above and added a new
requirement: **awards and accolades must be recorded — for spirits *and* for the
distilleries themselves.** The forward reason matters for the design: eventually an
agent will scout spirits-industry news for the bottles we carry and the distilleries
we represent, and surface it for social posts. That is not being built now, but the
data model laid down now decides whether it is cheap or expensive later.

## The voice fields — settled

| Field | Renders as | Decision |
|---|---|---|
| `whyWeCarry` | "Why We Carry It" — venue voice, unsigned | **Keep the drafted text as written.** It publishes as-is. |
| `notes` | "Sean's Notes" drawer, **signed `— Sean · Echo's Reserve · Curator`** | **Sean-authored only.** Never imported. Empty until he writes it; the drawer stays hidden. |
| `seanShort` | Unsigned pull-quote in the cue card | *Open — see the question at the end.* |

The distinction that drives this is attribution, and it is already in the renderer:
`notes` is printed above an explicit signature block (`spirit-vault-prototype.html`
around the `notes-sig` div), so machine-written text there would sign Sean's name to
words he did not write. `whyWeCarry` and `seanShort` carry no attribution.

**Implementation:** the import must not write generated `notes`. The guest engine
already hides the drawer correctly (`hasSeanNotes` gates
`drawer('notes', "Sean's Notes", …)`), and the admin editor already treats an empty
value as "hide it" — so this is an importer rule, not a renderer change. PR #162's
import route currently writes `notes: s.notes?.trim() || null` straight from the
payload; it needs to stop importing that field, or the payload needs it nulled.

## What the catalog records today

Almost nothing. Across all 110 live records there are **5 press entries total** —
3 awards, 1 score, 1 venue-event — and **every one of them is `verified: false` with
`sourceUrl: null`**, i.e. placeholders explicitly held back from publication. The 91
drafts on PR #162 carry no award, press, source or verification fields at all.

So this is effectively greenfield, which is the good news: it can be modelled
properly the first time rather than migrated later.

## Where accolades can live now, and why that isn't enough

`SpiritDefinition.press` is a `Json?` column ("verified professional
ratings/medals/media"), alongside `sources Json?`, `sourcingLimitations String[]`
and a `verificationStatus` enum. That is fine for *rendering* a dossier and is what
the guest engine reads.

It is the wrong shape for what Sean is describing, for two reasons:

1. **A JSON blob is not queryable.** "Every Gold medal since 2026", "which of our
   bottles have been scored above 92", "what has this distillery won" — none of
   those are reasonable queries against a JSON column, and all of them are exactly
   what a social-scouting agent needs.
2. **There is no distillery entity at all.** `distilleryName` is a nullable *string*
   on `SpiritDefinition`. There is no `Distillery` model anywhere in the schema. So
   "the distilleries we represent" cannot be answered except by string-matching, and
   a distillery-level award has nowhere to attach.

## Proposed model — two new tables

Deliberately additive and shaped like the existing canonical split (shared,
objective knowledge carries no `restaurantId`).

**`Distillery`** — canonical and shared, the same tier as `SpiritDefinition`:
`slug`, `name`, `country`, `region`, `city`, `founded`, `website`, `story`. Then
`SpiritDefinition.distilleryId` as a nullable FK, with the existing
`distilleryName` string retained through the migration and backfilled from it.
This is the piece that turns "distilleries represented" into a real query, and it
is a prerequisite for distillery-level accolades — not optional sugar.

**`Accolade`** — one row per award, score, or press mention, attached to *exactly
one* subject:

- `spiritDefinitionId` **or** `distilleryId` — exactly one non-null (DB CHECK).
- `type` — `AWARD` | `SCORE` | `PRESS` | `CERTIFICATION`.
- `source` — the awarding body or publication ("San Francisco World Spirits
  Competition", "Whisky Advocate").
- `title` — "Double Gold", "93 Points".
- `scoreValue` / `scoreScale` — nullable, so scores sort and filter numerically.
- `awardedOn` — date, nullable (some accolades are year-only).
- `sourceUrl`, `summary`.
- `verified` — boolean, **default false**.
- `discoveredBy` — `HUMAN` | `AGENT`, and `discoveredAt`.

Two rules carried over from the existing content gate, promoted from prose in
`HANDOFF.md` into enforced constraints — because an agent will eventually be
writing these rows:

- **`verified: true` requires a `sourceUrl`** (the existing exception for
  `type: venue-event` still applies). Enforce in the validator, and as a DB CHECK if
  it is expressible.
- **Anything an agent writes lands `verified: false`.** Machine discovery is a
  queue, never a publication. A human flips `verified`.

The guest engine keeps reading its existing `press` shape — build it as a
*projection* of `Accolade` rows in `vault-payload.ts`, so nothing in the renderer
changes and the 5 existing placeholder entries migrate in as unverified rows.

## The scouting agent — not now, but don't preclude it

Recorded as direction, not scope. The model above is what makes it cheap: a
scouting agent needs to ask "which distilleries do we represent, and what is new for
them", write candidates with a source and a date, and never publish on its own.
`Distillery` + `Accolade.discoveredBy` + `verified` default-false give it all three.
Anything beyond that — the scouting schedule, the social-post drafting, an approval
queue UI — is a separate build, and should be scoped after the vault is live.

## Sequencing

This does **not** belong in the go-live path. The vault can launch with the
accolade data it has (almost none), and the Recognition drawer already hides itself
when empty. Slot it after Phase 3, alongside or just before the tasting passport —
both are "reasons to come back" rather than "reasons it works".

The one thing worth doing *before* the 91 drafts publish: decide whether they need
any accolades at all. They currently have none, the drawer hides cleanly, and
nothing about that blocks publication.
