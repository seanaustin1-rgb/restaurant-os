# Spirit Vault — Data Audit

> **Historical snapshot (2026-07-26).** This audit describes the original
> five-record static prototype and is retained for provenance. It is not the
> current implementation plan. The live architecture and work lane are in
> `HANDOFF.md`; the canonical database schema is in `prisma/schema.prisma`.

**Date:** 2026-07-26 · **Lane:** Claude (preparation/cleanup) · **Audited artifact:** the then-current `spirit-vault-prototype.html`

This audit covers Task 1 (field inventory), Task 3 (technical debt), and Task 6
(editorial review of the five dossiers). The canonical schema proposal derived
from it is in `SPIRIT-SCHEMA-SPEC.md`.

---

## 1 · Field inventory

All five records populate every field below unless noted (usage: 5/5). The
current model is two objects per spirit joined by `id` at load:
`SPIRIT_DATA[]` (base) + `DOSSIER_DETAILS{}` (v2 layer), merged by
`normalizeSpiritRecords()`, plus injected `commerce` defaults and
`dataVersion`.

**Classification key:** K = knowledge (Vault-owned) · C = commerce (Toast/POS-owned) ·
V = venue-curated (Echo-specific) · P = provenance/verification · D = display-only
(should be computed, not stored)

### SPIRIT_DATA (base record)

