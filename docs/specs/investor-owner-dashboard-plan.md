# Investor & Owner Dashboard — Plan & Architecture

**Status:** PROPOSAL — for Codex architectural review *before* any build.
**Author:** Claude (with operator). **Date:** 2026-06-29.
**Ask of Codex:** review the whole plan, push back on architecture, and answer the
"Questions for Codex" at the bottom. Nothing here is built yet.

---

## 1. Goal

One engine, two curated views off the same `DashboardData`:

- **Operator view** — full, granular, the "why" and "how" (in the weeds).
- **Investor view** — curated assurance + progress, **notes-bridged**: every red metric
  carries a dated note so an investor sees the *why* without a phone call.

Governing rule (existing product principle): **surface the signal + show the math,
never overclaim.** Several items below exist specifically to *fix* current overclaims.

## 2. Decisions locked with the operator

- **Roles:** Investor = **read-only**. Consultant/Manager = authorized to adjust + set up.
  Operator = full. Investor outreach happens by email/call (no in-app threads → not CRM).
- **"The One Thing":** strictly **deterministic if/then** from the worst red bucket, with the
  math shown ("Labor is #1 pressure: 38% vs 32% target"). **No AI verdict.** Trend-based
  "trouble on the horizon" alerts are deferred until ≥~12 months of history exist.
- **Trend:** weekly directional ▲/▼ now (from existing weekly prime-cost trend). True
  MoM/YoY waits for real accumulated history; *some* prediction is acceptable once a year of
  monthly sales is uploaded, but history is the true determinant.
- **Modules de-bloat:** start with **collapse behind "More tools"** only. No "phase" model.
- **Cash:** **single merged tile**, with expand-on-click/hover for detail (no three cash tiles).
- **Net margin:** must explicitly state what it includes/excludes.

## 3. Full change set

Legend: ✅ done · 🟡 prototyped · ⬜ todo

### Track A — Investor Matrix (the real `/investor`)
- ⬜ A1. Fix "Profit discipline" bug → **Tax & reserve discipline** driven by `buckets[tax-reserve].signal` (red when short). *Current tile shows `categorizationCoveragePct` — a bookkeeping metric — so it reads 100% green while tax is short. Real bug.*
- ⬜ A2. Remove redundant "Investor return signal" tile (dup of real revenue).
- ⬜ A3. Add **Net margin** tile — **with an explicit inclusions/exclusions note**.
- ⬜ A4. Add **Reputation** tile (`data.aura`, Google/Yelp).
- ⬜ A5. Demote "Source freshness" → trust footnote **+ list actual sources** (POS/Bank/Payroll/…).

