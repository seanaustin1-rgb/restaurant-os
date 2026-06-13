# Deploying Restaurant OS to Vercel (POC)

The app builds clean and the Supabase DB is migrated. Going live is a one-time
Vercel setup (~10 min). After this, **every push to `main` auto-deploys**.

> For a POC, keep the **Clerk test instance** and **Plaid sandbox** as-is — test
> keys work on a real `vercel.app` domain (sign in with code `424242`). Rotating
> to fresh production keys is a real-launch step (when Dwolla/real money goes on),
> not a POC blocker.

## 1. Import the repo
vercel.com → **Add New → Project** → import **`seanaustin1-rgb/restaurant-os`**.
Framework auto-detects as **Next.js**. No build/output overrides needed.

## 2. Environment variables (Production + Preview)
Copy each value from your local `.env.local`:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Supabase pooled connection |
| `DIRECT_URL` | Supabase direct (migrations) |
| `NEXT_PUBLIC_SUPABASE_URL` | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | |
| `CLERK_SECRET_KEY` | test instance is fine for POC |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/onboarding` |
| `ENCRYPTION_KEY` | AES-256 key for Plaid tokens at rest |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV` | sandbox for POC |
| `ANTHROPIC_API_KEY` | statement extraction |
| `RESEND_API_KEY` | |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | background jobs (Toast sync) |
| `TOAST_CLIENT_ID` / `TOAST_CLIENT_SECRET` / `TOAST_API_HOSTNAME` / `TOAST_RESTAURANT_GUID` | analytics tiles |
| `NEXT_PUBLIC_APP_URL` | **set to the Vercel URL** it assigns (e.g. `https://restaurant-os.vercel.app`) |

⚠️ **Do NOT add `INNGEST_DEV`** — it's in `.env.local` for local dev only; on Vercel
it would point the Inngest cloud at a dev server.

## 3. Deploy
Click **Deploy**. First build runs `prisma generate && next build` (the repo's
build script). DB is already migrated — no migration step needed at deploy.

## 4. After first deploy
- **Clerk origins** — if sign-in is blocked, add the Vercel domain in the Clerk
  dashboard → allowed origins/redirects (test instances usually accept any origin).
- **Inngest** — register the app's `/api/inngest` endpoint in Inngest Cloud so the
  daily Toast sync runs in prod (it's keyed by `INNGEST_SIGNING_KEY`).
- Sign in (`424242`), confirm `/dashboard`, the **COGS drill-down**, and
  **`/modules/allocation`** render against live data.

## Alternative: let the agent drive it
Run `vercel login` once in your terminal, then say so — the agent will
`npm i -g vercel`, `vercel link`, push the env vars, and `vercel --prod` from
the terminal, no dashboard clicking.

## Real-launch hardening (later, not POC)
Rotate to fresh production keys in Vercel (Clerk prod instance, Plaid
production, regenerate `ENCRYPTION_KEY` only if no Plaid tokens are stored yet),
and keep `INNGEST_DEV` unset.
