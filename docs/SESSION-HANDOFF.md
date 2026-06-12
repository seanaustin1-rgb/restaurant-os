# Restaurant OS — Session Handoff

> Safe to email — contains **no secrets**. Bring your `.env.local` separately.

## Resume a session
Open the repo and tell Claude:
> "Read the README, `docs/SESSION-HANDOFF.md`, `docs/specs/transaction-categorization-v2.md`, and `docs/specs/labor-hours-module.md`, and check your project memory for Restaurant OS. Then let's build the **Allocation Advisor** module (the locked next pick) — or, if Toast/Sling credentials are in, start the Toast integration wave."

Repo: **https://github.com/seanaustin1-rgb/restaurant-os** (private)

## What this is
Multi-tenant restaurant-operator SaaS with a **Profit First** cash layer. Next.js 14 · Supabase/Prisma · Clerk · Plaid · Inngest · Vercel. Customer Zero = Stone Grille & Taphouse.

## Where we are (done & working)
- **Tier-3 AI bank-statement import is LIVE**: scanned PDF → Claude structured extraction → categorized transactions → Profit First dashboard. Real May data imported to restaurant **"Stone Grille and Tap House"** (`cmpvtkou90000syl9ziir8nlj`), 282 txns; 28 days of seeded sales so the gauges compute.
- **Categorization v2 — Phase 1 mostly built & shipped:**
  - **Two-level model live**: `Category` (per-restaurant, operator-extensible) → fixed `TapBucket` enum. `Transaction.categoryId` added; legacy `bucket` kept (dual-write).
  - 26 default categories seeded per restaurant; all 282 txns backfilled (manual edits preserved); new imports dual-write `categoryId`.
  - **Dashboard rollup** now computes TAP gauges from categories.
  - **Categories settings screen** at `/settings/categories` — add / rename / remap-TAP / archive (CRUD, auth-guarded, archive blocked while a category has txns).
- **Per-restaurant rules engine — shipped** (`Rule` table; new imports self-categorize per tenant). Phase 3 added **suggested rules** from repeated manual categorizations.
- **Global app header** — nav appears on every page.
- **Dashboard Modules framework (`src/lib/modules.ts`)** — the honest registry that replaced the mock tile list. `"live"` tiles link to a real page; `"soon"` tiles render disabled with the `blockedBy` dependency that unblocks them, so **nothing on the dashboard is a fake/dead control**. The grid renders from this list.
- **Three LIVE bank-data modules** (pattern for each: loader in `src/lib/modules/*.ts`, server page at `/modules/*`, client component in `src/components/modules/*`):
  - **Cash Flow** (`/modules/cash-flow`) — daily in/out, net-by-day bar chart, running balance. Sign convention: inflows stored **negative**, outflows **positive**.
  - **Vendor Spend** (`/modules/vendor-spend`) — spend by supplier, largest first, share bars; groups vendors by the same signature logic as the rules engine.
  - **Spending by Category** (`/modules/spending`) — outflows grouped into COGS / Labor / OpEx / Owner's Pay / Taxes / Other as a **profit donut** (spend groups + a profit slice = money in), plus a detailed per-category table. **Cash basis**, consistent with Cash Flow.
- **On GitHub** (private), README + specs + this handoff committed.

## Run it locally
```
git clone https://github.com/seanaustin1-rgb/restaurant-os.git
cd restaurant-os && npm install
# put your .env.local in place (NOT in the repo — bring it securely)
npx prisma generate
npm run dev          # http://localhost:3000
```
DB is already migrated on Supabase (shared) — no migration needed to develop.

## NEXT STEP (current priorities)

