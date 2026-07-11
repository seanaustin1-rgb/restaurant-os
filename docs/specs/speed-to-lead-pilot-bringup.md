# Speed-to-Lead — Pilot Bring-Up Runbook

Purpose: the exact, ordered steps to take the speed-to-lead MVP from "builds and
logs" to "a real lead lights up a real phone." Written so the whole demo can run
on **your own accounts** — you do not need a signed customer to stand up a live,
dialing demo. Only two steps genuinely require the design partner (their
BoldTrail account and one agent's mailbox); everything else is self-serve.

Audience: operator (you). Keep this next to `speed-to-lead-architecture.md`
(how it works) and `agent-app-information-architecture.md` (what the agent sees).

---

## The gating model

Every provider integration is a **gated adapter**: the deterministic core (response
clock, escalation ladder, first-touch stamping, AI draft) always runs and logs;
the provider call is a no-op until its env vars are present. So the app is fully
functional today — it just logs `(… not configured)` instead of ringing a phone.
Adding each key flips that adapter from *log* to *dispatch* with **no code change**.

Two helpers decide this at runtime:

- `dialingAvailable()` — true once `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` +
  `TWILIO_FROM` are set (`src/lib/realestate/dial.ts`).
- `notificationsAvailable()` — true once `ONESIGNAL_APP_ID` + `ONESIGNAL_API_KEY`
  are set (`src/lib/realestate/notify.ts`).

> Status of each dispatch path (what "add the key" actually does today):
> - **AI drafting — fully wired.** The moment `ANTHROPIC_API_KEY` is set, the
>   agent app shows a **Draft reply** button that calls Claude and drops a real
>   DRAFT into "Drafts to approve." No further code needed.
> - **OneSignal push — fully wired.** With the keys set, the agent app registers
>   the device (`PushRegistration` → `OneSignal.login(agentId)`) and the
>   escalation ladder pushes for real via the OneSignal REST API, targeting the
>   agent by external id. No further code needed.
> - **Twilio dialer/SMS — key + one small wire-up.** The keys flip the adapter to
>   the dispatch branch; the actual Twilio call is the remaining `TODO(pilot)`
>   line I finish once I can test against your live account (minutes).

---

## What you can do yourself, now (no customer needed)

| Capability            | Provider   | Self-serve? | Env vars |
| --------------------- | ---------- | ----------- | -------- |
| AI reply drafting     | Anthropic  | ✅ (you likely already have a key) | `ANTHROPIC_API_KEY`, optional `REALESTATE_DRAFT_MODEL` |
| Cell-bridge dialer    | Twilio     | ✅ free trial | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| SMS alerts            | Twilio     | ✅ same account | (same three) |
| Push alerts           | OneSignal  | ✅ free tier | `ONESIGNAL_API_KEY` (App ID already committed) |
| Webhook auth          | (you set)  | ✅ pick a secret | `BOLDTRAIL_WEBHOOK_SECRET` |

Optional: `NEXT_PUBLIC_APP_URL` (your deployed origin) so a push tap deep-links
straight into `/realestate/agent`.

## What truly needs the design partner

| Capability                | Needs from partner |
| ------------------------- | ------------------ |
| Real BoldTrail lead push  | Their BoldTrail account → Smart Campaign webhook pointed at us (see architecture spec §1). Also lets me confirm the exact payload shape in `normalizeBoldTrailLead`. |
| Send-from-agent's-inbox   | One agent consents to Gmail/Outlook OAuth so approved drafts send from *their* address. |

Until those two land, fire a **test lead** yourself (below) and the whole loop
runs on your accounts.

---

## Order of operations

### 1. Pick a webhook secret (2 min)

Choose any long random string. This authenticates the BoldTrail receiver; the
endpoint **fails closed** (503) if it's unset, so this is required even for a
self-fired test lead.

```
BOLDTRAIL_WEBHOOK_SECRET=<long-random-string>
```

### 2. Twilio (≈10 min, free trial)

1. Sign up at twilio.com → the trial gives you a Console with **Account SID** and
   **Auth Token** on the dashboard.
2. Buy/claim a phone number (trial includes one) with **Voice + SMS**.
3. On a trial account you must **verify** any number you'll dial or text (your own
   cell) under *Phone Numbers → Verified Caller IDs*. Paid removes this.
