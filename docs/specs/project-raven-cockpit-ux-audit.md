# Project Raven — Cockpit UX Audit (Claude Lane)

Pilot lens: **Luke — a brokerage owner who also runs vacation rentals.** He wants
an **executive assistant / AI operating system** that tells him what matters and
what to do — not a traditional CRM of tables, filters, roster grids, and data
entry.

Scope: UX/Product lane only. This is an audit + punch list + copy spec. No
schema, architecture, integration, or backend-contract changes. Treat the repo
as source of truth; evolve what exists rather than redesign it.

Screens reviewed (source-of-truth reads):
- Executive: `src/components/cockpit/ExecutiveCockpit.tsx`, `src/app/demo/executive-cockpit/page.tsx`, `src/components/dashboard/AdvisorBrief.tsx`
- Brokerage: `src/app/modules/brokerage/{page,cockpit/page,agent-cockpit/page}.tsx`, `src/lib/modules/brokerage-analytics.ts`
- Rentals/property: `src/components/cockpit/PropertyCockpit.tsx`, `src/app/modules/rentals/cockpit/page.tsx`, `src/app/demo/real-estate-cockpit/native/{RentalCockpit,RealEstateDemo}.tsx`

---

## The finding that explains everything else

The product already contains **one genuinely great AI-OS pattern**, and every
"feels like a CRM" complaint is a place where that pattern is missing.

It shows up in two forms already in the codebase:
- **"One thing first"** — interpret → prioritize → name the single thing that needs Luke.
- The demo Broker cockpit's **`def / read / so`** gauge (definition → this month's reading → *so here's what to do*).

Where that recommendation layer is present, the product feels like an assistant.
Where it's absent, you get the CRM: raw gauges with a threshold word, roster
tables, agent-first-person screens, and setup/plumbing copy. Two conditions make
it worse: the assistant voice is **conditional** (it disappears when nothing is
red, so a healthy month is a wall of silent green tiles), and the Morning Brief
is **pointed at the wrong person** (a consultant, not Luke).

The whole audit reduces to one move: **make the recommendation layer universal,
always-on, and spoken to Luke.**

---

## 1. KEEP / REFINE / MOVE / REMOVE — every screen

### Executive layer

