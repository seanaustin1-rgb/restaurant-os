# Spirit Vault — Handoff

**Last revision:** 2026-07-26 (merged foundation refactor + Toast/Raven command-center + audit docs)

## Active work lane — merged status (2026-07-26)

**Codex foundation pass: COMPLETE.** The prototype now has the
`SPIRIT_DATA` / `DOSSIER_DETAILS` data boundary, normalized `BOTTLES` output,
optional commerce linkage fields, development-time validation, and
`ADD-A-SPIRIT.md` data-entry workflow.

**Claude audit lane: COMPLETE.** Claude produced supporting specification and
audit documents without changing the prototype implementation.

**Remote Toast/Raven direction: MERGED.** The Toast ownership protocol and
`FUTURE-RAVEN-ADDON.md` future-direction document are preserved from
`origin/docs/spirit-vault-handoff`.

**Files changed across the merged lane:**

- `docs/spirit-vault/spirit-vault-prototype.html`
- `docs/spirit-vault/ADD-A-SPIRIT.md`
- `docs/spirit-vault/DATA-AUDIT.md`
- `docs/spirit-vault/SPIRIT-SCHEMA-SPEC.md`
- `docs/spirit-vault/REFACTOR-ACCEPTANCE-CRITERIA.md`
- `docs/spirit-vault/CONTENT-WORKFLOW.md`
- `docs/spirit-vault/FUTURE-RAVEN-ADDON.md`
- `docs/spirit-vault/HANDOFF.md`

**Relevant commits:**

- `5f0ffb2` — Toast ownership and shared command-center protocol.
- `ec8462c` — Future Raven hospitality add-on direction.
- `c89e39753119092c817e8a1bfa69edcd4d7ba026` — Codex data foundation refactor.
- `867006aa0650fe0f8585b3733b7bc4a69cd83d09` — Codex foundation handoff update.
- `b16f78b` — Claude audit lane docs and 5-to-164 workflow.

**Tests completed for the Codex foundation pass:**

- Headless Microsoft Edge via Chrome DevTools Protocol against the static HTML file.
- Widths tested: 320, 375, 390, 430, and 1200 px.
- At every width: 0 px horizontal overflow with drawers closed and with the first drawer open.
- Confirmed drawers are collapsed on load and open with `aria-expanded="true"`.
- Confirmed five-spirit navigation state remains `01 / 05` with five dots.
- Confirmed `gotoBottleId('chicken-cock-5-year')` navigates to Chicken Cock 5 Year and an invalid ID does not move the current dossier.

**Unresolved decisions (Sean):**

1. **Recognition sourcing** — fabricated prototype dates have been removed
   from the current data and unsupported claims are now `verified:false`.
   Source URLs are still needed before any award/score/press claim can be
   published as verified.
2. Single canonical record vs. keeping the two-map split. `SPIRIT-SCHEMA-SPEC.md`
   recommends single; `ADD-A-SPIRIT.md` currently documents the implemented split.
3. Data packaging at 164 records: inline vs external JSON. Acceptance criterion
   D4 requires measurement and documentation.
4. Batch order/size for content production. `CONTENT-WORKFLOW.md` recommends
   Bourbon-first, 10-15 per batch.
5. Toast integration scope: pricing only first, or pricing plus availability
   and 86 state in the initial production pass.

---

## Bourbon / American Whiskey Batch 1 — Codex lane (2026-07-26)

**Status:** Implemented on `feat/spirit-vault-bourbon-batch-1`.
**Implementation commit SHA:** `988bfb3a15a28451e08fa99ea4cba4e050d5716b`

**Claude review fix pass (2026-07-27):**

- Replaced corrupted Batch 1 middot separators so guest text renders as `·`,
  not `Â·`.
- Restored guest gating: normal mode renders only
  `publicationStatus:'published'`; `?review=1` exposes draft/review records for
  QA.
- Removed the internal Recognition fallback copy by hiding the drawer when no
  verified recognition exists.
