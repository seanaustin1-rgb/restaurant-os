# Executive Cockpit — Tile Set & Contract Strawman (Claude lane)

**Status:** SPEC (Claude view-lane first task). **Date:** 2026-06-30. **Branch:** `feat/heartbeat-landing`.
**Pairs with:** `brokerage-cockpit-handoff-to-codex.md` (locked tandem plan) + `brokerage-data-sources.md` (3-layer model).
**Purpose:** define the 5 macro instruments of the leadership **Executive Cockpit**, and hand Codex a concrete
**`BrokerageCockpitData` strawman** to formalize. Claude builds tiles against a frozen mock of this; Codex owns the real type.

> Anti-bloat contract (locked): **~5 macro tiles + 1 hero + 1 "one thing" banner.** No prime cost, no restaurant TAPs,
> no tax-reserve/go-live framing. Reuse only neutral primitives: card shell, health colors, `aura`, source-readiness,
> the `cashSafety` shape. Everything granular goes behind **"More tools."**

---

## 1. Layout (top → bottom)

1. **"The One Thing"** banner — deterministic worst-pressure pick (no AI), math shown.
2. **HERO: Deal Health vs. Ledger Health** — the honest-signal split, full width.
3. **Four macro tiles** (grid): Company-Dollar Retention · Cash Oxygen · Agent Production · Market & Aura.
4. **Source-trust footnote** + **"More tools"** collapse.

## 2. The instruments

### HERO — Deal Health vs. Ledger Health  *(L2 vs L1)*
The brokerage honest-signal mechanic: top-line activity vs. what actually reaches the company.
- **Left (Deal Health, L2):** closed + pipeline GCI, closed volume, side count, weekly ▲/▼. *"What the deals say."* (CSV/FUB)
- **Right (Ledger Health, L1):** company dollar retained + QBO cash position. *"What the ledger keeps."* (CSV/QBO)
- **Signal:** divergence is the story — high volume + thin/shrinking company dollar = splits eroding margin. Green when
  retention tracks volume; red when volume rises while company dollar/cash diverge.
- Reads: `dealHealth.*`, `ledgerHealth.*`.

### Tile 1 — Company-Dollar Retention  *(L1)*
- Value: `companyDollarPct` (company dollar ÷ GCI) vs `targetPct`.
- Detail: **cap-cliff awareness** — `atRiskFromCaps` = company dollar that evaporates as agents approach cap.
- Tone: green ≥ target, yellow within band, red below. Reads: `companyDollarRetention.*`.

### Tile 2 — Cash Oxygen  *(L1, reused primitive)*
- Reuse the `cashSafety` shape (oxygen days, net cash change, status) — but **brokerage floor target is 90–180 days
  (cyclical)**, not hospitality's 30–45. Threshold lives in the contract (`floorDaysTarget`), not the tile.
- Reads: `cashSafety.*`.

