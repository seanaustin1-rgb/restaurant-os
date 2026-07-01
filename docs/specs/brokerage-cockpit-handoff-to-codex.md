# Brokerage "Cockpit" — Living Coordination Doc (Claude ⇄ Codex)

**Purpose:** single source of truth for the tandem brokerage build. **Each agent updates its lane status
+ appends to the Progress Log (§6) after every step**, so the other always knows what's done and where we are.
Human relays this between sessions.
**Branch:** `feat/heartbeat-landing` · **Last updated:** 2026-07-01 by Claude.
**Related specs:** `brokerage-data-sources.md` (data landscape + monetization) · `investor-owner-dashboard-plan-v2.md`
(reconciled dashboard spec) · `executive-cockpit-tile-set.md` (tile set + strawman).

---

## 1. Current state (2026-07-01)

- **Executive Cockpit is wired to the real data spine and rendering real brokerage data.** `ExecutiveCockpit` +
  `/demo/executive-cockpit` consume Codex's `BrokerageCockpitData` / `loadBrokerageCockpit`. Mock fixture/types deleted.
- **Migration `20260630125000_add_brokerage_source_identity` is APPLIED** to the Supabase DB (`migrate deploy`).
- **Demo brokerage seeded** ("Cascade Realty Group" — 12 agents / 60 deals) via `scripts/seed-demo-brokerage.ts`.
- **Green:** tsc clean; verified HTTP 200 with real figures ($531k GCI, $15.6M vol, 19.4% retention). `next build`
  fails *locally* (Windows env quirk, reproduces on HEAD) — gate on tsc+vitest; Linux CI should be fine.
- **Only remaining coordination item:** PR `feat/heartbeat-landing → main` with CI green.

## 2. Lane status