- Aligned Sagamore Manhattan Finish age display to `4 yr + 30 mo finish`.

**Review fix verification:**

- Inline script syntax check passed.
- Static checks confirm zero corrupted middot sequences and no internal
  Recognition fallback copy.
- DOM harness confirms guest mode renders `01 / 05` and `5 OF 5`; review mode
  renders `01 / 20` and `20 OF 20`.

**Implementation summary:**

- Added 15 Bourbon / American whiskey / rye records via `BOURBON_BATCH_1` and
  `makeBatchSpirit({...})`, giving each new spirit one logical data entry.
- Preserved the existing mobile visual language, drawers, stable-ID
  navigation, and renderer shape by normalizing records into `BOTTLES`.
- Added canonical support fields for brand, expression, subcategory, country,
  region, distillery, numeric age data, record/publication/verification
  states, source provenance, and temporary commerce values.
- Moved Sean-confirmed prices into `commerce.pourPriceUsd` with explicit
  temporary price provenance pending Toast; display prices are generated from
  that venue commerce value for Batch 1.
- Removed fabricated dates from the original five press entries and changed
  unsupported recognition to `verified:false`.
- Updated recognition rendering so only verified awards/press appear in the
  guest-facing Recognition drawer.
- Expanded validation for draft records, body/finish ranges,
  record/publication/verification states, verified-claim source provenance,
  temporary price format/provenance, and null optional handling.
- Batch 1 remains inline for now; `CONTENT-WORKFLOW.md` records the migration
  path to external structured data before larger batches.

**Records added:**

1. Sagamore Spirit Small Batch Rye — `$14.00`
2. Sagamore Spirit Double Oak Rye — `$14.00`
3. Sagamore Spirit Manhattan Finish Rye — `$11.00`
4. Knob Creek Single Barrel 9 Year — `$16.50`
5. Bulleit 10 Year Bourbon — `$10.00`
6. Old Forester 1870 Original Batch — `$10.75`
7. Old Forester 1897 Bottled in Bond — `$11.75`
8. Old Forester 1910 Old Fine Whisky — `$13.00`
9. Old Forester 1920 Prohibition Style — `$14.25`
10. Old Forester Single Barrel Barrel Strength Rye — `$16.00`
11. Old Forester Rye 100 Proof — `$7.00`
12. WhistlePig Snout-to-Tail 10 Year Bourbon — `$22.00`
13. Jeptha Creed Bottled-in-Bond Bourbon — `$10.75`
14. Jeptha Creed Straight Four Grain Bourbon — `$10.75`
15. Jeptha Creed 6 Year Wheated Bourbon — `$10.75`

WhistlePig 15 Year Estate Oak Single Barrel Rye remains deferred to Batch 2.

**Sourcing limitations / unverified claims:**

- The original five dossiers retain draft award/score/press claims in data,
  but all unsupported entries are `verified:false` and no longer display as
  verified Recognition content.
- Chicken Cock February dinner remains a first-party venue-event draft claim
  until an internal event artifact/source is attached.
- Bulleit 10 Year official source did not publish a mash bill in this pass.
- WhistlePig Snout-to-Tail official source did not publish a mash bill in this
  pass.
- Old Forester Single Barrel Barrel Strength Rye uses Old Forester’s official
  rye mash-bill source plus a North Carolina ABC listing for proof/product
  identity; Echo’s exact bottle proof should be checked before publish.
- Jeptha Creed Four Grain source provides grain list/proof but not full mash
  percentages.
- All new Batch 1 records are draft: Sean-owned `whyWeCarry`, curator cue,
  Sean’s Notes, paths, pairings, and final flavor-axis approval remain pending.

**Files changed:**

- `docs/spirit-vault/spirit-vault-prototype.html`
- `docs/spirit-vault/ADD-A-SPIRIT.md`
- `docs/spirit-vault/CONTENT-WORKFLOW.md`
- `docs/spirit-vault/HANDOFF.md`