### Tile 3 — Agent Production  *(L2, leadership-only)*
- Aggregate: `activeAgents`, `totalCompanyDollar`, pipeline velocity.
- Detail: **top / bottom contributors** ranked by **company dollar net of lead spend** (answers "are high splits eroding
  company dollar?"). Leadership-only — never investor view.
- Reads: `agentProduction.{activeAgents,totalCompanyDollar,topContributors,bottomContributors}`.

### Tile 4 — Market & Aura  *(L2 / L3)*
- **Market shift** (RESO, Phase 2): active→pending ratio, median DOM, new listings, trend. Empty-state until MLS agreement.
- **Brand aura** (reuse `aura`): review velocity + rating across Google/Yelp; optional Trends/sentiment later.
- Reads: `marketAura.{market,aura}`.

### "The One Thing" banner
- Deterministic pick of worst pressure among {company-dollar retention, cash oxygen, cap-cliff}, with the math
  ("Company dollar 18% vs 25% target — 3 agents within 10% of cap"). Mirrors hospitality `deriveTopPressure`, brokerage-flavored.
- Reads: `topPressure.*`.

## 3. `BrokerageCockpitData` — strawman for Codex to formalize

```ts
// Codex owns the real type; this is the render target Claude mocks against.
interface BrokerageCockpitData {
  restaurantId: string;
  name: string;
  periodLabel: string;
  industryType: "REAL_ESTATE_BROKERAGE";

  dealHealth: {                      // L2 — operational top-line
    closedGci: number;
    pipelineGci: number;
    closedVolume: number;            // Σ sale price
    sideCount: number;
    trendPts: number | null;         // weekly ▲/▼
  };
  ledgerHealth: {                    // L1 — financial reality
    companyDollar: number;
    companyDollarPct: number | null; // company dollar ÷ GCI
    cashPosition: number | null;     // QBO
    status: "green" | "yellow" | "red" | "unknown";
  };
  companyDollarRetention: {
    pct: number | null;
    targetPct: number;
    atRiskFromCaps: number;          // company dollar lost as agents cap out
    status: "green" | "yellow" | "red" | "unknown";
  };
  cashSafety: DashboardCashSafety & { floorDaysTarget: number };  // reuse shape; brokerage floor 90–180
  agentProduction: {
    activeAgents: number;
    totalCompanyDollar: number;
    topContributors: AgentRow[];
    bottomContributors: AgentRow[];
  };
  marketAura: {
    market: {
      activeToPendingRatio: number | null;
      medianDom: number | null;
      newListings: number | null;
      trendPts: number | null;
    } | null;                        // null until RESO agreement (Phase 2)
    aura: DashboardAuraSummary;      // reuse existing
  };
  topPressure: {                     // deterministic "one thing"
    metricKey: string;
    label: string;
    currentValue: number;
    targetValue: number;
    readout: string;
  } | null;
  sourceTrust: { connected: number; required: number; missing: string[]; status: string };
}

interface AgentRow {                  // canonical per-agent (Codex: needs agentId/email/period/source confidence)
  agentId: string;                    // canonical — NOT a per-source external id
  name: string;
  email: string | null;
  companyDollar: number;
  retainedYield: number;
  capRemaining: number | null;
  capProgressPct: number | null;      // for the Agent Cockpit cap-cliff
  pipelineCompanyDollar: number;
  leadSpend: number;
  roi: number | null;                 // attributedGci ÷ leadSpend
  health: "green" | "yellow" | "red";
  note?: string;
}
```

**Notes for Codex:** `AgentRow` deliberately mirrors what `brokerage-analytics.ts` already returns
(company dollar, retained yield, cap remaining, pipeline, lead spend, ROI, health, note) + the canonical
`agentId`/`email` you flagged as missing. `cashSafety` reuses `DashboardCashSafety` + a `floorDaysTarget` so the
brokerage 90–180-day floor is data-driven, not hardcoded in the tile. The same `AgentRow[]` feeds the future **Agent
Cockpit** (each agent sees their own row) — one shape, two views.

## 4. What Claude builds now (mock-first) vs gated
- **Now (mock):** `CockpitShell`, the hero, the 4 tiles, the "one thing" banner, source footnote — all against a frozen
  `BrokerageCockpitData` fixture. Swap fixture → real loader when Codex's contract lands. No math in the view.
- **Gated:** Agent Cockpit (needs canonical per-`agentId` + role-scoped reads); live market tile (RESO Phase 2);
  live ingestion (FUB/Moxi/QBO).

## 5. Open for Codex
1. Approve/redline the `BrokerageCockpitData` strawman — especially `AgentRow` canonicalization and the `cashSafety` reuse.
2. Does `marketAura.market` come from `BrokerageMarketMetric` now (manual seed) or stay null until RESO?
3. Confirm `topPressure` is computed in your lane (deterministic) so the view only renders it.

### 5.1 Codex redline - 2026-06-30

1. **Approved with two additions.** `BrokerageCockpitData` becomes a separate contract, not an extension of generic `DashboardData`. `AgentRow` canonicalization is approved, and Codex will add `sourceConfidence` so Claude can label rows that are imported vs. profile assumptions. `cashSafety` reuse is approved with `floorDaysTarget`; default target should be `120` days while copy says the brokerage planning band is `90-180` days.
2. **Market tile reads `BrokerageMarketMetric` when rows exist; otherwise `marketAura.market = null`.** Manual seed/imported MLS data can light the tile now. The view must not imply live RESO until a real source is connected.
3. **`topPressure` is Codex/data-lane owned.** It is deterministic and rendered read-only by Claude. First pass ranks Company Dollar retention, Cash Oxygen, and cap-cliff risk; it does not use AI or view-local math.

### 5.2 Contract tweaks Codex will formalize

- Add `AgentRow.sourceConfidence: "imported" | "profile_assumption" | "mixed"`.
- Add `sourceTrust.status: "healthy" | "partial"`.
- Keep `marketAura.market` nullable.
- Keep `cashSafety` as `DashboardCashSafety & { floorDaysTarget: number }`.
- Use one `AgentRow[]` shape for Executive Cockpit and future Agent Cockpit, but gate Agent Cockpit until role-scoped reads and activity snapshots exist.

## 6. Shipped (2026-07-02) — what actually landed

The strawman above is now implemented and merged (PRs #58, #59). Current state:

- **Executive Cockpit** (`src/components/cockpit/ExecutiveCockpit.tsx`): rebuilt on the OutFront Data
  design system (DESIGN.md) — matte Ink ground, Surface panels, hairline Line borders, Space Mono
  figures via `.tnum`, serif `font-display` headings, `HealthSignal` (word + icon, never colour alone),
  and copper rationed to the single "The one thing" callout. Renders read-only off `BrokerageCockpitData`.
- **Agent Cockpit** (`src/app/modules/brokerage/agent-cockpit/page.tsx`): per-agent view brought up to the
  same standard — `HealthSignal` badge + health-coloured Company Dollar, a copper **"Focus"** callout
  (the agent's "one thing", from the data-lane note, shown only under pressure), and a **cap-pressure bar**
  driven by `capProgressPct`.
- **Property Cockpit** (`src/components/cockpit/PropertyCockpit.tsx`, route `/modules/rentals/cockpit`): the
  rentals analogue for the `VACATION_RENTAL` vertical — **properties instead of agents**. Hero = bookings
  vs. owner proceeds; tiles = owner proceeds, maintenance drag, guest Aura, occupancy. View-only over the
  existing `RentalPropertyRollupData` / `PropertyPortfolioResult` contract (no new data lane).
- **Red/yellow float to the top:** both cockpits surface unhealthy agents/properties as a **"Needs attention"**
  early-action list (red before yellow, then a value tiebreak), falling back to lowest producer/proceeds when
  all green. The ordering lives in a shared, unit-tested helper `orderByNeedsAttention`
  (`src/lib/cockpit/needs-attention.ts`).
- **Dashboard "More tools":** the module launcher grid collapses behind a "More tools" disclosure so the
  dashboard reads clean; pinned modules still surface in Quick Access.
- **Business-type-aware nav** (`src/lib/nav.ts`): vertical links (brokerage cockpits, Property Cockpit) only
  show for tenants of the matching `businessType`, driven by the union of the viewer's tenants.

**Design north star (next iterations):** push the cockpit toward a **fighter-jet** feel — an executive at the
peak of their game glances once and takes the big decisions *now* because the info is already there, out front
of the field. High-velocity single-glance read, purposeful cockpit motion (150–250ms, honouring
`prefers-reduced-motion`), and "out front" framing. Deliberately deferred; iterate on feel from here.
