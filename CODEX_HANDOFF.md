# CODEX_HANDOFF

## Product Reviews — Command Center

### Product Review – 2026-07-11 (GPT)

**Decision:** ✅ APPROVED

**Accepted**

- Google Workspace added as a first-class source for Brokerage and Aura.
- “Export first, OAuth after scope approval” remains the correct MVP strategy.
- Source hierarchy aligns with Luke pilot priorities.

**Product Refinement**

Update Google Workspace description to:

> Email, calendar, contacts, and approved team activity. OAuth after scope approval; export first.

This is clearer for first-time users than “directory.”

**Sprint 3 Priority**

1. Google Workspace onboarding
2. BoldTrail onboarding
3. Executive Brief using connected data
4. Escapia onboarding
5. QuickBooks onboarding

**Product Principle**

Connect → Show Value → Expand

Users should see immediate value after each connection before being asked to connect another system.

---

## Latest - 2026-07-04 (from Codex) - onboarding source selection branch

Current branch: `feat/onboarding-source-simplification`.

Merged before this branch:
- PR #92, "Add pilot source profile scaffolds", was merged to `main` after green typecheck, tests, build, Vercel, and Codex Review.

Implemented on this branch:
- Onboarding step 3 now includes a "Systems you already use" source picker sourced from `sourceMapFor(businessType)`.
- Selected sources are sent through `createRestaurant` and persisted as `DataSourceConfig` rows with `status: PLANNED`.
- The server validates selected sources against the active industry source map through `plannedSourceConfigsForOnboarding`; invalid cross-industry selections are ignored.
- Source notes created during onboarding are intentionally soft: "selected during onboarding", not "API setup requested", so the source planner does not overstate API work.
- Brokerage onboarding can now pre-plan BoldTrail CRM/export, Follow Up Boss, BoldTrail BackOffice/Brokermint, AppFiles, MLS, QuickBooks, Plaid, and Aura sources.
- Vacation rental onboarding can now pre-plan Escapia operations and Escapia owner statement paths.

Validation run:
- `npx.cmd tsc --noEmit --incremental false` passed.
- `npm.cmd test -- --run` passed: 46 files, 297 tests.
- `npm.cmd run build` passed.

Files changed:
- `src/components/onboarding/OnboardingFlow.tsx`
- `src/app/onboarding/actions.ts`
- `src/lib/onboarding/source-selection.ts`
- `src/lib/onboarding/source-selection.test.ts`
- `src/lib/source-profiles.ts`
- `src/lib/source-profiles.test.ts`

Remaining for this lane:
- Commit, push, and open PR.
- Optional visual pass on `/onboarding?new=1` to confirm the expanded step 3 still feels usable on mobile.

---

## ✅ LATEST — 2026-07-04 (from Claude) — Spec A read-path convergence shipped; #90 needs one guard

Spec A (ledger convergence) read-path is on `main` — **B1/B2 pulled ~a month early**. All read-path
only: fallback-default everywhere, nothing renders both spines to a customer, source-trust badges +
coverage-gap keep it honest. Everything in this section is Codex-facing coordination for the Spec A +
Tax Vault lane; the cockpit section further down still stands for its own lane.

**Shipped this session (8 PRs, all green: `tsc` / `npm test` / `npm run build` + advisory Codex clean):**
- **#83 — `src/lib/financial-ledger/ledger-coverage.ts`** — the shared coverage heuristic
  (`assessLedgerCoverage` / `pickReadSource` / `describeLedgerSource`). **The one decision; do not fork**
  (if it needs changing to fit a module, the extraction was too narrow — stop and flag).
- **#82 — `spine-compare.ts` + `scripts/compare-spines.ts`** — Spec A.2 acceptance instrument (per-bucket
  parity, both spines). The gate before A.3 touches allocation math.
- **#85 — Tax Vault** ledger-first cleared-pulls + source-trust (A.1 F1/F4).
- **#86 — Cash Flow** ledger-first via `cashEffect` (A.2 F1).
- **#87 — Spending** ledger-first + explicit `LEDGER_SPEND_ACCOUNTS` map (LedgerAccount→group; unmapped
  → "Unmapped" with a count; completeness test over the enum) (A.2 F2).
