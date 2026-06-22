# Cleanup Handoff — OutFront Data (restaurant-os)

**Goal:** Remove unnecessary/dead code accumulated during launch-hardening, **without changing any runtime behavior** of the live app. This is hygiene, not a refactor.

**Context:** The app is **live in production** (outfrontdata.com, Vercel project `restaurant-os`, Hobby plan, auto-deploys on push to `main`). Real users, real bank data, real money-adjacent logic. Treat `main` as production. See memory files `outfront-data-brand`, `operator-dashboard`, `google-places-aura`, `inngest-prod-sync` for what's live.

---

## Safety protocol (read first)

1. **Work on a branch**, not `main`. Small, focused commits per category so anything can be reverted cleanly.
2. **Trust nothing as "obviously dead" — verify each removal.** Grep for the symbol/file across `src/`, `scripts/`, `prisma/`, and config before deleting. "Looks unused" has already bitten this repo (see traps below).
3. **Green gate before every commit and before any push:**
   - `npx tsc --noEmit` → clean
   - `npm run build` (Next.js production build) → passes
   - `npm run lint` → no new errors
4. **Do NOT touch production data or infra** (Supabase rows, Vercel env vars, Inngest Cloud, Plaid/Yelp/Google config). This task is code only.
5. **Manual smoke test before pushing** (see Verification gate at the bottom).
6. When unsure whether something is dead, **leave it and flag it** in the PR description rather than deleting.

---

## Method

There's no dead-code tooling installed yet. Add one transiently to get a candidate list:

```bash
npx knip            # best for Next.js App Router — finds unused files, exports, deps
# or: npx ts-prune  # unused exports only
# or: npx depcheck   # unused dependencies only
```

Treat the output as **candidates, not a kill list** — knip has false positives for Next.js route handlers, server actions, and dynamic imports. Verify each before removing.

---

## Candidate areas (grounded by a scan on 2026-06-15)

### 1. `scripts/` — biggest target, lowest risk ⭐
**38 `.ts`/`.cjs` files** + a stray `scripts/.cache-txns.json` artifact. **The Next build only bundles `src/`, so `scripts/` ships nothing to prod — deleting here is zero runtime risk**, purely repo hygiene. Most are one-off probes/backfills/tests from development.

- **Almost certainly throwaway** (one-off probes/tests/backfills, already served their purpose): `toast-*-probe.ts` (auth, scope, payments, tax, shifts, loyalty, orders-tax, analytics), `test-*.ts` (llm-extract, toast-auth, allocation-engine, ledger-sweeps), `whoami-check.ts`, `inspect-txns.ts`, `commit-cached.ts` + `.cache-txns.json`, `backfill-categories.ts`, `backfill-rules.ts`, `fix-tech-categorization.ts`, `fix-debt-service-bucket.ts`, `recategorize-checks.ts`, `recategorize-transactions.ts`, `cleanup-restaurants.ts`, `toast-list-restaurants.ts`, `verify-rollup.ts`, `seed-sales.ts`, `dedupe-inspect.ts`, `dedupe-apply.ts` (the dedup is done), `check-data.ts`, `check-toast.ts`, `list-clerk-users.ts`, `md-to-pdf.cjs` (policies already generated).
- **Possibly worth keeping** (reusable ops/backfill tooling): `sync-toast-metrics.ts`, `sync-toast-sales-mix.ts`, `sync-toast-menu-items.ts`, `sync-toast-sales-tax.ts`, `run-allocation-ledger.ts`, `check-launch.ts`, `seed-demo.ts`. **Ask the operator** before deleting these — they're the manual equivalents of the nightly crons and are handy for backfills/recovery.
- Recommendation: move keepers into a documented `scripts/ops/` and delete the rest, OR delete throwaways and leave keepers in place. Confirm the keep/kill split with the operator.

