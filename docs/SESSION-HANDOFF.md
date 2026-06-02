# Restaurant OS — Session Handoff (2026-06-01)

> Safe to email — contains **no secrets**. Bring your `.env.local` separately.

## Resume a session
Open the repo and tell Claude:
> "Read the README, `docs/SESSION-HANDOFF.md`, and `docs/specs/transaction-categorization-v2.md`, and check your project memory for Restaurant OS. Then let's build Phase 1 of the categorization spec."

Repo: **https://github.com/seanaustin1-rgb/restaurant-os** (private)

## What this is
Multi-tenant restaurant-operator SaaS with a **Profit First** cash layer. Next.js 14 · Supabase/Prisma · Clerk · Plaid · Inngest · Vercel. Customer Zero = Stone Grille & Taphouse.

## Where we are (done & working)
- **Tier-3 AI bank-statement import is LIVE**: scanned Orrstown PDF → Claude structured extraction (`src/lib/import/llm-extract.ts`, model `claude-sonnet-4-6`, ~$0.24/statement) → categorized transactions → Profit First dashboard.
- **Categorization** tuned to real vendors (`src/lib/categorization/vendor-map.ts`); added **REVENUE** (deposits) and **PAYROLL_CHECK** (check # ≥ 10000) buckets + migrations (applied to Supabase).
- **Real May data imported** to restaurant **"Stone Grille and Tap House"** (`cmpvtkou90000syl9ziir8nlj`): 282 txns categorized; 28 days of DailySales seeded from Toast deposits so the dashboard gauges compute.
- **3 production bugs fixed**: structured-output `format.name` (removed); PDF ArrayBuffer detachment in `/api/import` (now copies buffer for the LLM); env loading.
- **On GitHub** (private), with README. **v2 categorization spec written** (`docs/specs/transaction-categorization-v2.md`).

## Run it locally
```
git clone https://github.com/seanaustin1-rgb/restaurant-os.git
cd restaurant-os && npm install
# put your .env.local in place (NOT in the repo — bring it securely)
npx prisma generate
npm run dev          # http://localhost:3000
```
DB is already migrated on Supabase (shared) — no migration needed to develop.

## NEXT STEP — build Phase 1 of the categorization spec
Spec: `docs/specs/transaction-categorization-v2.md`. Phase 1 (P0) =
1. `Category` table (per-restaurant, operator-extensible) + `Transaction.categoryId` FK + "Misc" catch-all.
2. Seed default categories per restaurant; map each → a fixed `tapBucket`.
3. Dashboard rollup: categories → the 6 Profit First TAPs (+ tax/revenue/excluded).
4. Per-restaurant categorization **rules** (replace the hardcoded vendor-map + `PAYROLL_CHECK_MIN`).
5. Migration/backfill from the current flat `bucket` → categories (preserve manual edits).
6. Categories settings screen (add/rename/remap/archive).

**Operator decisions already locked:** Misc → OpEx (until named); COGS_BEVERAGE shows as its own gauge line; Bank/Register Cash → EXCLUDED (register restocks); cash tip-outs → EXCLUDED, never Labor (they're pass-through to servers — also why some Toast deposits net low/negative).

**Still open (decide when building):** rule precedence on multi-match; per-category OpEx sub-budgets; whether the beverage line gets its own target %.

## Loose ends / reminders
- **Bring `.env.local`** — it's the only thing not in the repo (DB password + all keys).
- **Rotate secrets before production** — keys passed through chat during setup.
- **Duplicate restaurant**: an empty twin "Stone Grille and Taphouse" (`cmpvtq12q000i…`) exists from onboarding twice — delete it when convenient.
- **Before deploy**: remove `/api/dev/*` routes; run `next build` (passed once); set Vercel env WITHOUT `INNGEST_DEV`.
- **Gotchas** (Windows): Node may be off-PATH; run Prisma via `npx dotenv -e .env.local -- prisma ...`; use batched `$transaction([...])` over the Supabase pooler (not interactive); Clerk test emails use code `424242`.
