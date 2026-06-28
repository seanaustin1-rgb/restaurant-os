# Consultant Onboarding — Restaurant OS / OutFront Data

A fast start for an external reviewer. Assumes you've accepted the GitHub
collaborator invite to `seanaustin1-rgb/restaurant-os`.

> The full run/gotchas reference lives in the root [`README.md`](../README.md).
> This page is just the "start here" + a guided tour. Read it first.

---

## 1. Get it running (~15 min)

```bash
git clone https://github.com/seanaustin1-rgb/restaurant-os.git
cd restaurant-os
node -v          # expect 24.x
npm install
npx prisma generate
npm run dev      # http://localhost:3000
```

**The one missing piece: `.env.local`.** It's git-ignored on purpose (it holds
all secrets), so it is NOT in the repo you cloned. You'll receive it through a
**secure channel** (password manager / encrypted note) — never plaintext email
or chat. Drop it in the repo root before `npm run dev`.

If you only want to see the app behave (not develop against live data), use the
**fully isolated sandbox** instead of the production `.env.local` — see
[Sandbox setup](#sandbox-setup-isolated-zero-production-exposure) below.

### Windows / PowerShell notes
- If `npx`/`prisma` fail with *"running scripts is disabled"*, run once:
  `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
- Prisma ignores `.env.local`; use the wrappers: `npm run db:studio`, `db:push`.
- The DB schema is already migrated on Supabase — you do **not** run migrations to develop.

---

## 2. See how it operates — a guided tour

Public routes (no login needed):
- **`/heartbeat`** — the product landing / positioning.
- **`/demo`** — no-login instant-estimate: enter a few averages → a partial,
  personalized dashboard with locked tiles for bank/POS data. This is the
  fastest way to see the core "surface the signal, show the math" idea.

Authenticated app (needs Clerk login — use a Clerk test email
`you+clerk_test@example.com`, code `424242` on a dev instance):
- The operator **dashboard** is the heart of the product.

### Where the logic lives (read in this order)
| Concern | Path |
|---------|------|
| Domain logic root | `src/lib/` |
| Bank-statement import (incl. AI extraction) | `src/lib/import/` |
| Vendor → Profit First bucket categorization | `src/lib/categorization/` |
| Profit First / TAP calculator | `src/lib/profit-first/` |
| Break-even math (pure fn) | `src/lib/modules/break-even.ts` |
| Dashboard data loader | `src/lib/dashboard/` |
| API routes | `src/app/api/` (`/import`, `/plaid/*`, `/inngest`) |
| Background jobs / crons | Inngest functions wired at `/api/inngest` |
| DB schema | `prisma/schema.prisma` |

### Product direction (for context, not code)
- `docs/specs/heartbeat-go-live-readiness.md` — the Observe → Simulate → Coach → Pilot → Enforce path.
- `docs/specs/transaction-categorization-v2.md` — the next big build.
- `docs/BREAK-EVEN-RUNBOOK.md`, `docs/DEMO.md` — operational walkthroughs.

---

## 3. Verify your setup is healthy

```bash
npm run check:launch     # launch/smoke checks
npm run test             # vitest unit suite
npm run lint             # next lint
```

If those pass and `/heartbeat` renders at `localhost:3000`, you're fully set up.

---

## Sandbox setup (isolated, zero production exposure)

Stand up your **own** copy of each external service so nothing touches production.
A ready-to-fill template lives at [`.env.sandbox.example`](../.env.sandbox.example).

**To just *see the app operate*, you only need three things** — the seed script
renders a full dashboard without Plaid or Toast:

1. **Database** — create a free **Supabase** project. From Project Settings →
   Database, copy the **pooled** (port 6543) string into `DATABASE_URL`
   (append `?pgbouncer=true`) and the **direct** (port 5432) string into `DIRECT_URL`.
2. **Auth** — create a free **Clerk** application; use the **Development** instance
   keys (`pk_test_…` / `sk_test_…`). Dev instances accept the test login
   `you+clerk_test@example.com`, code `424242`.
3. **`ENCRYPTION_KEY`** — a fresh sandbox value is pre-filled in the template.
   Regenerate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

Then:

```bash
cp .env.sandbox.example .env.local         # fill in the <PLACEHOLDERS>
npx prisma generate
npx dotenv -e .env.local -- prisma migrate deploy   # builds the schema on your fresh DB
npm run dev                                # http://localhost:3000
```

Sign in once (creating your Clerk user), grab your **Clerk user ID** from the
Clerk dashboard, then seed a populated tenant attached to that login:

```bash
npx dotenv -e .env.local -o -- tsx scripts/seed-demo.ts --user <yourClerkUserId>
```

Reload `/dashboard` — it renders with realistic sales + categorized transactions.

### Exercising specific live flows (optional)
- **Bank-connect:** add **Plaid sandbox** keys, set `PLAID_ENV=sandbox`, link with test creds `user_good` / `pass_good`.
- **AI statement import:** add your **own** `ANTHROPIC_API_KEY`.

### About `ENCRYPTION_KEY` — "the key for the secrets"
`ENCRYPTION_KEY` is AES-256-GCM for **secrets at rest in the database** — currently
Plaid access tokens and Google Business Profile OAuth tokens (`src/lib/crypto.ts`).
It does **not** encrypt the other `.env` values (those are plain env vars); it only
protects integration tokens the app stores per-tenant.

Key facts:
- **The key must match the data it encrypted.** A token encrypted with key A can
  only be decrypted with key A — otherwise `decrypt()` throws (auth-tag mismatch).
- **In the sandbox, your own fresh key gives full functionality.** You connect your
  own (sandbox) Plaid/Google, the app encrypts those tokens with your key, and
  decrypts them with the same key. Self-contained — you never need production's key.
- **You'd only need the *production* `ENCRYPTION_KEY` to decrypt *production's* stored
  tokens** (i.e. running against the live DB). That's the crown-jewels path and is
  intentionally out of scope for sandbox review — don't request it.
- Each environment has its **own** key; they are not interchangeable, and rotating a
  key orphans previously-encrypted tokens (integrations must be reconnected).

---

## 4. Security expectations
- **Never commit `.env.local`** or any real key. It's git-ignored; keep it that way.
- Treat shared credentials as sensitive; if any key is exposed, tell the owner so it can be rotated.
- Don't point local dev at the **production** database with write access — request a dev DB or read-only role if you need real-shaped data.