### 2. `src/app/api/dev/*` — 4 dev-only routes
`plaid-sandbox`, `plaid-sync`, `seed-demo`, `dashboard-data`. Most are guarded by `if (process.env.NODE_ENV === "production") return 403`, so they're inert in prod but still shipped.
- `api/dev/plaid-sync` is now **redundant** — the production `api/plaid/sync` route does the same synchronous `runPlaidSync` directly. Strong removal candidate.
- The others: decide keep-as-local-dev-tools vs remove. Low risk either way (403'd in prod). Confirm they aren't referenced by any local dev workflow first.

### 3. Categorization refactor leftovers — VERIFY, don't assume
`src/lib/plaid/sync.ts` was refactored to use `categorize()` / `CategorizationContext` instead of the older `applyRules` + `TAP_BUCKET_TO_LEGACY`. **Those older exports are NOT dead** — still used in 6 files (`onboarding/vendors/actions.ts`, `lib/onboarding/vendor-setup.ts`, `categorization/suggestions.ts`, `settings/rules/actions.ts`, `transactions/misc/actions.ts`, and defined in `categorization/rules.ts`). After the `categorize` refactor, check `rules.ts` / `categories.ts` for any **now-orphaned helper exports** (run knip on these specifically), but keep what's still imported.

### 4. Smaller suspects (verify each)
- `src/lib/plaid/sandbox.ts` — Plaid sandbox helper; the prod path is production Plaid now. Check if anything outside `api/dev/plaid-sandbox` imports it; if it's dev-only, it goes with the dev route.
- `src/lib/mock/dashboard.ts` — **likely still used** (`DashboardHeader` imports `RoleKey` from it). Verify before touching.
- Untracked artifacts in `public/` (e.g. `Logo_trans.png` original) — not in git; ignore or clean locally.
- Unused npm deps — run `npx depcheck`; remove only ones with zero `src/` references (watch for build/tooling-only deps that depcheck misreports).

---

## ⛔ DO NOT REMOVE (intentional, looks-removable)

These will look suspicious to a dead-code tool but are deliberate and **live**:
- **`api/plaid/sync` (synchronous route) + `SyncNowButton` retry loop** — intentionally bypasses Inngest so manual sync works regardless of the worker. (`api/dev/plaid-sync` is the redundant one; this is the real one.)
- **`src/lib/inngest/*` + `api/inngest`** — the daily Plaid/Toast crons; **now registered and live in prod**.
- **`RemoveConnectionButton` + `api/plaid/connection/[id]`** — the disconnect feature (new).
- **`runPlaidSync` incremental/resumable logic + `timeBudgetMs`** in `sync.ts` — required for the 60s Hobby cap; do not "simplify" it away.
- **Aura `meta.ts` / Facebook provider** — scaffolded but unconnected on purpose (Facebook is a parked, intentional next-source; Google + Yelp are live).
- **`src/app/privacy/page.tsx` + `docs/*-policy.md` (+ PDFs)** — required for Plaid compliance.
- Anything `NODE_ENV`-guarded that's used in local dev.

---

## Verification gate (before pushing)

1. `npx tsc --noEmit` clean, `npm run build` passes, `npm run lint` clean.
2. Boot the app and smoke-test the critical paths that this session's removals could plausibly touch:
   - Dashboard `/dashboard` loads with real numbers (Heartbeat).
   - `/connections` — Connect / Sync now / Disconnect render.
   - `/modules/aura` — Google + Yelp tiles show.
   - Transactions / categorization pages load.
3. Open a PR (don't push straight to `main`). In the description, list what was removed by category and call out anything you were unsure about and left.

## Suggested commit slicing
1. `chore: remove one-off dev scripts` (scripts/ throwaways + .cache-txns.json)
2. `chore: drop redundant api/dev/plaid-sync` (and other agreed dev routes)
3. `chore: prune orphaned categorization/plaid helpers` (only knip-confirmed + grep-verified)
4. `chore: remove unused dependencies` (depcheck-confirmed)

Keep them separate so any one can be reverted without losing the others.