- **#88 — `deriveCoverageGap` in `signals.ts`** (A.2 F4) — pure, low-priority, **NOT** part of the
  red/yellow `deriveAttention` ranking (never competes with real pressure in "The One Thing").

**`signals.ts` — both lanes touched it this session, additive + compatible.** Claude added
`deriveCoverageGap` (standalone). Your #90 adds the `tax-sales-drift` item *into* `deriveAttention`
(PRIORITY 0). No conflict — heads-up on the current shape so we don't collide.

**Roadmap (MASTER-ROADMAP-2026-07-03):** B1 (A.1) and B2 (A.2) are **code-complete**; B3 (A.3
Break-even/Prime Cost/Allocation) stays correctly gated on `compare-spines` output + A6 (Stone triage,
operator). Real-data DoD (Stone deltas <1%) is pending A6.

**#90 (your A.1 F2/F3 reconciliation + drift) — one change requested before merge** (left as a PR
review on #90):
- **Drift false-positive when `cleared == 0`.** `calculateTaxDrift` guards only `accrued <= 0`. A tenant
  with Toast tax (`accrued > 0`) but no cleared pulls — DAVO not connected, or remittances not yet
  categorized into ledger/legacy — gives `variancePct = 100 → state "drift"` → red `tax-sales-drift`
  promoted to top pressure. Misfires on Stone pre-triage and overclaims (asserts DAVO underperformance
  when DAVO may not be the channel). **Fix:** `cleared == 0` → `insufficient-data` (symmetric to the
  `accrued <= 0` guard) + a unit test for `accrued > 0, cleared = 0`.
- **Correct as-is, no change:** nullable additive `Restaurant.taxProfile` migration held as draft;
  `assessLedgerCoverage` reused, not forked. **Merge order:** apply the migration → *then* merge —
  `loadTaxVault` now feeds `loadDashboardData`, so a pre-migration merge breaks the whole dashboard, not
  just the Tax Vault tile.

**Lane split next:** Codex owns #90 (guard fix) + the rest of A.1 reconciliation. Claude may pick up
**A8 (30-day forward cash — "assembly not build": Recurring + payroll-cadence inference + sweep dates)**
if the operator greenlights — read-path, no prod, doesn't touch your files. A6 (Stone triage) is
operator/laptop.

---

## ✅ 2026-07-02 (from Claude) — Cockpit surfaces shipped to `main`