**Tests completed:**

- Inline script syntax check.
- Headless Microsoft Edge via Chrome DevTools Protocol using a temporary
  local copy with the external Google Fonts link removed to avoid file-mode
  stylesheet blocking.
- Widths tested: 320, 375, 390, 430, and 1200 px.
- At every width: 0 px horizontal overflow with drawers closed and with the
  first drawer open.
- Confirmed drawers are collapsed on load and open with
  `aria-expanded="true"`.
- Confirmed navigation state is `01 / 20` with 20 dots.
- Confirmed stable-ID navigation works across all 20 records and invalid IDs
  fail safely.

**Recommended Batch 2 scope:**

- WhistlePig 15 Year Estate Oak Single Barrel Rye.
- Next 10–15 American whiskey/rye records from the master list, preferably
  only after testing an external static data payload/loader so Batch 2 does
  not continue growing the inline HTML indefinitely.

**Owner:** Sean Austin — Echo's Reserve / Stone Grille & Taphouse (rebranding to Barrel & Bond), York PA
**Deliverable:** `spirit-vault-prototype.html` (same folder) — single-file, self-contained, no build step.

## What this is

Brag Book v2. Guests scan a temporary QR code from the bartender and get a
per-bottle "dossier" dashboard for the Echo's Reserve spirits program. QR
sessions expire after 4 hours by design. Not a webpage, not a digital menu —
a mobile spirits dossier experience. **5 of 164 dossiers built:** Penelope
Barrel Strength, Chicken Cock 5 Year, Macallan 12 Double Cask, Don Fulano
Blanco Fuerte, Diplomático Reserva Exclusiva.

## ⚑ FOUNDATIONAL PRODUCT DECISION (2026-07-26)

**The Spirit Vault is the "POS of knowledge" for Echo's Reserve.** Just as
the POS is the source of truth for sales, the Spirit Vault is the source of
truth for every piece of knowledge about the collection. It is not only a
guest-facing dossier system — it is the master data source for the entire
spirits program. One master spirit database feeds:

```text
MASTER SPIRIT DATABASE
        |
        |— Guest Spirit Vault dossiers
        |— Bartender Flight Builder
        |— Manager Flight Builder + flight history
        |— Guest custom-flight QR pages
        |— Printable tasting placemats
        |— Staff training
        |— Event planning
        |— Brag Book (print + digital)
        |— AI recommendations
        |— Future inventory insights
        |— Agent research queue
```

Every downstream experience REFERENCES spirit records by stable ID — nothing
duplicates dossier content. This is a foundational architectural decision,
not an optional enhancement.

## System Ownership — Toast + Spirit Vault (binding)

The two systems have separate and explicit ownership boundaries.

### Toast is the source of truth for commerce

Toast owns operational commerce data, including:

- Current menu price
- Toast menu-item identity / GUID
- Sale availability
- 86 or inactive status when exposed by the integration
- POS-controlled menu configuration

Do not make manually entered Spirit Vault pricing the permanent source of
truth. Each spirit record should carry the stable Toast identifier needed to
join the knowledge record to the corresponding POS item. Price and
availability should be read from Toast when the production integration is
implemented.

If Toast values are cached for performance or resilience, the cache must
retain source provenance and a synchronization timestamp. Cached values are a
fallback representation of Toast data, not an independent editable price
record.

### Spirit Vault is the source of truth for knowledge

The Spirit Vault master record owns:

- Flavor profile and sensory metadata
- Production details
- Distillery and brand history
- Awards, recognition, and verified press
- Pairings
- Sean's notes and curator commentary
- Comparison and recommendation metadata
- Flight-building metadata
- Review, update, and verification history

### Application responsibility

Guest and staff applications combine the two sources at runtime:

```text
TOAST COMMERCE DATA
(price, availability, menu identity)
            +
SPIRIT VAULT KNOWLEDGE DATA
(flavor, history, press, pairings, recommendations)
            =
GUEST + STAFF EXPERIENCES
```

Do not duplicate data across systems when a stable reference can be used.
The same joined data should power dossiers, flight builders, placemats,
training, Brag Book, events, and future AI-assisted recommendations.

## Shared Command-Center Protocol — Claude + Codex

This file is the Spirit Vault command center and must be monitored and updated
by both Claude and Codex whenever either agent begins or completes meaningful
Spirit Vault work.

Required workflow:

1. Read this handoff before changing Spirit Vault code, data, schema, or UX.
2. Record durable product and architecture decisions here before implementing
   work that depends on them.
3. Preserve established product truth unless Sean explicitly changes it.
4. Document the active work lane, files changed, current status, unresolved
   questions, and next recommended action.
5. Add the relevant commit SHA after each completed increment.
6. Keep Claude and Codex ownership lanes explicit to avoid duplicate or
   conflicting implementation.
7. Do not create a competing master handoff. Supporting specifications may be
   added, but this remains the project-level source of truth.
8. Before merging, reconcile the implementation against this file and update
   any stale status, placeholder, or scope statements.

This is the same operating discipline used for Raven: code and product truth
must move together.

### Data requirements (binding on all future work)

Every spirit record must carry a stable ID and enough **structured**
metadata to support searching, filtering, comparisons, recommendations, and
flight generation. Avoid any architecture that stores information only as
presentation text — the data model must support future recommendation
engines without major refactoring. Current prototype status: flavor axes,
body, finish, proof, press, and paths are already structured; some
production values (mash bill, cask type, finish type) are still prose
strings inside label/value pairs and should be normalized into discrete
fields during the 5→164 data build-out.

### Stable IDs (implemented in this revision)

Every spirit record carries a permanent slug id — e.g.
`id: "penelope-barrel-strength"`. Array position is never a permanent
identifier. All recommendation links now resolve through
`spiritIndexById(id)` / `gotoBottleId(id)`; cross-links in `paths` use a
`ref: "<spirit-id>"` field. Future flight items reference `spiritId` the
same way. Current ids: `penelope-barrel-strength`, `chicken-cock-5-year`,
`macallan-12-double-cask`, `don-fulano-blanco-fuerte`,
`diplomatico-reserva-exclusiva`.

## Future Feature — Bartender Flight Builder (do not build yet)

Beyond the manager-facing builder below, the same spirit records must
eventually power a bartender-speed flow: **ask a guest a few questions,
assemble a custom flight in under one minute.** Example inputs: category,
flavor preference, proof preference, budget, experience level, number of
pours. The system recommends bottles from existing spirit records; the
bartender always has final editorial control. **The system recommends. The
bartender curates.** Today's obligation is architectural only: structured
metadata + stable IDs (see data requirements above) so this needs no
refactor later.

## New Product Requirement — Flight Builder (future build)

Full requirement below; a conceptual schema comment also lives in the
prototype source (`FLIGHT LAYER` banner). **Do not build the Flight Builder
in the current mobile dossier pass** — the data and interface architecture
are prepared for it.

### Database relationship

```text
SPIRITS  →  referenced by  →  FLIGHTS  →  contains  →  FLIGHT ITEMS
```

**Spirit record** — the master record for each bottle (this prototype's
`BOTTLES` objects).

**Flight record** — flight name, public title, internal name, description,
theme, status (draft/published/archived), start date, end date, price, pour
size, channel, created by, created date, updated date, published date.

**Flight item** — joins one spirit to one flight: spirit ID, flight ID,
display order, pour size override, flight-specific tasting note, flight-
specific pairing note, comparison prompt, inclusion rationale, temporary
price allocation, availability requirement. **Never copies the dossier.**

### Flight-specific content (lives on the flight item, not the spirit)

- **Why It Is Here** — e.g. "This pour establishes the baseline profile
  before the higher-proof and finished expressions."
