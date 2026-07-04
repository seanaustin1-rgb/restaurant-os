# OutFront Data — Product Map

> Single-page shared reference for any session (human or agent) working this repo.
> Generated 2026-07-03 from a full read of `main` @ `b93a93b`. Update when the
> architecture moves; details drift, this map's job is orientation.

**Product:** OutFront Data (live: www.outfrontdata.com on Vercel; Inngest Cloud
auto-sync registered). Multi-tenant SMB financial-intelligence SaaS with a
Profit First core. Verticals: restaurant (primary/live), service, retail,
contractor, real-estate brokerage, vacation rental.

**Stack:** Next.js 14 App Router · Supabase Postgres + Prisma · Clerk
(OPERATOR/CONSULTANT/INVESTOR/MANAGER via `UserRestaurantRole`; investor-only
users redirect to `/investor`) · Inngest · Plaid · Toast · Resend · Anthropic
SDK (statement extraction + `scripts/agents/`) · Tailwind · Recharts · Vitest.

## Data model

`Restaurant` = the tenant (generic business despite the name; `businessType`
enum). Two financial spines coexist:

1. **Legacy spine:** Plaid/statement `Transaction` → `Category` (operator-
   extensible) → code-owned `TapBucket` enum → Profit First (`TapSettings`,
   `VirtualAccount`, `BucketAllocation`, `BucketSweep` on the 10th/25th).
   `Rule` rows do the categorization (engine: `src/lib/categorization/rules.ts`,
   the single `categorize()` shared by Plaid sync, statement import, and the
   recategorize script). Inflows are REVENUE by sign; outflows run vendor rules.
2. **Clean ledger ("financial ledger isolation"):** `RawSourceEvent` →
   `NormalizedFinancialEvent` → `LedgerEntry`, plus `SyncException` and
   `SourceMappingRule`. Plaid + imports dual-write into both spines. Only Cash
   Oxygen reads ledger-first today. Spec: `docs/specs/financial-ledger-isolation.md`.

Cash runway = operator-entered `cashBalanceAnchor` + net transactions — no live
balance feed, by design. Toast feeds `DailySales`/`MenuItemSales`/sales tax;
allocation basis is **earned sales, not deposits**. Vertical models: full
brokerage set (`BrokerageAgent/Deal/LeadSpend/MarketMetric`) and rental set
(`RentalProperty/Booking/OwnerStatement/Expense/MaintenanceIssue/Review`).
Reputation: `ReviewCache`, `ReputationSnapshot` (weekly), `AuraIntentSnapshot`
(daily GBP actions). `MetricNote` = audience-scoped annotations.

## Connectors live today

- **Plaid** — daily 6:00am ET Inngest fan-out per connection; encrypted tokens,
  cursor sync. The cash-truth source.
- **Toast** — daily 5:30am ET; **single-tenant global env creds** (two credential
  sets: Analytics/era + Standard/operational) + one `TOAST_RESTAURANT_GUID`.
  Syncs daily metrics, sales mix, per-check sales tax, weekly menu items, then
  runs the Profit First ledger.
- **Google Business Profile** — full OAuth (start/callback/location/disconnect);
  daily intent snapshot (calls, directions, clicks, impressions).
- **Places / Yelp / Meta** — env-keyed Aura review sources; weekly snapshot.
- **Statement upload** — PDF import with Anthropic LLM extraction (Plaid fallback).
- **CSV imports** — vacation-rental and brokerage preview→commit pipelines.
- **NOT wired** (marketing copy only): MarginEdge, QuickBooks/Xero/Sage
  (only a QBO check-match heuristic exists), Square/Clover, payroll APIs,
  inventory, MLS/RESO. Toast payroll wages arrive via bank transactions.

## Dashboard

~30 registered modules in `src/lib/modules.ts` (~24 live incl. brokerage
Company Dollar / Commission Pipeline / Agent Performance / Lead ROI and the
rental Property Cockpit). "Soon" tiles render disabled with the blocking
dependency named. `src/lib/dashboard/signals.ts` is the keystone: deterministic
(no AI) attention ranking, Top Pressure ("The One Thing" — red-only, honest
insufficient-data state), and source trust — shared by Operator and Investor
views so they cannot diverge.

## Onboarding

Post-signup `/onboarding`: business creation w/ industry template picker, then
role-specific starter cards + a computed owner setup checklist (cash anchor →
authorize sources → vendor mapping → invite helpers). `/settings/sources` is
the real hub, with per-vertical minimum source maps (`src/lib/source-map.ts`).
Public funnel: `/heartbeat` landing, `/demo` estimators per vertical,
`/demo/tour` on a separate monthly-reseeded demo DB.

## Known state & debt (2026-07-03)

