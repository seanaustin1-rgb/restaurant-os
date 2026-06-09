# Restaurant OS — Session Handoff

> Safe to email — contains **no secrets**. Bring your `.env.local` separately.

## Resume a session
Open the repo and tell Claude:
> "Read the README, `docs/SESSION-HANDOFF.md`, and `docs/specs/transaction-categorization-v2.md`, and check your project memory for Restaurant OS. Then let's finish Phase 1 of the categorization spec."

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
- **On GitHub** (private), README + spec + this handoff committed.

## Run it locally
```
git clone https://github.com/seanaustin1-rgb/restaurant-os.git
cd restaurant-os && npm install
# put your .env.local in place (NOT in the repo — bring it securely)
npx prisma generate
npm run dev          # http://localhost:3000
```
DB is already migrated on Supabase (shared) — no migration needed to develop.

## NEXT STEP — finish Phase 1 (2 pieces left)
1. **Beer/Beverage as its own dashboard gauge line** (operator decision: keep it separate from Liquor). Small, visible. `cogsBeverage` is already computed in `src/lib/dashboard/data.ts`; just needs a gauge in the dashboard components.
2. **Per-restaurant rules engine** — move keyword→category rules into the DB per restaurant (a `Rule` table), replacing the hardcoded `src/lib/categorization/vendor-map.ts` + `PAYROLL_CHECK_MIN`, so new imports self-categorize per tenant. Biggest remaining piece. Then Phase 2 (spend-by-category drill-down, bulk recategorize, rule-management UI).

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

## Loose ends / reminders
- **Bring `.env.local`** — the only thing not in the repo (DB password + all keys).
- **Supabase free-tier pauses after inactivity.** If scripts/app error with `FATAL (ENOTFOUND) tenant/user … not found`, the project is asleep — open the Supabase dashboard (project ref `rweclputxgwutykinlbr`) and **Restore/Resume** it.
- **Rotate secrets before production** — keys passed through chat during setup.
- **Duplicate restaurant**: empty twin "Stone Grille and Taphouse" (`cmpvtq12q000i…`) from onboarding twice — delete when convenient.
- **Before deploy**: remove `/api/dev/*` routes; run `next build` (passing); set Vercel env WITHOUT `INNGEST_DEV`.
- **Gotchas** (Windows): Node may be off-PATH; run Prisma via `npx dotenv -e .env.local -- prisma ...`; use batched `$transaction([...])` over the Supabase pooler (not interactive); Clerk test emails use code `424242`; new route segments need a dev-server restart to register.

## Recent commits (this session)
`Initial commit` → README → handoff → Phase 1 categorization (`fe52a04`) → Categories settings screen (`c6113ea`). Helper scripts in `scripts/`: `backfill-categories.ts`, `verify-rollup.ts`, `inspect-txns.ts`, `seed-sales.ts`, `recategorize-checks.ts`, `commit-cached.ts`, `test-llm-extract.ts`.
