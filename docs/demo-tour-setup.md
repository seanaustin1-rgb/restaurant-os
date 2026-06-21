# Live demo tour (`/demo/tour`) — setup

The public Mode-1 tour renders the **full dashboard** for a sample "Demo Bistro"
with no login. To keep production clean, the demo lives in a **separate
database** — the app's production database is never used for demo data.

- **Runtime (the `/demo/tour` page):** reads **only** from `DEMO_DATABASE_URL`. It
  never writes. If `DEMO_DATABASE_URL` is unset or unseeded, the page shows a
  friendly "being prepared" state.
- **Seeding:** a deliberate, operator-run script that writes **only** to
  `DEMO_DATABASE_URL` and refuses to run without it — so it can never touch prod.

## One-time setup

1. **Create a separate Supabase project** (free tier is fine), e.g. `outfront-demo`.
   From its connection settings, copy:
   - the **pooled** connection string (port `6543`) → used as `DEMO_DATABASE_URL`
   - the **direct** connection string (port `5432`) → used for migrations

   > **Password gotcha:** Supabase shows the password as `[YOUR-PASSWORD]` — replace it
   > with the real password and do **not** keep the `[ ]` brackets. Use a password with
   > only letters and numbers (or URL-encode any symbols), or auth fails with `P1000`.

2. **Create the schema on the demo database** (uses the direct 5432 connection):
   ```sh
   DATABASE_URL="<demo-direct-5432>" DIRECT_URL="<demo-direct-5432>" npx prisma migrate deploy
   # (or, for a quick sync:  ... npx prisma db push)
   ```

3. **Add the runtime env var** to Vercel (Production) **and** local `.env.local`. The
   pooled (6543) URL **must** carry `?pgbouncer=true` or Prisma errors with
   `42P05 prepared statement "s0" already exists`:
   ```
   DEMO_DATABASE_URL="<demo-pooled-6543>?pgbouncer=true&connection_limit=1"
   ```

4. **Seed the Demo Bistro** (writes only to `DEMO_DATABASE_URL`):
   ```sh
   npx dotenv -e .env.local -o -- tsx scripts/seed-demo-tour.ts
   ```

5. **Redeploy.** Visit `/demo/tour` — the full sample dashboard renders.

## Keeping it fresh

`seedDemoData` seeds the **current** month, so after a month rollover re-run
step 4 to refresh the demo. (Idempotent — it clears its own prior seed.)

## Why it's safe

- The tour route imports a **second** Prisma client (`lib/demo/demo-prisma.ts`)
  bound to `DEMO_DATABASE_URL`; the production client is never used for demo data.
- `seedDemoBistro()` throws if `DEMO_DATABASE_URL` is missing, so seeding can
  never write to the production database.
