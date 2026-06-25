# AGENTS.md

Guidance for AI coding agents (OpenAI Codex, etc.) working in this repo. Codex
reads this file automatically for project context, conventions, and the commands
it should run to check its own work. Keep it accurate — stale instructions here
cause bad changes.

## Project

**Restaurant OS / OutFront Data** — a multi-tenant SaaS giving restaurant
operators financial intelligence (a Profit First allocation layer, leak-detection
tiles, reputation/"Aura", and a public prospect demo) on top of their bank
(Plaid) and POS (Toast) data.

- **Stack:** Next.js 14 (App Router) + TypeScript, Prisma (Postgres/Supabase),
  Clerk auth, Inngest crons, Tailwind, Vitest.
- **Production:** `main` auto-deploys to Vercel (`outfrontdata.com`). Treat `main`
  as prod and be deliberate about what merges into it.
- **Node:** v24 (matches CI). Use `npm` (there is a `package-lock.json`).

## Setup

```bash
npm install        # postinstall runs `prisma generate` automatically
```

A `.env.local` is needed to actually run the app; see `.env.example` for the
full list. Most checks below need no real secrets.

## Checks — run these before declaring work done

These mirror the CI gates in `.github/workflows/ci.yml`. A change is not "done"
until all three pass:

| Check      | Command              | Notes |
|------------|----------------------|-------|
| Typecheck  | `npx tsc --noEmit`   | First gate. Needs `prisma generate` (postinstall handles it). No DB required. |
| Tests      | `npm test`           | Vitest. Pure financial-core functions; dummy `DATABASE_URL` set in `vitest.config.ts`. No DB/secrets. |
| Build      | `npm run build`      | Full `next build`; catches server/client boundary + prerender errors that `tsc` can't. Runs with placeholder env only. |

> **Lint is NOT a working gate.** `npm run lint` (`next lint`) drops into an
> interactive "configure ESLint" prompt because there is no eslintrc. Do not rely
> on it. Initializing ESLint is a welcome improvement (see TODOs).

## Codebase map (highest-signal areas)

- `src/app/` — Next.js routes. `src/app/demo/` is the public no-login funnel;
  `/demo` and `/demo/tour` are intentionally public (allowlisted in
  `src/middleware.ts`). `src/app/api/` holds route handlers incl. `/api/inngest`.
- `src/lib/profit-first/` — the Profit First allocation calculator (financial core).
- `src/lib/modules/` — feature modules (leak detection, reputation/Aura trend, etc.).
- `src/lib/demo/` — demo estimate + separate demo Prisma client (`demo-prisma.ts`).
- `src/lib/inngest/functions.ts` — all scheduled crons (Plaid/Toast sync, demo
  reseed, reputation snapshot).
- `prisma/schema.prisma` — data model. Migrations live in `prisma/migrations/`.
- `src/middleware.ts` — Clerk auth + public-route allowlist.

## Conventions

- TypeScript throughout; match the surrounding file's style (imports, naming).
- Financial logic must stay covered by Vitest — add/extend tests in the
  `src/lib/profit-first` / `src/lib/modules` suites when you change calculations.
- The demo path must never read or write production data — it uses a **separate**
  demo database via `DEMO_DATABASE_URL` (`src/lib/demo/demo-prisma.ts`). Keep that
  isolation intact.

## Guardrails — do NOT do these without explicit human sign-off

- **Never run a production database migration** (`prisma migrate deploy` against a
  real `DATABASE_URL`/`DIRECT_URL`). Migrations against prod/demo Supabase are an
  operator action, not an agent action.
- **Never commit real secrets.** `.env.local` is gitignored; only placeholder
  values belong in committed files (see `ci.yml` and `.env.example`).
- Don't merge to `main` casually — it is production and auto-deploys to Vercel.

## When reviewing a diff (code-checking mode)

Prioritize, in order:
1. **Correctness** — logic bugs, especially in the financial calculators and any
   benchmark/allocation math.
2. **Tenant/data isolation** — anything that could leak one tenant's data, or let
   the demo path touch the production DB.
3. **Auth** — changes to `src/middleware.ts` or the public-route allowlist.
4. **Server/client boundary** — `next build` catches some; flag risky `"use
   client"` / server-only imports.
5. Then style/simplicity. Run the three checks above and report any failures.
