# Light up a populated demo

The dashboard renders **live** data, so a fresh tenant shows empty "connect a
source" states. To see it fully populated **without** wiring Plaid or Toast,
seed a demo tenant with a month of realistic sales + categorized spend.

## Fastest path — seed your signed-in restaurant (deployed or local)

The seed runs as a CLI against whatever database `DATABASE_URL` points at, so it
works on the **deployed** app too (the in-app dev seed route is disabled in
production on purpose).

1. **Get your Clerk user id.** Clerk dashboard → Users → your user → copy the
   `user_…` id. (This links the demo tenant to your login so it appears on
   `/dashboard`.)

2. **Run the seed** against the target database:

   ```bash
   # Against the production/deployed DB (use that environment's DATABASE_URL):
   DATABASE_URL="postgresql://…" DIRECT_URL="postgresql://…" \
     npm run seed:demo -- --user user_xxxxxxxxxxxxxxxx

   # Or locally, reading .env.local:
   npx dotenv -e .env.local -o -- tsx scripts/seed-demo.ts --user user_xxxxxxxxxxxxxxxx
   ```

   It creates a **"Demo Bistro"** (or reuses your existing restaurant) with an
   `OPERATOR` role for you, then seeds **31 days of May 2026** sales + ~30
   categorized transactions.

3. **Open `/dashboard`.** Heartbeat, Revenue, TAP gauges, Break-even, Prime
   Cost, Benchmarks, etc. are all populated.

### Flags

| Flag | Purpose |
|---|---|
| `--user <clerkUserId>` | Attach an `OPERATOR` role so the tenant shows on that login. |
| `--restaurant <id>` | Seed into an existing restaurant instead of creating one. |
| `--name <name>` | Name for a newly created restaurant (default `Demo Bistro`). |

Re-running is **idempotent** — it clears its own prior seed for that
restaurant/month first, so you can run it repeatedly.

## What it does *not* set up

- **Reputation (Aura)** needs real review-API keys (`GOOGLE_*` / `YELP_*` /
  `META_*`) — the seed can't fabricate those, so the Aura meter stays in its
  "connect a source" state. See `.env.example`.
- **Toast POS tiles** (item-level food cost, etc.) need the `TOAST_*` creds.

## Going from demo to real data

When you're ready to replace seeded numbers with the operator's actuals: connect
a bank via Plaid (sandbox in POC, production at launch) and/or Toast, then sync.
The seeded rows are tagged `source: "seed"` / `plaidTxnId: seed-…` so they're
easy to identify and clear. For the production launch checklist, see
[`LAUNCH.md`](./LAUNCH.md).
