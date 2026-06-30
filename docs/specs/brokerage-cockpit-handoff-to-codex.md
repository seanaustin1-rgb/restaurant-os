# Handoff → Codex: Brokerage "Cockpit" vertical — align + tandem plan

**From:** Claude (view/UX lane) · **Date:** 2026-06-30 · **Branch:** `feat/heartbeat-landing`
**Read first:** `docs/specs/brokerage-data-sources.md` (the API/data landscape + monetization) and
`docs/specs/investor-owner-dashboard-plan-v2.md` (the reconciled dashboard spec).
**How to respond:** mark each item in §1 **Agree / Pushback**, answer §2, and redline §3–4 lanes/sequencing.
Play devil's advocate on the data-spine architecture — that's your lane.

---

## 0. TL;DR of what changed since your last handoff

We pivoted the next vertical to **real-estate brokerage**, and the market research (Reddit + Gemini, cross-checked
against live API docs) converged on a sharp, buildable shape:

- Build brokerage as a **2nd hardcoded concrete vertical NOW** — *not* the polymorphic engine. The `IndustryManifest`
  engine stays the **Phase-2 North Star** (build it once a 2nd industry has live data; abstract from two concretes,
  not one + a guess). The view layer gets named the **"Cockpit."**
- **CSV is the wedge, not a fallback.** The brokerage's money-truth (GCI → company dollar → splits → caps) lives in
  *gated* back-office systems, and one popular one (Loft47) has **no API at all**. CSV export + QBO covers Layer 1 on
  day one and bypasses the incumbents' deliberate data silos — which Reddit confirms is the #1 frustration.
- The **brokerage schema already exists** (your `20260622210000` migration: `BrokerageAgent/Deal/LeadSpend/MarketMetric`).
  The work is *around* it, not a rebuild.

## 1. Decisions to confirm (Agree / Pushback)

1. **2nd concrete vertical now, polymorphic engine deferred.** Brokerage Cockpit is hardcoded (hospitality-style), read
   through named accessors so Phase-2 `IndustryManifest` swaps the *source* of labels/thresholds additively. ☐
2. **MVP data stack = CSV + QBO + Follow Up Boss + Google.** All gated APIs (Lone Wolf, SkySlope, Dotloop, BoldTrail,
   MoxiWorks) are **Phase 3**, unlocked with a pilot broker's leverage. ☐
3. **Three data layers, do not conflate:**
   - **L1 Money truth** (GCI→company dollar→splits→caps) → **CSV / QBO / back-office only**.
   - **L2 Production & activity** (volume, status, velocity, tapering) → Dotloop/SkySlope + MoxiWorks/FUB.
   - **L3 Aura** (mindshare/sentiment/reviews) → kvCORE web-engagement + Google Trends/Brand24/GBP (reuse `aura`).
   **Key claim to confirm in your lane:** transaction-mgmt systems do **NOT** reliably hold commission splits/caps
   (SkySlope = "if logged in custom fields"). So L1 cannot be sourced from Dotloop/SkySlope. ☐
4. **Product tiers + monetization:** **Executive Cockpit** (leadership wedge, size-band pricing) → **Agent Cockpit**
   (per-active-agent add-on, the MRR engine) → **Retention/flight-risk** (premium). Per-agent $ never in the investor
   view. Naming sits under the **OutFront Data** umbrella. ☐
5. **Hero tile = "Deal Health vs. Ledger Health"** — operational top-line (CSV/FUB) layered over financial reality (QBO).
   This is the honest-signals mechanic applied to brokerage. ☐
6. **Anti-bloat rule:** the Cockpit is ~5 macro tiles. **Do not port hospitality scaffolding** (go-live coach,
   prime-cost/tax-reserve/cost-ratio gauges) into it. Everything else behind "More tools." ☐

## 2. Questions for Codex (your lane — please answer)

1. **Per-agent rollup:** does `brokerage-analytics.ts` already produce a per-agent breakdown, or only aggregate
   (`companyDollarPct` etc.)? The Agent Cockpit + contribution ranking needs per-`agentId` (GCI, company dollar,
   cap progress, attributed lead spend). Small extension or net-new?
2. **Contract shape:** extend `DashboardData` with brokerage fields, or a separate `BrokerageCockpitData`? You own the
   contract — which keeps the hospitality contract clean while giving the Cockpit a stable read surface?
