# Restaurant OS

Multi-tenant restaurant-operator intelligence SaaS with a **Profit First** cash-management layer.
Unifies POS + bank + food-cost data into one operator dashboard, productized for sale.

**Stack:** Next.js 14 (App Router, TS) · Tailwind · Postgres (Supabase) + Prisma · Clerk (multi-tenant auth) · Plaid · Inngest · Resend · Vercel

---

## Run it on another machine

### 1. Prerequisites
- **Node.js 24.x** (`node -v`). On Windows it may install off-PATH — reopen your terminal or add it to PATH.
- Access to the shared **Supabase** project (the DB the app connects to) and the API keys below.

### 2. Clone & install
```bash
git clone https://github.com/seanaustin1-rgb/restaurant-os.git
cd restaurant-os
npm install
```

### 3. Environment
`.env.local` holds all secrets and is **git-ignored on purpose** — it is NOT in this repo. You must provide it:
- Copy your `.env.local` from your main machine (via a password manager / encrypted note — never plaintext email), **or**
- Use `.env.example` as the template and fill in the keys.

Required keys: `DATABASE_URL`, `DIRECT_URL` (Supabase), `NEXT_PUBLIC_CLERK_*` + `CLERK_SECRET_KEY`, `PLAID_*`, `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY` (AI statement import), `INNGEST_*`. See `.env.example`.

### 4. Generate the Prisma client & run
```bash
npx prisma generate
npm run dev            # http://localhost:3000
```
The database schema is already migrated on Supabase — you do **not** need to run migrations to develop. (If you change `schema.prisma`, see Migrations below.)

---

## Working notes / gotchas
- **Never commit `.env.local`** (or any real keys). It's git-ignored; keep it that way.
- **PowerShell execution policy** (Windows): if `npx`/`npm`/`prisma` fail with *"running scripts is disabled on this system"*, the `.ps1` shims are blocked. One-off fix: call the `.cmd` shim (`npx.cmd dotenv …`). Durable fix (run once): `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
- **Prisma CLI ignores `.env.local`** — run Prisma commands through dotenv: `npx dotenv -e .env.local -- prisma <cmd>`. Convenience scripts: `npm run db:migrate`, `db:push`, `db:studio`.
- **Pooled writes:** Supabase uses PgBouncer (transaction pooler). Use **batched** `prisma.$transaction([...])`, never interactive `$transaction(async tx => ...)` — the latter times out on the pooler.
- **Migrations:** `migrate dev` is interactive; prefer `--create-only` then hand-edit + `npx dotenv -e .env.local -- prisma migrate deploy`. Enum-value additions are `ALTER TYPE ... ADD VALUE`.
- **Auth testing:** Clerk's dev-browser handshake means `curl`/CLI can't fully test protected pages — verify auth flows in a real browser. Clerk test emails (`you+clerk_test@example.com`, code `424242`) skip email verification on dev instances.

## Layout
- `src/app` — App Router pages + API routes (`/api/import`, `/api/plaid/*`, `/api/inngest`)
- `src/lib` — domain logic: `import/` (statement extraction incl. AI), `categorization/` (vendor → bucket), `profit-first/` (TAP calculator), `dashboard/` (data loader)
- `prisma/` — schema + migrations
- `scripts/` — dev/verification tooling (TS, run via `npx dotenv -e .env.local -- tsx scripts/<file>.ts`)
- `docs/specs/` — product specs (see `transaction-categorization-v2.md`)

## Status & roadmap
Longer-term product direction is captured in `docs/specs/heartbeat-go-live-readiness.md`: the Observe -> Simulate -> Coach -> Pilot -> Enforce path, including Go-Live Coach and Aura market-energy enrichments.

Tier-3 AI bank-statement import is live (Claude structured extraction of scanned PDFs → categorized transactions → Profit First dashboard). Next up: the **configurable two-level categorization** system — see `docs/specs/transaction-categorization-v2.md`.

<!-- codex smoke test: safe to delete -->
