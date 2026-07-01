# Brokerage "Cockpit" — Living Coordination Doc (Claude ⇄ Codex)

**Single source of truth for the tandem brokerage build.** Update your own lane section + append to the
Progress Log after every step, so the other agent always knows what's done and where we are.

**Editing rule (agreed):**
- **Claude** edits `## Claude Lane Status`.
- **Codex** edits `## Codex Lane Status`.
- **Shared decisions / blockers** live in `## Shared Current State`; **handoffs** in `## Next Actions` — edit these only
  by coordination (don't rewrite the other's intent).
- Both append to `## Progress Log` with a `[Claude]` / `[Codex]` tag. `## Reference` is stable; change by coordination.

**Branch:** `feat/heartbeat-landing` · **Last updated:** 2026-07-01 by Claude ·
**Related specs:** `brokerage-data-sources.md`, `investor-owner-dashboard-plan-v2.md`, `executive-cockpit-tile-set.md`.

---

## Shared Current State

**Where we are (2026-07-01):**
- **Executive Cockpit is wired to the real spine and rendering real brokerage data.** `ExecutiveCockpit` +
  `/demo/executive-cockpit` consume `BrokerageCockpitData` / `loadBrokerageCockpit`. Mock fixture/types deleted.
- **Migration `20260630125000_add_brokerage_source_identity` APPLIED** to Supabase (`migrate deploy`).
- **Demo brokerage seeded** ("Cascade Realty Group" — 12 agents / 60 deals).
- **Green:** tsc clean; verified HTTP 200 with real figures ($531k GCI, $15.6M vol, 19.4% retention). Gate on
  **tsc + vitest** — `next build` fails *locally* (Windows env quirk, reproduces on HEAD); Linux CI should be fine.

**Locked decisions (all agreed 2026-06-30):**
1. 2nd concrete vertical NOW; polymorphic `IndustryManifest` engine deferred to Phase 2.
2. MVP stack = CSV + QBO + Follow Up Boss + Google/Aura; gated APIs = Phase 3.
3. Three data layers, never conflated — L1 money-truth (CSV/QBO/back-office only), L2 production/activity
   (Dotloop/SkySlope + MoxiWorks/FUB), L3 aura (kvCORE/Google/Brand24). Transaction-mgmt does NOT hold splits/caps.
4. Tiers: Executive Cockpit (wedge) → Agent Cockpit (per-agent MRR) → Retention (premium). Per-agent $ never in investor view.
5. Hero = "Deal Health vs. Ledger Health".
6. Anti-bloat: ~5 macro tiles; reuse neutral primitives only; no restaurant framing.

**Blockers:** PR `feat/heartbeat-landing → main` (+ CI green) is the only remaining coordination item.

## Claude Lane Status

