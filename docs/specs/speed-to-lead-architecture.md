# Speed-to-Lead Architecture

Purpose: define how a new lead goes from *created in BoldTrail* to *the agent's
phone ringing* in ~5 seconds, and how first-response time is captured and
reported — the engineering backbone behind the response-clock promise in the
agent app and broker cockpit.

Principle: **push, not poll.** Polling on an interval burns the speed-to-lead
window (call within ~5 min ≈ 20× more likely to qualify); a 60s poll spends a
fifth of that window before the agent even knows. Real-time webhooks spend ~5s
total. Poll only as a backstop.

Related: `agent-input-friction-boldtrail.md` (the BoldTrail bridge & response-time
capture), `src/lib/inngest/functions.ts` (job runner), the agent app response
clock (`src/app/demo/real-estate-cockpit/native/AgentApp.tsx`).

---

## 1. Ingestion — how the lead pushes in

### Primary: BoldTrail Smart Campaign webhook (confirmed real-time)

BoldTrail (formerly kvCORE) has **no global "New Lead" outbound webhook** setting.
Real-time push is configured through its **Smart Campaigns engine**:

1. Create/edit a Smart Campaign with **Start Logic / Standard Trigger = "Lead is New."**
2. Add a campaign action of type **Webhook**, pointed at our endpoint.
3. Toggle **Run Immediately** on that webhook action.

When a lead hits the CRM (IDX registration, lead dropbox, or API), the campaign
attaches instantly and POSTs the payload to us in real time (~1–3s).

> ⚠️ **Office Hours trap — must handle.** BoldTrail respects account "Office
> Hours" settings for automated outreach, and a webhook action is subject to
> them by default. Left as-is, **leads that arrive outside office hours (evenings,
> weekends — often the hottest) would be suppressed or delayed.** The webhook
> action must be configured to **ignore/bypass office-hour caps** for true
> 24/7/365 instant routing. This is a mandatory item on the per-account setup
> checklist, not optional.

### Redundancy: capture lead-source webhooks in parallel

Where possible, also receive the lead-source webhooks directly (Zillow,
realtor.com, FB Lead Ads, the IDX site). This gets the lead the instant it's
generated even if the BoldTrail campaign path lags, and de-risks single-source
dependence. Dedupe against the BoldTrail event by lead identity.

### Backstop: low-frequency poll

An Inngest cron polls the BoldTrail API every few minutes purely to catch any
webhook the endpoint missed (deploy blip, transient failure). It is a safety net,
**not** the primary path — never the mechanism response time depends on.

---

## 2. Endpoint & processing

```
BoldTrail / source webhook
  → Next.js API route (src/app/api/leads/route.ts)
       · verify signature
       · dedupe (idempotency key = lead external id)  ← retried deliveries must not double-fire
       · write Lead{ externalId, source, receivedAt }  (demo-DB tenant)
       · enqueue Inngest event  "lead/received"
  → 200 fast (ack the webhook immediately; do the work async)
```

`receivedAt` is the campaign/webhook lead-created timestamp — **this is where the
response clock starts.** Everything downstream measures against it.

---

## 3. Alerting — interrupt the agent (the make-or-break)

A lead in the dashboard is useless if the agent isn't looking at it. The
`lead/received` Inngest function fans out immediately:

| Channel | Role | Notes |
|---|---|---|
| **Push notification** (APNs/FCM) | Primary | *"New referral · Sam Ortega · call within 10 min."* Tap → opens the lead → one-tap call. |
| **SMS** (Twilio, ~$0.008/msg) | Co-primary / backup | Highest open rate; works even if the app isn't open or installed. |
| **Live in-app** (WebSocket/SSE) | If already in the dash | Lead pops to the top with a banner/sound; clock visibly starts. |
| **Auto-connect "press 1"** (optional upgrade) | Aggressive tier | System calls the agent, bridges to the lead. Sibling of paid click-to-dial. |

Target: **agent's phone buzzes within ~5 seconds of the lead existing.**

---

## 4. Response clock & escalation ladder

The same Inngest run schedules delayed steps (Inngest handles the sleep/resume
natively) so no lead dies silently. Thresholds mirror the response clock already
in the agent app:

| Elapsed since `receivedAt` | State | Action |
|---|---|---|
| **< 5 min**, untouched | green | Re-ping the agent (reminder) |
| **15 min**, untouched | yellow | Escalate — harder alert or notify a backup agent |
| **30 min**, untouched | red | Notify the broker |

Each step first checks whether a **first-touch** event has landed; if it has, the
ladder cancels. If not, it escalates.

---

## 5. First-touch capture → the metric

- **v1 (free):** "Call now" is a `tel:` deep link; the **tap is logged** as
  first-touch. Captures response time with zero agent typing, zero telephony cost.
- **v2 (upgrade):** click-to-dial (Twilio Voice, browser softphone) captures
  exact start, connect, **duration, outcome**, optional recording. ~$8–22/agent/mo
  depending on volume and softphone-vs-cell-bridge.

Every call normalizes to a `CallEvent { agentId, leadId, direction, initiatedAt,
connectedAt?, durationSec?, source }` under the tenant.

- **responseSeconds = firstTouchAt − receivedAt.**
- Per-agent rollups (median first-response, % within SLA, count breaching the red
  line) feed the **broker cockpit agent roster** — computed by the **deterministic
  engine**, never AI. AI only narrates ("Dana's referrals are going cold").

---

## 6. Reliability & isolation

- **Idempotency** on the inbound webhook (dedupe by lead external id) so retried
  deliveries don't double-alert.
- **Ack fast, work async** — the API route returns 200 immediately and hands off
  to Inngest; alert fan-out and escalation run in the background.
- **Poll backstop** (§1) catches missed webhooks.
- **Demo isolation** — all inbound leads land under the demo-DB tenant; production
  data is never read or written until per-tenant BoldTrail credentials are
  supplied. Demo writes only ever hit `DEMO_DATABASE_URL`.

---

## 7. Setup checklist (per brokerage)

1. Create the BoldTrail Smart Campaign: trigger **Lead is New** → **Webhook**
   action → **Run Immediately**, pointed at our endpoint.
2. **Configure that webhook action to bypass Office Hours** (24/7 routing).
3. (Optional) Add parallel lead-source webhooks for redundancy.
4. Register agent push tokens; verify SMS opt-in.
5. Confirm the poll-backstop cron is enabled.

---

## 8. Open items

- **Push infrastructure choice** — APNs/FCM direct vs. a provider (OneSignal, etc.).
- **BoldTrail write-back** — pushing call outcomes back to BoldTrail (needs the
  activity-write API scope); reporting lives in the dash regardless.
- **Office-hours bypass mechanism** — confirm the exact BoldTrail setting/flag
  that exempts a system webhook action from office-hour caps.
- **TCPA / recording consent** — outbound dialing at volume (consent, DNC scrub,
  calling hours) and call recording (two-party-consent states) apply once past
  tap-to-log into click-to-dial + recording.