- Stone Grille tenant: 928 txns, **373 open warning-level sync exceptions**
  (triage: `scripts/summarize-sync-exceptions.ts`). Sandbox Diner: 48 open,
  0 ledger entries.
- June labor bug ($17.7k wages misfiled by broad keyword rules) fixed via shared
  `categorize()`; KEYWORD matching is now word-start-bounded; `signatureOf` has
  a stopword filter; the manual rules form now rejects generic/too-short
  keywords (`keywordPatternProblem`). Rule edits still don't retro-move rows —
  run `scripts/recategorize-transactions.ts --commit` after changes.
- Review flow is approve/exclude only (no inline re-typing, no rule-save-from-
  review, no bulk-apply).
- ~19 unmerged branches; handoff state lives in `docs/SESSION-HANDOFF.md`
  RESUME HERE blocks + `docs/audits/go-live-inventory-2026-06-27.md`.

## Top risks

1. **Two financial spines can disagree** — most modules read legacy while Cash
   Oxygen reads ledger. Worst failure mode for a trust product. → Spec A below.
2. **Categorization integrity debt** — 373 exceptions unreviewed on the live
   tenant (guardrails now in place upstream).
3. **Toast single-tenancy blocks customer #2** — everything sales-side gated on
   it. → Spec B below.
4. **Vertical sprawl vs. trust-layer depth.**
5. **Branch/handoff sprawl** — state reconstruction cost is real.

---

# Spec A — Ledger Convergence (execute in Claude Code)

**Goal:** every dashboard dollar reads the clean ledger; legacy tables become a
write-through compatibility layer, then get dropped.

**Order (each step ships independently, ledger-first with legacy fallback,
exactly like Cash Oxygen's `source` pattern):**

1. **Tax Vault first.** DAVO pulls sales tax daily, so this is the module where
   a stale/legacy read is most dangerous. Read `LedgerEntry` rows with tax
   ledger accounts; fall back to legacy when no ledger tax entries exist.
   Surface the same source badge Cash Oxygen uses (Ledger-backed / estimate /
   needs setup).
2. **Cash Flow + Spending by Category.** Both are straight aggregations —
   port to `LedgerEntry.cashEffect` + ledger accounts. Keep the legacy path
   behind the same fallback predicate; add a per-module vitest asserting
   ledger and legacy agree on the seeded demo tenant (drift alarm).
3. **Break-even, Prime Cost, Allocation & Variance.** These read bucketed
   sums — port the bucket queries to ledger accounts. The TapBucket ↔
   LedgerAccount mapping must live in ONE exported map with a test.
4. **Investor matrix last but mandatory** — investors must only ever see
   reviewed ledger facts. When ledger coverage < 100% for the period, show the
   trust banner (deriveSourceTrust already escalates) rather than silently
   mixing spines.
5. **Exit criteria:** no module imports `Transaction` aggregation helpers;
   legacy `Transaction.bucket` marked deprecated in schema comments; then a
   removal migration in its own PR.

**Non-goals:** no UI redesign, no new review controls (separate track), no
touching ingest dual-writes until step 5.

**Prereq:** Stone's 373 exceptions reviewed (use the triage script) — converging
onto an unreviewed ledger just moves the mistrust.

# Spec B — Toast Multi-Tenancy (execute in Claude Code)

**Goal:** tenant #2 can connect their own Toast without env-var surgery.

1. **Schema:** move creds to `PosConnection` — encrypted `clientId`,
   `clientSecret`, `apiHostname`, `restaurantGuid`, plus optional analytics
   credential pair (Toast splits era vs Standard scopes across separate API
   clients — preserve the dual-set model per connection). Reuse the existing
   `ENCRYPTION_KEY` AES pattern from `PlaidConnection`.
2. **Client:** `src/lib/integrations/toast/client.ts` takes a credential object
   instead of reading env; env creds become the seed/fallback for Customer Zero
   (a backfill script writes them into Stone's `PosConnection` row).
3. **Scheduler:** `dailyToastSyncScheduler` becomes a fan-out over active
   `PosConnection` rows — copy `dailyPlaidSyncScheduler` exactly (one event per
   connection, isolated retries, one tenant's failure can't block others).
4. **Onboarding:** Toast connect card on `/settings/sources` collects the four
   fields (operator pastes from Toast developer portal — no OAuth self-serve
   exists for standard partners) and test-pings before saving.
5. **Guardrail:** `resolveToastRestaurantId()` and every `isToastConfigured()`
   call site must die — grep-verify zero env-based resolution remains outside
   the Customer-Zero backfill script.

**Exit criteria:** seeded second tenant with fake creds runs the full sync path
in tests (mock Toast API); Stone's nightly sync unaffected across a deploy.