_View/UX (Cockpit). Owned by Claude._
- ✅ Tile-set spec + strawman contract (`executive-cockpit-tile-set.md`).
- ✅ Executive Cockpit built, then **wired to real `loadBrokerageCockpit`** (`d028942`). Reputation/Market rendered as
  two tiles (a VIEW split; both source the contract's single `marketAura`).
- ✅ Applied the pending migration + seeded demo brokerage + verified real render.
- ⏳ **Blocked on Codex contract fields:** reputation *trend* + *themes* UI; market *months-of-supply / share*.
- ⏳ **Blocked on Codex:** Agent Cockpit (needs role-scoped per-`agentId` reads + activity snapshot).
- 💡 **Proposed, awaiting operator:** reputation as a header chip → click-to-expand Google review themes panel.

## Codex Lane Status

_Data/financial spine. Owned by Codex (Claude's best understanding — Codex to correct)._
- ✅ Formalized `BrokerageCockpitData` (`7aa072c`) + redline approving Claude's strawman with additions.
- ✅ Canonical per-agent rows; **source-identity spine** (`616fe38`); **CSV vendor profiles** (`5288592`); lead-spend
  hardening (`da258c1`); created migration `20260630125000`.
- ⏳ Live FUB ingestion (after read contract stable); role-scoped per-agent reads for Agent Cockpit.
- ⏳ Requested by Claude — see Next Actions.

## Next Actions

- **[Human/either] Open PR** `feat/heartbeat-landing → main`, confirm CI green. Last item to ship this vertical.
- **[Codex] Contract additions** for the reputation + market enhancements:
  - `reputationTrend { ratingTrendPts, reviewVelocity, windowWeeks, historyWeeks, themes{loved[],flagged[],summary} }`
    — Google ships review-theme summaries via **Places API (New) `reviewSummary`** (GA Sep 2025); deeper via Business
    Profile API (broker-owned, approval-gated). Real velocity needs **weekly aura-snapshot accumulation** (please kick off).
  - `marketPosition { monthsOfSupply, marketSharePct }` — needs RESO/MLS (Phase 2); render empty-state until connected.
- **[Codex] Agent Cockpit prerequisites:** role-scoped per-`agentId` reads + activity snapshot; then **[Claude]** builds
  the per-agent scoreboard (same `AgentRow` shape).
- **[Operator] Decide** the reputation header-chip + themes-panel UX (frees a tile; progressive disclosure).

## Reference — Contract & Lane Boundary

**`BrokerageCockpitData`** (in `src/lib/modules/brokerage-analytics.ts`, Codex-owned): `dealHealth`, `ledgerHealth`,
`companyDollarRetention`, `cashSafety` (`DashboardCashSafety & {floorDaysTarget}`, default 120),
`agentProduction {top/bottomContributors: BrokerageCockpitAgentRow[]}`, **single `marketAura {market, aura}`** (Claude
splits into two tiles in the view), `topPressure` (deterministic, data-lane owned), `sourceTrust`.
`BrokerageCockpitAgentRow`: agentId/email/companyDollar/retainedYield/capRemaining/capProgressPct/pipelineCompanyDollar/
leadSpend/roi/health/**sourceConfidence**/note.

**Source identity (applied):** `BrokerageAgent` = canonical human; `BrokerageAgentSourceIdentity`
(agentId/sourceSystem/externalAgentId/email/rawPayload, unique `[restaurantId, sourceSystem, externalAgentId]`,
email-matched); `BrokerageAgentActivitySnapshot` (agent/source/period). Authority: CSV/back-office → $, FUB/Moxi → activity.

**Lane boundary — contract is the firewall:**
- **Codex owns:** `prisma/schema.prisma` brokerage models + migrations, `src/lib/brokerage/**`, `brokerage-analytics.ts`,
  contract types, identity/activity logic, CSV vendor profiles, ingestion adapters.
- **Claude owns:** `src/app/**` cockpit routes, `src/components/cockpit/**`, tile set, copy, hierarchy, visual treatment.
- **Shared (coordinate first):** `schema.prisma`, migration files, the contract type.

**Process hygiene:** commit **only your own files**; **never `git stash`** on this shared checkout (Windows autocrlf
phantom diffs); gate on **tsc + vitest**.

## Progress Log

_Append-only, newest first. Tag every entry `[Claude]` / `[Codex]`._

- **2026-07-01 [Claude]** Restructured this doc into the agreed lane sections (Shared / Claude Lane / Codex Lane / Next
  Actions + Reference + Log).
- **2026-07-01 [Claude]** Wired Executive Cockpit to real `loadBrokerageCockpit` + `BrokerageCockpitData`; deleted mock
  `types.ts`/`fixture.ts` (`d028942`). Applied migration `20260630125000` (`migrate deploy` → Supabase). Seeded "Cascade
  Realty Group". Page selects a brokerage tenant **with deals** (a stray "Demo Bistro" is mis-typed `REAL_ESTATE_BROKERAGE`
  w/ 0 deals — skip it). Verified real render (HTTP 200; $531k GCI, $15.6M vol, 19.4% retention).
- **2026-07-01 [Codex]** Source-identity spine (`616fe38`), CSV vendor profiles (`5288592`), lead-spend hardening
  (`da258c1`); created migration `20260630125000_add_brokerage_source_identity`.
- **2026-06-30 [Claude]** Built Executive Cockpit mock-first (`a59486e`). Split Market&Aura → Reputation + Market tiles
  (view choice); Agent Production to a full-width row; added Market Position (Gemini input).
- **2026-06-30 [Codex]** Formalized `BrokerageCockpitData` (`7aa072c`); redline approved strawman + `sourceConfidence`,
  `floorDaysTarget` default 120, nullable `marketAura.market`, data-lane-owned `topPressure`. Agreed all 6 decisions.
- **2026-06-30 [Claude]** Locked plan + specs (`39ac4f6`).
