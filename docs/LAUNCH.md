# Launch readiness — going from POC to real production

This is the **go-live checklist** for taking Restaurant OS from the POC
configuration (Clerk test instance, Plaid sandbox) to a real production launch
where real bank data and real money are involved.

Most of these are actions in external dashboards (Vercel, Clerk, Plaid, Inngest,
your DNS host) — the repo can't do them for you, but it can **verify** them:

```bash
# Load your production env, then:
npm run check:launch
```

`check:launch` reports each item below as ✓ (ready), ! (POC-fine, fix before
real money), or ✗ (blocking). It exits non-zero on any ✗, so you can wire it
into a deploy step. It is deliberately **not** in CI — CI builds with placeholder
env on purpose.

---

## 0. Prerequisite — the app deploys (already true)

- [x] `main` auto-deploys to Vercel; preview deploys on every PR.
- [x] CI gates every PR: **Typecheck**, **Test** (financial core), **Build**
      (production `next build`).

## 1. Authentication — Clerk test → production instance

- [ ] Create a **production** Clerk instance (separate from the test one).
- [ ] Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_live_…`) and
      `CLERK_SECRET_KEY` (`sk_live_…`) in Vercel (Production scope).
- [ ] Add the production domain to Clerk's **allowed origins / redirect URLs**.
- [ ] Confirm the magic test code (`424242`) no longer works — real auth is live.

> `check:launch`: **clerk-instance** turns ✓ only on `pk_live_`/`sk_live_`.

## 2. Bank data — Plaid sandbox → production

- [ ] Obtain Plaid **production** access (approval required).
- [ ] Set `PLAID_ENV=production` plus the production `PLAID_CLIENT_ID` /
      `PLAID_SECRET` in Vercel.

> `check:launch`: **plaid-env** is ✓ only when `PLAID_ENV=production`.

## 3. Secrets at rest — `ENCRYPTION_KEY`

Plaid access tokens are stored encrypted with AES-256 using `ENCRYPTION_KEY`.

- [ ] Generate a real 32-byte key: `openssl rand -hex 32`.
- [ ] Set it in Vercel **before** any real Plaid token is stored. Rotating it
      later orphans already-encrypted tokens (re-link required).
- [ ] Never ship the all-zeros placeholder from `.env.example`.

> `check:launch`: **encryption-key** fails on the placeholder or a non-64-hex value.

## 4. Background jobs — Inngest

- [ ] Register the app's `/api/inngest` endpoint in **Inngest Cloud** so the
      daily Toast sync runs in production (keyed by `INNGEST_SIGNING_KEY`).
- [ ] Ensure `INNGEST_DEV` is **unset** in Vercel (it's for local dev only; in
      prod it would point Inngest Cloud at a dev server).

> `check:launch`: **inngest-dev** fails if `INNGEST_DEV` is set.

## 5. Domain & app URL

- [ ] Point your domain (recommended: a subdomain like `app.yourdomain.com`) at
      Vercel — see `DEPLOY.md` §5 for the exact Bluehost DNS records.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the public `https://` URL and redeploy.
- [ ] Add the domain to Clerk's allowed origins (step 1).

> `check:launch`: **app-url** warns on `http://` or `localhost`.

## 6. Required configuration present

These must all be set for the app to boot and run in production: `DATABASE_URL`,
`DIRECT_URL`, Clerk keys, Supabase URL + key, `ENCRYPTION_KEY`, Plaid
client/secret/env, Inngest event + signing keys, `RESEND_API_KEY`,
`NEXT_PUBLIC_APP_URL`.

> `check:launch`: **required-env** lists anything missing.

## 7. Optional integrations (degrade gracefully — not launch blockers)

- **Toast** (`TOAST_*`) — POS metrics tiles. Dark until all four vars are set.
- **Aura** (`GOOGLE_*`, `YELP_*`, `META_*`/`FACEBOOK_*`) — reputation meter.
  Each source lights up independently; absent ones show "connect" cards.
- **Anthropic** (`ANTHROPIC_API_KEY`) — AI extraction of scanned statements.

## 8. Before real money (hardening)

- [ ] Re-run `npm run check:launch` — expect **PRODUCTION-READY** (no ✗, no !).
- [ ] Confirm a real bank link + sync populates the dashboard.
- [ ] Verify the daily Toast sync fires in Inngest Cloud.
- [ ] Smoke-test sign-in, `/dashboard`, the COGS drill-down, and
      `/modules/allocation` against live data.