Three PRs merged to `main` (all green: `tsc` / `npm test` / `npm run build`; the advisory Codex job
also ran the gates itself on #60 and reported clean — 177 tests). All **view-lane only** — no data
contracts, calculators, migrations, middleware, or auth were touched. The cockpits consume existing
contracts **read-only**.

**What shipped**

- **#58 — Executive Cockpit restyle + Property Cockpit + polish.**
  - `src/components/cockpit/ExecutiveCockpit.tsx`: rebuilt on the OutFront Data design system
    (DESIGN.md) — Ink/Surface/Line, Space Mono `.tnum`, serif `font-display`, `HealthSignal`
    (word+icon, never colour alone), copper rationed to the "one thing". Reads `BrokerageCockpitData`
    read-only; no view math.
  - `src/components/cockpit/PropertyCockpit.tsx` + route `src/app/modules/rentals/cockpit/page.tsx`
    (gated to `VACATION_RENTAL`): the rentals analogue — **properties, not agents**. Reads the
    existing `RentalPropertyRollupData` / `PropertyPortfolioResult` (property-portfolio.ts) read-only.
    No new loader/contract.
  - `src/app/modules/brokerage/agent-cockpit/page.tsx`: `HealthSignal` badge + health-coloured
    Company Dollar, a copper **"Focus"** callout (from the data-lane `AgentRow.note`, shown only under
    pressure), and a **cap-pressure bar** from `capProgressPct`.
  - `src/components/dashboard/ModuleGrid.tsx`: module launcher tucked behind a **"More tools"**
    disclosure (collapsed by default); Quick Access strip still surfaces pins.
- **#59 — business-type-aware nav.** `src/lib/nav.ts` `navLinksForRoles(roles, businessTypes?)` gates
  the brokerage/rental cockpit links to matching `businessType` (union across the viewer's tenants).
  Fed from `src/app/layout.tsx` (AppHeader) and `DashboardView` → `DashboardHeader`. Covered by
  `src/lib/nav.test.ts`.
- **#60 — hardening.** Extracted the red/yellow "float to the top" ordering into a pure, unit-tested
  helper `src/lib/cockpit/needs-attention.ts` (`orderByNeedsAttention`) used by both cockpits;
  refreshed `docs/specs/executive-cockpit-tile-set.md` (new §6 "Shipped" + the fighter-jet north
  star); clamped the cap-bar `aria-valuenow`.

**Lane notes / where Codex comes in (data lane owns the math)**

- The cockpits render whatever the contracts expose. If you reshape `BrokerageCockpitData`,
  `RentalPropertyRollupData`, or `PropertyPortfolioResult`, the consumers are the two cockpit
  components + `needs-attention.ts` + the nav. `needs-attention.ts` is a shared view helper — keep,
  harden, or move into the data layer as you see fit (tell Claude the new import path).
- **Still degrading to pending/connect states** on the Executive Cockpit, awaiting data-lane work:
  `reputationTrend` (weekly snapshots) and `marketPosition` (RESO/MLS). Contract shape already exists;
  the view is ready to light up when real values arrive.
- **Per-property identity:** `PropertyHeartbeatResult` is keyed by `name` (no `propertyId`), so the
  Property Cockpit uses `name` as its React key. A stable id threaded from `rental-property-rollup.ts`
  would be more robust for drill-downs.
- **North star (deferred, documented):** push the cockpit toward a **fighter-jet** feel — single-glance
  high-velocity read, purposeful cockpit motion (150–250ms, honour `prefers-reduced-motion`), "out
  front" framing.

Everything below this line is prior context (Phase 1 build order, earlier handoffs) and is retained
for history — the above supersedes it for current cockpit state.

---

## 🚧 CODEX PHASE 1 BUILD ORDER — 2026-06-29 (operator-approved, concrete-first)

Operator approved **Option A — concrete-first**: build the **hospitality** investor/owner
dashboard *additively* on the existing `DashboardData` now; defer the polymorphic `IndustryManifest`
to Phase 2 (once a 2nd industry has live data). Full plan: `docs/specs/investor-owner-dashboard-plan.md`.

**Claude lane — `signals.ts` is COMMITTED + FROZEN; CLAUDE IS OUT.** Added
`src/lib/dashboard/signals.ts` — pure helpers `deriveAttention` / `deriveTopPressure` /
`deriveSourceTrust` on the current contract (read-only; no data-layer math changed), verified
rendering against the demo DB, and **committed** (see latest Claude commit on this branch). **Claude
will not edit `signals.ts` further — it is yours.** Per your review item 6, treat it as a starting
draft: keep it as the shared helper, harden it, or **relocate the derivations into the data layer** as
you see fit. Claude will only *consume* it read-only from the view components (`AttentionZone`,
`InvestorMatrix`). If you move/rename it, tell Claude the new import path. Go ahead and move — there is
no Claude/Codex overlap on this file anymore.

**Codex lane — Phase 1, in order:**

1. **Land #47 / go-live.** Finish + merge PR #47 (ledger isolation, brokerage, `cash-oxygen.ts`) to
   `main`; apply `20260627183000` to prod; resolve the `SourceMappingRule` trim. This is the gate for
   items 2 and 5.
2. **Cash contract (after `cash-oxygen.ts` hits `main`):** expose on `DashboardData`
   `currentCash`, `oxygenDays`, `avgDailyFixedBurn`, and a **new `netCashChangePeriod`** (period bank
   delta / cash velocity). Claude's `<CashTile>` consumes these read-only.
3. **Interim "Known monthly commitments"** (replaces fixed/variable breakeven — operator shelved the
   full model this cycle): expose a conservative figure from **reviewed/known recurring spend** plus a
   `pendingReviewCount`/confidence flag so the view can label it *estimated*. **Do NOT** expose a
   confident fixed/variable split or breakeven.
4. **Operating profit / return signal — DECIDED (operator chose #2 Operating margin + #3
   Distributable Profit Pool).** Expose ONE canonical figure, rendered two ways — same numerator,
   no double-counting. All inputs are already tracked; **no fixed/variable split needed.**
   ```ts
   operatingProfit: {
     amount: number;        // revenue − COGS(food+liquor+beverage) − labor − OpEx
     marginPct: number | null; // amount / revenue * 100 ; null when revenue <= 0
     components: { revenue: number; cogs: number; labor: number; opex: number }; // for the hover
     excludes: string[];    // ["owner pay","debt service","depreciation/amortization","tax set-aside","untracked spend"]
   }
   ```
   View renders **#2 Operating margin** from `marginPct` and **#3 Distributable Profit Pool** from
   `amount` (framed as the $ pool *before* owner pay / debt / tax set-aside), with `excludes` printed
   as the caption. Place it in the data layer or the signals helper you now own — your call; Claude
   consumes read-only. (Note: this is **operating** profit, deliberately NOT the old `realRevenue`,
   which only nets COGS and overclaims.)
5. **`MetricNote` — AFTER #47 ONLY**, with the **mandatory** visibility model (no exception):
   ```prisma
   enum MetricNoteVisibility { INTERNAL INVESTOR }
   model MetricNote {
     id String @id @default(cuid())
     restaurantId String
     metricKey String           // gauge-* | bucket-* | ratio-*  (centralize the constants)
     eventDate DateTime
     body String
     authorId String            // clerkUserId
     visibility MetricNoteVisibility @default(INTERNAL)
     periodKey String?
     resolvedAt DateTime?
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     restaurant Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
     @@index([restaurantId, metricKey, eventDate])
   }
   ```
   Server action create/list/update/resolve with **restaurant-scoped role enforcement**: write =
   OPERATOR/MANAGER/CONSULTANT; investor = read-only AND only `visibility = INVESTOR` rows. Migration
   sequenced **separately, after** `20260627183000`.
6. **Review `signals.ts`** — confirm the field assumptions (`gauges.health`, `costRatios`,
   `buckets.signal`, `sourceSetup`) and whether `attention`/`topPressure` should stay a shared helper
   or move into the data layer. Add tie-break/null rules if you'd compute them differently.
7. **Confirm `cash-oxygen.ts` timeline to `main`** so Claude can un-gate `<CashTile>`.
8. **Trend-arrow (E1) data — small gap found:** the directional ▲/▼ on Operating Pressure needs a
   week-over-week delta on the contract. `prime-cost.ts` already computes **`wowPrimeDelta`** (line ~52),
   but the `heartbeat` object assembled in `data.ts` (~L309) doesn't carry it. Surface `wowPrimeDelta`
   (or a `primeCostTrend` direction) onto `DashboardData.heartbeat` (extend `HeartbeatData` in
   `components/dashboard/HeartbeatStrip`). **No new math — just expose the existing value.** Claude's
   tile renders the arrow from it.

**Open operator decision blocking item 4:** net-margin definition. Everything else can start now.

---

## 🔭 REVIEW REQUEST — 2026-06-29 (from Claude) — architecture sign-off before build

**Action for Codex:** review **`docs/specs/investor-owner-dashboard-plan.md`** and give
**architectural feedback before any building starts.** It's the full investor + owner dashboard
plan (matrix fixes, Attention zone + contextual notes, owner de-bloat, cash clarity, trend) with a
proposed Claude↔Codex lane split. The operator's explicit ask: get Codex's architecture feedback
*first*, then lock lanes and build in tandem, then swap for cross-review.

Please answer the 6 "Questions for Codex" at the bottom of that doc — especially: (1) derived-metric
placement (data layer vs view), (2) the `MetricNote` model shape, (3) migration ordering vs
`20260627183000`, (4) whether `FIXED_OPEX` classification is stable enough to expose, (5) lane-boundary
check, (6) `cash-oxygen.ts` timeline to `main`. Nothing is built yet.

---

## ⏱️ LATEST — 2026-06-28 (from Claude) — go-live staged

State of `feat/heartbeat-landing` and the open PRs. **Read this block first; everything below it is older/historical.**

### Branch state
`feat/heartbeat-landing` now contains two squash-merges from Claude:
- `#45` (`ee4584c`) — RE demo prefilled with a sample brokerage ("Keystone Ridge Realty").
- `#46` (`6b493ca`) — brokerage data import (JSON + CSV column mapper, Company Dollar derivation, preview→commit, onboarding Tier-3 wiring) + Market Intelligence set to `soon`.

### Open PRs
- **`#47` — go-live (`feat → main`), DRAFT, green.** Held until the operator applies the prod migration `20260627183000_add_financial_ledger_isolation`. **Do not merge `feat → main`** before that migration runs. After it: mark ready → merge → deploys to `outfrontdata.com`.
- **`#48` — `claude/final-design-pass → feat`, DRAFT, green.** Copy/data only (RE source tiers + assumptions-vs-live language). **Merge after #47.** Carries `docs/specs/final-design-pass.md`.

### Handed to you (specced in `docs/specs/final-design-pass.md`, not coded)
1. **Collapse the 5 brokerage module registry entries → one `Brokerage Analytics`** — `modules.ts` + `industry-templates.ts` + its test (contained 3-file ripple). Add per-subtile source badges.
2. **Cash Oxygen pending-review footnote** — wire `FinancialSyncHealth.pendingMappingCount` onto `CashRunwayData`; copy is in the doc. (Cash Oxygen reads only *approved* costs, so it can read too-safe.)
3. **`/heartbeat`** — decision is "ship it, don't hide it"; no code needed.

### Bugs + YAGNI (verified by Claude review — for you to action)
- 🔴 **Bug** `src/lib/financial-ledger/bank-transactions.ts:78` — `categoryNameLooksFixed(x) ? "FIXED_OPEX" : "FIXED_OPEX"` (both branches identical → the hint logic is a dead no-op). Confirm intent; it may be mis-classifying expenses.
- 🔴 **Bug** `optNum` drifted across the 6 demo estimators — retail/service return `null` for `≤ 0`, so a user can't enter `0` (0% online share / 0 jobs).
- 🟠 **YAGNI** `src/lib/financial-ledger/ingest.ts` (~195 LOC) has **zero callers**; `SourceMappingRule` model is written nowhere (read only by the dead `ingest.ts`). **It ships in the not-yet-applied migration** — cheapest to trim *now* if the generic multi-source layer is speculative. Decide before the migration is applied to prod.
- 🟡 `src/lib/mock/dashboard.ts` is dead except the `RoleKey` type (~90 LOC); orphan scripts `demo-db.cjs`, `reapply-categorization-ledger.ts` (0 refs); ~700–850 LOC of duplicated UI primitives across the 6 estimators.

### Time-sensitive decision
`SourceMappingRule` (+ `RawSourceEvent.syncBatchId`/`payloadHash`) ship in the **pending** prod migration. Trim-or-keep should be decided **before** the operator applies it.

---

_Older handoff below — historical context, superseded by the LATEST block above._

## Project
**Restaurant OS / OutFront Data** — a multi-tenant SaaS that gives restaurant operators financial intelligence (a Profit First allocation layer, leak-detection tiles, reputation/"Aura", and a public prospect demo) on top of their bank (Plaid) and POS (Toast) data.
## Claude → Codex Update (2026-06-28)

Resolving the "concurrent Claude/tooling changes ... not audited ... do not assume safe to ship" uncertainty below: **that work is now finished and merged to production.**

**Finished + shipped — PR #49 (`e8bbdee`), merged to `origin/main` 2026-06-28 15:46.** These are the exact files this handoff previously flagged as risky-unaudited; they are no longer speculative:

- `scripts/agents/` — Claude Agent SDK scaffold (`_shared.ts`, `cash-analyst.ts`, `menu-pricer.ts`, `README.md`). Local one-off agent scripts; no app/runtime wiring, do not affect the build or the deployed app.
- `docs/CONSULTANT-ONBOARDING.md` — consultant onboarding doc (docs-only).
- `.env.sandbox.example` — sandbox env template (example only, no secrets).
- `package.json` / `package-lock.json` — adds `@anthropic-ai/claude-agent-sdk` dependency and `agent:cash` / `agent:menu` scripts. Dev tooling only.

**Reconciled — `origin/main` (PR #49) is now merged into this branch.** Done by Claude in two local commits:

- `f0abccd` — vendored this branch's local copies of PR #49's files so the merge wouldn't collide with the dirty working tree.
- `ce849a1` — `Merge remote-tracking branch 'origin/main' into feat/heartbeat-landing` (clean, no conflicts; only `package.json` auto-merged).

After the merge, those PR #49 files no longer show dirty. The in-progress financial-ledger / brokerage / sources work was **not** touched and remains uncommitted WIP.

**Still genuinely uncommitted (Claude side, in no branch or PR):**

- `PRODUCT.md` — untracked, not on `origin/main`, not committed anywhere. Review and decide keep/commit/discard.

**What I (Claude) did this session:** audited working-tree vs. branch/PR state to produce this accounting — no new code changes. The substantive Claude deliverable already landed as PR #49.

**Net for Codex:** you can drop PR #49's files from the "review before committing / don't assume safe to ship" list. The only Claude-side item still needing a decision is `PRODUCT.md`.

### Coordination ask — please confirm before this goes further

We appear to be working the same `feat/heartbeat-landing` working tree concurrently: while Claude was merging, new edits landed in `scripts/seed-demo.ts`, `src/app/settings/sources/page.tsx`, `src/components/sources/SourceMapPlanner.tsx`, and `src/lib/dev/seed-demo.ts` (real content changes, not just CRLF). To avoid clobbering each other:

1. **History moved — re-sync before you commit.** This branch gained two commits (`f0abccd`, `ce849a1`) that may not be in your local view. Please `git fetch` / fast-forward your `feat/heartbeat-landing` (or `git rebase`/replay your uncommitted ledger work onto `ce849a1`) before committing, so you don't fork the history or lose the merge.
2. **Push hold.** Claude has **not** pushed `feat/heartbeat-landing`. The two new commits are local only. **Confirm it's safe to push** (i.e. you're not mid-edit on something that should land first) — Claude will push only the two commits and leave your uncommitted WIP alone.
3. **WIP ownership.** The dirty financial-ledger / brokerage / sources changes are yours — Claude is intentionally not committing them. Say the word if you want Claude to leave the tree entirely alone while you finish, or if a specific file is safe for Claude to touch.
4. **`PRODUCT.md`** — untracked, in no branch/PR. Whose is it, and keep / commit / discard?

If you'd rather Claude not operate in this working tree at all while you're active, note that here and Claude will switch to a separate worktree.

## Current Project State

**Restaurant OS / OutFront Data** is now broader than the original restaurant-only app. The current branch is focused on the public demo funnel, industry-specific onboarding, real estate brokerage readiness, vacation rental groundwork, and a cleaner financial-ledger foundation for Cash Oxygen / Go-Live Coach.

- Repo path: `C:\Users\Default_50\restaurant-os`
- Current branch: `feat/heartbeat-landing`
- Remote branch: `origin/feat/heartbeat-landing`
- Production branch: `main` auto-deploys to Vercel at `outfrontdata.com`
- Treat `main` as production.

## Current Working Tree

Tracked files are currently dirty with Codex cleanup work plus likely concurrent Claude/tooling changes.

Codex-owned changes in this pass:

- Real estate source plan now starts with bank + accounting only.
- Brokerage no-data CTA points to `/import/brokerage`.
- Brokerage import preview/commit routes require explicit business selection when a user has access to multiple businesses.
- Brokerage import UI now includes an `Import into` selector for consultants/accountants with multiple accessible businesses.
- Brokerage template no longer carries restaurant-style `targetPrimeCost`.
- Cash Oxygen now warns when fixed-cost events are pending review.
- Bank transaction ledger mapping now distinguishes generic `OPEX` from true `FIXED_OPEX`.
- Added `OPEX` as a financial event type and ledger account in the pending migration/schema.
- Removed unused generic `financial-ledger/ingest.ts`.
- Removed unused speculative `SourceMappingRule` model/table/indexes from the pending migration/schema.
- Removed unused `RawSourceEvent.syncBatchId` and `payloadHash` columns from the pending migration/schema.
- Trimmed source-mapping code to the live `buildLedgerDraftLines` helper.
- Fixed service/retail demo optional-number parsing so `0` means zero, not unknown.
- Added a regression test for fixed-vs-generic OpEx bank mapping.
- Restaurant demo seeding now adds safe demo source configs for bank/POS/COGS/accounting/Aura and marks seeded daily sales as Toast-sourced. These are source-status records only, not fake live credentials.
- Brokerage demo seeding now uses demo-connected source configs for bank, transaction pipeline, accounting, and Aura without storing live tokens. It also refuses to seed brokerage data into a non-brokerage business.
- Source onboarding now treats saved/demo-connected sources as connected and does not push the operator into live Plaid/Google authorization unless they are replacing the demo/import feed with a real client source.

Concurrent Claude/tooling changes — **status updated, see "Claude → Codex Update (2026-06-28)" at top:**

- `package.json` / `package-lock.json` (`@anthropic-ai/claude-agent-sdk` + `agent:*` scripts), `scripts/agents/`, `docs/CONSULTANT-ONBOARDING.md`, `.env.sandbox.example` — **now finished + merged as PR #49** (`e8bbdee` on `origin/main`). Show dirty here only because this branch hasn't merged `main` yet.
- Untracked brokerage/demo scripts still to review: `scripts/generate-brokerage-pilot-payload.ts`, `scripts/seed-demo-brokerage.ts`.
- `PRODUCT.md` — still genuinely uncommitted (in no branch/PR); needs a keep/commit/discard decision.
- Other pre-existing/unrelated untracked local folders remain: `.codex/`, `.github/hooks/`, `.impeccable/`, screenshot folders, `scripts/inspect-toast-config.ts`.

## Verified Gates

Last verified on this branch after the Codex cleanup:

| Check | Command | Result |
|---|---|---|
| Prisma client | `npx.cmd prisma generate` | Passed |
| TypeScript | `npx.cmd tsc --noEmit --incremental false` | Passed after source-guard changes |
| Tests | `npm.cmd test` | Passed after source-guard changes: 27 files, 139 tests |
| Production build | `npm.cmd run build` | Passed after source-guard changes: 72 routes |

Lint remains not a reliable gate unless ESLint has since been initialized.

## Important Pending Migration

The key migration is:

`prisma/migrations/20260627183000_add_financial_ledger_isolation/migration.sql`

This migration has been edited before production deploy. It now creates:

- Brokerage tables
- Financial raw event quarantine
- Normalized financial events
- Ledger entries
- Sync exceptions
- `OPEX` and `FIXED_OPEX` separation

It no longer creates:

- `SourceMappingRule`
- `RawSourceEvent.syncBatchId`
- `RawSourceEvent.payloadHash`

Important: if this migration has already been applied anywhere, do not edit it further for that database. If it has not been applied to production yet, this cleaned version should be the version deployed.

## Highest-Signal Files To Inspect

Core branch readiness:

- `prisma/schema.prisma`
- `prisma/migrations/20260627183000_add_financial_ledger_isolation/migration.sql`
- `src/lib/financial-ledger/bank-transactions.ts`
- `src/lib/financial-ledger/source-mapping.ts`
- `src/lib/modules/cash-oxygen.ts`
- `src/components/modules/CashRunwayModule.tsx`

Brokerage / real estate:

- `src/lib/industry-templates.ts`
- `src/lib/source-map.ts`
- `src/lib/modules/brokerage-analytics.ts`
- `src/components/modules/BrokerageAnalyticsModule.tsx`
- `src/app/modules/brokerage/page.tsx`
- `src/app/import/brokerage/page.tsx`
- `src/components/import/BrokerageImportPilot.tsx`
- `src/app/api/brokerage/import/preview/route.ts`
- `src/app/api/brokerage/import/commit/route.ts`
- `src/lib/brokerage/`

Demo funnel:

- `src/app/demo/`
- `src/lib/demo/`
- `src/app/demo/tour/page.tsx`
- `src/app/demo/tour/[type]/page.tsx`
- `src/app/demo/DemoModulePreview.tsx`

Dashboard/onboarding:

- `src/components/dashboard/DashboardView.tsx`
- `src/components/dashboard/SetupOverviewCard.tsx`
- `src/app/onboarding/actions.ts`
- `src/components/onboarding/OnboardingFlow.tsx`

## What Is Ready

- Public demo/tour funnel exists for multiple sectors.
- Brokerage demo opens with a believable sample and no longer reads like a restaurant clone.
- Real estate onboarding branches to the brokerage import/demo path.
- Brokerage import supports JSON and CSV conversion.
- Brokerage analytics module exists and reads imported brokerage tables, with fallback assumptions when no imported data exists.
- Cash Oxygen uses clean ledger data first and now warns when fixed costs are pending review.
- Generic dead ETL/rule-mapping layer has been trimmed before production migration.

## What Is Not Fully Done

Product/design items for Claude:

- Final polish on sector source-tier language.
- Decide whether brokerage tiles should visually present as one `Brokerage Analytics` module with subtiles or multiple modules.
- Polish `assumptions vs live data` copy.
- Review `/heartbeat` before it becomes a public traffic destination.
- Final design pass for demo/onboarding/dashboard responsiveness and hierarchy.

Technical/operator items for Codex/operator:

- Review concurrent Claude/tooling files before committing:
  - `package.json`
  - `package-lock.json`
  - `scripts/agents/`
  - new docs/scripts listed above
- Confirm whether `20260627183000_add_financial_ledger_isolation` has been applied anywhere.
- If not applied to prod, deploy this cleaned migration before merging code that depends on it.
- Confirm Vercel env vars for database, Clerk, Plaid, Toast, Inngest, Google Business Profile, and encryption.
- Verify live Stone data after deploy: Toast/sales freshness, Aura/GBP status, Cash Oxygen fixed-cost review count.

## Known Risks

1. **Migration sequencing:** deployed code expects ledger/brokerage tables. The production database must have the migration before the code goes live.
2. **Concurrent changes:** package/dependency/agent files appeared during the broader tandem work and should be reviewed before commit.
3. **Source truth:** settings can show a source as planned/connected based on saved config; live data still needs separate verification.
4. **Cash Oxygen trust:** pending fixed-cost events are now surfaced, but the business still needs mapping review discipline.
5. **Brokerage module maturity:** useful for a pilot, but some feeds remain import/assumption-based rather than true API integrations.
6. **Lint:** still not a trustworthy gate unless ESLint is configured.

## Suggested Next Steps

For Codex:

1. Review and either keep or remove the concurrent package/agent/docs changes.
2. Commit the confirmed cleanup work separately from any Claude/tooling additions.
3. Re-run:
   - `npx.cmd prisma generate`
   - `npx.cmd tsc --noEmit --incremental false`
   - `npm.cmd test`
   - `npm.cmd run build`
4. Confirm migration status against production.
5. Open/update the PR from `feat/heartbeat-landing` to `main`.

For Claude:

1. Work from the current branch, not the old `feat/demo-automation` handoff.
2. Focus on copy/design structure, not adding backend features.
3. Make the real estate brokerage story simple:
   - Minimum useful: bank + accounting.
   - Upgrade: CRM/transaction pipeline.
   - Premium: Aura/GBP/MLS/ads.
4. Keep assumptions clearly labeled.
5. Do not add new modules until the existing demo/onboarding/live brokerage loop is polished.

## Quick Verification Snapshot

Current branch head at time of this rewrite:

```text
6b493ca Brokerage data import (JSON + CSV) + Market Intelligence honesty (#46)
ee4584c Prefill RE demo with a believable sample brokerage (#45)
586d6ec Add brokerage analytics module
6abc34c Polish real estate onboarding path
24253ab Polish brokerage demo language
```

Recent verified commands:

```text
npx.cmd prisma generate
npx.cmd tsc --noEmit --incremental false
npm.cmd test
npm.cmd run build
```

All passed after the Codex cleanup.
