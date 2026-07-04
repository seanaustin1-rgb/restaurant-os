# Spec E — Billing, Packaging & Founder Pricing

**Status:** Approved by Sean 2026-07-03. Not yet executed.
**Branch:** `claude/spec-e-billing` off `main`
**Dependencies:** Independent of Specs A/B/D. Sequence after Spec C in the queue. Requires Clerk Billing enabled in Clerk dashboard (one-time manual setup by Sean before session).
**Convention:** One session, one branch, one PR, Codex `/review` before commit. Keep 196 Vitest green + new gates below.

---

## 1. Purpose

Add paid plans, plan gating, and price-adjustment tooling. Three requirements from Sean, all hard:

1. **Global price changes with zero deploys** — change once, propagates everywhere.
2. **Per-tenant price overrides** — individual customers can diverge from list.
3. **Founder (early-adopter) cohort pricing** — locked pricing for first customers, capped, auditable.

Billing rails = **Clerk Billing (B2C mode)**. Tenants are `UserRestaurantRole` rows, not Clerk Organizations — the billing owner is the OPERATOR's Clerk user. Location caps enforced app-side. Clerk uses Stripe for processing only (0.7% + Stripe fees). Do **not** adopt Clerk Orgs for this.

**Hard rule:** Clerk is checkout + subscription lifecycle only. The app's source of truth for entitlements and price display is the `TenantPlan` table in Postgres. All sessionless paths (Inngest digest fan-out, sync schedulers, allocation engine) read `TenantPlan`, never Clerk.

---

## 2. Pricing catalog (configured in Clerk dashboard, not code)

| Plan (Clerk slug) | Price | maxTenants | Features |
|---|---|---|---|
| `core` | $149/mo per location | 1 | digest, forward_cash, tax_vault, csv_import, plaid + 1 POS source |
| `pro` | $249/mo per location | 1 | everything in core + mod_vendor, benchmarks, menu_mix, multi_source, extended_history |
| `group` | $129/mo/location, 3+ locations | 3 (raise manually) | pro features + portfolio rollup |
| `founder_core` (hidden) | $99/mo | 1 | = core |
| `founder_pro` (hidden) | $179/mo | 1 | = pro |

- Founder prices: **publicly-available toggled OFF** in Clerk — never render in `<PricingTable/>`.
- Founder terms: price locked while continuously subscribed; lapse = re-enter at list. Eligibility: first 10 tenants per vertical OR live before launch+90 days, whichever caps first. Concierge fee **waived** for founders.
- Concierge onboarding ($750 one-time/location, waived on annual prepay) is **not** a Clerk plan — one-time Stripe payment link, logged against the tenant's ConnectionRequest.
- Investor seats free/unlimited (existing INVESTOR role, no billing object). Consultant wholesale ($99/client/mo, 3-client min) deferred to a later spec — do not build now.

**No hardcoded prices anywhere in the repo.** Grep gate in DoD.

---

## 3. Data model (additive Prisma migration)