3. **Schema delta for the CSV+FUB blend** (see data-sources §5): a `sourceSystem` discriminator
   (`CSV|FOLLOW_UP_BOSS|LONE_WOLF|SKYSLOPE|BOLDTRAIL|MOXIWORKS`) + an **email-keyed identity match** to collapse one
   human's per-system ids (today `@@unique([restaurantId, externalAgentId])` would duplicate an agent across sources).
   Approve as the next brokerage data task? Authority rule: CSV wins for $, FUB/Moxi win for activity — agree?
4. **Agent-activity surface:** add a light per-agent activity snapshot (logins/CMAs/pipeline velocity from FUB/Moxi)
   vs. reusing `BrokerageDeal` pipeline stages? This is the fuel for the retention tier.
5. **Migration sequencing:** is the brokerage schema delta independent of the contested `20260627183000` / PR #47, or
   does it stack? (Brokerage models look independent of the SourceMappingRule trim — confirm.)
6. **CSV robustness:** how forgiving is `normalized-import.ts` to multi-vendor exports (Lone Wolf vs SkySlope vs Loft47
   column shapes)? Is per-vendor templating needed for the wedge to actually work at a broker's desk?
7. **Lone Wolf:** any read on whether its 2025 API Portal exposes **commission/split line items** vs only transaction
   metadata? (Determines whether it ever *replaces* CSV or only augments it — Phase 3.)

## 3. Proposed tandem lanes (no overlap)

Mirror the hospitality split. The **contract is the firewall**: Codex produces a read-only contract; Claude renders it.

| | **Codex — data/financial spine** | **Claude — view/UX (Cockpit)** |
|---|---|---|
| **Owns** | `prisma/schema.prisma` brokerage models + migrations; `src/lib/brokerage/**` (CSV normalize/import); `src/lib/modules/brokerage-analytics.ts` (per-agent rollup + cockpit output); FUB/QBO ingestion adapters; the **brokerage cockpit contract** type | `src/app/**` cockpit routes (Executive + Agent + demo preview); `src/components/cockpit/**` (CockpitShell, ExecutiveCockpit, AgentCockpit, **DealHealthVsLedger** tile); presentational reuse of `aura` |
| **Produces** | stable read-only `BrokerageCockpitData` (+ per-agent array) | read-only consumer; **no math changes** |
| **Never touches** | the cockpit components/routes | the contract internals, brokerage math, schema, migrations |
| **Shared (reconcile at PR only)** | `schema.prisma`, the contract type file, any `DashboardView` routing switch | same |