| Screen / element | Verdict | Why (Luke's POV) |
|---|---|---|
| Exec Cockpit · "One thing first" callout | **KEEP** ⭐ | The one true assistant element. Make it *always* render (green fallback: "Nothing needs you; strongest signal is X"). |
| Deal Health vs Ledger Health hero | **KEEP** | "Does volume reach the company" is an owner question; the footer sentence interprets. Lead with the *gap conclusion*, not raw GCI. |
| 4 macro tiles (retention / cash oxygen / reputation / market) | **REFINE** | Keep the signals; pair each with a one-line action. Rename to plain words (§4). |
| Reputation-trend + Market-position footnote strips | **MOVE** | Mostly "gathering snapshots / connect MLS" placeholder states — plumbing diluting the glance. |
| Agent production · "Top contributors" | **REFINE (trim)** | Leaderboard = vanity for a solo glance. |
| Agent production · "Needs attention" | **KEEP** | Owner-relevant — but say *why* + next step, not just a dollar figure. |
| Source-trust pill + footnote + "modeled" badges | **MOVE** | Data-integrity plumbing; belongs in settings/health. |
| `/demo/executive-cockpit` dev page | **KEEP as dev harness / REMOVE from any pilot path** | 404s in prod by design; never Luke-facing. (Minor: subline says "five instruments" then lists six.) |

### Brokerage layer

| Screen / element | Verdict | Why |
|---|---|---|
| Three separate brokerage doors (Analytics / Executive / Agent) | **REFINE → consolidate** | Three overlapping entry points into the same data *is* CRM IA. Luke wants one front door that routes him. |
| Brokerage Executive Cockpit | **KEEP** (best of the three) | Same refinements as Exec Cockpit above. |
| Agent Cockpit (whole screen) | **MOVE** | Written in the agent's first person — "My take-home," "Add income goal," "My CMAs." Luke is not the "my." |
| Agent Cockpit · "Focus this week" / coaching queue | **REFINE → aggregate to owner level** | Turn per-agent coaching into "3 agents aren't working their leads." |
| Agent Cockpit · Production / Forecast / Activity grids | **REMOVE from Luke's path** | Agent self-service detail (contacts, CMAs, cap progress). |
| "Update brokerage data" / "Plan brokerage sources" CTAs | **MOVE to settings** | Data-entry/import CTAs on the daily surface — exactly what Luke reacts against. |
| Brokerage Analytics index · Agent Performance roster grid (5 columns/agent) | **REMOVE / MOVE to drill-down** | The archetypal CRM table. Replace with the cockpit's "Needs attention" list. |
| Analytics · Market Intelligence composite scores ("Market score 118") | **REMOVE / MOVE to a market tab** | Abstract scores with no action. |
| Analytics · Lead ROI panel | **KEEP + REFINE** | Maps directly to Luke's concern (are agents working leads / is spend paying off). Make it a plain sentence. |
| Analytics · Company Dollar / Pipeline panels | **REFINE** | Collapse to the single retained-vs-target read; drop definitional CRM copy. |
| Analytics · Source Readiness panel | **MOVE to settings** | "Live feed missing / Planned" config on the primary dashboard. |

### Rentals / property layer

| Screen / element | Verdict | Why |
|---|---|---|
| Live Property Cockpit · "One thing first" | **KEEP** ⭐ | Same as exec — but it disappears when green. Make always-on. |
| Bookings vs Owner Proceeds hero | **KEEP** | "What the owner keeps" is precisely his question; strongest thing on the page. |
| Owner-proceeds / Maintenance-drag / Guest-Aura tiles | **REFINE** | Add a `so:` line each (the demo proves the pattern). Rename "Guest Aura" → "Guest reviews." |
| Occupancy tile | **REFINE or REMOVE** | Bare metric, no health, no "so what." |
| Property production lists | **KEEP + REFINE** | "Needs attention" is right; make rows **tappable** — today it's a dead end. |
| Demo RentalCockpit · "One thing" red alert | **KEEP** ⭐ | Best expression of the AI-OS voice in the codebase — a full interpret-and-act sentence. |
| Demo · property roster table (Occupancy / ADR / RevPAR columns) | **REFINE** | Keep exception ordering + reason lines; **drop ADR/RevPAR columns** to shed the PMS-grid feel; lead with the reason. |
| Demo · drawer maintenance + reviews | **KEEP** | Concrete "what's wrong" = the "what needs attention" answer. |
| Demo · Price-aggressiveness segmented control | **REFRAME** | Turn the manual Low/Med/High toggle into a recommendation: "We recommend a price drop — approve?" |
| Demo · Automated owner report | **KEEP** ⭐ | Huge for an owner who answers to *other* owners. |
| ADR / RevPAR portfolio tiles | **REFINE / demote** | Operator metrics; hide behind a "details" reveal. |

### Demo flow (`RealEstateDemo`)

| Element | Verdict | Why |
|---|---|---|
| Tabbed shell (Broker / Agent / Rental) | **REFINE** | Frames it as three products, not Luke's operating system. The Agent tab switches persona ("Good morning, **Priya**"). |
| Broker gauge `def / read / so` pattern | **KEEP + PORT everywhere** | The missing recommendation layer the live screens lack. |
| Market-intelligence ticker (Bloomberg-style tape) | **MOVE / REMOVE from default** | The most terminal-like element; noise for Luke, bury behind "market." |
| Agent app tab (in owner flow) | **MOVE** | Least relevant to an owner; not the headline. |
| Cross-demo consistency | **FIX** | Broker demo = "Cascade Realty," rentals = "Sawtooth Retreats." Different companies reinforce "separate demos." And the live PropertyCockpit and demo RentalCockpit share almost no vocabulary or layout — a pilot who sees the demo won't recognize the product. |

---

## 2. UX punch list — prioritized

### P0 — pilot blockers (before Luke's first week)
1. **Re-point the Morning Brief from consultant → owner.** Kill every `Ask the operator: "…"`; speak to Luke and make the call (§3). Highest-impact change.
2. **Make "One thing first" always-on** on every cockpit (exec, brokerage, property). A healthy day must still say something ("Nothing needs you — strongest signal is X"), never a silent wall of green tiles.
3. **Get Luke out of the Agent Cockpit's first person.** Owner should never land on "My take-home / My CMAs." Route him to an owner roll-up; keep the agent screen for agents.
4. **Reconcile the demo with the live product.** The rental demo (ADR/RevPAR tables, drawers) and the live PropertyCockpit look like different apps. Pick one vocabulary/layout so a pilot recognizes what they bought.
5. **Remove data-entry/setup CTAs from daily surfaces** — "Update brokerage data," "Plan brokerage sources," source-readiness rows → settings.

### P1 — before broader rollout
6. **Add the `so:` recommendation line to every tile** across the live cockpits (port the demo's proven pattern).
7. **Consolidate the three brokerage doors** into one front door that routes.
8. **Replace roster/analytics tables** (Agent Performance grid, PMS occupancy table) with the "Needs attention" recommendation list; make rows tappable to a drill-in.
9. **De-jargon the whole surface** (§4 glossary).
10. **Make "Needs attention" items say *why + next step*,** not just name + dollar.

### P2 — polish
11. Demote ADR/RevPAR/market-score/ticker behind "details" reveals.
12. Unify badge vocabulary ("3/4 sources" vs "2 need you now" vs "Escapia connected" all share one slot).
13. Fix "five instruments/six" copy; tidy footnotes.
14. One shared company/story across the demo tabs.

---

## 3. The Morning Executive Brief — refined

**The problem, precisely.** It is framed as *"Advisor mode → Client conversation
brief → a consultant/accountant view,"* and its recommendations are scripts for
interrogating Luke: `Ask the operator: "Does this heartbeat match what you feel
this week?"`. The product stands behind Luke, narrating him to a third party. Its
fallback even punts: *"Use the conversation prompt to confirm the operator agrees
with what the data is showing."*

**The fix is not to delete Advisor mode** — the `CONSULTANT` role genuinely needs
it. The fix is to **branch the voice by role**: consultants keep the conversation
brief; **owners get spoken to directly.** This reuses existing role data — no new
feature.

### Structure (owner mode)

```
Good morning, Luke.                          ← time-aware greeting, by name
Wednesday, June 11 · your business is healthy — one thing needs you.

┌─ Needs you today ───────────────────────────────┐   ← lead, always present
│ Your team's response time slipped this week:    │
│ 3 leads sat untouched past 30 minutes.          │
│                          [ Nudge those agents ] │   ← a real action, not a script
└─────────────────────────────────────────────────┘

Also worth knowing                                    ← reassurance, plain language
· Owner proceeds climbed to 47% — best this quarter.
· Cash covers 47 days; you're clear of your floor.

(setup nudges only during onboarding, never in the daily brief)
```

### Before → After (real copy)

| Today (verbatim) | Refined (owner voice) |
|---|---|
| Eyebrow "Advisor mode" · "Client conversation brief" · "A consultant/accountant view of what to celebrate, what to inspect…" | "Good morning, Luke. Wednesday, June 11 — your business is healthy, one thing needs you." |
| `Ask the operator: "Does this heartbeat match what you feel in the real estate broker / agent team this week?"` | "Your team's response time slipped — 3 leads went untouched past 30 min. **Want me to nudge them?**" |
| "No urgent blocker visible" → "Use the conversation prompt to confirm the operator agrees with what the data is showing." | "Nothing's on fire today. Strongest signal: owner proceeds up to 47%. I'll flag the moment something needs you." |
| "Top win: Profit First model is stabilizing" | "Your cash discipline is holding — three straight months inside target." |
| "Go-Live is still in coach mode" | "You're two steps from switching on automatic transfers — want to see them?" |
| "Missing data: Starting cash balance / Collected sales tax / GBP action authorization" (daily nag) | *(moved out of the daily brief into a one-time onboarding checklist)* |

**Principles:** second person, by name · make the call (don't ask him to confirm
the data) · every item ends in one action · plain words · reassurance when
healthy · setup chores leave the daily surface.

---

## 4. Where it feels like a CRM, not an AI operating system

1. **Raw metrics with no "so what."** Occupancy/ADR/RevPAR tiles, "Market score 118," Activity snapshot (Contacts/CMAs/New leads). *Fix: universal `so:` line.*
2. **Roster/PMS tables.** Agent Performance (5 columns × every agent), the demo's Occupancy/ADR/RevPAR grid with a `<thead>`. *Fix: recommendation list, not a grid.*
3. **Agent-first-person on an owner's screen.** "My take-home," "My CMAs," "Add income goal." *Fix: owner roll-up.*
4. **Setup/plumbing as content.** "Update brokerage data," "Plan brokerage sources," "Live feed missing / Planned," "{n}/{n} sources connected," "modeled" badges, "gathering weekly snapshots," "Source: QBO/back office." *Fix: move to settings; one quiet status indicator max.*
5. **Interrogation instead of assistance.** `Ask the operator: "…"` throughout the Brief. *Fix: §3.*
6. **Analyst jargon assuming the reader is an analyst.** Glossary:

| Product term | Owner language |
|---|---|
| Company-dollar retention | What the brokerage keeps |
| Cash oxygen | Days of cash / runway |
| Owner proceeds | What the owner takes home |
| Maintenance drag | Upkeep eating into profit |
| Guest Aura | Guest reviews |
| ADR / RevPAR | (demote; "avg nightly rate" if shown) |
| Heartbeat / coach mode / rehearse pilot | (internal lifecycle — hide from owner) |
| Break-even CD / Weighted GCI / active:pending | (analyst detail — drill-down only) |

---

## 5. Pilot-adoption focus (no new major features)

Every recommendation evolves what already exists — the `so:` layer, "One thing
first," and role data are all in the codebase. Nothing here adds a feature; it
removes friction from Luke's first week:

- **Day 1 feeling:** he opens the app and it *talks to him* and tells him the one
  thing — instead of handing him gauges to interpret or scripts to interrogate
  himself with.
- **The pattern already exists** — this is about making the best thing in the
  codebase universal, not building something new.
- **The demo becomes the product** — reconciling them means the thing that sells
  Luke is the thing he logs into.

---

## Recommended first implementation slice

The P0 with the highest ratio of adoption-impact to code-risk is the **Morning
Brief owner-voice reframe** (§3): role-branch `AdvisorBrief.tsx` so owners are
addressed directly with a made call + one action, consultants keep the existing
conversation brief. UX-lane only; no schema/contract changes. "One thing first"
always-on (P0 #2) is the natural companion.
