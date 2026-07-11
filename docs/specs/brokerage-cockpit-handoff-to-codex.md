# Project Raven — Command Center

_Formerly "Brokerage 'Cockpit' — Living Coordination Doc (Claude ⇄ Codex)." Promoted 2026-07-11 to the **primary Project
Raven Command Center**. The **`## Product Decision Log`** below is the canonical record of product truth._

**Single source of truth for Project Raven.** Update your own lane section + append to the
Progress Log after every step, so the other agents always know what's done and where we are.

**Editing rule (agreed):**
- **Claude** edits `## Claude Lane Status`.
- **Codex** edits `## Codex Lane Status`.
- **Shared decisions / blockers** live in `## Shared Current State`; **handoffs** in `## Next Actions` — edit these only
  by coordination (don't rewrite the other's intent).
- Both append to `## Progress Log` with a `[Claude]` / `[Codex]` tag. `## Reference` is stable; change by coordination.

**Branch:** `feat/heartbeat-landing` · **Last updated:** 2026-07-11 by Claude ·
**Related specs:** `brokerage-data-sources.md`, `investor-owner-dashboard-plan-v2.md`, `executive-cockpit-tile-set.md`,
`project-raven-cockpit-ux-audit.md`, `project-raven-pilot-interaction-spec.md`.

> **This document is the Project Raven Command Center** (promoted 2026-07-11). The **`## Product Decision Log`** below is
> the canonical record of product truth — every major product decision is recorded there (as a numbered PD) **before**
> implementation begins (PD-012). Open questions still awaiting Sean live in **`## Sean Decisions Required`**. Each agent
> updates only its own lane. Read the current milestone (PD-011: **Luke First Login**) before starting work.

---

## Product Decision Log

> **Canonical record of Project Raven product truth.** Every major product decision is recorded here as a numbered **PD**
> **before** implementation begins (PD-012). Append-only: supersede a decision rather than delete it. Status values:
> **Active** · Superseded · Retired.

### PD-001 — Mission
- **Status:** Active · **Added:** 2026-07-11
- **Decision:** Raven is an **Executive Operating System**. It is **not a CRM**. Success is measured by **daily adoption**. Current pilot customer: **Luke**.
- **Rationale:** The product wins when Luke runs his business through it every day ("this helps me run my business"), not when it merely displays data.

### PD-002 — Product Principles
- **Status:** Active · **Added:** 2026-07-11
- **Decision:** (1) The cockpit **always loads first**. (2) AI **never replaces** the cockpit. (3) The Morning Brief is **voice-first**. (4) **Typing is always available.** (5) **Skip is always available.**
- **Rationale:** The operator stays in control; the assistant augments the cockpit, never gates it.

### PD-003 — Morning Brief Flow (locked)
- **Status:** Active · **Added:** 2026-07-11
- **Decision:** The Morning Brief sequence is **locked**: **Cockpit → Greeting → Executive Brief → One Thing First → Return to Cockpit.**
- **Rationale:** A predictable, repeatable ritual that always returns the user to their cockpit.

### PD-004 — One Thing First
- **Status:** Active · **Added:** 2026-07-11
- **Decision:** Every Morning Brief ends with **exactly one** recommended action. **Never multiple priorities.**
- **Rationale:** A single next action drives execution; competing priorities create paralysis.

### PD-005 — Integration Priority
- **Status:** Active · **Added:** 2026-07-11
- **Decision:** Integration order is **(1) Google Workspace, (2) BoldTrail, (3) Escapia, (4) QuickBooks Online.** Future integrations occur **only after pilot validation**.
- **Rationale:** Sequence integrations behind proven pilot value.

### PD-006 — Connect → Show Value → Expand
- **Status:** Active · **Added:** 2026-07-11
- **Decision:** The activation path is **Connect → Show Value → Expand.** **Never require users to connect multiple systems before demonstrating value.**
- **Rationale:** Time-to-value must precede any ask for more setup.

### PD-007 — Pilot Goal
- **Status:** Active · **Added:** 2026-07-11
- **Decision:** Luke connects **Google Workspace**, receives a **personalized Morning Brief**, **knows exactly what action to take next**, and **returns voluntarily the next morning**.
- **Rationale:** A concrete, observable success condition for the pilot.

### PD-008 — Vacation Rentals are a First-Class Business Type
- **Status:** Active · **Added:** 2026-07-11
- **Decision:** Vacation rentals are a **first-class business type**, not a secondary feature of brokerage. Brokerages managing vacation rentals experience a **consistent Executive Cockpit across agents and properties.** **Property-owner reporting is a core capability.** **Automated monthly owner reports are required** and follow the same automation philosophy used for executive briefings, agent coaching, and follow-up workflows. Treat as **foundational architecture**.
- **Rationale:** Luke runs a large vacation-rental division; owner reporting and a consistent cockpit are core to his daily use, not an add-on.

### PD-009 — Team Roles
- **Status:** Active · **Added:** 2026-07-11
- **Decision:**
  - **Sean — CEO:** product vision, Luke relationship, business decisions.
  - **GPT — Head of Product:** roadmap, acceptance criteria, sprint priorities, product governance.
  - **Claude — Design Authority:** UX, pilot validation, PASS / REFINE / PILOT BLOCKER.
  - **Codex — Engineering:** implementation, testing, repository, documentation.