**Process hygiene (lessons from this session's shared-tree mess):**
- Commit **only your owned files**; never `git add -A` on the shared checkout.
- **Do not `git stash`** on this checkout — Windows autocrlf creates phantom diffs that block stash-pop and pulled in
  the other lane's uncommitted work last time.
- Coordinate explicitly before editing `schema.prisma` or the contract type; treat the contract file as the seam.
- Gate the build on **tsc + vitest** (`next build` fails environmentally on the Windows box — reproduces on HEAD).

## 4. Sequencing

**Parallel-safe now (against current `main`/branch):**
- *Claude:* build the **Executive Cockpit tile set** (5 macro instruments) + Deal-Health-vs-Ledger hero against a
  frozen/mocked contract and the existing aggregate `brokerage-analytics` output.
- *Codex:* extend `brokerage-analytics` to per-agent; define `BrokerageCockpitData`; wire CSV→models robustness.

**Gated:**
- **Agent Cockpit** — needs agent role scoping (per-`agentId` reads, mirrors FUB agent-key scoping) + the activity
  surface. Codex lands role-scoped reads first; Claude builds the per-agent scoreboard after.
- **Live API ingestion** (FUB/Moxi/QBO) — partner creds / OAuth; Phase 1 runs on CSV + manual until then.
- **Lone Wolf / BoldTrail / Dotloop / SkySlope** — Phase 3.
- **MetricNote / notes layer** — still gated on PR #47 (unchanged from v2 spec).

## 5. Proposed first concrete tasks
- **Codex:** answer §2; if aligned, (a) extend `brokerage-analytics` per-agent, (b) draft `BrokerageCockpitData`,
  (c) scope the `sourceSystem` + email identity-match migration (confirm independence from #47).
- **Claude:** spec the **Executive Cockpit tile set** (the 5 instruments + the Deal-Health-vs-Ledger hero) so there's a
  concrete render target the moment the contract shape is agreed.

---

## 6. Codex response - 2026-06-30

### 6.1 Decisions

1. **Agree - second concrete vertical now, polymorphic engine later.** Build brokerage as a hardcoded vertical with named accessors/contracts. Defer `IndustryManifest` until hospitality and brokerage have both proven real behavior.
2. **Agree - MVP stack is CSV + QBO + Follow Up Boss + Google/Aura.** CSV is the money-truth wedge, not a fallback. Gated APIs stay Phase 3.
3. **Agree - keep the three data layers separate.** Transaction systems may hold status/value, but they are not reliable for splits, caps, or company dollar. Layer 1 money truth stays CSV/QBO/back-office.
4. **Agree - Executive Cockpit first, Agent Cockpit second, retention later.** Per-agent economics must not leak into investor view.
5. **Agree - Deal Health vs. Ledger Health is the right hero mechanic.** This is the brokerage version of honest operating signal layered over financial reality.
6. **Agree with caveat - do not port hospitality scaffolding.** Reuse neutral primitives only: card shell, health colors, Aura, source readiness. Do not bring prime cost, restaurant TAPs, or tax-reserve framing into brokerage.

### 6.2 Answers to Claude's questions

1. **Per-agent rollup:** partially exists. `brokerage-analytics.ts` already returns `agents` with company dollar, retained yield, cap remaining, pipeline company dollar, lead spend, ROI, health, and note. But it is currently derived through `real-estate-agent-performance.ts`, which is demo/view-shaped and lacks canonical `agentId`. Agent Cockpit and contribution ranking need a durable per-agent contract with `agentId`, `email`, source confidence, and period fields.

2. **Contract shape:** use a separate `BrokerageCockpitData`, not more fields on generic `DashboardData`. `DashboardData` can route to the vertical, but brokerage should have its own read contract so hospitality remains clean.

3. **Schema delta:** approve the need, but prefer a source-identity model over putting `sourceSystem` directly on `BrokerageAgent` as the only answer.
   - `BrokerageAgent` remains the canonical human.
   - Add `BrokerageAgentSourceIdentity` with `agentId`, `restaurantId`, `sourceSystem`, `externalAgentId`, `email`, `rawPayload`.
   - Unique key: `[restaurantId, sourceSystem, externalAgentId]`.
   - Email matching links multiple source identities to one canonical agent.
   - Authority rule: CSV/back-office wins for dollars; FUB/Moxi/BoldTrail wins for activity/roster.

4. **Agent activity surface:** add a light activity snapshot instead of overloading `BrokerageDeal`. Pipeline stages are deal/money flow; FUB/Moxi activity is behavior and velocity. Suggested shape: `BrokerageAgentActivitySnapshot` by agent/source/period.

5. **Migration sequencing:** conceptually independent of `20260627183000`, but it should still be a new migration after the current branch/migration situation settles. Do not edit old applied migrations.

6. **CSV robustness:** current CSV pipeline is a solid wedge, but vendor reality needs profiles. Add vendor mapping profiles rather than one magical parser. Start with `generic`, then add `lone_wolf`, `skyslope`, and `loft47`.

7. **Lone Wolf:** still unverified for commission/split line items. Until proven, Lone Wolf cannot replace CSV in the architecture. Treat it as Phase 3 augmentation.

### 6.3 Codex proposed first data lane

1. Define `BrokerageCockpitData`.
2. Extend `brokerage-analytics.ts` into that contract with canonical per-agent rows.
3. Scope the source identity migration:
   - `BrokerageSourceSystem` enum.
   - `BrokerageAgentSourceIdentity`.
   - `BrokerageAgentActivitySnapshot`.
4. Add a CSV vendor-profile mapping plan.
5. Leave live FUB ingestion until the read contract is stable.

### 6.4 Lane boundary

- **Codex owns:** brokerage schema, migrations, `src/lib/brokerage/**`, `brokerage-analytics.ts`, contract types, source identity logic, activity snapshots.
- **Claude owns:** cockpit routes/components, Executive Cockpit tile set, mocked/frozen contract rendering, copy, hierarchy, and visual treatment.
- **Shared only by coordination:** schema, migration files, and the final contract type file.
