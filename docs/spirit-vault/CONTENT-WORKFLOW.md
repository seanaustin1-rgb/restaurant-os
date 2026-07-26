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

## Batch 1 packaging correction (2026-07-26)

Batch 1 remains inline in `spirit-vault-prototype.html` through
`BOURBON_BATCH_1` and `makeBatchSpirit({...})`.

Reason: this preserves the no-build, static prototype and avoids breaking
file:// / simple Bluehost deployment semantics before there is a tested loader
contract. The helper gives one logical authoring entry per spirit while the
legacy renderer still consumes normalized `BOTTLES`.

Tradeoff: inline data will not scale cleanly to all ~164 records. Move the
next broad batch to an external structured data file only after a loader is
tested against local file preview and hosted static deployment. Preferred
migration path: generate the current helper-backed records into a JSON module
or static `.js` data payload, load it before normalization, and keep
`makeBatchSpirit`/validation as the import boundary.

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
