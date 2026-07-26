# Spirit Vault — Handoff

**Last revision:** 2026-07-26 (v2.1 — stable-ID architecture + Flight Builder requirement)
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
`gotoBottleId()`. V2 fields live in a `V2` map merged onto `BOTTLES` at load,
so v1 data blocks stayed untouched. CSS additions under `/* ═══ V2 ═══ */`
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

1. **Pour prices** ($11–$16) are guesses. Sean supplies real numbers.
2. **Awards & press entries** are directionally right but unverified —
   marked `verified:true` only so the prototype renders. Real verification
   pass required before launch.
3. **Availability statuses** are staged for demo variety.
4. **Sean's Notes / seanShort / whyWeCarry** drafted in his voice; he reviews.
5. Session countdown is cosmetic — no real token check yet.
6. Bottle images are SVG silhouettes; real photography planned.

## Decisions needing Sean's review

- Drawer order; whether Sean's Notes sits above the drawers instead of last.
- Top-3 tasting note wording per bottle; compare path assignments.
- Flight Builder priority relative to the QR token backend and 5→164 data
  entry.

## Out of scope this pass

Flight Builder UI (architecture prepared only), QR token backend (Cloudflare
Worker, 4-hour signed tokens — matches Sean's existing `toast-proxy` /
`mailchimp-proxy` worker stack), scaling 5 → 164 dossiers (full list in
`echo-reserve.html`'s `DEFAULT_SPIRITS`), CMS/database, multi-file
architecture, real photos, favorites / build-a-flight guest features.

## Site context

Live site: stonegrilleandtaphouse.com, static files on Bluehost at
`/home1/thecopp3/website_f69777da/`. Fonts via Google Fonts. No dependencies,
no localStorage.