4. Set:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_FROM=+1XXXXXXXXXX        # your Twilio number, E.164
```

For v1 the dialer bridges from a single shared `TWILIO_FROM`; per-agent dedicated
numbers aren't modeled yet (`initiateCall` falls back to `TWILIO_FROM`). That's
fine for the demo — calls originate from your Twilio number.

### 3. OneSignal (≈10 min, free tier)

1. Sign up at onesignal.com → create an app → add a **Web** platform ("Typical
   Site"): Site URL = your origin, leave the service-worker settings on defaults
   (a root `OneSignalSDKWorker.js` already ships in `public/`).
2. Copy the **REST API Key** from *Settings → Keys & IDs*.

The pilot **App ID (`fa9269c1-f248-4e5d-a489-91f5f17b933b`) is already committed**
in `src/lib/realestate/onesignal.ts` (it's a public identifier), so the only env
var you must set is the secret:

```
ONESIGNAL_API_KEY=xxxxxxxx                         # REQUIRED — secret, server only
NEXT_PUBLIC_ONESIGNAL_APP_ID=xxxxxxxx-xxxx-xxxx    # optional — only to override the committed App ID
```

How it wires up (already built):
- The agent app renders `PushRegistration`, which loads the OneSignal v16 SDK
  (from their CDN — no npm dep), calls `OneSignal.login(agentId)` to bind the
  device to the agent, prompts for permission, and persists enrollment via the
  `confirmAgentPush` server action (sets `BrokerageAgent.pushExternalId`).
- The escalation ladder's `sendLeadAlert` POSTs to the OneSignal REST API with
  `include_external_user_ids: [agentId]`, so each rung (new → reminder → backup
  → broker) pushes to the right agent. Unassigned leads log instead of pushing.
- The service worker lives at `public/OneSignalSDKWorker.js`.

All of it no-ops cleanly until `NEXT_PUBLIC_ONESIGNAL_APP_ID` (client) and
`ONESIGNAL_APP_ID`/`ONESIGNAL_API_KEY` (server) are present.

### 4. Anthropic (already yours)

```
ANTHROPIC_API_KEY=sk-ant-...
REALESTATE_DRAFT_MODEL=claude-sonnet-5   # optional; this is the default
```

The moment a key is present, `draftMessage()` produces real Fair-Housing/TCPA-aware
drafts instead of the gated stub.

### 5. Where the vars go

- **Local dev:** `.env.local` (git-ignored). Run with the repo's usual
  `npx dotenv -e .env.local -o -- …` convention.
- **Vercel:** Project → Settings → Environment Variables. Add each to Preview
  (for the PR's preview URL) and Production. Redeploy so they take.

---

## No-terminal bring-up (migrations + data)

For operators without a local dev setup, the whole thing comes up from the
browser + Vercel dashboard — no terminal:

1. **Migrations apply themselves on deploy.** The build runs
   `scripts/vercel-migrate.mjs` → `prisma migrate deploy`, but *only* on a Vercel
   **production** build with `DATABASE_URL` set (preview/local skip). So a
   production deploy (merging to `main`) creates the `Lead`/`CallEvent`/
   `MessageEvent` tables automatically. Make sure `DATABASE_URL` and — for
   migrations — a direct (non-pooled) `DIRECT_URL` are set in the Production env.
2. **Seed your pilot data with one URL.** Set a one-time secret in the env:

   ```
   PILOT_BOOTSTRAP_TOKEN=<long-random-string>
   ```

   Then, **signed in**, open:

   ```
   /api/realestate/dev/bootstrap?token=<PILOT_BOOTSTRAP_TOKEN>&name=Your%20Brokerage
   ```

   It creates a `REAL_ESTATE_BROKERAGE` tenant, attaches you as **BROKER**, links
   you to a `BrokerageAgent`, and seeds a small fictitious lead spread. Idempotent
   — reuses a brokerage you already belong to and only seeds once. The endpoint
   **fails closed** (503) whenever `PILOT_BOOTSTRAP_TOKEN` is unset, so **remove
   the token from the env once you're set up** to close the door.
3. Open `/realestate/broker` and `/realestate/agent` — both now render populated.

---

## Fire a test lead (proves the loop end-to-end, no BoldTrail)

**Easiest: the in-app button.** On `/realestate/broker` (signed in as
broker/operator/manager) there's a **Fire test lead** button — it pushes a
synthetic lead through the *real* ingest pipeline, assigns it to the tenant's
first agent, and refreshes the roster. No curl, no secret handling. Use this for
demos.

**Or by curl** (simulates exactly what BoldTrail POSTs). Replace `<tenant>` with a
`REAL_ESTATE_BROKERAGE` Restaurant id and `<secret>` with your
`BOLDTRAIL_WEBHOOK_SECRET`.

```bash
curl -X POST "https://<preview-or-prod-host>/api/realestate/leads/boldtrail?tenant=<tenant>&secret=<secret>" \
  -H "content-type: application/json" \
  -d '{"lead":{"id":"test-001","first_name":"Jordan","last_name":"Buyer","email":"jordan@example.com","phone":"+15551234567","source":"IDX"}}'