**1. Allocation & Variance Engine — the LOCKED next pick (Profit First centerpiece).**
Full spec: **`docs/specs/allocation-variance-engine.md`** (supersedes the earlier lightweight "Allocation Advisor" sketch). The engine: **pre-allocation tax skim** (Davo sales tax + Toast payroll tax off the top into a Tax Reserve), then **daily** allocation of Real Revenue into virtual buckets (5/5/30/27/20/13) on each settled deposit, **draw-down** as real payments clear Plaid, **rolling-7-day variance** (green/yellow/red dollar-gap) per operating bucket, and **binary OK/SHORT** on the Tax Reserve. Profit + Owner's Pay **swept on the 10th & 25th** (sim only). Builds on existing `TapSettings`, `VirtualAccount`, `calculator.ts`, `DailySales`, Plaid feed, categorization engine, and Inngest. **⚠️ Has open decisions that change locked TAP %s + the beer-line treatment — see the spec's section B; resolve before writing the migration.**

**2. Toast integration wave** — operator is using the **Toast Developer API** (confirmed 2026-06-12).
One connection lights up **six tiles**: Tax Vault, Food Cost, Sales Mix, Menu Engineering, Covers Flow,
and **Labor Hours**. Labor scope is fully specced in **`docs/specs/labor-hours-module.md`** (scheduled vs.
actual hours via **Sling-through-Toast**, 4-week change, YoY when prior-year data exists). First
integration decision: **Sling API vs. Toast Labor API** as the authoritative source for hours.