| Field | Type | Req | Class | Findings |
|---|---|---|---|---|
| `id` | string slug | ✔ | K | Good. Stable, human-readable, validated for duplicates. Keep as permanent key. |
| `cat` | string (`Bourbon\|Scotch\|Agave\|Rum`) | ✔ | K | Doubles as display label and filter value. No enum constant; v1 site data also had `irish`/`american` categories this set doesn't cover yet. **No subcategory field at all** (v1 site had `Kentucky Bourbon`, `Blanco / Silver`, etc.). |
| `silo` | string (`bourbon\|scotch\|tequila\|rum`) | ✔ | D→K | Silhouette/liquid-color key. Misaligned vocabulary with `cat` (`Agave` vs `tequila`). Rename to `imageKey` or derive from subcategory. |
| `name` | string | ✔ | K | Conflates brand + expression in one string (`Penelope Barrel Strength`). Fine for display; blocks brand-level filtering. Split into `brand` + `expression`, keep `name` as computed display. |
| `distillery` | string prose | ✔ | K | `Producer · City, State` packed into one display string. **No structured country/region/city fields anywhere** — geography filters promised to the Flight Builder are impossible today. |
| `style` | string prose | ✔ | K/D | Mixed bag: legal class + attributes + marketing (`The Famous Old Brand`). Should decompose into subcategory + attribute tags; keep as optional display line. |
| `proof` | **string** | ✔ | D | Display twin of `proofN`. Store the number once; format at render. Penelope's `116.2` is one batch's value presented as static — needs a `batchVaries` flag or range. |
| `proofN` | number | ✔ | K | Good. The only filterable strength value. No ABV. |
| `age` | string | ✔ | K/D | Free text: `4–5 yr`, `5 yr`, `12 yr`, `Unaged`, `Up to 12 yr`. **No numeric minYears/maxYears → age filtering/progression impossible.** |
| `price` | string `$14` | ✔ | **C** | Placeholder guess. Commerce data living in the knowledge record as a display string. Must move under `commerce` as a number, POS-suppliable. |
| `priceL` | string `2 oz pour` | ✔ | **C** | Pour size hidden inside a label. Should be numeric `pourSizeOz` under commerce. |
| `status` | array of `{k,t}` | ✔ | C+V mixed | Conflates three things: stock availability (`available`, `low` — POS-adjacent), venue merchandising (`flight`, `reserve`), and event tagging (`eventb`). `t` is hand-written display text duplicating what `k` implies. Split: `commerce.availability` vs `venue.merchandising`. |
| `flavor` | object, 7 numeric axes | ✔ | K | Good. Validated 0–10, unknown-axis check. Keep. |
| `body`, `finish` | number 0–10 | ✔ | K | Good. Not currently validated for range (only axes are) — minor validator gap. |
| `production` | **array of `[label, value, wide?]` tuples** | ✔ | K trapped in D | **Worst offender.** Presentation-shaped prose: labels inconsistent across records (`Mash Bill`/`Grain`/`Agave`/`Base`; `Barrel`/`Casks`/`Rest`; `Age` duplicated vs top-level `age`), values are sentences, and the third element is a **layout flag inside content data**. Cask type, finish type, mash bill, and production method cannot be filtered — all four are promised Flight Builder filters. |
| `prodTags` | string[] | ✔ | K/V mixed | Mixes production attributes (`Non-Chill Filtered`) with venue framing (`Dessert Pour`) and heritage marketing (`Heritage Brand · Est. 1856`). Needs a controlled vocabulary. |
| `why` | string **with HTML** (`<em>`) | ✔ | K | Markup embedded in data (Penelope only). Set a policy: plain text, or a declared minimal-markup convention. |
| `awards` | array `{t,s}` | ✔ | P (weak) | Undated, unsourced, unverified — a parallel, weaker version of `press[]`. **Redundant structure**: badges should be derived from verified press entries (or awards entries must gain date/verified/sourceUrl). |
| `compare` | array | ✔ (all 5) | **DEAD** | Superseded by `paths` in v2, still shipped in every record, never rendered. Delete during refactor. |
| `pairings` | array `[emoji, slot, text]` | ✔ | V | Tuple-shaped; emoji stored as data; slot vocabulary drifts (`Cocktail`/`Serve`/`Starter`/`Charcuterie` vs spec's fixed five). Fix the slot enum; move icons to renderer. |
| `dist` | object | ✔ | K | `place` is `·`-joined prose (no country field); `coord` is a **formatted display string** (`39.09° N · 84.85° W`) — store `{lat, lng}`, format at render (future map needs numbers). `history` prose is fine. |
| `dist.timeline` | array `[yearLabel, text]` | ✔ | K | Year labels non-sortable (`Today`, `1950s–60s`, `2000s`). Add numeric `sortYear` alongside the label. |
| `btb.stats` | array `[label, value]` | ✔ | D | Display-shaped stat tiles, hand-picked per bottle. Fine as venue-curated display, but several duplicate structured facts that should live in production/origin (Est. year, char level). |
| `btb.facts` | string[] | ✔ | K/V | Fine as prose. Some are venue voice ("ask about the next one") — belongs in venue section. |
| `notes` | string | ✔ | **V** | Sean's Notes. Correctly venue-owned. Voice drafted by agent, pending Sean review. |

### DOSSIER_DETAILS (v2 layer)

| Field | Type | Req | Class | Findings |
|---|---|---|---|---|
| `reviewedAt` | ISO date | ✔ | P | Good; validated format. No `addedAt`/`updatedAt`/`reviewedBy` yet (production system will need them). |
| `topNotes` | string[3] | ✔ | K | Good; validated length. |
| `whyShort` | string | ✔ | K | Good. |
| `seanShort` | string | ✔ | V | Curly quotes and `— Sean` attribution **baked into the data string**. Store the quote alone; render attribution. |
| `whyWeCarry` | string | ✔ | V | Correctly separated from `why`. |
| `press` | array | ✔ | P | Best-structured field in the file. Missing `sourceUrl` (required for the sourcing rules in CONTENT-WORKFLOW.md) and `addedAt`. **See editorial review: current dates are fabricated.** |
| `paths` | `{lighter,similar,adventurous}` | ✔ | V | `ref` correctly used for in-vault links. Non-ref entries carry freehand `name`/`d` duplicating bottles that exist in the master 164 list — at scale, most should become refs, with freeform allowed only for true off-list mentions. |
| `commerce` (injected) | object of nulls | ✔ | C | Codex's placeholder — correct shape, correct ownership, unrendered. Availability and price should eventually join it. |
| `dataVersion` (injected) | string | ✔ | P | Fine. |

### Fields that don't exist yet but are already promised

Country, region, subcategory, brand/expression split, ABV, numeric age bounds,
structured cask type / finish type / mash bill / production method,
`recordStatus` (draft/reviewed/published), `sources[]`, `sortYear` on timeline,
`{lat,lng}`, per-record image asset reference (only the 4-way `silo` silhouette
exists). All are prerequisites for the filter list in HANDOFF ("Filters the
database must support") — see schema spec.

---

## 2 · Technical debt register

**Classification:** 🔴 Blocker before scaling · 🟠 Should fix during refactor ·
🟡 Safe to defer · ⚪ Intentional prototype shortcut

| # | Finding | Class | Notes |
|---|---|---|---|
| T1 | `production` is presentation prose (tuples + layout flag); cask/mash/method/finish unfilterable | 🔴 | Blocks 4 of the promised Flight Builder filters. Core of the Codex refactor. |
| T2 | No country/region/subcategory/brand fields | 🔴 | Blocks geography & subcategory filters; must exist before mass data entry or 164 records get re-touched. |
| T3 | No numeric age bounds | 🔴 | Blocks age filter/progression. Add before data entry. |
| T4 | Price/pour size stored as display strings in knowledge record | 🔴 | Acceptance criterion "POS can later supply price/availability without rewriting the knowledge record" fails today. Move under `commerce`. |
| T5 | No `recordStatus` (draft/reviewed/published) | 🔴 | The 5→164 workflow can't run without it; validation currently requires every editorial field, making legitimate drafts impossible. |
| T6 | `status` conflates stock, merchandising, and events | 🟠 | Split commerce availability from venue merchandising. |
| T7 | `awards` duplicates `press` with weaker guarantees | 🟠 | Derive badges from press, or unify. |
| T8 | Dead `compare` arrays in all 5 records | 🟠 | Delete; ~40 lines of drift risk. |
| T9 | Two-map entry (`SPIRIT_DATA` + `DOSSIER_DETAILS`) requires dual data entry per spirit | 🟠 | Merge into one canonical record per spirit (schema spec §1) or generate the split from one source. ADD-A-SPIRIT.md currently instructs editing both. |
| T10 | `proof` string / `proofN` number duplication | 🟠 | Store once, format at render. |
| T11 | HTML (`<em>`) inside `why` data | 🟠 | Declare markup policy. |
| T12 | Non-ref path entries duplicate master-list bottle facts | 🟠 | Ref-first policy once records exist. |
| T13 | Hardcoded counts: vault-note "5 of 164" in static HTML; `'164 AT LAUNCH'` string in `renderVault()` despite `SPIRIT_COLLECTION_TARGET` existing | 🟠 | Two spots; constant is already defined — wire it through. |
| T14 | `cmp-row` has `role="button"`/`tabindex` but no Enter/Space key handler; vault cards & pager dots are click-only divs | 🟠 | Keyboard users can't activate recommendation links or vault cards. Drawers themselves are real buttons (good). |
| T15 | Vault-card status dots are color-only (no text/aria) | 🟠 | Availability legend exists only in detail view chips. |
| T16 | Single-file architecture: at 164 records the inline data pushes the HTML toward ~1.5–2 MB on bar Wi-Fi | 🟠 | Refactor decision for Codex: external JSON (or generated file) while keeping no-build deploy simple. Flagged, not prescribed. |
| T17 | `body`/`finish` not range-validated (axes are) | 🟡 | One-line validator addition. |
| T18 | `dist.coord` display string; no `{lat,lng}` | 🟡 | Needed only when the real map ships. |
| T19 | Timeline year labels non-sortable | 🟡 | Add `sortYear` when convenient. |
| T20 | Emoji stored in pairing data | 🟡 | Cosmetic. |
| T21 | Inline `onclick` string injection with ids | 🟡 | Ids are controlled slugs; revisit if ids ever carry user input. |
| T22 | Google Fonts dependency (no offline fallback beyond system serif) | 🟡 | Acceptable degradation. |
| T23 | `prefers-reduced-motion` not respected (pulse/hint animations) | 🟡 | Small CSS addition. |
| T24 | Session countdown is cosmetic; no token check | ⚪ | QR backend explicitly deferred. |
| T25 | Validation throws only in dev contexts, logs in production | ⚪ | Correct behavior for a guest-facing page. |
| T26 | Index-based `stepBottle`/pager for transient navigation | ⚪ | Acceptable — permanent references all use stable ids; swipe order is inherently positional. |
| T27 | `renderDetail` rebuilds full innerHTML per bottle | ⚪ | Fine at this scale. |

**Preserve during refactor (do-not-lose list):** stable-ID navigation
(`spiritIndexById`/`gotoBottleId`), drawer accessibility pattern
(`aria-expanded`/`aria-controls`/`hidden`), `radarSVG`/`radarMini`/`bottleSVG`/
`medalSVG` renderers, swipe + arrow-key navigation, filter logic shape in
`renderVault()`, the validation layer added in `foundation-v1`, the visual
language, and the verified-only/newest-first press rendering rule.

---

## 3 · Editorial review of the five dossiers (Task 6)

Proposed revisions are **proposals for Sean's review** — nothing has been
rewritten in the prototype.

### 3.1 The one serious integrity issue — fabricated press dates

Every `press[]` entry carries a **specific ISO date that was invented during
prototyping** (e.g. Penelope "SFWSC Double Gold — 2025-04-12", Macallan "ISC
Gold — 2025-07-08", Diplomático "Madrid Gold — 2025-05-21"). The underlying
awards are plausible and in several cases real in some year, but the dates,
classes, and score contexts are not sourced. They are marked `verified:true`
solely so the prototype renders.

**Proposed handling (needs Sean's decision):**
- Option A (recommended): flip all award/score entries to `verified:false`
  until sourced. Because the UI renders verified-only, the Recognition drawer
  would show badges but no dated entries until real citations land.
- Option B: keep undated badges only, delete the fabricated dated entries.
- Either way: `sourceUrl` becomes required for `verified:true` going forward
  (rule written into CONTENT-WORKFLOW.md).

The one legitimately dated entry is Chicken Cock's Feb 17, 2026 Echo's Reserve
dinner (first-party event, verifiable in-house).

### 3.2 Claim-by-claim flags

**Penelope Barrel Strength** — `proof: 116.2` states one batch as if constant
(batches vary by design; needs `batchVaries` handling). `Entry Proof: 120`
unverified. Four-grain description and 2023 MGP acquisition are accurate.
"93 Points Whisky Advocate" unsourced.

**Chicken Cock 5 Year** — 1856 Paris KY founding and Cotton Club tin-can story
are established brand history; the "1950s distillery fire" is repeated brand
lore that should get a source before print. "Cotton Club Pour" is styled as an
award badge but is heritage, not recognition — consider a separate "heritage"
badge type. Mash bill intentionally vague ("corn-forward") — fine.

**Macallan 12 Double Cask** — "485 acres" and "among the smallest stills in
Speyside" match brand-published material; ISC Gold date fabricated. The claim
"the wood costs more than the spirit" is a fact-shaped flourish — soften or
source. Note (`walk you toward the Tomatin`) reads slightly upsell-y next to
the other four; borderline, Sean's call.

**Don Fulano Blanco Fuerte** — Producer, La Tequileña/NOM 1146, Enrique
Fonseca, additive-free stance, and "Fuerte = undiluted export proof" all match
brand-published material. "harvested at 8–10 years" is typical highland
practice presented as this producer's constant — verify or soften. The
Tequila Matchmaker verification date is invented; the verification itself is
checkable.

**Diplomático Reserva Exclusiva** — 1959 DUSA/Seagram's history and "sugar
cane honeys" language are accurate brand history. The dossier honestly owns
the sweetness (good — this category draws added-sugar criticism, and the copy
pre-empts it without naming it). Madrid gold date invented.

### 3.3 Consistency observations

Tasting-note specificity is even (3 notes each, comparable granularity).
Tone is consistent operator-voice across `notes`/`whyWeCarry`; none reads as
brand copy. Weakest `whyWeCarry` is Macallan's (leans on "name recognition" —
true but thin; a line about *margin role* or *staff training anchor* would
match the others' concreteness). Comparison paths hold up, with two flags:
Old Grand-Dad 7yr (100pf) as "Lighter" for Penelope is correct only
relative to 116.2 — the row copy already says why, fine; Diplomático →
Macallan as "Adventurous" is a deliberate cross-category jump — keep, it's
the most interesting link in the set.

### 3.4 Provisional-data summary (already flagged in HANDOFF)

Pour prices (all 5), award/press citations (all except the Feb dinner),
availability staging, and all Sean-voice copy remain provisional pending
Sean's numbers, a sourcing pass, and his voice review.
