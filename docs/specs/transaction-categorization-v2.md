# PRD: Configurable Two-Level Transaction Categorization

**Status:** Draft · **Owner:** Operator (Customer Zero) · **Date:** 2026-06-01
**Component:** Restaurant OS — Profit First cash-management layer
**Stack:** Next.js 14 (App Router) · Supabase/Postgres · Prisma · Clerk · Inngest

---

## Problem Statement

Today every transaction is tagged with a single flat `TransactionBucket` enum that does **two jobs at once**: it's the operator's expense detail *and* the Profit First TAP allocation. That conflation means (a) the detail is too coarse to answer "where did the money actually go?" — Marketing, Maintenance, Software, and Professional Services all collapse into one `OPEX_SUPPLIES` blob, and (b) the operator **cannot add a category** without an engineer shipping a code change and a DB migration. For a multi-tenant product, that's a non-starter: every restaurant has its own vendors and its own way of slicing OpEx. The guiding principle the operator stated — **"every dollar needs a name"** — is impossible to honor when categories are a fixed, code-owned enum.

## Background / Current State

- `TransactionBucket` enum (flat): `REVENUE, COGS_FOOD, COGS_LIQUOR, COGS_BEVERAGE, LABOR, PAYROLL_CHECK, OPEX_RENT, OPEX_UTILITIES, OPEX_INSURANCE, OPEX_SUPPLIES, DEBT_SERVICE, OWNER_PAY, TAX_SALES, TAX_PAYROLL, UNCATEGORIZED`.
- Categorization is a hardcoded, shared `VENDOR_PATTERNS` list (`src/lib/categorization/vendor-map.ts`) plus a `PAYROLL_CHECK_MIN = 10000` rule — **both tuned to Customer Zero's specific vendors and checkbook**, which is wrong for tenant #2.
- Profit First TAPs (fixed by the framework): **Profit, Owner Pay, COGS Food, COGS Liquor, Labor, OpEx+Spill**. Sales tax (Davo) and payroll tax are excluded from TAPs.
- Dashboard (`src/lib/dashboard/data.ts`) sums specific buckets into TAP gauges.

## Goals

1. **Operator can name every dollar** — provide a category granular enough that the share of spend left in a "Misc/Uncategorized" catch-all is < 5% of OpEx dollars after setup.
2. **Operator-extensible at runtime** — adding/renaming/remapping a category requires **zero** code changes or migrations.
3. **Preserve Profit First integrity** — categories roll up deterministically into the fixed TAP set; the existing gauges keep working unchanged in meaning.
4. **Multi-tenant correct** — categories and mapping rules are per-restaurant; new tenants start from a sensible seeded default set, not Customer Zero's hardcoded rules.
5. **Non-destructive migration** — existing categorized transactions (incl. manual overrides) map cleanly onto the new model with no data loss.

## Non-Goals

- **Changing the Profit First TAP framework.** The six TAPs (+ taxes, revenue, excluded) stay fixed. We are adding a layer *beneath* them, not redefining them. *(Out of scope: too foundational; not the problem.)*
- **A full chart-of-accounts / GL or QuickBooks-grade accounting.** Categories are management buckets, not double-entry accounts. *(Separate initiative.)*
- **ML/auto-learning categorization.** v1 uses deterministic rules + the LLM extractor's output; no model training. *(Premature.)*
- **Sub-gauges per category on the dashboard.** Categories give a detail *view*; the gauges stay the six TAPs. *(Avoid Profit First drift.)*
- **Shared/global category templates across tenants beyond the seed set.** *(v2.)*

## Proposed Solution (Two-Level Model)

**Level 1 — Categories** (fine-grained, per-restaurant, operator-extensible).
**Level 2 — TAP Buckets** (fixed allocation each category rolls up into).

```
Category {
  id           String  @id
  restaurantId String          // per-tenant
  name         String          // "Marketing", "Maintenance & Repair", ...
  tapBucket    TapBucket       // where it rolls up for Profit First
  isSystem     Boolean         // seeded default vs operator-created
  sortOrder    Int
  archivedAt   DateTime?
  @@unique([restaurantId, name])
}

Transaction.categoryId  String?  -> Category   // nullable = falls back to "Misc"
```

`TapBucket` (the allocation target — small, fixed enum, code-owned):
`COGS_FOOD · COGS_LIQUOR · COGS_BEVERAGE · LABOR · OWNER_PAY · OPEX · TAX_SALES · TAX_PAYROLL · REVENUE · EXCLUDED`

Key points:
- A category maps to exactly **one** `tapBucket`. Operators choose categories; the system owns how each rolls into Profit First.
- **`EXCLUDED`** handles non-expense cash movement — **Bank/Register Cash**, internal transfers — so it never distorts a TAP.
- **"Misc"** is a system category (one per restaurant) that is the catch-all so nothing is ever nameless; it's surfaced prominently for the operator to reassign.
- Vendor/keyword **rules** map a transaction description → a Category (which determines the TAP). Rules become per-restaurant data, replacing the hardcoded `VENDOR_PATTERNS` and `PAYROLL_CHECK_MIN`.

