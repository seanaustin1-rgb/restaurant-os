# Agent-Input Friction & the BoldTrail Bridge

Purpose: turn the real-estate agent dashboard into the surface agents *want* to
open every morning, so that broker visibility is harvested as a byproduct of the
agent doing their job — instead of demanded through data entry the way BoldTrail
(kvCORE) demands it today.

Audience: design-partner brokerage whose investor/broker reports **low BoldTrail
usage because it is cumbersome**, which leaves the broker blind to what agents
are actually doing.

Related: `real-estate-brokerage-data-foundation.md` (data model),
`brokerage-data-sources.md` (source map). Dashboard component:
`src/app/demo/real-estate-cockpit/native/AgentApp.tsx`. Performance engine:
`src/lib/demo/real-estate-agent-performance.ts`.

---

## 1. The problem, stated precisely

BoldTrail is **input-first**: it asks the agent to log calls, advance stages, tag
contacts, and schedule follow-ups. The payoff of that work — a clean pipeline the
*broker* can see — accrues to someone else, later. The agent pays 100% of the
cost today and receives ~0% of the value today, so they stop. The broker's
dashboard then goes stale and he loses visibility. This is a **value-exchange**
failure, not a training failure. More training, more nagging, and more required
fields all make it worse.

## 2. The reframe

**Output-first, input-as-byproduct.** The agent opens the app because it tells
*them* what to do this morning. Every action they take to get through the day
emits exactly the structured signal the broker needs. The agent gets value now;
broker visibility is *harvested* from that engagement, never demanded.

Design invariant for every feature we add to the agent app:

> If a screen asks the agent to type or re-enter something the system could have
> known, it has failed. The agent's only inputs are **taps that also advance
> their own day.**

## 3. Strategy: sit on top of BoldTrail, don't replace it

The wedge for the design partner is **not** rip-and-replace. It is a friendly
action layer *on top* of BoldTrail:

- BoldTrail stays the system of record (contacts, lead routing, IDX behavior).
- The agent lives in our simple daily-priority view and rarely opens BoldTrail.
- Every one-tap action writes back to BoldTrail **and** feeds the broker cockpit.

This resurrects the investor's dead CRM without re-litigating agent buy-in.

## 4. Integration surface — which events sync which direction

Assumes Inside Real Estate / BoldTrail API + webhook access at the partner's
tier (**confirm this first — API access is gated**). All writes are idempotent
(keyed by external id) and every inbound record is stored under a
`demo-DB` tenant first; production BoldTrail credentials are never held in the
demo path.

### Inbound (BoldTrail → dashboard) — so the agent re-enters nothing

| Source record | Feeds dashboard panel | Notes |
|---|---|---|
| Leads / new inquiries (webhook) | Lead action center (`AgentApp.tsx:120`) | Carries lead source + created-at → drives the response clock |
| Contacts / smart CRM stage | Lead cards + priority queue | Stage is displayed, not asked for |
| Tasks / follow-up reminders | Today · priority queue (`:58`) | Surfaced as queue items, not a separate to-do app |
| Behavioral signals (property views, saved-search hits) | "lead gone quiet" / "listings match saved search" nudges | Powers the *why* line on each lead card |

### Outbound (dashboard → BoldTrail) — one tap, no form

| Agent action in app | Written back to BoldTrail | Also feeds |
|---|---|---|
| **Call now** tap (`:250`) | Logged activity + first-touch timestamp | Response-time metric (§6) |
| **Send SMS/email template** | Logged outreach + template id | Touch cadence |
| **Snooze / Skip** | Next-action date | Pipeline freshness |
| Queue task check-off (`:201`) | Task complete / stage nudge | Compliance + pipeline status |
| Doc uploaded against a missing item (`:67`) | Document attached | Broker compliance view |

### Not synced from BoldTrail (other systems of record)

- **Closings / inspections / missing docs** → transaction-management system, not
  BoldTrail. Surfaced as the priority queue.
- **Market intelligence** → MLS via SkySlope (already labeled on-roadmap at
  `AgentApp.tsx:308`).
- **Calendar guard** → the agent's connected calendar.

The dashboard is the *aggregator* across these four spines; BoldTrail is one of
them, not the whole picture.

## 5. Build order — the three input-friction wins to ship first

Ranked by leverage ÷ effort.

1. **Response-time auto-capture** (highest leverage, lowest effort). See §6.
   Turns the existing 15/30-minute clock into a real metric the broker has never
   been able to see. Requires only: capture the "Call now" tap + inbound lead
   `created_at`. Ship this even before full two-way sync.
2. **Two-way BoldTrail sync** (leads in, activities out). The §4 surface. This is
   what makes the app the agent's daily home and keeps BoldTrail alive underneath.
3. **Missing-doc surfacing → broker compliance view.** The queue already renders
   missing docs by filename; wire the upload write-back so the broker sees live
   compliance instead of chasing agents.

Everything the broker sees is already half-built: the agent roster runs a real,
tested engine (`computeAgentPerformance`) that outputs response health, weighted
pipeline, lead ROI, and a red/yellow/green rollup. It just needs live events
instead of the seeded `LEADS`/`QUEUE` constants.

## 6. Deep-dive: response-time capture, end to end

Why this one first: "time to first touch" is the single metric brokers most want
and least have, because it requires knowing *when the lead arrived* and *when the
agent first responded* — two facts BoldTrail can't reliably capture because
agents don't log call times. We can capture both with **zero** agent typing.

