# CODEX_HANDOFF

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

- **Repo path on disk:** `C:\Users\Default_50\restaurant-os`
- **Current branch:** `feat/demo-automation` (3 commits ahead of `origin/main`; open as PR #34)
- **Production:** `main` auto-deploys to Vercel (`outfrontdata.com`). Treat `main` as prod.

## What changed and why (this work)

Two PRs of work, most of it shipped:

### PR #33 — merged to `main` (commit `9c72120`)
- **Dead-code cleanup** (no behavior change): removed ~31 one-off scripts, 3 redundant/dev-only `api/dev/*` routes, and the unused `tailwind-merge` dep.
- **Public demo funnel:**
  - **Mode 2 — `/demo`**: no-login instant estimate. A prospect types a few numbers; a personalized partial dashboard computes **client-side** (reuses the Profit First calculator). Tiles needing bank/POS data render "locked". Optional Google rating lookup. Supports shareable prefill links (`/demo?name=...&sales=...`).
  - **Mode 1 — `/demo/tour`**: no-login full dashboard tour for a sample "Demo Bistro". Reads from a **separate demo database** (`DEMO_DATABASE_URL`) via a second Prisma client so production data is never touched.

### PR #34 — open on `feat/demo-automation` (3 commits)
- `cfa06ef` **Monthly demo reseed** — `monthlyDemoReseed` Inngest cron (1st of month, 6am ET) refreshes the Demo Bistro; writes only to the demo DB.
- `bfc6331` **Benchmark defensibility** — tightened the net-margin *typical* band 6–12% → **3–9%** (full-service runs thin) in both the demo and the live module; added `docs/benchmarks-rationale.md` (where the ranges come from + a publish-ready FAQ answer).
- `0ab0d4b` **Aura reputation trending** — a new `ReputationSnapshot` table + a weekly Inngest cron that records each source's rating (+ a count-weighted "overall" row); `loadReputationTrend()` computes a latest-vs-~6-weeks-ago delta + review velocity, gated to a "gathering history" state until ~2 weeks of data exist; trend chip added to the Aura tile.

> ⚠️ **The Aura migration has NOT been applied to the databases yet** (the agent was blocked from running a prod migration by a safety classifier). See "Open questions / TODOs" — this must happen before PR #34 is merged/deployed.

## Inspect first (highest-signal files)
- `src/app/demo/` and `src/lib/demo/` — the demo (estimate.ts, demo-tenant.ts, demo-prisma.ts, DemoEstimator.tsx, page.tsx, tour/page.tsx)
- `src/lib/modules/reputation-trend.ts`, `src/components/modules/AuraModule.tsx`, `prisma/migrations/20260621000000_add_reputation_snapshot/` — Aura trending
- `src/lib/inngest/functions.ts` — all scheduled crons (Plaid/Toast sync, demo reseed, reputation snapshot)
- `prisma/schema.prisma` — data model (note the new `ReputationSnapshot` at the end)
- `docs/demo-tour-setup.md`, `docs/benchmarks-rationale.md` — setup + rationale
- `src/middleware.ts` — Clerk auth + public-route allowlist (`/demo` is public)

## Install
- Requires **Node v24** (works in PowerShell on Windows) and npm.
- `npm install` — `postinstall` runs `prisma generate` automatically.

## Run locally
- `npm run dev` → http://localhost:3000 (requires `.env.local`, see below).
- Useful pages: `/` (landing), `/demo` (works with no DB), `/demo/tour` (needs the demo DB seeded), `/dashboard` (auth-gated via Clerk).

## Checks (all run for this handoff)
| Check | Command | Result |
|---|---|---|
| Tests | `npm test` (vitest) | **55 passed / 6 files** ✅ |
| Type check | `npx tsc --noEmit` | **clean** ✅ |
| Build | `npm run build` (`prisma generate && next build`) | **passes** ✅ |
| Lint | `npm run lint` (`next lint`) | ⚠️ **not configured** — drops into an interactive "configure ESLint" prompt (no eslintrc). Not a working gate. |

Other scripts: `npm run seed:demo`, `npm run check:launch`, `npm run db:migrate`, `npm run db:studio`.

## Known failing tests / warnings
- **None failing.** All 55 tests pass; tsc + build clean.
- **Lint is unconfigured** (pre-existing) — `next lint` has no config and prompts interactively.
- Git shows `LF will be replaced by CRLF` warnings on commit (Windows line endings) — cosmetic.
- `public/logo.png` is modified-but-uncommitted in the working tree — **pre-existing, NOT part of this work**; left as-is intentionally.
- The cleanup + demo were verified via type-check/build + HTTP probes, but **not** via a logged-in visual click-through of the auth-gated dashboards (local GUI/screenshot tooling was unresponsive during the session).

## Environment variables (names + safe placeholders only — NO real values)
Set these in `.env.local` (local) and Vercel (deployed). Real values are intentionally omitted.

```dotenv
# --- Database (Supabase Postgres) ---
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true"   # pooled
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"                    # direct (migrations)

# --- Separate DEMO database (for /demo/tour) ---
DEMO_DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true&connection_limit=1"
DEMO_DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"

# --- Auth (Clerk) ---
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_xxx"
CLERK_SECRET_KEY="sk_test_xxx"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/onboarding"

# --- Supabase (client-side keys; storage/realtime scaffolding) ---
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_xxx"

# --- Banking (Plaid) ---
PLAID_CLIENT_ID="xxx"
PLAID_SECRET="xxx"
PLAID_ENV="production"   # or sandbox

# --- POS (Toast) ---
TOAST_API_HOSTNAME="https://ws-api.toasttab.com"
TOAST_CLIENT_ID="xxx"
TOAST_CLIENT_SECRET="xxx"
TOAST_ANALYTICS_CLIENT_ID="xxx"
TOAST_ANALYTICS_CLIENT_SECRET="xxx"
TOAST_RESTAURANT_GUID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# --- Background jobs (Inngest) ---
INNGEST_EVENT_KEY="xxx"
INNGEST_SIGNING_KEY="signkey-prod-xxx"
INNGEST_DEV="0"

# --- Reputation / Aura (optional; each source lights up when its vars are set) ---
GOOGLE_PLACES_API_KEY="xxx"          # also used by /demo Google rating lookup
GOOGLE_PLACE_ID="ChIJxxxxxxxxxxxx"
YELP_API_KEY="xxx"
YELP_BUSINESS_ID="business-slug"
# META_GRAPH_TOKEN / FACEBOOK_PAGE_ID — Facebook source, parked/unwired

# --- Other ---
ANTHROPIC_API_KEY="sk-ant-xxx"   # AI features
RESEND_API_KEY="re_xxx"          # transactional email (scaffolded)
ENCRYPTION_KEY="32-byte-hex"     # encrypts stored access tokens
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## External services / databases / credentials required
- **Supabase** — two separate Postgres projects: production, and a **demo** project (`DEMO_DATABASE_URL`) for `/demo/tour`. Schema managed by Prisma migrations (`prisma/migrations`).
- **Clerk** — authentication for all non-public routes.
- **Plaid** — bank transactions. **Toast** — POS/sales data.
- **Inngest** — scheduled crons + event workers (registers on deploy via `PUT /api/inngest`).
- **Google Places + Yelp** — Aura reputation (Google is live in prod; the `/demo` estimate also uses `GOOGLE_PLACES_API_KEY`, ~free tier, cap a quota if worried).
- **Resend** — email (scaffolded). **Anthropic** — AI features. **Vercel** — hosting (auto-deploy on push to `main`).

## Open questions / TODOs / risky assumptions
1. **Aura migration is pending and must run before PR #34 deploys.** The agent was denied running the prod migration. Operator must run, in this order:
   - Prod: `npx dotenv -e .env.local -- npx prisma migrate deploy`
   - Demo: `npx dotenv -e .env.local -- node scripts/demo-db.cjs "npx prisma migrate deploy"`
   - **Then** merge PR #34. If the new code deploys before the table exists, `/modules/aura` will 500.
2. **Aura is single-tenant** today (one env-configured place per source). The snapshot model + trend are written global; multi-tenant Aura is a future change.
3. **Benchmark ranges are static industry norms** (not live peer data) — see `docs/benchmarks-rationale.md`. Structured to swap for cohort percentiles later.
4. **Demo data goes stale monthly** unless reseeded — the new cron handles it; manual fallback `npx dotenv -e .env.local -o -- tsx scripts/seed-demo-tour.ts`. If unseeded, `/demo/tour` shows a "being prepared" state.
5. **Lint has no config** — there is no real lint gate; consider initializing ESLint (`next lint`).
6. `main` = production and auto-deploys; be deliberate about merges.

## Suggested next steps for Codex
1. Run the **pending Aura migration** (prod + demo, order above), then merge PR #34.
2. After deploy, `/modules/aura` will show "gathering history" for ~2 weeks until the weekly snapshot cron accumulates data, then the trend self-activates — verify the cron registered in Inngest.
3. **Configure ESLint** so there's a working lint gate (currently none).
4. Optionally do a **logged-in visual smoke test** of the auth-gated dashboards (the one verification not done this session).
5. Review `docs/demo-tour-setup.md` for the demo-DB provisioning runbook (incl. the pgbouncer + URL-safe-password gotchas already encountered).

---

## Appendix — captured command output

```
$ git branch --show-current
feat/demo-automation

$ git status --short
 M public/logo.png
?? .claude/
?? "Access Control Policy.pdf"
?? "Information Security Policy.pdf"
?? "Public/Information Security Policy.docx"
?? Public/Logo_trans.png
?? Public/logo_trans.ai
?? "docs/Information Security Policy.pdf"
?? "docs/Privacy Policy.pdf"
?? docs/access-control-policy.md
?? docs/cleanup-handoff.md
?? docs/information-security-policy.md
?? docs/privacy-policy.md
?? docs/privacy.html
(note: CODEX_HANDOFF.md is added by this step)

$ git diff --stat
 public/logo.png | Bin 87497 -> 1113859 bytes
 1 file changed, 0 insertions(+), 0 deletions(-)

$ git log --oneline -4
0ab0d4b feat(aura): reputation trending (weekly snapshots + 4-8wk trend)
bfc6331 chore(benchmarks): tighten net-margin typical band to 3-9% + add rationale/FAQ doc
cfa06ef feat(demo): auto-reseed Demo Bistro monthly via Inngest cron
9c72120 Dead-code cleanup + public demo (instant estimate /demo + full tour /demo/tour) (#33)

$ npm test          # vitest
Test Files  6 passed (6)
     Tests  55 passed (55)

$ npx tsc --noEmit  # clean (exit 0)
$ npm run build     # passes (exit 0)
$ npm run lint      # NOT configured — interactive prompt, not a usable gate
```