- **Rationale:** Clear separation of authority prevents lane overlap.

### PD-010 — Review Process
- **Status:** Active · **Added:** 2026-07-11
- **Decision:** The flow is **Engineering → Design Review → Product Approval → Customer Validation → Next Sprint.** **No sprint begins until the previous sprint has completed review.**
- **Rationale:** Quality gate; no parallel sprint churn.

### PD-011 — Current Milestone: Luke First Login
- **Status:** Active · **Added:** 2026-07-11
- **Decision:** The current milestone is **Luke First Login.** Everything currently ships toward this milestone.
- **Rationale:** A single focusing objective for all lanes.

### PD-012 — Governance Rule
- **Status:** Active · **Added:** 2026-07-11
- **Decision:** From this point forward, **every major product decision must be recorded in the Product Decision Log before implementation begins.** The Product Decision Log is the **canonical record of product truth**.
- **Rationale:** Prevents decisions from being lost or contradicted; the PDL is the single source.

---

## Sean Decisions Required

_Open product decisions. Agents add rows here instead of deciding; Sean resolves. Newest lane first._

**Raven pilot interaction design (Claude lane, 2026-07-11)** — needed before Claude-lane view implementation begins.
See `project-raven-pilot-interaction-spec.md` for full context.

| # | Decision | Claude's recommendation | Status |
|---|---|---|---|
| R1 | Voice: forced, or opt-in? | **RESOLVED → PD-002:** voice-first, with typing + skip always available. | RESOLVED |
| R2 | Morning Brief entry: auto-open modal, or non-blocking (cockpit first)? | **RESOLVED → PD-001 / PD-002 / PD-003:** cockpit always loads first; AI never replaces it. | RESOLVED |
| R3 | Approve the one net-new capability — a scoped LLM follow-up answer over the brief's already-loaded data (reuses the existing Anthropic path)? | **Approve**, bounded to brief context | OPEN |
| R4 | Learned automations (e.g. auto-send a trusted agent's drafts): opt-in only, or auto-enable? | **Opt-in only**, never silent | OPEN |
| R5 | Agent-rhythm "automatic CRM write-back": pilot week one, or deferred? | **Defer** until pilot CRM creds land (Codex ingestion lane) | OPEN |
| R6 | Consolidate the three brokerage doors into one front door now, or after the first pilot week? | **Now** (low-risk view change) | OPEN |

---

## 2026-07-11 — Claude Lane: Pilot Interaction Design

**Mission.** Turn the current cockpit experience into a coherent **first-week pilot for Luke** — a brokerage owner who
also runs a large vacation-rental division — without redesigning the product or changing backend contracts. Luke needs a
direct, concise **executive-assistant** experience that says what matters, what to do next, and why.

**Status:** design specs delivered (see below); **no code written yet** — awaiting design approval before Claude-lane
view implementation. This lane does **not** overlap Codex: it produces UX/copy/interaction specs and (on approval) edits
only Claude-owned view/route files.

### Claude owns (this lane)
1. Morning Executive Brief interaction design — the first 3 minutes; cockpit-visible-first; greet → ready prompt; flows for
   begin / skip / interrupt / ask follow-up / end / return-to-cockpit; owner voice; **separate consultant brief preserved
   for `CONSULTANT`**.
2. Owner-voice copy spec — replaces "Ask the operator…" interrogation language; exact copy for healthy / one urgent /
   multiple / incomplete-data / positive-signal / recommended-action; every item ends in one action.
3. Always-on "One thing first" — red / yellow / **healthy fallback that still orients** (never disappears).
4. Screen-to-screen pilot flow — cockpit → brief → needs-attention → agent coaching detail → rental-property detail →
   communication action → back to cockpit; reuse current screens; **minimum** routing/hierarchy changes only.
5. Agent first-week rhythm — morning brief / daily execution / AI email-text / automatic CRM update / evening review /
   tomorrow preview; no new modules.
6. Evening Debrief — 3-minute optional conversational wrap (wins / unfinished / what Raven learned / tomorrow / one
   confirmation only when needed); voice optional.
7. AI behavior + tone standard — concise, calm, direct, transparent, never chatty/repetitive, asks only when necessary,
   executes obvious reversible actions automatically, surfaces uncertainty.

**Full spec:** `docs/specs/project-raven-pilot-interaction-spec.md`. **Audit input:** `docs/specs/project-raven-cockpit-ux-audit.md`.

### Files Claude may touch (view/route/copy only — on approval)
- `src/components/dashboard/AdvisorBrief.tsx` (owner-voice role branch + brief state machine)
- `src/components/dashboard/**` (new client-side brief/debrief state machine components)
- `src/components/cockpit/ExecutiveCockpit.tsx`, `PropertyCockpit.tsx` (always-on one-thing fallback; clickable needs-attention/property rows; back-to-cockpit)
- `src/app/modules/brokerage/**`, `src/app/modules/rentals/**` (routing/hierarchy wiring, view only)
- `src/app/realestate/agent/AgentAppView.tsx` (morning/evening bookend views)

### Files Claude must avoid (Codex/backend lane)
- `prisma/schema.prisma`, `prisma/migrations/**`
- `src/lib/modules/brokerage-analytics.ts`, `property-portfolio.ts`, `rental-property-rollup.ts`
- `src/lib/brokerage/**`, contract types, identity/activity logic, CSV vendor profiles
- ingestion adapters (FUB/Moxi/BoldTrail), API/import routes, auth, shared backend services
- `nav.ts` — **coordinate first** (July-3 log flags it Codex-sensitive)

### Concrete next actions for Codex (after Sean approves the design)
- **[Codex] CRM write-back adapter** — the agent rhythm's "automatic CRM update" needs an outbound push of touches
  (`CallEvent`/`MessageEvent` already recorded internally) to the brokerage CRM (BoldTrail/FUB). Ingestion lane; gated on pilot creds.
- **[Codex, optional] Deterministic "top positive signal" helper** in the data layer, if we'd rather the healthy-state
  one-thing fallback (spec §3) be data-owned than view-picked. Not required for v1.
- **[Codex] Persist opt-in automation rules** — e.g. an "auto-send agent X's drafts" flag surfaced by the Evening Debrief's
  "what Raven learned" (spec §6). Setting/store only; Claude surfaces + confirms, Codex persists.
- **[Codex] `nav.ts` coordination** — if the door-consolidation (spec §4) touches nav, Codex applies or blesses the change.

### Sean decisions
Consolidated in **`## Sean Decisions Required`** (rows R1–R6) at the top of this Command Center. Not repeated here.

---

## Pilot Acceptance Reviews (Claude-owned)

_Claude is in **Product Design / Pilot Acceptance**. As Codex delivers implementation, Claude reviews it against this
Command Center + the Raven UX principles (`project-raven-pilot-interaction-spec.md`) from the lens of **Luke's first week**._

**Success bar:** the work passes when it moves Luke toward *"This helps me run my business,"* not *"nice dashboard."*

**Verdict rubric — findings are classified ONLY as:**
- **PASS** — matches the spec + owner-voice principles; ready for Luke.
- **REFINE** — works, but needs a specific copy/UX change to feel like an assistant. Claude gives the **exact** replacement.
- **PILOT BLOCKER** — would break Luke's first-week trust or adoption; must fix before pilot.

Scope guardrail: reviews address adoption, clarity, and executive flow. Claude flags backend/schema/integration only when it
**directly** changes the UX, and routes those to Codex as a dependency — never edits them.

### Pre-staged acceptance criteria — first slice

_Objective PASS conditions defined **before** implementation so review is fast and consistent. Slice = the first Claude-lane
build once approved: **Morning Brief owner-voice reframe + always-on "One thing first."** Criteria gated on an open Sean
decision are marked (R#)._

**A. Morning Brief — owner voice** (`AdvisorBrief.tsx`, owner/operator path)
- **PASS** when: greets Luke by name; the `CONSULTANT` path is **unchanged**; **zero** consultant/interrogation strings survive in the owner path (no "Ask the operator…", "Advisor mode", "Client conversation brief", "confirm the operator agrees"); each briefing item ends in **exactly one** action; a healthy day still says something useful (never renders empty); jargon replaced per the audit glossary.
- **PILOT BLOCKER** when: owner sees any "Ask the operator…"/advisor framing; the "one thing" is wrong or empty; the brief blocks the cockpit when the decision says non-blocking (R2).
- **Gated:** voice on/off (R1) · non-blocking bar vs modal (R2) · follow-up Q&A capability (R3) — those sub-behaviors reviewed only once the decision lands.

**B. Always-on "One thing first"** (exec + property cockpits)
- **PASS** when: red/yellow render as today **and** the healthy/green state renders a useful positive-orientation line (never blank); copy follows spec §3; an action affordance is present (optional on green).
- **REFINE** triggers: a metric with no "so what"; a glossary jargon term; missing/duplicated action.

### Review log

| Date | Feature / PR | Verdict | Finding | Exact fix |
|---|---|---|---|---|
| — | _Awaiting first Codex implementation delivery._ | — | Nothing to review yet; Codex has not shipped Raven-lane implementation. | — |

---

## Pilot Learnings (Claude-owned)

_Standing, observation-only log — hypotheses to validate with **Luke**, not feature requests. Populated as features become
usable. Five lenses per surface: **Expected behavior · Assumptions to test · Questions to observe · Adoption signals ·
Potential friction.** Success metric: Luke says "this helps me run my business."_

### Broker roster / speed-to-lead — `/realestate/broker` (usable now)
- **Expected behavior:** Luke glances each morning to see whether agents are responding to leads; reads worst-first; acts on the "leaked to broker" count.
- **Assumptions to test:** that lead-leakage (untouched > 30 min) is the metric he actually cares about; that worst-first matches his mental model; that he'll *act* (nudge an agent), not just observe.
- **Questions to observe:** Does he open it daily or only when something's wrong? Does he trust the response-time numbers? Does he know what to *do* about a slow agent from this screen?
- **Adoption signals:** he cites a specific agent's response time in a team conversation; checks it unprompted; median response improves week over week.
- **Potential friction:** numbers with no "so what"; no one-tap nudge from here; an empty state early on can read as "broken."

### Agent daily app — `/realestate/agent` (usable now; drives the data Luke sees)
- **Expected behavior:** agent opens it on their phone, sees untouched leads first, taps Call now / Draft reply, approves drafts.
- **Assumptions to test:** agents will adopt a new surface vs. living in BoldTrail; the cell-bridge "Call now" feels natural; AI drafts are good enough to send with light edits.
- **Questions to observe:** Do agents open it unprompted? Do they trust the draft? Does push reach them fast enough? Do they *double-enter* into BoldTrail anyway (the friction CRM write-back would remove)?
- **Adoption signals:** 90%+ of first touches flow through the app; agents approve drafts rather than writing their own; median first response under 2 min.
- **Potential friction:** yet-another-app fatigue; iOS push needs a home-screen install; one off-tone draft erodes trust fast; no CRM write-back = double entry.

### Executive Cockpit — `/modules/brokerage/cockpit` (usable now)
- **Expected behavior:** Luke opens it as his 30-second read on brokerage health; looks first at whether volume is reaching the company (deal-vs-ledger) and whether cash is safe.
- **Assumptions to test:** that "company dollar retention" and "cash oxygen" are decisions he acts on, not just numbers he notes; that he reads the hero gap the way we intend ("volume only matters if it reaches the company").
- **Questions to observe:** Does he land here first, or on the brief? Which tile does his eye go to? Does he understand the tiles without us explaining them? Does he ever act, or only observe?
- **Adoption signals:** he quotes the retention or cash-days number to his team; he asks "why did this move" (wants the drill-in); he checks it before a leadership decision.
- **Potential friction:** jargon (company dollar / cash oxygen / DOM) with no plain gloss; dead "connect MLS / gathering snapshots" tiles reading as broken setup; no path from a worrying tile to the detail behind it.

### Property Cockpit — `/modules/rentals/cockpit` (usable now)
- **Expected behavior:** Luke checks whether his rentals are performing and which properties need attention; cares about what the *owner keeps*, not gross bookings.
- **Assumptions to test:** that "owner proceeds" framing lands better than occupancy/ADR/RevPAR; that the "needs attention" property is the one he'd actually chase; that he wants portfolio-level first, property-level on demand.
- **Questions to observe:** Does he trust the proceeds number? Does he tap a flagged property expecting detail (today a dead end)? Does "Guest Aura" mean anything to him?
- **Adoption signals:** he acts on a flagged property (calls the cleaner/manager); he references owner proceeds when talking to a property owner; he checks it weekly.
- **Potential friction:** invented vocabulary ("Guest Aura," "Maintenance drag"); property rows aren't tappable (can't get to the "why"); occupancy tile is a bare number with no "so what."

### Morning Brief (pending build — log once usable)
- **Expected behavior:** Luke reads/hears the brief, acts on the one thing, returns to the cockpit.
- **Assumptions to test:** the "one thing" is the *right* one; owner-voice reads as an assistant, not a gimmick; he wants a brief at all vs. just glancing at the cockpit.
- **Questions to observe:** Begin or Skip? Does he ask a follow-up? Does he act on the recommended action or ignore it?
- **Adoption signals:** he starts the brief unprompted; acts on the recommendation; asks a follow-up; says it saved him time.
- **Potential friction:** one wrong "one thing" erodes trust; too chatty; anything that feels like an interruption.

---

## 2026-07-03 Tandem Setup - Current Working Plan

**Current repo state from Codex:** local `main` is aligned with `origin/main`. PR #70 is merged and shipped to `main`.
The Agent Cockpit now has a deterministic data-layer coaching helper (`deriveAgentCoachingSignals`) and the page renders
`Focus this week` plus a ranked `Coaching queue`. Core gates passed locally and in CI: typecheck, tests, build, Vercel,
and Codex Review.

**Today goal:** get the three near-term verticals ready for early-adopter/investor review:
1. Restaurant / Stone live dashboard truth.
2. Real estate brokerage Executive Cockpit + Agent Cockpit + import/demo path.
3. Vacation rental / property management cockpit + import/demo path.

### Claude Help Lane - Start Here

Claude should avoid data-contract/math/schema work unless explicitly coordinated. The useful lane today is product QA,
design/copy review, and source-story clarity against the current shipped app/preview.

**Claude tasks:**

1. **Brokerage visual/copy QA**
   - Review `/modules/brokerage`, `/modules/brokerage/cockpit`, `/modules/brokerage/agent-cockpit`,
     `/demo/real-estate`, and `/import/brokerage`.
   - Confirm the cockpit still matches the intended "fighter-jet / 30-second cockpit" direction.
   - Flag places where the UI looks like a generic dashboard instead of an operating cockpit.
   - Flag any restaurant/hospitality cross-talk, especially words like prime cost, spill, COGS where they are not brokerage-native.
   - Check that Agent Cockpit copy makes clear where data comes from: BoldTrail/activity, appFiles/back-office files,
     QBO/cash truth, CSV/export fallback.

2. **Vacation rental visual/copy QA**
   - Review `/modules/rentals/cockpit`, `/modules/property-heartbeat`, `/demo/vacation-rental`, and `/import/rentals`.
   - Decide whether `/modules/property-heartbeat` should remain as a separate legacy/module path or become a redirect/entry
     to `/modules/rentals/cockpit`.
   - Flag restaurant or brokerage wording leakage.
   - Confirm the user-facing model is property-native: occupancy, ADR, RevPAR, owner proceeds, maintenance drag,
     break-even occupancy, Escapia/PMS import story.

3. **Demo funnel QA**
   - Review `/demo/tour`, `/demo/real-estate`, `/demo/vacation-rental`, and `/demo`.
   - Confirm "put in your own numbers" never routes a brokerage/rental prospect to a restaurant result.
   - Confirm public demo language is honest about what is sample/demo, what can come from API, and what can come from CSV.

4. **Output format for Claude**
   - Produce a short punch list with severity:
     - P0: blocks investor/early-adopter demo.
     - P1: should fix before design lock.
     - P2: design polish / later.
   - For each finding include route, screenshot if useful, exact copy currently shown, and suggested replacement copy.
   - Do not make broad rewrites. If code edits are needed, list exact file/route first so Codex can avoid overlap.

### Codex Lane - Current Owner

Codex will handle the repo/data integrity side:
- Check open PRs/status and latest `main`.
- Verify brokerage source labels and agent coaching rules are defensible.
- Fix hard routing/data-source bugs found in the demo and import flows.
- Verify restaurant live data truth: Toast freshness, Aura/Google status, Cash Oxygen/pending review count, Plaid/QBO/cash
  assumptions, and Davo/sales-tax language.
- Keep any design-only findings out of data-layer changes unless they expose a real correctness problem.

### Coordination Rules For Today

- Claude owns review output and visual/copy recommendations.
- Codex owns app/data fixes and mergeable implementation.
- If Claude edits files, avoid:
  - `src/lib/modules/brokerage-analytics.ts`
  - `src/lib/modules/property-portfolio.ts`
  - `src/lib/modules/rental-property-rollup.ts`
  - Prisma schema/migrations
  - API/import routes
- If Claude needs to change cockpit UI components, note it first in this file or in a short handoff so Codex does not patch
  the same component in parallel.

---

## Shared Current State

**Where we are (2026-07-01):**
- **Executive Cockpit is wired to the real spine and rendering real brokerage data.** `ExecutiveCockpit` +
  `/demo/executive-cockpit` consume `BrokerageCockpitData` / `loadBrokerageCockpit`. Mock fixture/types deleted.
- **Migration `20260630125000_add_brokerage_source_identity` APPLIED** to Supabase (`migrate deploy`).
- **Demo brokerage seeded** ("Cascade Realty Group" — 12 agents / 60 deals).
- **Green:** tsc clean; verified HTTP 200 with real figures ($531k GCI, $15.6M vol, 19.4% retention). Gate on
  **tsc + vitest** — `next build` fails *locally* (Windows env quirk, reproduces on HEAD); Linux CI should be fine.

**Locked decisions (all agreed 2026-06-30):**
1. 2nd concrete vertical NOW; polymorphic `IndustryManifest` engine deferred to Phase 2.
2. MVP stack = CSV + QBO + Follow Up Boss + Google/Aura; gated APIs = Phase 3.
3. Three data layers, never conflated — L1 money-truth (CSV/QBO/back-office only), L2 production/activity
   (Dotloop/SkySlope + MoxiWorks/FUB), L3 aura (kvCORE/Google/Brand24). Transaction-mgmt does NOT hold splits/caps.
4. Tiers: Executive Cockpit (wedge) → Agent Cockpit (per-agent MRR) → Retention (premium). Per-agent $ never in the **external `/investor`** view — scoped by decision 7.
5. Hero = "Deal Health vs. Ledger Health".
6. Anti-bloat: ~5 macro tiles; reuse neutral primitives only; no restaurant framing.
7. **Cockpit audience — DECIDED (operator, 2026-07-01):** Executive Cockpit is **leadership-only**. Keep the named per-agent leaderboard (Company Dollar / lead ROI / cap remaining). When it leaves demo, **gate the authed route to `OPERATOR` / `MANAGER` / `CONSULTANT`; never render for an `INVESTOR` role.** The decision-4 guardrail ("per-agent $ never in the investor view") applies to the **external `/investor` surface only**, which stays aggregate — the Executive Cockpit is a leadership tool, not an external-investor view. No change to the leaderboard itself; this is a scope clarification + an auth-gate requirement for the future authed page. `loadBrokerageAgentCockpitForUser` (agent sees only their own row) is unaffected.

**Blockers:** PR `feat/heartbeat-landing → main` (+ CI green) is the only remaining coordination item.

## Claude Lane Status

_Product Design / Pilot Acceptance (view/UX + copy). Owned by Claude._
- 🎯 **Role (2026-07-11):** Pilot Acceptance. Review Codex implementations against this Command Center + the Raven UX
  principles through Luke's first-week lens; classify findings **PASS / REFINE / PILOT BLOCKER** with exact replacement
  copy/UX in `## Pilot Acceptance Reviews`. No new broad audits; no major redesigns.
- 📓 **Standing:** maintain `## Pilot Learnings` — observations to validate with Luke as features become usable.
- ⏳ **Now:** no Codex Raven-lane delivery to review yet; six design decisions (R1–R6) open with Sean. Holding for either.
- ✅ **Project Raven pilot-adoption audit** (`project-raven-cockpit-ux-audit.md`): KEEP/REFINE/MOVE/REMOVE for every
  cockpit screen + P0/P1/P2 punch list + CRM-vs-AI-OS inventory.
- ✅ **Project Raven pilot interaction spec** (`project-raven-pilot-interaction-spec.md`): Morning Brief flow, owner-voice
  copy states, always-on one-thing, screen-to-screen flow, agent first-week rhythm, Evening Debrief, AI tone standard.
- ⏳ **Awaiting Sean approval** on the six minimal design decisions (voice default, brief entry, follow-up Q&A, learned
  automations, CRM write-back timing, door consolidation) before Claude-lane view implementation begins.
- 💡 **First implementation slice on approval:** owner-voice + role branch in `AdvisorBrief.tsx` and the always-on
  one-thing green fallback — pure view work, no contract change.
- ✅ Tile-set spec + strawman contract (`executive-cockpit-tile-set.md`).
- ✅ Executive Cockpit built, then **wired to real `loadBrokerageCockpit`** (`d028942`). Reputation/Market rendered as
  two tiles (a VIEW split; both source the contract's single `marketAura`).
- ✅ Applied the pending migration + seeded demo brokerage + verified real render.
- ⏳ **Blocked on Codex contract fields:** reputation *trend* + *themes* UI; market *months-of-supply / share*.
- ⏳ **Blocked on Codex:** Agent Cockpit (needs role-scoped per-`agentId` reads + activity snapshot).
- 💡 **Proposed, awaiting operator:** reputation as a header chip → click-to-expand Google review themes panel.

## Codex Lane Status

_Data/financial spine. Owned by Codex._
- ✅ Formalized `BrokerageCockpitData` (`7aa072c`) and approved Claude's strawman with additions:
  `sourceConfidence`, `floorDaysTarget`, nullable market data, and data-lane-owned `topPressure`.
- ✅ Built the brokerage read spine now consumed by the real Executive Cockpit: canonical per-agent rows,
  company-dollar retention, cash safety reuse, market/aura wrapper, source trust, and deterministic top pressure.
- ✅ Hardened the CSV onboarding wedge: vendor profiles (`5288592`) for generic / Lone Wolf-style / SkySlope-style /
  Loft47-style exports; lead-spend campaign ID mapping and per-agent de-dupe hardening (`da258c1`).
- ✅ Added and wired the source-identity spine (`616fe38`): `BrokerageSourceSystem`,
  `BrokerageAgentSourceIdentity`, `BrokerageAgentActivitySnapshot`; CSV imports now create source identity rows for
  canonical agents.
- ✅ Added Executive Cockpit contract extensions for Claude:
  `reputationTrend { ratingTrendPts, reviewVelocity, windowWeeks, historyWeeks, themes, state }` and
  `marketPosition { monthsOfSupply, marketSharePct, source, note }`. These are honest-null until snapshots / RESO data exist.
- ✅ Added Agent Cockpit protected read surface:
  `loadBrokerageAgentCockpitForUser(...)`, `agentProduction.allAgents`, and `GET /api/brokerage/agent-cockpit`.
  Operators/managers/consultants can read any agent; other users only resolve an agent matched to their email/source identity.
- ✅ Verified after Codex changes: `tsc --noEmit --incremental false` passed; `vitest --run` passed (`30` files,
  `151` tests).
- ✅ Source onboarding lane started in PR #92 (`feat/source-profile-scaffolds`): added source profiles/status UI,
  Follow Up Boss API client scaffold, credential-intake guidance, and CRM-neutral/AppFiles casing cleanup.
- ⏳ Not started: live Follow Up Boss / Moxi / BoldTrail ingestion jobs. The FUB client scaffold exists, but real sync
  should wait until partner credentials / pilot source shapes are available.

### Engineering delivered this session (2026-07-11, Claude-built — for Codex ownership per PD-009)
_Logged here so the Engineering picture is complete; Codex to absorb/own. Full history is in the Progress Log; nothing overwritten._
- Speed-to-lead **agent app** (`/realestate/agent`) and **broker roster** (`/realestate/broker`) view routes.
- **OneSignal Web SDK** integration (pilot App ID committed; `Key` auth for new-format key; root service worker) — push gated on `ONESIGNAL_API_KEY`.
- **No-terminal pilot bootstrap** endpoint (`GET /api/realestate/dev/bootstrap`, token-gated, fail-closed) — creates a brokerage tenant + links the user + seeds sample leads.
- **Auto-apply migrations** on Vercel production build (`scripts/vercel-migrate.mjs`, production-guarded, idempotent).
- AI **draft-for-lead** and **fire-test-lead** server actions.
- ⚠ **Note vs PD-005:** this session's push/Twilio/OneSignal work predates the integration priority (Google Workspace #1, BoldTrail #2). See Recommendations in the handoff report — resequencing may be warranted before Luke First Login.

## Next Actions

- **[Human/either] Open PR** `feat/heartbeat-landing → main`, confirm CI green. Last item to ship this vertical.
- **[Claude] Reputation + Market UI:** contract fields now exist. Render `reputationTrend` as gathering/not-connected
  until snapshots/review themes are populated; render `marketPosition` empty-state until RESO/MLS or profile values exist.
- **[Claude] Agent Cockpit UI:** protected read endpoint exists at `/api/brokerage/agent-cockpit?restaurantId=...&agentId=...`.
  It returns one allowed agent plus latest activity snapshot. Use `agentProduction.allAgents` only for operator-facing
  selection lists; never expose all rows in an agent-scoped view.
- **[Codex later] Live ingestion:** FUB/Moxi/BoldTrail activity adapters and real reputation themes after pilot creds/data.
- **[Operator] Decide** the reputation header-chip + themes-panel UX (frees a tile; progressive disclosure).

## Reference — Contract & Lane Boundary

**`BrokerageCockpitData`** (in `src/lib/modules/brokerage-analytics.ts`, Codex-owned): `dealHealth`, `ledgerHealth`,
`companyDollarRetention`, `cashSafety` (`DashboardCashSafety & {floorDaysTarget}`, default 120),
`agentProduction {top/bottomContributors: BrokerageCockpitAgentRow[]}`, **single `marketAura {market, aura}`** (Claude
splits into two tiles in the view), `topPressure` (deterministic, data-lane owned), `sourceTrust`.
`BrokerageCockpitAgentRow`: agentId/email/companyDollar/retainedYield/capRemaining/capProgressPct/pipelineCompanyDollar/
leadSpend/roi/health/**sourceConfidence**/note.

**Source identity (applied):** `BrokerageAgent` = canonical human; `BrokerageAgentSourceIdentity`
(agentId/sourceSystem/externalAgentId/email/rawPayload, unique `[restaurantId, sourceSystem, externalAgentId]`,
email-matched); `BrokerageAgentActivitySnapshot` (agent/source/period). Authority: CSV/back-office → $, FUB/Moxi → activity.

**Lane boundary — contract is the firewall:**
- **Codex owns:** `prisma/schema.prisma` brokerage models + migrations, `src/lib/brokerage/**`, `brokerage-analytics.ts`,
  contract types, identity/activity logic, CSV vendor profiles, ingestion adapters.
- **Claude owns:** `src/app/**` cockpit routes, `src/components/cockpit/**`, tile set, copy, hierarchy, visual treatment.
- **Shared (coordinate first):** `schema.prisma`, migration files, the contract type.

**Process hygiene:** commit **only your own files**; **never `git stash`** on this shared checkout (Windows autocrlf
phantom diffs); gate on **tsc + vitest**.

## Progress Log

_Append-only, newest first. Tag every entry `[Claude]` / `[Codex]`._

- **2026-07-11 [Claude]** **Established the Project Raven Command Center + Product Decision Log.** Promoted this doc (new
  H1, governance note) to the primary Command Center and added a top-level **`## Product Decision Log`** with twelve
  numbered decisions **PD-001…PD-012** (mission; product principles; locked Morning Brief flow; One Thing First;
  integration priority; connect→value→expand; pilot goal; vacation-rentals-first-class; team roles; review process;
  Luke-First-Login milestone; governance rule), each with Status/Date/Decision/Rationale. Marked Sean-decision rows
  **R1/R2 RESOLVED** (→ PD-002, PD-001/003); R3–R6 remain open. Merged today's engineering notes into the Codex/Engineering
  section for absorption (history preserved). **Documentation/governance only — no application code touched.**
- **2026-07-11 [Claude]** Continued the Pilot Acceptance lane (no external change to review — branch unchanged, no Codex
  delivery, R1–R6 still open). Pre-staged **acceptance criteria** for the first slice (Morning Brief owner-voice + always-on
  one-thing) with objective PASS / PILOT BLOCKER / REFINE conditions, marking sub-behaviors gated on R1–R3. Extended
  **Pilot Learnings** to the two other surfaces usable today (Executive Cockpit, Property Cockpit). Claude-lane doc only;
  no code, no audit, no Codex-owned file touched.
- **2026-07-11 [Claude]** Entered **Product Design / Pilot Acceptance**. Added two Claude-owned standing sections:
  `## Pilot Acceptance Reviews` (PASS / REFINE / PILOT BLOCKER rubric + review log; empty until Codex ships Raven-lane
  implementation) and `## Pilot Learnings` (observation-only hypotheses to validate with Luke across the usable
  speed-to-lead broker roster + agent app, and the pending Morning Brief). Updated Claude Lane Status to the acceptance
  role. No audit, no redesign, no code, no Codex-owned file touched. Holding to review Codex deliveries and/or resolved
  Sean decisions (R1–R6).
- **2026-07-11 [Claude]** Adopted the **Command Center** operating model: this doc is the single authoritative Project
  Raven roadmap (no separate roadmap file; `PROJECT_RAVEN_MASTER.md` not created). Added a top-level
  `## Sean Decisions Required` section and consolidated the six open Raven design decisions (R1–R6) there — agents surface
  decisions, Sean resolves. Claude edits only its own lane; will not edit Codex's engineering lane except to flag
  dependencies/blockers; reads the current sprint before starting work. No code touched.
- **2026-07-11 [Claude]** Opened the **Pilot Interaction Design** lane (Project Raven). **Completed:** the interaction spec
  `docs/specs/project-raven-pilot-interaction-spec.md` (Morning Brief first-3-minutes flow with begin/skip/interrupt/ask/
  end/return; owner-voice copy states each ending in one action; always-on "One thing first" incl. a healthy-state
  fallback that still orients; screen-to-screen pilot flow reusing current routes; agent first-week rhythm over the
  existing `/realestate/agent` app; 3-minute optional Evening Debrief; and an executive-assistant AI tone standard), plus
  this dated top section and lane status. Design branches the brief **by role** — owners get the direct conversational
  voice, `CONSULTANT` keeps the existing "Client conversation brief" in `AdvisorBrief.tsx`. **No code written; no contract,
  schema, or Codex-owned file touched.** **Ready for Codex (post-approval):** CRM write-back adapter for the agent rhythm,
  optional data-owned "top positive signal" helper, persistence for opt-in learned automations, and `nav.ts` coordination
  for door consolidation. **Needs Sean:** the six minimal design decisions listed in the top section / spec §⚑.
- **2026-07-04 [Codex]** On PR #92 / `feat/source-profile-scaffolds`, completed source onboarding cleanup for the
  Codex-owned July-3 QA findings: Agent Cockpit coaching/source copy is CRM-neutral, `AppFiles` displays with correct
  casing while preserving the persisted `appFiles transaction export` provider key, Follow Up Boss counts as a CRM
  pipeline source in brokerage readiness/trust, and credential-intake guidance marks API keys as secure-support items
  rather than note text.
- **2026-07-03 [Claude]** Completed the QA lane (brokerage / vacation rental / demo funnel). Findings in
  `docs/specs/july-3-qa-findings-claude.md`. Headlines: **P1→P0** — Executive Cockpit (`/modules/brokerage/cockpit`)
  renders the named per-agent leaderboard to an INVESTOR role (no role gate; `nav.ts:21` also exposes the link),
  violating locked decision 7 — **needs Codex coordination before editing `nav.ts`**. **P1** — Agent Cockpit hardcodes
  "BoldTrail" in empty states though FUB/Lofty/Brokermint are offered (source-label copy, Codex-owned). **P2** —
  "appFiles" undefined/inconsistent casing (Codex-owned). **P1** — `/demo` defaults to the restaurant estimator under a
  neutral header; operator chose to make it an industry chooser (Claude applying on branch `qa/2026-07-03-claude-lane`).
  **P2** — `/demo` encoding mojibake (Claude, same branch). Vacation rental verified clean; property-heartbeat redirect
  already in place.
- **2026-07-03 [Codex]** Added the current tandem setup block for today's work. Claude lane is product QA,
  design/copy review, and source-story clarity across brokerage, vacation rental, and demo funnel routes. Codex lane is
  repo/data integrity, hard routing/source fixes, and restaurant live-data truth checks. PR #70 is merged to `main`, adding
  deterministic Agent Cockpit coaching signals and the ranked coaching queue.
- **2026-07-01 [Claude]** Operator ruled on cockpit audience (new locked decision 7): Executive Cockpit is
  **leadership-only** — keep the named per-agent leaderboard, gate the future authed route to
  OPERATOR/MANAGER/CONSULTANT, never INVESTOR. Resolves the post-go-live review flag ("per-agent $ leaderboard
  vs. the investor-view guardrail") as a scope clarification: the guardrail binds the external `/investor` surface
  only, which stays aggregate. No leaderboard code change; auth-gate required when the cockpit leaves demo.
- **2026-07-01 [Codex]** Audited brokerage demo/import guardrails after the Cinnamon Beach Realty issue. Removed a
  restaurant-derived "prime cost" phrase from the real-estate estimator and constrained brokerage import preview/commit
  routes to `REAL_ESTATE_BROKERAGE` businesses only. Typecheck and vitest green.
- **2026-07-01 [Codex]** Wrapped the first two requested Codex blockers: added nullable reputation/market contract
  extensions and a protected Agent Cockpit read surface (`loadBrokerageAgentCockpitForUser` +
  `/api/brokerage/agent-cockpit`). Typecheck and vitest green.
- **2026-07-01 [Codex]** Confirmed handoff file structure and updated Codex lane status directly. Current Codex side:
  brokerage Executive Cockpit data contract is landed and consumed; CSV/source identity foundation is pushed; remaining
  Codex work is contract additions for reputation/market, role-scoped Agent Cockpit reads, then live activity ingestion.
- **2026-07-01 [Claude]** Restructured this doc into the agreed lane sections (Shared / Claude Lane / Codex Lane / Next
  Actions + Reference + Log).
- **2026-07-01 [Claude]** Wired Executive Cockpit to real `loadBrokerageCockpit` + `BrokerageCockpitData`; deleted mock
  `types.ts`/`fixture.ts` (`d028942`). Applied migration `20260630125000` (`migrate deploy` → Supabase). Seeded "Cascade
  Realty Group". Page selects a brokerage tenant **with deals** (a stray "Demo Bistro" is mis-typed `REAL_ESTATE_BROKERAGE`
  w/ 0 deals — skip it). Verified real render (HTTP 200; $531k GCI, $15.6M vol, 19.4% retention).
- **2026-07-01 [Codex]** Source-identity spine (`616fe38`), CSV vendor profiles (`5288592`), lead-spend hardening
  (`da258c1`); created migration `20260630125000_add_brokerage_source_identity`.
- **2026-06-30 [Claude]** Built Executive Cockpit mock-first (`a59486e`). Split Market&Aura → Reputation + Market tiles
  (view choice); Agent Production to a full-width row; added Market Position (Gemini input).
- **2026-06-30 [Codex]** Formalized `BrokerageCockpitData` (`7aa072c`); redline approved strawman + `sourceConfidence`,
  `floorDaysTarget` default 120, nullable `marketAura.market`, data-lane-owned `topPressure`. Agreed all 6 decisions.
- **2026-06-30 [Claude]** Locked plan + specs (`39ac4f6`).