### Claude — view/UX (Cockpit)
- ✅ Tile-set spec + strawman contract (`executive-cockpit-tile-set.md`).
- ✅ Executive Cockpit built mock-first, then **wired to the real `loadBrokerageCockpit` loader** (commit `d028942`).
- ✅ Applied the pending migration + seeded the demo brokerage + verified real render.
- ✅ Reputation/Market rendered as **two tiles** (a VIEW split; both source from the contract's single `marketAura`).
- ⏳ **NEXT (blocked on Codex contract fields):** reputation *trend* + *themes* UI; market *months-of-supply / share*.
- ⏳ **NEXT (blocked on Codex):** Agent Cockpit (needs role-scoped per-`agentId` reads + activity snapshot).
- 💡 **Proposed, awaiting operator go:** reputation as a header chip → click-to-expand themes panel (Google review
  summaries). See §5.

### Codex — data/financial spine
- ✅ Formalized `BrokerageCockpitData` contract (`7aa072c`); redline approved Claude's strawman + additions.
- ✅ Canonical per-agent rows; **source-identity spine** `616fe38`; **CSV vendor profiles** `5288592`; lead-spend
  hardening `da258c1`; created migration `20260630125000`.
- ⏳ **NEXT (its plan):** live FUB ingestion once the read contract is stable; role-scoped per-agent reads for Agent Cockpit.
- ⏳ **Requested by Claude (§5):** contract additions for reputation trend/themes + market months-of-supply/share;
  kick off weekly aura-snapshot accumulation so the trend has history.

## 3. Locked decisions (all agreed 2026-06-30)

1. **2nd concrete vertical NOW, polymorphic `IndustryManifest` engine deferred** to Phase 2 (2nd live industry).
2. **MVP stack = CSV + QBO + Follow Up Boss + Google/Aura.** Gated APIs (Lone Wolf/SkySlope/Dotloop/BoldTrail/MoxiWorks) = Phase 3.
3. **Three data layers, never conflated:** L1 money-truth (GCI→company$→splits→caps) = CSV/QBO/back-office ONLY
   (transaction-mgmt does not reliably hold splits/caps); L2 production/activity = Dotloop/SkySlope + MoxiWorks/FUB;
   L3 aura = kvCORE/Google/Brand24.
4. **Tiers:** Executive Cockpit (leadership wedge) → Agent Cockpit (per-active-agent MRR engine) → Retention/flight-risk
   (premium). Per-agent $ **never** in the investor view. Under the **OutFront Data** umbrella.
5. **Hero = "Deal Health vs. Ledger Health"** (operational top-line over financial reality — honest-signals mechanic).
6. **Anti-bloat:** ~5 macro tiles; **reuse neutral primitives only** (card shell, health colors, Aura, source-readiness).
   No prime cost / restaurant TAPs / tax-reserve framing. Everything else behind "More tools."

## 4. Contract & lane boundary (reference)

**Contract (Codex owns) — `BrokerageCockpitData` in `src/lib/modules/brokerage-analytics.ts`:**
`dealHealth`, `ledgerHealth`, `companyDollarRetention`, `cashSafety` (`DashboardCashSafety & {floorDaysTarget}`,
default 120), `agentProduction {top/bottomContributors: BrokerageCockpitAgentRow[]}`, **single `marketAura {market, aura}`**
(Claude splits this into two tiles in the view), `topPressure` (deterministic, data-lane owned), `sourceTrust`.
`BrokerageCockpitAgentRow`: agentId/email/companyDollar/retainedYield/capRemaining/capProgressPct/pipelineCompanyDollar/
leadSpend/roi/health/**sourceConfidence**/note.

**Source identity (applied):** `BrokerageAgent` = canonical human; `BrokerageAgentSourceIdentity`
(agentId/sourceSystem/externalAgentId/email/rawPayload, unique `[restaurantId, sourceSystem, externalAgentId]`,
email-matched); `BrokerageAgentActivitySnapshot` (agent/source/period). Authority: CSV/back-office → $, FUB/Moxi → activity.

**Lane boundary — contract is the firewall:**
- **Codex owns:** `prisma/schema.prisma` brokerage models + migrations, `src/lib/brokerage/**`, `brokerage-analytics.ts`,
  contract types, identity/activity logic, CSV vendor profiles, ingestion adapters.
- **Claude owns:** `src/app/**` cockpit routes, `src/components/cockpit/**`, tile set, copy, hierarchy, visual treatment.
- **Shared (coordinate before touching):** `schema.prisma`, migration files, the contract type.

**Process hygiene:** commit **only your own files** (never `git add -A`); **never `git stash`** on this shared checkout
(Windows autocrlf phantom diffs); gate on **tsc + vitest** (not local `next build`).

## 5. Open items / requests

- **PR `feat/heartbeat-landing → main` + CI green** — last coordination item.
- **Codex contract additions (from Claude):**
  - `reputationTrend { ratingTrendPts, reviewVelocity, windowWeeks, historyWeeks, themes{loved[],flagged[],summary} }` —
    Google ships review-theme summaries via **Places API (New)** `reviewSummary` (GA Sep 2025); deeper via Business
    Profile API (broker-owned, approval-gated). Real velocity needs weekly aura snapshots.
  - `marketPosition { monthsOfSupply, marketSharePct }` — needs RESO/MLS (Phase 2); render empty-state until connected.
- **Agent Cockpit** — needs Codex role-scoped per-`agentId` reads + activity snapshot; then Claude builds the per-agent scoreboard.
- **Reputation UX (proposed, awaiting operator):** move reputation to a header chip (`4.6★ ▾`) → click opens a themes panel
  ("what people love / what's flagged"). Frees a tile; matches cockpit progressive-disclosure.

## 6. Progress log (append-only, newest first — every step)

- **2026-07-01 [Claude]** Wired Executive Cockpit to the real `loadBrokerageCockpit` + `BrokerageCockpitData`; deleted
  mock `types.ts`/`fixture.ts` (commit `d028942`). Applied pending migration `20260630125000` (`migrate deploy` → Supabase).
  Seeded "Cascade Realty Group". Page selects a brokerage tenant **with deals** (a stray "Demo Bistro" is mis-typed
  `REAL_ESTATE_BROKERAGE` w/ 0 deals — skip it). Verified real render (HTTP 200; $531k GCI, $15.6M vol, 19.4% retention).
- **2026-07-01 [Codex]** Landed source-identity spine (`616fe38`), CSV vendor profiles (`5288592`), lead-spend
  hardening (`da258c1`); created migration `20260630125000_add_brokerage_source_identity`.
- **2026-06-30 [Claude]** Built Executive Cockpit mock-first (`a59486e`). Split Market&Aura → Reputation + Market tiles
  (view choice, per operator feedback); pulled Agent Production to a full-width row. Added Market Position (Gemini input).
- **2026-06-30 [Codex]** Formalized `BrokerageCockpitData` (`7aa072c`); redline: approved strawman + `sourceConfidence`,
  `floorDaysTarget` default 120, `marketAura.market` nullable, `topPressure` data-lane owned. Agreed all 6 decisions.
- **2026-06-30 [Claude]** Locked plan + specs (`39ac4f6`): `brokerage-data-sources.md`, `investor-owner-dashboard-plan-v2.md`,
  this doc, `executive-cockpit-tile-set.md`.
