# Spirit Vault — Refactor Acceptance Criteria

**Date:** 2026-07-26 · **Applies to:** the Codex structural refactor (data/render
separation, schema normalization, validation, 5→164 scalability)
**Baseline:** `spirit-vault-prototype.html` at `foundation-v1` + `SPIRIT-SCHEMA-SPEC.md`

The refactor is DONE only when every item below passes. Items marked ✅ are
already satisfied by the current `foundation-v1` validation layer and must not
regress.

## A · Data entry & authoring

- [ ] **A1 — Data-only additions.** Adding a normal new spirit touches data
  only (one record; or one file if data moves external). Zero renderer, CSS,
  or filter-code changes. Prove it: add a test spirit (e.g. a sixth record),
  confirm dossier, vault card, filters, and compare refs all work, then remove it.
- [ ] **A2 — One entry point per spirit.** A spirit is authored in ONE place.
  The current dual `SPIRIT_DATA` + `DOSSIER_DETAILS` entry is eliminated or
  generated from a single source.
- [ ] **A3 — Draft records are possible.** A record with
  `recordStatus:'draft'` may omit editorial fields (curator note, whyWeCarry,
  paths) without validation errors, and is excluded from the guest-facing
  vault and swipe order.
- [ ] **A4 — ADD-A-SPIRIT.md updated** to match the final shape, including the
  draft workflow.

## B · Validation (visible, actionable failures)

- [x] ✅ **B1 — Duplicate IDs detected** (foundation-v1).
- [x] ✅ **B2 — Broken comparison refs detected** (foundation-v1).
- [x] ✅ **B3 — Malformed press entries detected** — date format, required
  fields, boolean `verified` (foundation-v1).
- [x] ✅ **B4 — Flavor axes validated** — numeric 0–10, unknown axes rejected
  (foundation-v1).
- [ ] **B5 — Body and finish range-validated** 0–10 (gap in foundation-v1).
- [ ] **B6 — Missing required fields reported clearly**, per-record and
  per-field, respecting `recordStatus` (draft vs published requirements).
- [ ] **B7 — Optional fields fail gracefully.** Null/absent optional data
  (commerce values, press, imageAsset, displayRows, facts) renders cleanly:
  section hidden or placeholder shown — never `undefined`, never a throw.
- [ ] **B8 — `verified:true` press requires `sourceUrl`** (exception:
  `type:'venue-event'`).
- [ ] **B9 — Controlled vocabularies enforced** — category, subcategory,
  pairing slots, press types validate against the constants block.

## C · No regressions (guest experience)

- [ ] **C1 — All five existing dossiers render correctly** after migration to
  the canonical schema — every drawer, chip, badge, and value spot-checked
  against the pre-refactor page.
- [ ] **C2 — Browse filters still work** (category, proof, flavor lean), and
  counts derive from data + `SPIRIT_COLLECTION_TARGET` — no hardcoded "5" or
  "164" strings anywhere in markup or renderers.
- [ ] **C3 — Stable-ID navigation still works**: compare-row deep links,
  `gotoBottleId()`, and swipe/arrow transient navigation.
- [ ] **C4 — Drawers remain accessible**: real `<button>` heads,
  `aria-expanded`/`aria-controls` states, `hidden` bodies, ≥44px touch targets.
- [ ] **C5 — Keyboard access added** for compare rows, vault cards, and pager
  dots (Enter/Space activation) — the one known a11y regression risk area.
- [ ] **C6 — No horizontal overflow at 320, 375, 390, 430, and desktop
  widths**, drawers closed AND open (`scrollWidth === clientWidth`).
- [ ] **C7 — Radar, mini-radar, and silhouettes render identically** from the
  new schema (flavor axes order preserved).

## D · Architecture guarantees

- [ ] **D1 — Commerce isolation.** Price and availability can be supplied
  later by a POS (or manager) by writing ONLY `commerce.*` — demonstrated by
  changing a price/availability value and confirming zero knowledge/venue
  fields changed and the dossier reflects it.
- [ ] **D2 — Dead data removed**: `compare[]`, `proof` display string,
  `priceL`, `status[].t` duplication, layout flags inside data.
- [ ] **D3 — Renderer/data boundary explicit**: no HTML in data fields except
  under a declared markup policy; icons, formatting, and layout decisions live
  in renderers.
- [ ] **D4 — Scale smoke test**: generate 164 stub records (script is fine),
  confirm the vault browse remains usable and initial load stays acceptable on
  a mid-range phone profile; document the load numbers and the chosen data
  packaging (inline vs external JSON) in HANDOFF.md.
- [ ] **D5 — Preserved-code list honored** (see DATA-AUDIT.md §2): stable-ID
  helpers, drawer pattern, SVG renderers, swipe/keyboard nav, press
  verified-only/newest-first rule, visual language.

## E · Definition of done

- [ ] All boxes above checked, with the width matrix and scale smoke test
  results pasted into HANDOFF.md.
- [ ] HANDOFF.md updated: work completed, files changed, commit SHA, and any
  schema deviations from SPIRIT-SCHEMA-SPEC.md called out explicitly for
  Sean's sign-off.
- [ ] No scope creep: no Flight Builder UI, no QR backend, no Raven, no visual
  redesign.