- **What to Notice** — e.g. "Compare the toasted oak and dark cherry against
  the brighter fruit in the previous pour."
- **Transition to Next Pour** — e.g. "The next whiskey increases proof and
  body while retaining the same caramel-led profile."

### Manager workflow (required behavior)

Search the spirit database → filter candidates → select bottles → arrange
order → review the progression visually → add flight narrative → set pour
size and price → preview guest presentation → save as draft → publish or
archive. Nothing is re-entered manually; name, category, proof, age, flavor
profile, price, availability, image, tasting notes, production, pairings,
recognition, and Sean's commentary all flow from the spirit record.

### Filters the database must support

Category, subcategory, country, region, distillery, brand, proof range, age
range, price range, availability, flavor axis, body, finish, cask type,
finish type, mash bill / base material, production method, recognition,
recently added, recently reviewed, previously used in flights.

### Flight design intelligence

The system makes the design visible; the manager makes the curatorial call —
no auto-generated flights. Comparison dimensions: proof progression,
sweetness, oak, smoke, fruit, body, finish length, age, price, geographic
progression, production-method progression.

**Visual model:** selected spirits appear as phone-friendly compact rows
(bottle image, name, proof, age, price, availability, top-3 flavor traits,
compact flavor signature, flight position) with drag-to-reorder. A
comparison drawer reveals radar overlays, proof progression, price
contribution, flavor contrast, repeated characteristics, and gaps. The
prototype's `radarMini()` and snapshot row are the design seed for this.

### Guest output

A flight record generates: mobile flight page, individual spirit drawers,
printable placemat data, bartender service notes, staff training sheet,
event menu copy, QR-linked tasting experience. The guest flight page uses
the same visual-first drawer design as the Vault: initial view = flight
title, theme, price, pour size, spirit order, compact comparison visual,
short introduction; each pour opens a drawer with What to Notice, core
flavor visual, why it's included, permanent dossier link (by spiritId), and
pairing/comparison note.

### Tracking requirements

Track which spirits appeared in each flight, dates used, use counts,
current + historical pricing, flight status, post-publication changes,
substitutions, and guest-facing version history — enabling reporting on
most-featured spirits, spirits not flighted recently, best-performing
themes, repeated flavor profiles, category balance, margin by flight, and
inventory pressure from active flights.

## v2 revision — mobile-first summary + drawers (2026-07-26)

Interaction model refined: **visual summary first, depth behind drawers.**
Product concept and visual language unchanged.

### Mobile-first summary (above the fold)

Order: Hero Summary → Compact Flavor Snapshot → one-sentence Why It Matters →
Sean curator cue → Reviewed date → drawers.

- **Hero (compact):** category, bottle silhouette (116px), name, distillery,
  availability chips, proof / age / pour price / category, style line. Price
  and availability visible immediately.
- **Flavor Snapshot:** mini radar signature (`radarMini()`) + three dominant
  tasting notes (`topNotes[]`, ranked 01/02/03).
- **Summary lines:** `whyShort`, `seanShort` (curator cue), then
  `✓ Dossier reviewed <date>` from `reviewedAt`.

### Expandable drawers (all collapsed on load)

Semantic `<button aria-expanded aria-controls>` heads, `hidden` bodies,
`toggleDrawer()` — instant open/close, multiple may stay open, 54px min
touch targets, chevron state, no nesting, no horizontal scrolling.

Order: **Taste & Texture** (full radar, intensity bars, body/finish) ·
**How It Is Made** · **Why It Matters** · **Why We Carry It** (Echo-specific,
`whyWeCarry`) · **Recognition & Press** (badges + dated entries) ·
**At the Table** · **Distillery Story** (incl. behind-the-bottle) ·
**Compare & Continue** (◇ Lighter / ◆ Similar / ✦ Adventurous; in-vault rows
deep-link by stable ID) · **Sean's Notes** (gold-bordered, signed).

