# Spirit Vault — Handoff

**Last revision:** 2026-07-26 (v2 — mobile-first summary + expandable drawers)
**Owner:** Sean Austin — Echo's Reserve / Stone Grille & Taphouse (rebranding to Barrel & Bond), York PA
**Deliverable:** `spirit-vault-prototype.html` (same folder) — single-file, self-contained, no build step.

## What this is

Brag Book v2. Guests scan a temporary QR code from the bartender and get a
per-bottle "dossier" dashboard for the Echo's Reserve spirits program. QR
sessions expire after 4 hours by design. Not a webpage, not a digital menu —
a mobile spirits dossier experience. **5 of 164 dossiers built:** Penelope
Barrel Strength, Chicken Cock 5 Year, Macallan 12 Double Cask, Don Fulano
Blanco Fuerte, Diplomático Reserva Exclusiva.

## v2 revision — what changed (2026-07-26)

Interaction model refined per design update: **visual summary first, depth
behind drawers.** Product concept and visual language unchanged.

### Mobile-first summary (above the fold)

Order: Hero Summary → Compact Flavor Snapshot → one-sentence Why It Matters →
Sean curator cue → Reviewed date → drawers.

- **Hero (compact):** category, bottle silhouette (116px), name, distillery,
  availability chips, proof / age / pour price / category, style line. Price
  and availability visible immediately.
- **Flavor Snapshot:** mini radar signature (`radarMini()` — polygon only, no
  labels) + three dominant tasting notes (`topNotes[]`, ranked 01/02/03).
- **Summary lines:** `whyShort` (one sentence), `seanShort` (curator cue,
  quoted + signed), then `✓ Dossier reviewed <date>` from `reviewedAt`.

### Expandable drawers (all collapsed on load)

Semantic `<button aria-expanded aria-controls>` heads, `hidden` bodies,
`toggleDrawer()` — instant open/close, multiple may stay open, 54px min touch
target, chevron state. No nested drawers, no horizontal scrolling.

Order: **Taste & Texture** (full 7-axis radar, intensity bars, body/finish) ·
**How It Is Made** (production grid + tags) · **Why It Matters** (category
significance) · **Why We Carry It** (NEW — Echo-specific rationale,
`whyWeCarry`) · **Recognition & Press** (badges + dated press entries) ·
**At the Table** (pairings) · **Distillery Story** (location plate, history,
timeline, behind-the-bottle stats & facts — merged) · **Compare & Continue**
(three paths: ◇ Lighter / ◆ Similar / ✦ Adventurous, full-width rows,
in-vault rows deep-link) · **Sean's Notes** (gold-bordered, signed).

### Data model additions (per bottle object)

```js
reviewedAt: "2026-07-26",          // rendered "Dossier reviewed July 26, 2026"
topNotes: ["Caramel depth", ...],  // exactly 3, ranked
whyShort: "...",                    // one sentence, above the fold
seanShort: "“...” — Sean",          // curator cue, above the fold
whyWeCarry: "...",                  // Echo-specific; distinct from `why`
press: [{ date, type, source, title, summary, verified }],
paths: { lighter: [{name,d,why}], similar: [...], adventurous: [...] }
```

Press rendering: **verified-only, newest-first, date + source + type shown.**
Adding an entry = appending to the array; no renderer changes needed. The
production system will later distinguish Added / Updated / Reviewed — the
prototype carries `reviewedAt` only. The v1 `compare` field is superseded by
`paths` and is no longer rendered (left in data, safe to delete).

### Renderer changes

`renderDetail()` rebuilt around the summary + `drawer()` helper. New helpers:
`radarMini()`, `fmtDate()` (UTC-safe), `toggleDrawer()`, `cmpRow()`,
`drawer()`. V2 fields live in a `V2` map merged onto `BOTTLES` at load
(`Object.assign`) so v1 bottle data blocks stayed untouched. CSS additions are
under the `/* ═══ V2 ... ═══ */` banners; production spec grid drops to one
column ≤430px.

### Mobile testing

Tested via headless Chromium at **320 / 375 / 390 / 430 / 1200px**:
0px horizontal overflow at every width (drawers closed and open), no clipped
content, hero specs reflow 2×2 ≤380px, radar scales, long names wrap. Desktop
uses the same IA in a 560px column.

## Preserved from v1

Category bottle silhouettes, dark/gold Playfair–Cormorant–DM Mono language,
full radar, production tags, curated Why It Matters, recognition badges,
cross-linked recommendations, pairings, distillery history/timeline, Sean's
Notes, availability states, Vault browse + filters, swipe navigation,
arrow-key navigation, session countdown.

## Known placeholders — DO NOT ship without fixing

1. **Pour prices** ($11–$16) are guesses. Sean supplies real numbers.
2. **Awards & press entries** are directionally right but unverified — they
   are marked `verified:true` only so the prototype renders. Real verification
   pass required before launch.
3. **Availability statuses** are staged for demo variety.
4. **Sean's Notes / seanShort / whyWeCarry** drafted in his voice; he reviews.
5. Session countdown is cosmetic — no real token check yet.
6. Bottle images are SVG silhouettes; real photography planned.

## Decisions needing Sean's review

- Drawer order (currently Taste → Made → Why → Carry → Press → Table →
  Distillery → Compare → Notes).
- Whether Sean's Notes should sit above the drawers instead of last drawer.
- Top-3 tasting notes wording per bottle.
- Compare path assignments (which bottle counts as "adventurous").

## Out of scope this pass (unchanged plan)

QR token backend (Cloudflare Worker, 4-hour signed tokens — matches Sean's
existing `toast-proxy` / `mailchimp-proxy` worker stack), scaling 5 → 164
dossiers (full list in `echo-reserve.html`'s `DEFAULT_SPIRITS`), CMS/database,
multi-file architecture, real photos, favorites / build-a-flight.

## Site context

Live site: stonegrilleandtaphouse.com, static files on Bluehost at
`/home1/thecopp3/website_f69777da/`. Fonts via Google Fonts. No dependencies,
no localStorage.
