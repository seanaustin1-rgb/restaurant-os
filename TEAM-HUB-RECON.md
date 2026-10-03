# Team Hub reconnaissance

Read-only review of `seanaustin1-rgb/restaurant-os` at `main` commit `8af0e3b` (October 3, 2026). This is an implementation inventory and placement recommendation; no Team Hub code or schema was changed. **UNVERIFIED** means the current source does not establish the behavior, or a live service was not inspected.

## Tenant boundary and locations

- `Restaurant.id` is the existing tenant key. The schema explicitly calls each Restaurant an isolation boundary; `UserRestaurantRole` joins a Clerk user to one restaurant and has a unique `(clerkUserId, restaurantId)` pair. Most domain models carry `restaurantId` and a relation to `Restaurant`. [Schema](prisma/schema.prisma#L1), [Restaurant](prisma/schema.prisma#L226), [UserRestaurantRole](prisma/schema.prisma#L292).
- Enforcement is primarily at individual server entry points and queries. Clerk middleware authenticates protected routes; it does not select a restaurant or check a business role. The Prisma client is constructed without a tenant-scoping extension or middleware. For example, the Spirit Flight page looks up an authorized role, then queries flights by that `restaurantId`; the flight action repeats a server-side role check. [Middleware](src/middleware.ts#L37), [Prisma client](src/lib/prisma.ts#L1), [Flight page](src/app/admin/spirit-vault/flights/page.tsx#L15), [Flight actions](src/app/admin/spirit-vault/flights/actions.ts#L38).
- No row-level-security policies were found in `prisma/migrations/`, and no app-wide Prisma tenant guard was found in the inspected source. Whether the deployed Supabase database has separate RLS policies is **UNVERIFIED**; do not assume query filtering alone protects new Team Hub tables. [Prisma client](src/lib/prisma.ts#L1), [Migration directory](prisma/migrations/), [Schema datasource](prisma/schema.prisma#L9).
- There is no general staff/venue `Location` model in the Prisma schema. `Restaurant` is the current business/venue boundary; `IntegrationConnection.externalLocationId` identifies a provider location, and `RentalProperty` serves the vacation-rental vertical. Whether multiple Maker’s House locations should be one tenant or separate restaurants is **UNVERIFIED**. [Restaurant](prisma/schema.prisma#L226), [IntegrationConnection](prisma/schema.prisma#L645), [RentalProperty](prisma/schema.prisma#L730).
- Several existing screens resolve the first eligible restaurant via `findFirst`, including access management and Spirit Vault staff. For a user in multiple businesses, Team Hub needs an explicit selected `restaurantId` and a positive membership check on **every** lesson, assignment, submission, and media operation. This is a placement recommendation based on the current pattern. [Access actions](src/app/settings/access/actions.ts#L22), [Flight actions](src/app/admin/spirit-vault/flights/actions.ts#L38), [Dashboard](src/app/dashboard/page.tsx#L13).

## Clerk and member roles

- `ClerkProvider` wraps the app and `clerkMiddleware` protects routes outside the public allowlist. Server pages call `auth()` to obtain `userId`, then query `UserRestaurantRole` for the allowed restaurants/roles. The dashboard enumerates all of a user's restaurant memberships. [Root layout](src/app/layout.tsx#L1), [Middleware](src/middleware.ts#L4), [Dashboard](src/app/dashboard/page.tsx#L8).
- Roles stored in Prisma are `OPERATOR`, `CONSULTANT`, `INVESTOR`, and `MANAGER`. There is no employee-only, learner, contributor, reviewer, or trainer role in this enum. Access invites and grant/removal operate on the same role list; an operator can remove a role, while code protects the last operator. These are app roles, not evidence of Clerk Organization memberships. [Role enum](prisma/schema.prisma#L19), [Access actions](src/app/settings/access/actions.ts#L13), [Access actions](src/app/settings/access/actions.ts#L185).
- `Restaurant.clerkOrgId` exists as an optional field, but no use of that field or Clerk Organizations was found in `src/`. The billing plan document explicitly proposes individual Clerk accounts plus `UserRestaurantRole` rather than Clerk Orgs. Live Clerk dashboard settings and actual organization memberships are **UNVERIFIED**. [Restaurant](prisma/schema.prisma#L226), [Root layout](src/app/layout.tsx#L34), [Billing spec](docs/fable-5/spec-e-billing.md#L18).
- The invite flow checks a Clerk account by email, creates/upserts a `UserRestaurantRole`, or stores a `BusinessAccessInvite` and accepts it after matching the signed-in email. This could be reused for staff onboarding, but financial app roles currently carry broader meaning; a Team Hub learner role needs a separate capability design. [Access actions](src/app/settings/access/actions.ts#L44), [Access actions](src/app/settings/access/actions.ts#L81), [Access actions](src/app/settings/access/actions.ts#L147), [Schema invite](prisma/schema.prisma#L311).

## Entitlements and module gating

- A `TenantPlan` model and a single `entitled(tenantId, feature)` helper are described in the billing **spec**, but neither appears in the current Prisma schema or `src/` implementation. Thus a Team Hub plan gate cannot simply call an existing entitlement helper; live Clerk Billing configuration is **UNVERIFIED**. [Billing spec](docs/fable-5/spec-e-billing.md#L18), [Billing spec](docs/fable-5/spec-e-billing.md#L46), [Billing spec](docs/fable-5/spec-e-billing.md#L81), [Prisma schema](prisma/schema.prisma), [Source tree](src/).
- `ModuleConfig` already records a tenant's `moduleKey`, `isEnabled`, position, and settings; onboarding seeds it from the industry template. That is configuration, not a billing entitlement or secure route gate. The dashboard module registry and navigation are presentation lists. Proposed Team Hub gating should check the signed-in user's membership and role, tenant module enablement, and eventual plan entitlement in server routes/actions and jobs. [ModuleConfig](prisma/schema.prisma#L600), [Onboarding actions](src/app/onboarding/actions.ts#L103), [Module registry](src/lib/modules.ts#L1), [Navigation](src/lib/nav.ts#L19).

## Inngest and background-work patterns

- The single Inngest client is `restaurant-os`. The registered endpoint is `/api/inngest`, exempted from Clerk middleware because Inngest authenticates it with its signing key. [Client](src/lib/inngest/client.ts#L1), [Route](src/app/api/inngest/route.ts#L1), [Middleware](src/middleware.ts#L26).
- Nine registered functions cover daily Plaid scheduling and per-connection sync, daily Toast scheduling and per-tenant sync, monthly demo reseed, weekly reputation snapshot, daily Aura snapshot, and daily digest scheduling and per-tenant send. Cron fan-out uses `step.sendEvent`; workers use `step.run` and configured retries (Plaid 4, Toast 3, demo/reputation/Aura/digest 2). [Functions](src/lib/inngest/functions.ts#L27), [Functions](src/lib/inngest/functions.ts#L59), [Functions](src/lib/inngest/functions.ts#L75), [Functions](src/lib/inngest/functions.ts#L99), [Functions](src/lib/inngest/functions.ts#L133), [Functions](src/lib/inngest/functions.ts#L150), [Functions](src/lib/inngest/functions.ts#L164), [Functions](src/lib/inngest/functions.ts#L191), [Function registry](src/lib/inngest/functions.ts#L252).
- Existing comments describe Plaid's single sync step and cursor handling as retry-safe, and Toast writes as idempotent upserts. The digest send path says retries can redeliver the same email; it is not a model for paid media-generation exactly-once behavior. Team Hub generation/import jobs should persist an external job ID and unique tenant-scoped import key before submission, then reconcile ambiguous responses without creating duplicate lessons. [Plaid worker](src/lib/inngest/functions.ts#L54), [Toast worker](src/lib/inngest/functions.ts#L94), [Digest worker](src/lib/inngest/functions.ts#L220).

## File and media storage

- The statement import route accepts an uploaded `File`, reads it into memory, extracts candidates, and returns them for review; it does not save the original file. `VacationRentalImportBatch.fileName` is a name field, not stored media. No persistent video/object-storage adapter or signed media delivery flow was found in `src/` or the Prisma schema. External storage configured outside this repo is **UNVERIFIED**. [Import route](src/app/api/import/route.ts#L6), [Import route](src/app/api/import/route.ts#L19), [Vacation rental batch](prisma/schema.prisma#L695).
- Team Hub therefore needs a private durable-media decision before implementation. A URL in a lesson row is insufficient by itself: the delivery path must recheck tenant membership and authorization, including after access removal. This is a proposed requirement derived from the present route-level tenancy pattern. [Middleware](src/middleware.ts#L37), [Flight page](src/app/admin/spirit-vault/flights/page.tsx#L19), [Prisma client](src/lib/prisma.ts#L1).

## Vertical vocabulary / manifest

- Current vocabulary lives in `INDUSTRY_TEMPLATES` (`BusinessType`-keyed labels, descriptions, profile questions, seed accounts, and default module keys) and `SOURCE_MAPS` (source categories/options by business type). The dashboard resolves a template for its active business. [Industry templates](src/lib/industry-templates.ts#L38), [Source maps](src/lib/source-map.ts#L60), [Dashboard view](src/components/dashboard/DashboardView.tsx#L157).
- `docs/fable-5/SPEC-C-industry-manifest.md` proposes a richer `IndustryManifest` registry and `getManifest`, but no `src/lib/industries/` implementation exists in the current tree. Treat that document as design direction, **not** an available API. A restaurant-specific Team Hub label could live beside current template vocabulary until the manifest system lands. [Manifest spec](docs/fable-5/SPEC-C-industry-manifest.md#L69), [Manifest spec](docs/fable-5/SPEC-C-industry-manifest.md#L118), [Industry templates](src/lib/industry-templates.ts#L51).

## App Router placement

- Protected owner/manager surfaces already live under `src/app/admin/`, and ordinary modules under `src/app/modules/`; navigation entries are declared in `src/lib/nav.ts`. The middleware's public allowlist does not include `/team`, so a new `/team` route will require Clerk authentication by default. [Admin flight page](src/app/admin/spirit-vault/flights/page.tsx#L15), [Module registry](src/lib/modules.ts#L16), [Navigation](src/lib/nav.ts#L19), [Middleware](src/middleware.ts#L4).
- Proposed route layout: `src/app/team/page.tsx` (feed), `src/app/team/learn/[lessonId]/page.tsx` (stable deep link), `src/app/team/training/page.tsx` (assignments), `src/app/team/submit/page.tsx` (staff submissions), and `src/app/team/manage/...` (manager review). Related mutations/media delivery could live under `src/app/api/team/...`. A route group named `(team)` may organize shared layout, but `/team` must still be a real path segment. The exact route naming is a proposal; role/tenant authorization must run in each server operation as in existing admin actions. [App Router structure](src/app/), [Flight actions](src/app/admin/spirit-vault/flights/actions.ts#L38), [Middleware](src/middleware.ts#L37).
- Navigation alone is not an authorization boundary: it derives a **union** of a user's roles and business types across all tenants. Team Hub should resolve the selected restaurant and role together before rendering or returning data. [Root layout](src/app/layout.tsx#L34), [Navigation](src/lib/nav.ts#L44), [Dashboard](src/app/dashboard/page.tsx#L13).

## Test patterns to follow

- Vitest runs `src/**/*.test.ts` in Node with `@` mapped to `src` and dummy database URLs. Existing tests use pure domain functions for industry template integrity, while server action tests mock Prisma/Clerk and assert authorization and tenant-scoped operations. [Vitest config](vitest.config.ts#L4), [Industry template tests](src/lib/industry-templates.test.ts#L16), [Spirit Flight action tests](src/app/admin/spirit-vault/flights/actions.test.ts), [Spirit Vault membership tests](src/lib/spirit-vault/membership.test.ts).
- For Team Hub, test access against two tenants, multi-business role selection, direct lesson/media URLs after removal, assignment revision rules, submission review/publish transitions, and duplicate import events. These are proposed acceptance tests based on the existing tenant and job patterns. [UserRestaurantRole](prisma/schema.prisma#L292), [Flight action tests](src/app/admin/spirit-vault/flights/actions.test.ts), [Inngest functions](src/lib/inngest/functions.ts#L59).

## Decisions that source inspection cannot answer

- **UNVERIFIED:** whether Maker’s House staff already have Clerk accounts, whether the desired staff role may see any financial pages, and whether Clerk Organizations are enabled in the account. [Role enum](prisma/schema.prisma#L19), [Clerk setup](src/app/layout.tsx#L1).
- **UNVERIFIED:** deployed database RLS, current media vendor/account, desired venue hierarchy, and live subscription entitlements. [Datasource](prisma/schema.prisma#L9), [IntegrationConnection](prisma/schema.prisma#L645), [Billing spec](docs/fable-5/spec-e-billing.md#L18).
- **UNVERIFIED:** whether the separate Stone Grille PHP admin already contains employee training. That code is outside this repository; the repository's current routes show no Team Hub implementation. [App routes](src/app/), [Repository scope](AGENTS.md).

## Spec A–E inventory and Spec F template

The existing specs do not share a single formal template. Their authoritative source files are:

| Spec | File path(s) | Shape |
|---|---|---|
| A | [`docs/PRODUCT-MAP.md`](docs/PRODUCT-MAP.md#L105); [`docs/fable-5/spec-a1-tax-vault.md`](docs/fable-5/spec-a1-tax-vault.md); [`docs/fable-5/spec-a2-cashflow-spending.md`](docs/fable-5/spec-a2-cashflow-spending.md) | Umbrella Spec A in the product map; separate A.1 and A.2 implementation specs. No standalone A.3/A.4 spec file found. |
| B | [`docs/PRODUCT-MAP.md`](docs/PRODUCT-MAP.md#L139) | Embedded after Spec A; no standalone Spec B file found. |
| C | [`docs/fable-5/SPEC-C-industry-manifest.md`](docs/fable-5/SPEC-C-industry-manifest.md); [`docs/fable-5/spec-c-review-upgrades.md`](docs/fable-5/spec-c-review-upgrades.md); companion [`docs/fable-5/SPEC-C2-connector-security.md`](docs/fable-5/SPEC-C2-connector-security.md) | Two documents labeled Spec C address different scopes; C2 is an explicit companion. Keep all three paths distinct when citing C. |
| D | [`docs/fable-5/SPEC-D-concierge-csv-spine.md`](docs/fable-5/SPEC-D-concierge-csv-spine.md) | Standalone spec organized into three parts, numbered subsections, and build order. |
| E | [`docs/fable-5/spec-e-billing.md`](docs/fable-5/spec-e-billing.md) | Standalone spec with status, branch, dependencies, convention, ten numbered sections, kickoff prompt, and manual setup. |

**Template choice:** [Spec E](docs/fable-5/spec-e-billing.md) has the most complete lifecycle structure for a new Spec F: decision status, dependencies, purpose, catalog, data model, flow, gates, pilot, admin operations, known debt, build order, testable completion checks, execution prompt, and operator setup. The block below copies its complete heading order and metadata field names *literally*. Billing-specific headings and fields are reference slots to rename for Team Hub; they are not claims that Team Hub needs a pricing catalog or a trial.

```md
# Spec E — Billing, Packaging & Founder Pricing

**Status:**
**Branch:**
**Dependencies:**
**Convention:**

---

## 1. Purpose
## 2. Pricing catalog (configured in Clerk dashboard, not code)
## 3. Data model (additive Prisma migration)
## 4. Sync flow
## 5. Gating
## 6. Virtual Pilot (trial)
## 7. Admin billing panel (`/admin/provisioning` extension)
## 8. Known debt (log, don't fix)
## 9. Build order
## 10. Definition of Done

---

## Claude Code kickoff prompt
## Manual setup (Sean, before session)
```

Spec E has no declared generic required-field schema. These are the **explicit fields and content slots it uses**, copied here so Spec F can mirror the level of detail without importing billing decisions:

| Spec E slot | Fields/content in the source | What Spec F should supply in the corresponding slot |
|---|---|---|
| Header | `Status`, `Branch`, `Dependencies`, `Convention`. | Decision status, proposed branch, prerequisite work, and working/review convention. |
| §1 Purpose | Concrete requirements and a stated source-of-truth/hard rule. | Team Hub outcome, actors, scope, and non-negotiable access/content rules. |
| §2 Pricing catalog | Table columns `Plan (Clerk slug)`, `Price`, `maxTenants`, `Features`; founder eligibility, exclusions, and no-hardcoded-prices rule. | Rename to Team Hub capability/entitlement catalog if useful; list audiences, capabilities, ownership, and gates. Pricing fields apply only if Spec F actually sets pricing. |
| §3 Data model | `TenantPlan`: `id`, `tenantId`, `plan`, `features`, `status`, `priceCents`, `cohort`, `maxTenants`, `currentPeriodEnd`, `billingOwnerId`, `graceUntil`, `createdAt`, `updatedAt`; feature slugs and source of truth. | List each proposed model, field, relation, tenant key, uniqueness constraint, lifecycle state, and data source of truth. Do not copy the billing model as Team Hub schema. |
| §4 Sync flow | Trigger/event, tenant resolution, idempotent update, status transitions, and catalog read path. | Capture/import/publish flow, tenant resolution, retry key, moderation transitions, and link/media delivery path. |
| §5 Gating | Separate `UI/routes`, `Server logic + Inngest`, `Degrade ladder`, and location-cap enforcement. | Separate visible navigation from server/job authorization; state role, tenant, plan, and access-removal rules. State any degraded mode only if desired. |
| §6 Virtual Pilot | Pilot start state, duration, end behavior, conversion path. | Pilot participants, duration, content seed, success measures, and exit decision. |
| §7 Admin billing panel | Admin actions and guardrails; `AdminActionLog` records actor, tenant, old price, new price, cohort, reason. | Manager content/review/assignment actions, permitted roles, audit fields, and forbidden actions. Billing audit fields are examples, not Team Hub requirements. |
| §8 Known debt | Explicit deferred limitations. | Open dependencies and deferred work, separate from release requirements. |
| §9 Build order | Ordered implementation steps ending in tests. | Small, reviewable delivery sequence and migration/deployment gates. |
| §10 Definition of Done | Checkboxes with observable behavior, grep gates, and Vitest gates. | Checkboxes for tenant isolation, employee access, lesson/media privacy, assignment completion, submissions, and practical pilot outcomes. |
| Kickoff / manual setup | A ready-to-paste implementation prompt and operator prerequisites. | Exact repository/spec references and any account/vendor setup Sean must perform before implementation. |

Source for the literal headings and fields: [Spec E header and purpose](docs/fable-5/spec-e-billing.md#L1), [catalog](docs/fable-5/spec-e-billing.md#L24), [model](docs/fable-5/spec-e-billing.md#L43), [flow and gates](docs/fable-5/spec-e-billing.md#L69), [pilot and admin](docs/fable-5/spec-e-billing.md#L87), [build and acceptance](docs/fable-5/spec-e-billing.md#L121), [kickoff and setup](docs/fable-5/spec-e-billing.md#L145).