### Default seeded category set (new-tenant starting point)

| Category | tapBucket |
|---|---|
| Food — Distributor / Grocery | COGS_FOOD |
| Liquor (state store) | COGS_LIQUOR |
| Beer / Beverage Distributor | COGS_BEVERAGE |
| Payroll — Direct Deposit | LABOR |
| Payroll — Paper Checks | LABOR |
| Owner Pay / Draw | OWNER_PAY |
| Rent | OPEX |
| Utilities (gas/electric/water) | OPEX |
| Telecom / Internet | OPEX |
| Insurance | OPEX |
| Waste / Trash | OPEX |
| Smallwares / Supplies | OPEX |
| **Marketing** | OPEX |
| **Maintenance & Repair** | OPEX |
| **Cleaning / Services** | OPEX |
| **Professional Services** (accountant/legal) | OPEX |
| **Technology / Software** (POS, SaaS) | OPEX |
| Merchant / Bank Fees | OPEX |
| Sales Tax | TAX_SALES |
| Payroll Tax | TAX_PAYROLL |
| Sales Deposits | REVENUE |
| **Bank / Register Cash** (weekly register-restock withdrawals) | EXCLUDED |
| **Tips / Tip-Outs** (daily cash paid to servers) | EXCLUDED |
| Internal Transfers | EXCLUDED |
| **Misc** (catch-all) | OPEX *(until named)* |

## User Stories

**Operator**
- As an operator, I want to add a custom category (e.g., "Live Music") and choose which TAP it counts toward, so my P&L reflects how I actually run my business.
- As an operator, I want to rename or re-map an existing category, so I can correct or refine the defaults without an engineer.
- As an operator, I want a rule that says "anything from `MAILCHIMP` → Marketing," so future imports self-categorize.
- As an operator, I want to recategorize an individual transaction and have it stick (manual override), so one-offs don't get re-swept by rules.
- As an operator, I want a "Misc/Unassigned" view sorted by dollar amount, so I can quickly give the biggest unnamed dollars a home.
- As an operator, I want a spend-by-category breakdown for the month, so I can see detail beneath each TAP gauge.

**New tenant (onboarding)**
- As a new operator, I want to start with sensible default categories so I'm productive immediately, then tailor them.

**System**
- As the dashboard, I want to roll categories up to TAPs deterministically, so the Profit First gauges stay correct regardless of an operator's custom categories.

## Requirements

### Must-Have (P0)
1. **`Category` table + `Transaction.categoryId`** (nullable FK; null → Misc). *AC:* Given a transaction with no category, when the dashboard loads, then it is treated as Misc and never breaks a TAP sum.
2. **Per-restaurant seeding** of the default category set on restaurant creation. *AC:* Given a new restaurant, when onboarding completes, then the default categories exist with correct `tapBucket` values.
3. **Category → TAP rollup in the dashboard.** *AC:* Given categories mapping to OPEX, when the dashboard computes the OpEx gauge, then it equals the sum of all transactions whose category's `tapBucket = OPEX`; `EXCLUDED` categories (Bank/Register Cash, Tips/Tip-Outs, Internal Transfers) are omitted from **all** gauges; **COGS_BEVERAGE renders as its own line**, separate from the Liquor gauge; **Misc rolls into OpEx**.
8. **Pass-through cash correctness.** *AC:* Given register-restock withdrawals and daily cash tip-outs, when categorized, then they map to EXCLUDED and never appear in Labor, OpEx, or any expense TAP.
4. **Per-restaurant categorization rules** (description keyword → category), replacing hardcoded `VENDOR_PATTERNS` + `PAYROLL_CHECK_MIN`. *AC:* Given a rule "PLCB → Liquor," when a `PLCB…` transaction is imported, then it gets that category. Payroll-check threshold becomes a per-restaurant rule, **default off** for new tenants.
5. **Manual override preserved.** *AC:* Given a manually categorized transaction, when import rules re-run, then the manual category is not overwritten (`isManualOverride`).
6. **Migration/backfill** from flat buckets → categories with no data loss, incl. Customer Zero's current 282 rows and their hand edits.
7. **Categories settings screen** (CRUD: add, rename, remap tapBucket, archive). *AC:* operator can complete each without engineering.

### Nice-to-Have (P1)
- **Spend-by-category detail view** under each TAP on the dashboard (drill-down).
- **Bulk recategorize** from the Misc view (select N → assign category).
- **Rule management UI** (not just per-transaction overrides) — create/edit keyword rules.
- **Category usage guardrails** — prevent archiving a category that has transactions without reassignment.