```

Expected chain:
1. `RawSourceEvent` upserted, `Lead` created, `realestate/lead.received` fired.
2. Inngest `leadReceivedAlert` runs: alert primary → +5m reminder → +15m escalate
   BACKUP → +30m escalate BROKER, **cancelled the instant `firstTouchAt` is set**.
3. With Twilio/OneSignal keys present those alerts dispatch; without, they log.
4. Open `/realestate/agent` (as the linked agent) → the lead shows band-colored
   and untouched; **Call now** stamps first touch and stops the clock.
5. `/realestate/broker` → the lead flows into the roster + speed-to-lead scorecard.

Re-POSTing the same `id` is idempotent (dedup on
`restaurantId + sourceSystem + externalId`) and never overwrites the clock.

To exercise it without deploying, the demo seed
(`scripts/seed-demo-brokerage.ts`, `seedLeadPipeline`) creates a spread of leads
with realistic response times against `DEMO_DATABASE_URL`.

---

## The two customer-side steps, when you sign York PA

1. **BoldTrail webhook** — in their account, build a Smart Campaign:
   trigger *"Lead is New"* → action **Webhook** → **Run Immediately**, URL =
   `https://<host>/api/realestate/leads/boldtrail?tenant=<their-tenant>&secret=<secret>`.
   Must **bypass Office Hours** or after-hours leads won't fire (see architecture
   spec §1). Send me one real captured payload and I'll confirm the field mapping
   in `normalizeBoldTrailLead` — it's built defensively, so this is a one-file tweak.
2. **Agent mailbox** — the one pilot agent completes Gmail/Outlook OAuth so
   approved drafts send from their own address (never a shared/covert inbox).

---

## Definition of done (from the MVP brief)

- Median first response **< 2 min** (`SPEED_TO_LEAD_TARGET_SEC = 120`, surfaced on
  the broker scorecard).
- **90%+ agent adoption** — measured by touches coming through the app vs. leaks.
- Broker has **lead-leakage visibility** — the roster is worst-first (most
  escalated-to-broker, then slowest median), so leakage is the top row, not buried.

---

## Compliance owner = you (unchanged)

Fair Housing, TCPA/DNC consent for SMS + dialing, and two-party-consent are yours
to sign off before live outreach. v1 deliberately does **no call recording** to
sidestep two-party-consent. The AI draft prompt is Fair-Housing/TCPA-aware but is
an assist, not a legal guarantee — the agent approves every send.
