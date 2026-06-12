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

**1. Allocation Advisor — the LOCKED next pick (Profit First centerpiece).**
The allocation *ritual*: twice a month (the **10th & 25th**) tell the operator exactly what to transfer between accounts — *"$X → Profit, $Y → Owner's Pay, $Z → Tax, remainder → OpEx"* — derived from the existing TAP target % (`src/lib/profit-first/calculator.ts` + `TapSettings`) applied to **real deposits**, plus a running history of what's been set aside. Turns the existing dashboard gauges from a *score* into the *play*. Build as a module (loader `src/lib/modules/allocation-advisor.ts`, page `/modules/allocation`, client component; flip a new tile live in `src/lib/modules.ts`). **Bank-data ready — no Toast needed.**

**2. Toast integration wave** — credentials incoming (operator getting them **2026-06-12**). One connection lights up **six tiles**: Tax Vault, Food Cost, Sales Mix, Menu Engineering, Covers Flow, and **Labor Hours**. Labor scope is fully specced in **`docs/specs/labor-hours-module.md`** (scheduled vs. actual hours via **Sling-through-Toast**, 4-week change, YoY when prior-year data exists). First integration decision: **Sling API vs. Toast Labor API** as the authoritative source for hours.

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

<!-- /PASTE BLOCK -->

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
