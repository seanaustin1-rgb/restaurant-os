# Spirit Vault — 5→164 Content Workflow

**Date:** 2026-07-26 · **Scope:** how the remaining ~159 dossiers get produced
without flooding Sean or shipping unverified claims. Do not begin mass data
entry until the Codex refactor passes `REFACTOR-ACCEPTANCE-CRITERIA.md` —
otherwise 159 records inherit the current shape and get touched twice.

## Roles

| Actor | Owns |
|---|---|
| **Agent (research)** | Drafts knowledge fields from brand/producer sources: identity, origin, strength, production, history, timeline, flavor first-pass, press candidates with URLs. Everything lands as `draft`. |
| **Agent (editorial)** | Drafts whyShort / whyItMatters / topNotes in house style; proposes paths; never fabricates dates, scores, or awards. |
| **Sean** | Everything a guest reads as *his*: curatorNote, curatorCue, whyWeCarry approval or rewrite, flavor-axis sanity check (he's tasted these; the agent hasn't), path sign-off, pricing (separate lane), final publish. |
| **Verifier (agent pass + human spot-check)** | Confirms sourced claims before `verified:true` or `recordStatus:'reviewed'`. |

## Per-spirit pipeline

1. **Seed** — create record from the master list (`echo-reserve.html`
   `DEFAULT_SPIRITS` has name/category/sub/detail for all 164). Status: `draft`.
2. **Research** — agent fills knowledge fields. Every production/history claim
   gets a source in `provenance.sources[]`. Unknown = null, never invented.
3. **Editorial draft** — agent writes narrative fields + proposed flavor axes,
   topNotes, paths. Venue fields (curatorNote/cue, whyWeCarry) are drafted but
   flagged `[DRAFT — SEAN]`.
4. **Verification** — press entries checked against their sourceUrl;
   production claims spot-checked; anything unsourced stays `verified:false`
   or gets cut. Status: `reviewed`.
5. **Sean pass** — batch review (see below): voice fields approved/rewritten,
   flavor axes adjusted from actual tasting, paths approved. Status:
   `published`, `reviewedBy:'sean'`, `reviewedAt` set.
6. **Publish** — record enters guest vault. Incomplete records simply stay
   `draft`/`reviewed` and never render — no half-dossiers in front of guests.

## Sourcing rules (binding)

- **Press/awards:** primary source only (competition results page, publication
  review, producer press release as last resort — typed as such). `sourceUrl`
  required for `verified:true`. Date comes FROM the source. No source, no
  entry — badges without dates are the fallback, fabricated dates are never
  acceptable (see DATA-AUDIT.md §3.1 for the cleanup of the current five).
- **Production claims:** producer-published material is acceptable and cited;
  third-party lore (fires, Prohibition stories) needs a named source before
  print use.
- **Flavor axes:** agent proposes from consensus tasting notes; Sean's palate
  is the tiebreaker and the authority — axes are Echo's read, not an average
  of the internet.

## Comparison-path selection rules

- Ref-first: if the bottle is in the master database, use `ref`, never
  freeform.
- Lighter/Similar: same category, one clear delta (proof, oak, price) stated
  in `why`. Adventurous: one step out — subcategory jump, production jump, or
  (max one per bottle) a cross-category bridge.
- Every path entry must name its delta in one clause. If the why can't be
  written in one clause, it's the wrong recommendation.

## Batching recommendation

**Batch by category, via a structured import file.** One-at-a-time is too slow
(159 × full pipeline), and a single 164-record big-bang makes Sean's review
pass impossible to do well.

- **Format:** one JSON file per batch matching the canonical schema (agents
  produce it; validation runs on import). A spreadsheet front-end is optional
  later; JSON is the interchange either way.
- **Batch size:** 10–15 spirits — one category slice per batch, sized so
  Sean's pass is a single sitting (~30–45 min of voice review per batch).
- **Order:** Bourbon first (largest shelf, anchors flights and Flight Night),
  then American whiskey/rye → Scotch, Irish & world → Agave → Gin → Rum.
  Within each batch, flight-eligible and Reserve-room bottles first — they
  face guests soonest.
- **Cadence gate:** a batch does not start until the previous batch is
  `published`. Prevents a 100-record `draft` swamp.

## Handling incomplete records

`draft` and `reviewed` records are invisible to guests, visible in any future
admin/browse tooling, and carry their gaps as nulls — never placeholder prose.
A record stuck >2 batches in `draft` gets triaged: fill it, or park it with a
`parked:true` flag and a reason (discontinued, seasonal, awaiting producer info).

## Data packaging — external payload (DONE 2026-07-27)

The Batch-2 gate is cleared. All 20 records were moved out of the inline HTML
to **`spirit-vault-data.js`**, an external static payload exposing
`window.SPIRIT_VAULT_DATA({ makeBatchSpirit })`. The engine loads it via a
relative `<script src>` before normalization and consumes it through
`normalizeSpiritRecords()` → `BOTTLES` — no `fetch`, so it works under
`file://`, local static preview, and Bluehost static hosting. The two-map
`SPIRIT_DATA` + `DOSSIER_DETAILS` split is retired; the five legacy records are
now single canonical objects, and `makeBatchSpirit`/validation remain the
import boundary.

Parity was proven byte-for-byte: per-record and whole-array fingerprints of the
normalized `ALL_BOTTLES` are identical to the pre-migration build (guest 5 /
review 20). **D4 load numbers:** `spirit-vault-data.js` is ~50 KB / 508 lines
for 20 records (~2.5 KB each); the HTML dropped 442 lines. As a single parsed
static file with no network round-trips, load stays instant on a mid-range
phone; projected ~164 records remain well within static-payload limits.

**Deploy contract:** ship `spirit-vault-prototype.html` **and**
`spirit-vault-data.js` together in the same directory.

Batch 2 authoring: add one `makeBatchSpirit({...})` record per spirit to the
`BATCH` array in `spirit-vault-data.js` (see `ADD-A-SPIRIT.md`). Per-batch data
files can be split out later if the single payload grows large.

Process correction from Batch 1: Sean-confirmed menu prices may be recorded
as temporary venue commerce values (`commerce.pourPriceUsd` +
`priceProvenance`) but remain non-authoritative until Toast supplies the
production commerce source of truth.

## Sean's per-batch inputs (kept small on purpose)

For each spirit: approve/rewrite curatorNote + curatorCue + whyWeCarry (or
say "skip — no note yet," which is allowed and renders nothing), adjust flavor
axes if the agent's read is off, approve paths, confirm merchandising flags
(flight-eligible / reserve-room / event tags). Pricing stays in his separate
lane and joins via `commerce` whenever it's ready — it never blocks publishing
a dossier (price row hides when null).