### Future Considerations (P2)
- Cross-tenant category **templates** / industry presets.
- **Suggested rules** from repeated manual overrides ("you've tagged 3 `VEVOR` charges as Maintenance — make it a rule?").
- Budget targets **per category** (not just per TAP).
- Category-level trends month-over-month.

## Technical Design Notes

- **Rollup stays in `src/lib/dashboard/data.ts`**, but `groupBy(bucket)` becomes `group transactions by category → map category.tapBucket → sum into the six TAPs`. A single query joining `Transaction → Category` then aggregating by `tapBucket` keeps it one round-trip.
- **Keep the legacy `bucket` column during transition** (dual-write) so the dashboard never breaks mid-migration; drop it in a later cleanup migration once `categoryId` is authoritative.
- **Pooler constraint:** all writes (seeding, backfill, bulk recategorize) must use **batched array `$transaction([...])`**, never interactive transactions, over Supabase's PgBouncer pooler (port 6543). Enum-value migrations must be applied with explicit authorization (`migrate deploy`).
- **Import path:** `/api/import/commit` resolves `description → rule → categoryId` (per restaurant) instead of calling the global `categorizeTransaction`. The LLM extractor is unchanged.
- **`tapBucket` enum is code-owned** (small, stable). Adding a *category* is data; adding a *TAP* is a (rare) code change — correct separation.

## Migration / Backfill Plan

1. Ship `Category` + `Transaction.categoryId` (additive migration; keep `bucket`).
2. Seed default categories for every existing restaurant.
3. Backfill: map each existing `bucket` value → the corresponding default category (e.g. `OPEX_SUPPLIES → Smallwares/Supplies`, `PAYROLL_CHECK → Payroll — Paper Checks`, `UNCATEGORIZED → Misc`). Customer Zero's manual edits (e.g., `OPEX_RENT` on check #1592) map to the Rent category and retain `isManualOverride`.
4. Switch dashboard rollup to `categoryId`.
5. (Later) Convert hardcoded `VENDOR_PATTERNS` into seeded per-restaurant rules; remove the global map.
6. (Later cleanup) Drop the legacy `bucket` column.

## Success Metrics

**Leading (days–weeks)**
- **Naming coverage:** share of OpEx dollars in Misc after setup **< 5%** (today the operator-specific tail is large).
- **Self-service:** operator adds ≥ 1 custom category and ≥ 1 rule without engineering, within first week.
- **Auto-categorization rate** on a fresh statement import ≥ 80% of dollars (excluding genuinely ambiguous one-offs).

**Lagging (weeks–months)**
- **Multi-tenant readiness:** a second restaurant onboards and categorizes a statement using only seeded defaults + its own rules — **zero** code changes.
- **Dashboard trust:** TAP gauge values reconcile to the sum of their categories (automated check passes 100%).

## Resolved Decisions (2026-06-01, operator)

- **Misc → OPEX until named.** Misc counts toward the OpEx TAP (dollars are never dropped) and is surfaced for reassignment. *(Chosen over excluding-until-named.)*
- **Beer/Beverage → its own line.** COGS_BEVERAGE displays as its own gauge/line, separate from Liquor — not rolled into the Liquor TAP.
- **Bank/Register Cash → EXCLUDED.** Confirmed: weekly **cash withdrawals to restock the registers**, not an expense.
- **Cash tip-outs are pass-through (EXCLUDED), not Labor.** The operator pays **server tips in cash daily** out of the register. Tips are customer money owed to staff, not the restaurant's labor expense → a **Tips / Tip-Outs** category maps to EXCLUDED and must never hit the Labor TAP. This also explains why some Toast deposits net low/negative (tip liability settled in cash). *Correctness requirement (P0 #8).*

## Open Questions

- **Rule precedence:** when multiple keyword rules match one description, what wins — most specific, highest priority, or first-match (today's behavior)? — *Engineering + operator.*
- **Per-category targets:** do operators want OpEx *sub-budgets* (Marketing ≤ X%) in v1, or just visibility? — *Operator.*
- **Beverage target %:** the six Profit First TAPs have no beverage target. Does the standalone COGS_BEVERAGE line get an operator-set target (a de-facto 7th allocation), or display as tracked-only with no target? — *Operator.*

## Timeline / Phasing

- **Phase 1 (P0 core):** `Category` table + seeding + dashboard rollup + backfill + per-restaurant rules + settings CRUD. Ships the operator-extensible model end-to-end for Customer Zero.
- **Phase 2 (P1):** spend-by-category drill-down, rule-management UI, bulk recategorize.
- **Phase 3 (P2):** templates, suggested rules, per-category budgets.

**Dependencies:** none blocking; builds on the existing import pipeline. Sequence Phase 1 *before* onboarding a second tenant so the hardcoded rules are gone by then.
