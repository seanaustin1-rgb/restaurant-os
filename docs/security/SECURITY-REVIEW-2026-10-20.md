# Security Review & Checklist — 2026-10-20

The living security checklist for OutFront Data. **Reviewers (human or Codex):
check every diff against the invariants in §2, and use §5 to hunt for anything
this review missed.** Each finding has an ID; cite it in PRs and reviews.

Status key: ✅ fixed · 🔧 fixed in this PR · ⏳ open · 👤 operator action (not code)

---

## 1. Scope & method

Read-only review of `main` @ `8ce068f` (2026-10-20): every route handler under
`src/app/api/**`, every server action, every page that resolves a tenant, the
Clerk middleware allowlist, Prisma schema, CI workflows, dependencies
(`npm audit --omit=dev`), git history (414 commits scanned for secrets), and the
Supabase surface. Not covered: Vercel / Supabase / Clerk / GitHub dashboard
settings (no access — see §4), runtime penetration testing.

Tenancy model: tenant = `Restaurant`; membership = `UserRestaurantRole`
(OPERATOR / MANAGER / CONSULTANT / INVESTOR). Prisma connects as the table owner.

---

## 2. Invariants — every PR must hold these

Flag a violation as a blocking finding with file:line.

- **INV-1 Tenant scoping.** Every query that reads or writes tenant data is scoped
  to a `restaurantId` the caller holds a role on, derived server-side. Never
  trust a `restaurantId`, connection id, or record id from params/body/query
  without re-checking membership (pattern: `{ id, restaurantId: <caller's> }`).
- **INV-2 No global tenant data.** No table holding tenant data without a
  `restaurantId`. No env-configured data source shown to more than one tenant
  (env sources belong to exactly one owner — see `src/lib/modules/aura-owner.ts`).
- **INV-3 Investor is read-only.** INVESTOR never reaches a mutation, a sync, or
  an internal (non-`/investor`) financial page. Tenant lookups on internal pages
  use `INTERNAL_VIEW_ROLES`; write actions use `ADJUSTMENT_ROLES` / `OPERATOR_ROLES`.
  A mixed-role user must never get an investor-only tenant on an internal page.
- **INV-4 Role-scoped tenant pick.** `userRestaurantRole.findFirst` filters by the
  role set the page/action needs — never `{ clerkUserId }` alone.
- **INV-5 Public routes stay narrow.** Any change to the `isPublicRoute` allowlist
  in `src/middleware.ts` needs a reason in the PR. Public handlers read only an
  explicit field allowlist and never touch ledger / Plaid / tax / allocation data.
- **INV-6 Single-tenant secrets stay single-tenant.** Anything that prints or
  unlocks a single-tenant secret (Spirit Vault day code) checks the caller is
  staff of THAT tenant (`mayIssueDayCode`), not of "any restaurant". This covers
  every encoding of the secret, not just printed text: a QR whose `/v/<code>` URL
  embeds the code leaks it to anyone who decodes the image
  (`qrTargetUrl(…, { withDayCode })` must use the same check).
- **INV-7 Credentials encrypted at rest.** OAuth/Plaid tokens go through
  `encrypt()` / `decrypt()` in `src/lib/crypto.ts`. Never log tokens, secrets, or
  request bodies carrying them.