> **✅ DONE (2026-06-12): Toast connector scaffolding built AND verified live.**
> Standalone `src/lib/integrations/toast/` module — OAuth2 client-credentials auth + process-local
> token cache (`auth.ts`), typed `toastFetch` that injects the `Toast-Restaurant-External-ID` header
> and retries once on 401 (`client.ts`), config guard `isToastConfigured()` (`config.ts`), barrel
> `index.ts`. Env contract added to `.env.example`: `TOAST_CLIENT_ID`, `TOAST_CLIENT_SECRET`,
> `TOAST_API_HOSTNAME`, `TOAST_RESTAURANT_GUID`. Shipped in **PR #3**. Smoke test
> `scripts/test-toast-auth.ts` + discovery `scripts/toast-list-restaurants.ts`.
>
> **Verified against PRODUCTION** (`https://ws-api.toasttab.com`) from the **local Windows machine**
> (`.env.local`, NOT a web session): ✓ config present → ✓ **OAuth2 login succeeds** (real bearer token)
> → restaurant-scoped read returns **403** = GUID + header **accepted**, but this API client's granted
> **scopes** don't yet cover `/restaurants`. So the connector plumbing is proven end-to-end; reading
> actual data just needs the relevant scope enabled on the Toast API client.
>
> **Credential facts learned (2026-06-12):** these are **Standard (restaurant-scoped) API credentials**,
> NOT a partner integration — the Partners API (`/partners/v1/restaurants`) returns
> `401 "partnerGuid must be supplied in token"`, so there's no partner restaurant-list to query; the
> restaurant GUID must be supplied directly (it's a UUID issued with the client id/secret).
> `TOAST_RESTAURANT_GUID` is a UUID (8-4-4-4-12), **not** the access-type label `TOAST_MACHINE_CLIENT`.
>
> **⚠️ CRITICAL FINDING (2026-06-12): the current creds are ANALYTICS-only, not operational.**
> Decoded the access-token claims: `iss=toast-pos.toasttab.auth0.com`, **`scope=enterprise-metrics:read`**
> — the only granted scope. So this client is provisioned for the Toast **Analytics / Enterprise Metrics
> API**, NOT Standard (operational) API Access. A scope probe of 8 operational endpoints (labor.employees,
> labor.jobs, labor.timeEntries, orders, menus, config/diningOptions, restaurants, cashmgmt) returned
> **403 on all 8** (`scripts/toast-scope-probe.ts`). The six-tile plan — especially Labor Hours
> (scheduled-vs-actual *hours*, punch/shift level) — needs **operational** scopes (`labor:read`,
> `labor.employees:read`, `orders:read`, `config:read`, `menus:read`, `cashmgmt:read`). **Decision pending
> (operator):** (A) request **Standard API Access** from Toast with those operational read scopes, or
> (B) build on the **enterprise-metrics** Analytics API we already have (probe its surface first — it may
> cover sales/labor-cost *aggregates* but likely NOT scheduled-vs-actual hours).
>
> **Still TODO before the tiles:** (a) resolve the access fork above (operational scopes vs analytics API);
> (b) add the four vars to **Vercel** (Prod+Preview) for deploy, and to the **web environment config** if
> you want web sessions to reach Toast; (c) then build the six tiles' data layers on `toastFetch` — Labor
> Hours first (`docs/specs/labor-hours-module.md`). Keep tile work out of the scaffold PR.

**Other bank-data modules on deck (no Toast needed):**
- **Recurring & Subscriptions** — uses `Transaction.isRecurring`; flag recurring spend + price creep (zombie-subscription killer).
- **Cash Runway / low-balance warning** — days of cash at current burn, early-warning line.
- **Duplicate / unusual payment catcher** — flags likely double-pays and off-norm charges.

### Categorization backlog (older — verify status before picking up)
1. **Beer/Beverage as its own dashboard gauge line** — `cogsBeverage` is computed in `src/lib/dashboard/data.ts`; may still need a gauge in the dashboard components (verify, the beverage settings/gauges work landed since).
2. **Categorization Phase 2 polish** — spend-by-category drill-down, bulk recategorize, rule-management UI. (Rules engine itself is shipped.)

**Operator decisions locked:** Misc → OpEx (until named); COGS_BEVERAGE = its own gauge line; Bank/Register Cash → EXCLUDED (register restocks); cash tip-outs → EXCLUDED, never Labor (pass-through to servers — also why some Toast deposits net low/negative).
**Still open:** rule precedence on multi-match; per-category OpEx sub-budgets; whether the beverage line gets its own target %.

## ⚠️ PENDING DB MIGRATION (apply before running)
Milestone B added 4 nullable columns to `TargetSettings` (beverage cost targets +
manual sales-mix). The Prisma client now selects them, so **the dashboard will error
until the migration is applied** to the shared Supabase DB:
```
npx dotenv -e .env.local -- prisma migrate deploy
```
Migration: `prisma/migrations/20260609120000_add_beverage_cost_targets`. Additive &
safe (all nullable). Existing Customer Zero gets the columns as NULL → beverage
gauges show a "set your sales mix" prompt until configured at `/settings/beverage`.

## ⬇️ FROM AN EARLIER (EXTERNAL) CHAT — TO INTEGRATE
> The operator has a block of notes/decisions/requests from a separate conversation
> to paste in. **Placeholder added 2026-06-12.** When provided, fold each item into
> the relevant section above (modules roadmap, locked decisions, specs) rather than
> leaving it parked here.

<!-- PASTE BLOCK BELOW -->
**Integrated 2026-06-12** → full **Profit First Allocation & Variance Engine** spec saved to
**`docs/specs/allocation-variance-engine.md`** (operator block verbatim + repo-grounding +
open-decisions). It's the real version of NEXT STEP #1. Open decisions that **conflict with
previously-locked state** (resolve before migration):
- **TAP split changes:** Labor 32→**27**, OpEx 28→**20**, new **Spill 13%** bucket. Customer Zero's
  `TapSettings` row needs a data-update (defaults only hit new rows).
- **Beer line:** earlier lock = "COGS_BEVERAGE its own gauge line"; this spec folds beer/wine into
  **COGS Liquor** (Food 18 / Liquor 12 only) for allocation. Confirm override.
- **Ledger:** extend existing `VirtualAccount` rather than add a parallel `BucketBalance`.
- **Tax source of truth:** Tax Reserve (sales) + the Tax Vault tile both use **Davo's actual pull**,
  never a 6% estimate (PA: all alcohol sales-tax exempt; 6% food + non-alc only; York County).
<!-- /PASTE BLOCK -->

## Where secrets go (so they're visible in web sessions AND in prod)
Secrets live in **three separate stores** — setting one does **not** populate the others:
1. **Claude Code web environment config** → so the agent can see them *in a web session right now*.
   Set them as environment variables/secrets on the environment this session launches from
   (docs: https://code.claude.com/docs/en/claude-code-on-the-web). They're injected into the container
   as env vars. **Currently EMPTY — this is the gap.** Whatever was added before isn't reaching this env.
2. **Vercel project env vars** → so they work *once live* (Production + Preview scopes).
3. **`.env.local`** → local dev only (never committed).
Toast vars to set in #1 and #2: `TOAST_CLIENT_ID`, `TOAST_CLIENT_SECRET`, `TOAST_API_HOSTNAME`,
`TOAST_RESTAURANT_GUID`. **Rotate** any key that was ever pasted into chat before going live.

**Dead ends that do NOT work (verified 2026-06-12 — don't retry):**
- **Dropping a file in `~/.claude/`.** That folder is Claude Code's *own* internal config (its auth
  token, session transcripts, hooks, skills) — not a secrets store. A file there never becomes a
  `process.env.*` var the app reads, and the folder is rebuilt fresh each container (not carried over
  from a prior session), so anything placed there is gone next session.
- **Assuming a previous session's `.env.local` / uploaded file persists.** Containers are ephemeral and
  cloned fresh from the repo; only committed files survive, and secrets must never be committed.
- **The ONLY mechanism that makes a secret visible to the agent in a web session** is store #1 above
  (env vars/secrets in the web environment's configuration), injected into the container as real env
  vars. This is a platform UI action the operator must do — the agent cannot place or read it for them.

## Loose ends / reminders
- **Bring `.env.local`** — the only thing not in the repo (DB password + all keys).
- **Supabase free-tier pauses after inactivity.** If scripts/app error with `FATAL (ENOTFOUND) tenant/user … not found`, the project is asleep — open the Supabase dashboard (project ref `rweclputxgwutykinlbr`) and **Restore/Resume** it.
- **Rotate secrets before production** — keys passed through chat during setup.
- **Duplicate restaurant**: empty twin "Stone Grille and Taphouse" (`cmpvtq12q000i…`) from onboarding twice — delete with `npx dotenv -e .env.local -- tsx scripts/cleanup-restaurants.ts` (lists all; add `--delete <id> --commit` to remove the empty one — refuses non-empty without `--force`).
- **Before deploy**: apply the pending migration (above); `/api/dev/*` routes are already hardened (middleware 404s them in prod **and** each handler self-guards on `NODE_ENV`, so they can stay); run `next build` with real env present; set Vercel env WITHOUT `INNGEST_DEV`. **Rotate any secrets** shared via chat during setup. Note: `middleware.ts` is correct for the pinned Next 14 — the `proxy` rename only applies if you upgrade to Next 16.
- **Gotchas** (Windows): Node may be off-PATH; run Prisma via `npx dotenv -e .env.local -- prisma ...`; use batched `$transaction([...])` over the Supabase pooler (not interactive); Clerk test emails use code `424242`; new route segments need a dev-server restart to register.

## Recent commits
Earlier: `Initial commit` → README → handoff → Phase 1 categorization (`fe52a04`) → Categories settings screen (`c6113ea`).
This session (modules work): suggested rules / Phase 3 (`4af86f3`) → deploy-hardening + cleanup script (`d7eb433`) → global app header (`57c0aef`) → **Cash Flow module** (`782ed8a`) → **Vendor Spend module** (`b542fbf`) → **Tax Vault re-tag** to real-figures dependency (`88767bb`) → **Spending by Category + profit donut** (`629186d`) → **Labor Hours tile + spec** (`279f0a5`).
Helper scripts in `scripts/`: `backfill-categories.ts`, `verify-rollup.ts`, `inspect-txns.ts`, `seed-sales.ts`, `recategorize-checks.ts`, `commit-cached.ts`, `test-llm-extract.ts`, `cleanup-restaurants.ts`.