### Data model additions (per bottle object)

```js
id: "penelope-barrel-strength",    // STABLE — never array position
reviewedAt: "2026-07-26",          // rendered "Dossier reviewed July 26, 2026"
topNotes: ["Caramel depth", ...],  // exactly 3, ranked
whyShort: "...",                    // one sentence, above the fold
seanShort: "“...” — Sean",          // curator cue, above the fold
whyWeCarry: "...",                  // Echo-specific; distinct from `why`
press: [{ date, type, source, title, summary, verified }],
paths: { lighter: [{ref?, name, d, why}], similar: [...], adventurous: [...] }
```

Press rendering: **verified-only, newest-first, date + source + type shown.**
Adding an entry = appending to the array. Production will later distinguish
Added / Updated / Reviewed; the prototype carries `reviewedAt` only. The v1
`compare` field is superseded by `paths` and no longer rendered.

### Renderer notes

`renderDetail()` builds summary + `drawer()` sections. Helpers: `radarMini()`,
`fmtDate()` (UTC-safe), `toggleDrawer()`, `cmpRow()`, `spiritIndexById()`,
`gotoBottleId()`. Editable fields live in `SPIRIT_DATA` and
`DOSSIER_DETAILS`; `normalizeSpiritRecords()` produces the renderer-facing
`BOTTLES` array after validation. CSS additions under `/* ═══ V2 ═══ */`
banners; production grid drops to one column ≤430px.

### Mobile testing

Headless Chromium at **320 / 375 / 390 / 430 / 1200px**: 0px horizontal
overflow at every width (drawers closed and open), no clipped content, hero
specs reflow 2×2 ≤380px, radar scales, long names wrap, stable-ID deep links
verified (Penelope → Chicken Cock via compare row; direct `gotoBottleId`).
Desktop uses the same IA in a 560px column.

## Preserved from v1

Category bottle silhouettes, dark/gold Playfair–Cormorant–DM Mono language,
full radar, production tags, curated Why It Matters, recognition badges,
cross-linked recommendations, pairings, distillery history/timeline, Sean's
Notes, availability states, Vault browse + filters, swipe navigation,
arrow-key navigation, session countdown.

## Known placeholders — DO NOT ship without fixing

1. **Pour prices** ($11–$16) are guesses. Sean supplies real numbers until the
   Toast integration becomes the production source of truth.
2. **Awards & press entries** are directionally right but unverified —
   retained as draft data with `verified:false`. Real source URLs and dates
   are required before any recognition claim renders as verified.
3. **Availability statuses** are staged for demo variety; production values
   should come from Toast when the integration supports them.
4. **Sean's Notes / seanShort / whyWeCarry** drafted in his voice; he reviews.
5. Session countdown is cosmetic — no real token check yet.
6. Bottle images are SVG silhouettes; real photography planned.
7. Toast menu-item GUID mapping and synchronization timestamps are not yet
   implemented.

## Decisions needing Sean's review

- Drawer order; whether Sean's Notes sits above the drawers instead of last.
- Top-3 tasting note wording per bottle; compare path assignments.
- Flight Builder priority relative to the QR token backend and 5→164 data
  entry.
- Toast integration scope: pricing only first, or pricing plus availability
  and 86 state in the initial production pass.

## Out of scope this pass

Flight Builder UI (architecture prepared only), QR token backend (Cloudflare
Worker, 4-hour signed tokens — matches Sean's existing `toast-proxy` /
`mailchimp-proxy` worker stack), scaling 5 → 164 dossiers (full list in
`echo-reserve.html`'s `DEFAULT_SPIRITS`), CMS/database, multi-file
architecture, real photos, favorites / build-a-flight guest features, and
production Toast menu synchronization.

## Site context

Live site: stonegrilleandtaphouse.com, static files on Bluehost at
`/home1/thecopp3/website_f69777da/`. Fonts via Google Fonts. No dependencies,
no localStorage.