- **INV-8 Demo isolation.** Demo writes use `demoPrisma` only (CLAUDE.md).
- **INV-9 RLS on every table.** Every new table in a migration gets
  `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. `scripts/check-rls.ts` must pass.
- **INV-10 No secrets in git.** Placeholders only in committed files.
- **INV-11 Webhooks/machine callbacks verify signatures** before doing anything.
- **INV-12 Dev routes** are blocked in production by middleware AND by their own
  `NODE_ENV` guard, and never write through the prod `prisma` client.

---

## 3. Findings

### Fixed in PR #177 "security: tenant isolation fixes" (`security/tenant-isolation-fixes`)

| ID | Sev | Finding | Status |
|---|---|---|---|
| T-1 | High | **Aura cross-tenant leak.** `AuraIntentSnapshot` / `ReputationSnapshot` had no `restaurantId`; env-configured Google/Yelp/Meta reviews and the GBP env token+location were shown to every tenant. | ✅ restaurantId added (migration `20261020120000_aura_tenant_scope`); env sources only for the env owner; per-tenant cron |
| T-2 | Med | **Day-code bypass.** Staff of any RESTAURANT tenant (incl. self-onboarded) could print the vault day code via `/admin/spirit-vault/today`, flight prep, placemat. | ✅ routes require a staff role on `SPIRIT_VAULT_RESTAURANT_ID` |
| T-3 | Med | **Investors on internal pages.** `/modules/*`, `/connections`, rentals import history resolved the tenant with no role filter; `/dashboard` loaded full internal data for tenants a mixed-role user only invests in (UI-only gating). | ✅ `INTERNAL_VIEW_ROLES` filter, `/modules` layout redirect, server-side investor filter on `/dashboard` |
| T-4 | Med | **Toast resolver name fallback.** `resolveToastRestaurantId` matched by restaurant name with no `orderBy`; a self-onboarded tenant with the same name could receive the env Toast account's sales. | ✅ pinned to the oldest match; Aura owner never uses a name match |

### Fixed in this PR (`security/hardening`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S-1 | High | **Supabase Data API exposure.** No migration enabled RLS; with the Data API on, `public` tables are reachable with the project URL + public key. | 🔧 migration `20261020130000_enable_rls_public` (RLS on, no policies) + `scripts/check-rls.ts`; removed unused `@supabase/supabase-js` and the Supabase public-key env requirement |
| S-2 | Low | `POST /api/plaid/sync` accepted any role (investor could trigger a write). | 🔧 `ADJUSTMENT_ROLES` only |
| S-3 | Low | `saveAccessRole` could demote the last OPERATOR. | 🔧 same ≥1-operator guard as `removeAccessRole` |
| S-4 | Low | No baseline security headers. | 🔧 HSTS, nosniff, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy, `poweredByHeader: false` (`next.config.mjs`) |
| S-5 | Low | No automated dependency updates. | 🔧 `.github/dependabot.yml` |
| S-6 | Low | CI workflow token had default permissions. | 🔧 `permissions: contents: read` in `ci.yml` |
| S-7 | Med | Committed sandbox `ENCRYPTION_KEY` (`.env.sandbox.example`) could be reused in prod unnoticed. | 🔧 launch readiness flags it red |
| S-8 | Low | Vault fails OPEN when `SPIRIT_VAULT_DAY_SECRET` is unset (by design pre-launch), silently. | 🔧 launch readiness flags it yellow |

### Open — need their own PR

| ID | Sev | Finding | Plan |
|---|---|---|---|
| H-1 | **Critical** | **Next.js 14.2.35** is below every patched release for 23 advisories (2 critical RCE, several SSRF/DoS/cache-poisoning; fixes start at 15.5.24). Vercel hosting likely blunts some (image optimizer, Windows-host RCE), not all (Server Actions DoS/SSRF, middleware/cache issues). | ⏳ dedicated upgrade PR to Next 15.5.24+ (async `params`/`cookies()`/`headers()`, caching defaults). Run full checks + a manual smoke of auth, Plaid Link, vault, Inngest. |
| H-2 | Med | No Content-Security-Policy. | ⏳ ship `Content-Security-Policy-Report-Only` tuned for Clerk, Plaid, Cloudflare Stream; enforce after a clean week |
| H-3 | Med | No rate limiting anywhere. Day code is 32^6 ≈ 1.07e9; at a sustained 100 req/s ≈ 0.8%/day chance to hit it via `/v/[code]` or `?k=`. Impact limited (guest spirits menu), but also unthrottled: sign-in-adjacent actions, invite, sync. | ⏳ Vercel Firewall rate-limit rule on `/v/*` and `/vault?k=*` (👤); consider a durable limiter (e.g. Upstash) for server actions |
| H-4 | Low | `/api/dev/seed-demo` takes `body.restaurantId` and writes via the prod `prisma` client (deletes that month's `dailySales`); `/demo/investor-preview` and `/demo/executive-cockpit` read the first real tenant via prod `prisma` unauthenticated. All 404 when `NODE_ENV=production` (also true on Vercel previews), so exposure = a dev/staging server pointed at the prod DB. | ⏳ move to `demoPrisma` or require operator role on the target tenant (INV-12) |
| H-5 | Low | Plaid / Google error messages echoed to the client verbatim. | ⏳ log server-side, return generic messages |
| H-6 | Low | `userRestaurantRole.findFirst` without `orderBy` picks an arbitrary tenant for multi-tenant users (Spirit Vault admin and others). Correctness more than security. | ⏳ add `orderBy` or explicit tenant selection |
| H-8 | Low | `api/brokerage/agent-cockpit` (and `brokerage-analytics.ts` ~790, `modules/brokerage/agent-cockpit/page.tsx` ~55) accept INVESTOR rows; scoped to the agent matched by email, and the API route isn't behind the `/modules` layout redirect. | ⏳ decide whether agents should be a distinct role; otherwise exclude INVESTOR (INV-3) |
| H-9 | Low | Toast resolver still falls back to a restaurant **name** match (now oldest-first). Robust fix: write a `PosConnection` row (provider TOAST, externalId = GUID) for Stone and drop the name fallback. | ⏳ 👤 create the row, then remove the fallback |
| H-7 | Low | 49 transitive advisories (`npm audit --omit=dev`: 36 moderate, 11 high, 2 critical incl. `next`, `proxy-addr`). Most fixable with `npm audit fix` (non-breaking). | ⏳ run after H-1 lands; Dependabot will keep it current |

---

## 4. Operator actions (dashboards — not code) 👤

- [ ] **Supabase → Advisors → Security Advisor:** confirm no "RLS disabled in public" errors after the S-1 migration.
- [ ] **Supabase → Project Settings → Data API:** disable it, or remove `public` from exposed schemas (the app doesn't use it).
- [ ] **Supabase → Database → Settings:** turn on **Enforce SSL**.
- [ ] **Supabase:** confirm backups / PITR; MFA on the Supabase account.
- [ ] **Apply migrations** `20261020120000_aura_tenant_scope` and `20261020130000_enable_rls_public` to prod and demo (`prisma migrate deploy`), then run `scripts/check-rls.ts` against each.
- [ ] **Vercel env:** confirm prod `ENCRYPTION_KEY` ≠ the sandbox key; `SPIRIT_VAULT_DAY_SECRET` set; optionally `AURA_RESTAURANT_ID` = Stone Grille's id. Remove `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` if nothing else needs it. Run `npm run check:launch` (or the readiness check) against prod env.
- [ ] **GitHub:** confirm the previously exposed PAT is revoked; branch protection on `main` (require PR + CI); turn on Dependabot security updates + secret scanning.
- [ ] **Vercel Firewall:** rate-limit rule for `/v/*` and `/vault` with `k=` (H-3).
- [ ] **MFA** on Vercel, Clerk, Plaid, Toast, GitHub, Google Cloud (policy §4 says so; verify).

---

## 5. Hunt list — for reviewers to find what this review missed

Look specifically for:

1. Any `findFirst` / `findMany` / `update` / `delete` on a tenant model whose
   `where` doesn't include a caller-verified `restaurantId` (INV-1, INV-4).
2. Server actions (`"use server"`) that skip `auth()` or the role check — they are
   callable directly by POST, regardless of what the UI shows.
3. Route handlers under `src/app/api/**` that are reachable by INVESTOR and write.
4. Anything reading `process.env.*` tenant data (Toast GUID, Google, Yelp, Meta,
   vault) and returning it to a tenant other than the env owner (INV-2).
5. New public routes or broadened matchers in `src/middleware.ts` (INV-5).
6. Inngest functions that loop tenants: one tenant's data written under another's id.
7. Cache leaks: `revalidate`, `unstable_cache`, `fetch` caching of per-tenant data
   keyed only by URL (Next data cache is shared across users).
8. New Prisma models without `restaurantId`, or migrations without RLS (INV-2, INV-9).
9. `dangerouslySetInnerHTML` or HTML string templates (vault/placemat/prep routes
   build HTML by hand — every interpolation must go through `esc()`).
10. Open redirects (`?to=`, `redirect(searchParams…)`), SSRF via user-supplied URLs.
11. Secrets in logs, error messages, or client bundles (`NEXT_PUBLIC_*` that
    shouldn't be public).

When you find one, add it to §3 with the next ID.