```
BoldTrail lead webhook ──▶ store Lead{ externalId, source, receivedAt } (demo-DB tenant)
        │                         │
        │                         └──▶ Lead action center renders card with a live clock
        │                              started from receivedAt (green <15m / yellow 15–30m / red >30m)
        │
Agent taps "Call now" ──▶ record firstTouchAt = tap time (+ click-to-dial if available)
        │                         │
        │                         ├──▶ write activity back to BoldTrail (idempotent, keyed by externalId)
        │                         └──▶ emit AgentTouchEvent{ agentId, leadId, receivedAt, firstTouchAt, source }
                                          │
                                          ▼
                        responseSeconds = firstTouchAt − receivedAt
                                          │
                    feeds computeAgentPerformance-style rollup → broker cockpit agent roster
                    (per-agent median response, % within SLA, worst offenders surfaced first)
```

Data captured, all as byproduct of one tap:
- **Per-lead:** source, received-at, first-touch-at, response seconds, SLA band.
- **Per-agent (broker view):** median first-response, % of leads touched inside
  the 15-minute target, count breaching the 30-minute red line, trend over time.

Minimal new persistence: a `LeadTouch` record (`agentId`, `leadExternalId`,
`source`, `receivedAt`, `firstTouchAt`) under the demo-DB tenant. No production
or demo-tenant data is read or written until BoldTrail credentials are supplied
for a specific tenant.

## 7. Definition of done (phase 1 of this workstream)

- BoldTrail sandbox lead webhook lands a `Lead` under a demo-DB tenant.
- Lead action center clock is driven by real `receivedAt`, not a constant.
- "Call now" writes an activity back to BoldTrail and records first-touch.
- Broker cockpit agent roster shows a live per-agent response-time column.
- No agent free-text input anywhere in the flow.

## 8. Open questions to take back to the investor

1. What BoldTrail/Inside Real Estate **API tier** does the brokerage have —
   specifically lead webhooks + activity write-back?
2. Which **transaction-management** system holds closings/inspections/docs
   (drives the priority queue, separate from BoldTrail)?
3. Is **click-to-dial** acceptable (best first-touch fidelity), or is a logged
   tap sufficient for v1?
4. Which single metric would make the broker open this daily — response time,
   compliance status, or pipeline freshness? (Recommend leading with response
   time.)
5. Are agents willing to **connect their mailbox** (Gmail/Outlook OAuth) so
   OutFront can send/draft on their behalf and thread naturally? This is a
   consented, authorized connection — not scraping.
6. What is the brokerage's tolerance for **AI auto-sending** vs. draft-and-approve
   on client email? (Recommend draft-and-approve first; see §10.)

---

## 9. The AI overlay: where automation executes, how it reports back

The larger vision: OutFront becomes the **AI overlay for the brokerage** — it
supports the agent in what they'd otherwise do (poorly, late, or not at all) in
BoldTrail, automates the work as it happens, and reports completion back to the
broker automatically. The architecture question — *does this run through BoldTrail
or inside OutFront?* — resolves to a deliberate split:

- **Execute in OutFront.** OutFront is the brain, the agent's daily surface, and
  the actor. It sends the email, fires the reminder, drafts the reply — through
  its own integrations, never by driving BoldTrail's UI (which is the very thing
  agents avoid).
- **Record to BoldTrail.** Every action is written back as a logged activity /
  stage change (the §4 outbound surface). BoldTrail stays the system of record,
  so its existing reports stay live and brokerage data never fragments.
- **Report to the broker in both.** The OutFront cockpit is the rich view
  (response time, compliance, pipeline health from `computeAgentPerformance`);
  BoldTrail is the compatible mirror. The broker sees "it was done" without
  asking anyone.

This is what makes it an **overlay, not a replacement** — it revives the
investor's underused BoldTrail instead of competing with it.

**Who owns the outbound send.** Because the premise is that agents avoid
BoldTrail, OutFront owns the send: through the agent's **own connected mailbox
(Gmail/Outlook OAuth)** so mail comes *from them* and threads naturally, then logs
the record back to BoldTrail. This is a consented, scoped OAuth connection to act
on the agent's behalf — deliberate and authorized, categorically different from
covert inbox scraping.

## 10. Communications automation — the risk ladder

Agent dashboards make email/reminder automation an obvious win, but these are
three tiers with very different risk. Ship low-risk fully; earn your way into
high-risk.

| Tier | What it is | Risk | Rollout |
|---|---|---|---|
| **1. Reminders / nudges** | Response clock, follow-up cadence, calendar guard, "lead gone quiet" | Low | Fully automate now — no human gate |
| **2. One-tap templated sends** | The existing "Send SMS/email template" buttons (`AgentApp.tsx:250`) | Medium | Agent taps to approve → OutFront sends → logs to BoldTrail |
| **3. AI-drafted responses** | AI reads the thread and drafts a contextual reply | High value / high risk | Draft-and-approve first; auto-send only for narrow safe categories once trust is earned |

**Guardrails for tier 3 (name these to the partner):**

- **Compliance** — TCPA (texts require consent + opt-out), fair-housing language
  screening, RESPA (no steering / undisclosed referral arrangements).
- **Brand / tone** — replies must match the agent's voice and brokerage standards.
- **Human-in-the-loop** — draft-and-approve by default; graduate specific,
  low-risk intents (e.g. "confirm showing time," "send requested doc") to
  auto-send only after a measured trust period.
- **Auditability** — every AI-sent or AI-drafted message is logged (to BoldTrail
  and the OutFront record) with the model/template that produced it.

Sequencing: tier 1 ships with the response-time work (§5–6); tier 2 already
exists as one-tap actions and just needs the real send + write-back; tier 3 is a
later, guarded phase gated on the mailbox-OAuth and compliance decisions in §8.

---

### One-line pitch for the investor

> Your agents won't work in BoldTrail because it takes from them and gives to
> you. This flips it: the app runs their day, and your visibility falls out of
> them just doing their job.
