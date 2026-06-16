# Break-Even Runbook — pulling live data in a Claude Code web session

A step-by-step guide for getting Stone Grille's **break-even point** computed from live
data inside a Claude Code on the web session. Written because the web sandbox blocks the
normal database connection, so we reach the data a different way.

---

## TL;DR — what to paste into a fresh session

> **Goal: compute the break-even point for Stone Grille using live data.**
>
> Context you need (a fresh session has none of our history):
> - The DB's Postgres port is blocked by this sandbox's HTTP-only proxy, so **don't use
>   `psql`/Prisma/`DATABASE_URL`.** Instead query the **Supabase REST API over HTTPS**, which works.
> - Project URL: `https://rweclputxgwutykinlbr.supabase.co` — REST base is `.../rest/v1`.
> - The anon key is in the env var `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Send it as both
>   the `apikey` and `Authorization: Bearer` headers.
> - Tables are Prisma PascalCase names: `Restaurant`, `DailySales`, `Transaction`, `Category`.
>   Find the **Stone Grille** restaurant that actually has data (there's a known empty
>   duplicate — pick the one with `DailySales`/`Transaction` rows).
> - Read the existing break-even logic in `src/lib/modules/break-even.ts` and use that same
>   formula (break-even = fixed costs ÷ contribution margin; variable = COGS + labor;
>   fixed = OPEX + debt service).
> - **Important override:** ignore the cash-basis rent from bank transactions and use my
>   **contractual lease of $22,500/month** as the rent fixed cost.
>
> Pull the most recent ~8 weeks of net sales + labor (from `DailySales`) and COGS + fixed
> costs (from categorized `Transaction`s), then give me: break-even sales (monthly +
> per-day), my margin of safety, and how many dollars I'm above/below break-even. If the
> REST query returns empty because of row-level security, tell me and we'll sort out access.

---

## One-time setup (in the Claude Code environment, NOT Supabase)

These live at **claude.ai/code → cloud/environment icon (top of session) → edit**. They are
a *different* place from the Supabase dashboard. Both only take effect when a **new session
starts**, so set them, then open a fresh session.

1. **Network access = Custom**, add `*.supabase.co` to **Allowed domains** (keep the default
   package-manager list checked). Without this the sandbox proxy returns
   `Host not in allowlist`.
2. **Environment variable** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the Supabase **anon /
   publishable** key (Supabase dashboard → Project Settings → API Keys → `anon` `public`).
   This key is public/safe to share; the `service_role` key is NOT — don't use that one.

---

## Why the normal path doesn't work here

- The web sandbox routes all egress through an **HTTP/HTTPS-only proxy**. Raw Postgres
  (ports 6543 pooler / 5432 direct) never makes it out — connections time out — and the
  direct host is IPv6-only, which the sandbox doesn't support.
- HTTPS (443) *does* get out, and Supabase exposes a **PostgREST API** over HTTPS, so we
  query that instead of connecting to Postgres directly.
- This means `psql`, `prisma`, and any script using `DATABASE_URL` will fail in a web
  session. They work fine in a **local terminal**, which is the alternative if you'd rather
  run the real app code (`loadBreakEven`) end-to-end.

## The break-even math (for reference)

From `src/lib/modules/break-even.ts`:

```
Contribution Margin (CM) = 1 − (variable cost ÷ net sales)
Break-even Sales         = Fixed Costs ÷ CM
```

- **Variable** = COGS (food + liquor + beer) + Labor — i.e. Prime Cost.
- **Fixed** = Operating Expenses (OPEX) + Debt Service.
- **Lease override:** the module reads rent **cash-basis** (whatever cleared the bank),
  which misstates a lumpy/partial/prepaid month. Use the **contractual $22,500/month**
  instead for an honest, stable number.

## If the REST query returns empty rows

That means Supabase **row-level security (RLS)** is blocking the anon role. Options:
- Confirm the tables are exposed and the anon role has `SELECT` (Prisma-created tables
  usually inherit Supabase's default grants, but verify).
- Fall back to running in a **local terminal** with `DATABASE_URL`, where RLS/role grants
  aren't in the way.