```prisma
model TenantPlan {
  id               String   @id @default(cuid())
  tenantId         String   @unique
  plan             String   // core | pro | group | founder_core | founder_pro
  features         String[] // mirrors Clerk Feature slugs
  status           PlanStatus // PILOT | ACTIVE | PAST_DUE | CANCELED
  priceCents       Int      // ACTUAL subscription price — individuals can diverge from catalog
  cohort           Cohort   // LIST | FOUNDER | CUSTOM
  maxTenants       Int      @default(1)
  currentPeriodEnd DateTime?
  billingOwnerId   String   // Clerk userId of the OPERATOR who pays
  graceUntil       DateTime? // set on PAST_DUE
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

Feature slugs (must match Clerk Feature slugs exactly): `digest`, `forward_cash`, `tax_vault`, `csv_import`, `mod_vendor`, `benchmarks`, `menu_mix`, `multi_source`, `extended_history`, `portfolio`.

`priceCents` and `cohort` exist because per-tenant overrides mean the webhook must carry the **actual** price, not the catalog price. All in-app price display reads TenantPlan.

---

## 4. Sync flow

1. Clerk Billing webhook (`subscription.created/updated/deleted`) → Next.js route → Inngest event → handler upserts `TenantPlan`. Idempotent on subscription id + event timestamp.
2. Handler resolves `tenantId` from `billingOwnerId` via UserRestaurantRole (OPERATOR). Multi-location owner on `group`: one subscription, N TenantPlan rows share plan/status, priceCents recorded per the subscription item.
3. On any status change to PAST_DUE: set `graceUntil = now + 7 days`.
4. Catalog endpoint `GET /api/billing/catalog`: reads Plans/Prices from Clerk Backend API, cached ~1hr. Marketing site and any in-app price mentions consume this — **a Clerk dashboard price change is the only action needed to reprice globally.**

---

## 5. Gating

- **UI/routes:** Clerk `has({ feature })` / `<Protect>` for page-level walls (cheap, session-aware). Module routes (vendor, benchmarks, menu-mix, portfolio) get walls.
- **Server logic + Inngest:** a single helper `entitled(tenantId, feature)` reading TenantPlan. The daily digest fan-out, sync schedulers, and any allocation-adjacent job MUST use this helper — no Clerk calls in cron paths.
- **Degrade ladder:** `PAST_DUE` → full function through `graceUntil`, banner shown. Past grace → **read-only**: digest pauses, dashboard viewable, syncs continue 30 more days, then syncs pause. **Data is never deleted.** `CANCELED` → read-only immediately, same 30-day sync tail.
- Location count enforced against `maxTenants` at tenant-creation time.

---

## 6. Virtual Pilot (trial)

- App-level state, **not** a Clerk trial — pilot starts before any checkout exists (no card, no keys; CSV spine only per Spec D).
- `TenantPlan` row created with `status = PILOT`, `plan = core`, `priceCents = 0`, full core features, 14-day live-digest window (store `pilotEndsAt` in meta or reuse `graceUntil` semantics — implementer's call, document it).
- Pilot end: digest pauses, read-only 30 days. Conversion = Clerk checkout; webhook flips the same row to ACTIVE.
- Conversion surface shows the pilot's dollar findings (residual $, low-point date) — content already computed in signals.ts; this spec only builds the surface, not the math.

---

## 7. Admin billing panel (`/admin/provisioning` extension)

Extends the concierge console. Staff can:

- View tenant's plan, status, actual priceCents, cohort, founder counter.
- **Transition price** (list ↔ founder ↔ one-off custom) via Clerk Backend API subscription-item transition. Clerk handles proration/timing (upgrades immediate; paid-to-paid at period end — no double-billing).
- **Assign FOUNDER cohort** — sets Clerk price + TenantPlan.cohort in one action.
- **Founder counter:** count of `cohort = FOUNDER` grouped by vertical, displayed next to the assign button. Cap of 10/vertical enforced by eyeball for now — no build.

**Guardrails (same class as act-on-behalf):**
- Every price action writes an `AdminActionLog` row (actor, tenant, old price, new price, cohort, reason free-text).
- Price transitions **blocked on PAST_DUE tenants** — resolve dunning first; discounting a delinquent account masks churn.
- No destructive actions: panel can never cancel a subscription (that stays customer-side via Clerk profile components).

---

## 8. Known debt (log, don't fix)

- Clerk Billing: no tax/VAT support yet, USD-only. **PA taxes SaaS — Sean to confirm treatment with accountant before first live invoice.** Revisit when Clerk ships tax or if we outgrow it (escape hatch: TenantPlan is the source of truth, so a future Stripe-direct migration touches checkout only).
- Consultant wholesale tier deferred.
- Founder cap enforcement is manual.
- Group plan quantity handling is coarse (flat Clerk plans, app-side caps) — fine at current scale.

---

## 9. Build order

1. Additive Prisma migration (`TenantPlan`, enums).
2. Webhook route + Inngest sync handler + `entitled()` helper.
3. Gate the Inngest fan-outs and module routes (grep for every fan-out touching per-tenant compute).
4. `/pricing` page (`<PricingTable/>`) + catalog endpoint + conversion surface.
5. Admin billing panel + AdminActionLog wiring + founder counter.
6. Pilot state handling + degrade ladder.
7. Vitest.

## 10. Definition of Done

- [ ] Clerk dashboard price change reflects on `/pricing` and catalog endpoint with no deploy (cache TTL only).
- [ ] Per-tenant price transition via admin panel updates Clerk AND TenantPlan.priceCents; AdminActionLog row written.
- [ ] Founder assignment: hidden price applied, cohort set, counter increments, concierge-waived flag visible.
- [ ] Digest fan-out skips non-entitled tenants (PILOT-expired, past-grace PAST_DUE, CANCELED) — Vitest gate.
- [ ] `entitled()` is the only entitlement path in server/Inngest code — no Clerk calls in cron paths (grep gate).
- [ ] Zero hardcoded price strings in repo (grep gate: `149|249|129|\$99` outside catalog/tests).
- [ ] Degrade ladder: PAST_DUE grace → read-only → sync tail verified; **no path deletes tenant data** — Vitest gate.
- [ ] Price transition blocked on PAST_DUE in admin panel — Vitest gate.
- [ ] 196 existing tests green.

---

## Claude Code kickoff prompt

> Read CLAUDE.md, docs/PRODUCT-MAP.md, and docs/specs/spec-e-billing.md. Execute Spec E. Verify all paths against the repo before writing code — especially the Inngest fan-out locations and UserRestaurantRole resolution. Work on a new branch `claude/spec-e-billing` off main. Clerk Billing must already be enabled in the Clerk dashboard; if plan slugs don't resolve, stop and report rather than stubbing.

## Manual setup (Sean, before session)

1. Enable Billing in Clerk dashboard; connect Stripe account.
2. Create the 5 plans per §2 with exact slugs + feature slugs; toggle founder plans non-public.
3. Create Stripe payment link for concierge ($750).
4. Confirm PA SaaS tax treatment with accountant.