### Track B — Trust layer
- 🟡 B1. **Attention Required** zone (over-target items rise to top).
- 🟡 B2. **Contextual dated notes** ("managed event").
- ⬜ B3. Persist: **`MetricNote` model + server action** (migration sequenced after #47).
- ⬜ B4. Integrate Attention+notes into real `DashboardView`, **role-gated** (operator/consultant write; investor read-only).

### Track C — Owner-view de-bloat
- ⬜ C1. Collapse Modules grid behind **"More tools"** (default = pinned).
- ⬜ C2. Collapse Setup/Template/Sources strip → **System Health** gear (top-right).
- ⬜ C3. **"The One Thing"** — deterministic from worst red bucket; show math.

### Track D — Cash clarity (consolidated)
- ⬜ D1. **One** cash tile: current balance + net-change ▲/▼ + days-of-oxygen vs floor; expand for detail.
- ⬜ D2. **Fixed vs Variable + breakeven** (needs cost classification — see architecture).
- ⬜ D3. Demo seed: set a cash anchor + balance (removes "Anchor needed").

### Track E — Trend / velocity
- ⬜ E1. Directional ▲/▼ on Operating Pressure from existing **weekly** prime-cost trend.
- ⬜ E2. True MoM sparklines — needs a **prior-period loader** (deferred until real history).

## 4. Architecture (the part needing Codex's review)

### 4.1 Data contract — `DashboardData`
Claude's view lane consumes `DashboardData` **read-only**. Open question: where do new
*derived* values live — data layer vs view?

- **Net margin** = `realRevenue / revenue` → pure presentational derivation → **view**.
- **Attention list** (gauges `health∈{red,yellow}` + costRatios + buckets `signal=red`) →
  currently derived in the view prototype. Proposal: **promote to `DashboardData.attention`**
  so both views + tests share one definition. *Codex: agree?*
- **"The One Thing"** = deterministic pick of worst red bucket → proposal: compute in the
  **data layer** (testable, single source) and expose `DashboardData.topPressure`. *Codex: agree?*
- **Fixed vs Variable / breakeven** = needs `FIXED_OPEX` classification (your ledger lane).
  Proposal: Codex extends `break-even.ts`/data layer to expose `fixedCosts`, `variableCosts`,
  `breakEvenSales` on `DashboardData`; Claude only renders. *Codex: is FIXED_OPEX classification
  ready to expose, or still in flux?*
- **Net cash change / oxygen-days** = from `cash-oxygen.ts` (your lane, not yet on `main`).
  Claude renders `cashSafety.{currentCash,oxygenDays,avgDailyFixedBurn}` + a net-change field.
  *Codex: confirm/added a `netCashChange` (period bank delta) field?*

### 4.2 `MetricNote` persistence (proposed)
```
model MetricNote {
  id           String   @id @default(cuid())
  restaurantId String
  metricKey    String   // namespaced: "gauge-opex" | "bucket-tax-reserve" | "ratio-liquor"
  eventDate    DateTime // the dated event the note explains
  body         String
  authorId     String   // clerkUserId
  createdAt    DateTime @default(now())
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  @@index([restaurantId, metricKey])
}
```
- Server action create/list; **writes gated to OPERATOR/MANAGER/CONSULTANT**, investor read-only.
- Migration **created only after #47 lands on `main`** so it never stacks on the contested
  `20260627183000` migration or desyncs the demo DB history.
- *Codex: does the model shape + `metricKey` namespacing fit your schema conventions? Retention?*

### 4.3 Component / lane hygiene
- Extract `InvestorMatrix`, `AttentionZone`, `CashTile` into `src/components/*` so edits to the
  **shared `DashboardView.tsx`** stay minimal/additive (reduces Claude↔Codex collision).
- Role curation reuses the existing role system (`UserRestaurantRole`, `landingPathForRole`).

### 4.4 Migration & branch sequencing
- Codex: `feat/heartbeat-landing` → PR #47 (+ prod `20260627183000`) → `main`.
- Claude: `feat/investor-owner-dashboard` off `main`; rebases as #47 lands.
- D-cash (oxygen/net-change), D2 (fixed/var), B3 (notes migration) are **gated** on the Codex
  lane reaching `main`. A, B1/B2, C, E1 are parallel-safe on current `main`.

## 5. Lane breakout (tandem)

| | **Codex** — data/financial spine + go-live | **Claude** — view/UX |
|---|---|---|
| Owns | `financial-ledger/**`, `cash-oxygen.ts`, `break-even.ts`, brokerage, `source-map.ts`, `industry-templates.ts`, ledger schema + `20260627183000` | `app/investor/page.tsx`, new `AttentionZone`/`MetricNote*`/extracted `InvestorMatrix`, presentational parts of `DashboardView.tsx` |
| Produces | stable `DashboardData` (+ any new derived fields above) | read-only consumer; no math changes |

Shared files (`DashboardView.tsx`, `schema.prisma`, migrations) reconcile at PR/cross-review.
After both land, swap for review.

## 6. Questions for Codex (please answer before we lock + build)

1. **Derived-metric placement:** attention list, "one thing", fixed/variable, net-cash-change —
   data layer (`DashboardData`) or view? (Claude leans: anything needing cost classification or
   reused across views → data layer; pure ratios → view.)
2. **`MetricNote`** model shape + `metricKey` namespacing — fits conventions? Index/retention concerns?
3. **Migration ordering** — confirm MetricNote migration lands *after* `20260627183000`; any conflict
   with how you're finalizing that migration (the `SourceMappingRule` trim decision)?
4. **FIXED_OPEX** — is the fixed/variable cost classification stable enough to expose on
   `DashboardData` now, or should D2 wait?
5. **Lane check** — are any "Claude-lane" files ones you consider in-flight/yours? Re-draw the boundary
   if so.
6. **`cash-oxygen.ts`** — what's the timeline to `main`? D's cash tile is gated on it.
