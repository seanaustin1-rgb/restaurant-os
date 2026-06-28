# Final Design / Structure Pass — Brokerage & Go-Live Surfaces

Spec-of-record for the pre-visual-polish tightening pass. Goal: **reduce confusion, tighten
promises, no new features.** Two changes are applied in this PR (priorities 1 & 3); the other
three are decisions + copy for Codex/design to implement (they touch the module registry, the
cash module's data, and are otherwise architecture-adjacent).

| # | Priority | This PR | Notes |
|---|---|---|---|
| 1 | RE source tiers | ✅ applied | `source-map.ts` |
| 2 | Brokerage dashboard presentation | decision only | registry change (Codex) |
| 3 | Assumptions vs live language | ✅ applied | `BrokerageAnalyticsModule.tsx` |
| 4 | `/heartbeat` go/no-go | decision only | no code change needed |
| 5 | Cash Oxygen pending-review warning | copy + wiring note | needs 1 data field (Codex) |

---

## 1. Real-estate source tiers ✅ APPLIED

**Problem:** `source-map.ts` flagged the CRM (`Follow Up Boss / Lofty / kvCORE`) **and** Google
Business Profile as `minimum: true` — telling a broker they must connect a CRM + GBP to start.

**Fix (applied):** only Bank (Plaid) + QuickBooks/Xero keep `minimum: true`. The plan now reads
as three plain tiers:
- **Tier 1 — Start here (minimum useful):** Bank + QuickBooks/Xero → Company Dollar, runway,
  break-even, Profit First. Nothing else required.
- **Tier 2 — Useful upgrade:** CRM / transaction system → pipeline, splits & caps, lead ROI.
- **Tier 3 — Premium / market layer:** GBP, Zillow/Realtor.com, Meta/Google Ads, MLS/RESO.

`minimumAutoInput` rewritten to: *"Start with bank (Plaid) + QuickBooks/Xero … CRM and market
data are upgrades, not requirements."* Group labels now carry "(useful upgrade)" / "(premium
layer)".

**Design follow-up:** the planner UI should render these as three labeled tiers with a "You only
need Tier 1 to start" line, and visually de-emphasize Tiers 2–3 as optional.

## 2. Brokerage dashboard presentation — DECISION: **one module, source-aware subtiles**

Concur with Codex. Today `modules.ts` registers **5 separate "live" modules** (`company-dollar`,
`commission-pipeline`, `agent-performance`, `lead-roi`, + `market-intelligence`) that all `href`
to the *same* page (`/modules/brokerage#anchor`) — overselling five mature products that are one
surface fed by partial data.

**Implementation (Codex — contained ripple, 3 files):**
- `src/lib/modules.ts`: replace the 5 entries with one — `{ key: "brokerage-analytics", name:
  "Brokerage Analytics", status: "live", href: "/modules/brokerage" }`.
- `src/lib/industry-templates.ts`: in `REAL_ESTATE_BROKERAGE.defaultModuleKeys`, replace the 5
  keys with `brokerage-analytics`.
- `src/lib/industry-templates.test.ts`: update the asserted key list.
- The page already renders the subtiles via `Panel` — keep the anchor ids; just add a per-subtile
  source badge (see #3) so each tile shows live vs assumption-based independently.

Net: one credible module that visibly sharpens as feeds connect, instead of five half-empty tiles.

## 3. "Assumptions vs live data" language ✅ APPLIED (+ extension note)

Consistent, grounded vocabulary (applied in `BrokerageAnalyticsModule.tsx`):

| State | Was | Now |
|---|---|---|
| no live feed | "not mapped" | **"Live feed missing"** |
| connected | "connected" | **"Live feed connected"** |
| planned | "planned" | **"Planned"** |

Empty-state banner rewritten to: *"Using setup assumptions. As you connect bank, accounting, CRM,
and lead data, each one replaces the assumptions row by row — nothing here is a guess once a live
feed lands."* (States the staging as a process that's working, not an apology.)

**Extension (design):** add a small **"Using setup assumptions"** badge on each subtile whose
data is still assumption-based (pairs with the per-subtile source badge from #2).

## 4. `/heartbeat` public landing — DECISION: **ship it, don't hide it**

Reviewed `HeartbeatLanding.tsx`. It **fits the final brand**: built on `DESIGN.md` (One-Voice
copper rationing, Status-is-not-decoration via `HealthSignal`), the hospitality↔brokerage toggle
demonstrates "one engine, two vocabularies," numbers are already labeled *"Illustrative · Stone
Grille figures,"* and CTAs route to `/onboarding` + `/demo`. No reason to hide a page this
on-brand.

**Conditions before paid traffic:**
1. Hero claims ("…is when brokerages go broke") are great for organic/demo; soften to a defensible
   promise if running paid ads.
2. Confirm the `/onboarding` primary CTA converts a *cold* visitor; if it assumes a signed-in flow,
   point cold traffic at `/demo` first.

Conservative posture if nervous pre-polish: organic + demo traffic yes, paid traffic after visual
polish.

## 5. Cash Oxygen pending-review warning — COPY + wiring note

**Context:** Cash Oxygen reads only *approved* ledger entries, so pending fixed costs are excluded
— the floor can read **too safe** exactly when items are unreviewed. So this disclosure is honest,
not cosmetic.

**Copy (grounded, non-alarming) — show as a yellow footnote only when pending fixed-cost
exceptions > 0:**
> *"Some fixed-cost entries are still pending review, so Cash Oxygen may improve or tighten once
> they're approved."*

Sharper variant if you want it to nudge action:
> *"Cash Oxygen is reading reviewed costs only. N fixed-cost entries are pending review — approving
> them may raise or lower this number."*

**Wiring (Codex — small):** the signal already exists (`FinancialSyncHealth.pendingMappingCount`
via `loadFinancialSyncHealth`). Surface a count on `CashRunwayData` (one field + one call in
`loadCashRunway`) and render the footnote in `CashRunwayModule`'s existing "Honest footnotes" area.

---

## Out of scope (per the handoff)
No new features. The remaining backend YAGNI items (dead `ingest.ts`, the speculative
`SourceMappingRule` table, the `bank-transactions.ts:78` no-op ternary, the demo-estimator
duplication) are tracked separately and are **not** part of this design pass.
