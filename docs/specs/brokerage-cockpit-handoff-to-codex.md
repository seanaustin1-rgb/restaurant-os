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

### PD-013 — Design owns UI states; Engineering implements
- **Status:** **Active** (ratified by Sean 2026-07-12) · **Added:** 2026-07-11
- **Decision (proposed):** Executive-panel **UI states** — *which* states exist, plus their copy, hierarchy, owner-voice, and behavior — are **designed by Claude (Design Authority)**. **Codex implements** them to that spec and **flags any missing state back to Design** rather than originating it. This clarifies/enforces PD-009.
- **Rationale:** Panel-state design is product judgment and is invisible to CI (typecheck/test/build stay green regardless). When Engineering designs states in a vacuum, design review becomes cleanup instead of confirmation — see the REV-1/R11/R12 drift (inverted sequence, missing greeting, voice-as-input-only). Design-specs-first keeps product truth upstream of code.

### PD-014 — Morning Ritual is embedded in the Executive Cockpit
- **Status:** Active · **Added:** 2026-07-12 (Sean)
- **Decision:** The Raven Morning Ritual lives as an **embedded panel on the Executive Cockpit** (the PR #106 `LukeFirstLoginPanel` approach) — greeting → Executive Brief → One Thing First → return, all layered on the cockpit. The standalone full-screen `/morning-brief` route (PR #105) is **retired**.
- **Rationale:** Keeps the cockpit as the stable home base (PD-002/003); the ritual augments the cockpit and returns to it rather than replacing it. Resolves the two-implementation divergence in favor of the embedded one.

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

**Luke First Login (surfaced by the Design Review, 2026-07-11)**

| # | Decision | Claude's recommendation | Status |
|---|---|---|---|
| R7 | Which `businessType` lands on which cockpit at login? | **RESOLVED (Sean, 2026-07-11):** login lands on **one unified Executive Cockpit** (brokerage agents + rental properties, one surface), per PD-008. Net-new cockpit-first router + unified view. | RESOLVED |
| R8 | Onboarding: enforced value-gate, or stay skippable? | **RESOLVED (Sean, 2026-07-11):** a **light value-gate on Google** — guide connect Google Workspace → first brief, then skippable after value is shown (PD-006/PD-007). | RESOLVED |
| R9 | Resolve the sign-in vs sign-up + env-config landing conflict. | **RESOLVED (Sean, 2026-07-11):** **both** sign-in and sign-up route to the unified cockpit; new users pass through onboarding once first; fix the `.env*` post-signup divergence. | RESOLVED |
| R10 | Which roles are "owner-mode" (reach the Morning Brief)? | **RESOLVED (Sean, 2026-07-11):** owner-mode = **`OPERATOR` + `BROKER`** (owners only; exclude MANAGER). Apply to the Executive Cockpit gate (`BROKERAGE_LEADERSHIP_ROLES`). Unblocked the REV-1 pilot blocker. | RESOLVED |

---

## Execution Plan — Luke First Login (Claude ⇄ Codex)

_The path to a Luke-usable pilot, split by lane (PD-009) and gated by the review loop (PD-010: Engineering → Design Review →
Product Approval (GPT) → Business Approval (Sean) → next). **Design specs states → Codex builds → Claude reviews.**_

| # | Increment | Claude (Design Authority) | Codex (Engineering) | Gate |
|---|---|---|---|---|
| 1 | **Morning Ritual** | ✅ REV-2 PASS | ✅ PR #106 (CI green) | ✅ **Sean APPROVED (2026-07-12) → merge PR #106 to `main`** |
| 2 | **Agent → Owner rollup demo** (§8) | ✅ spec done (§8) → REV-3 on delivery | Build: surface agent-accountability in owner One Thing First; verify shared-tenant propagation; seed spread | Claude REV-3 → GPT/Sean |
| 3 | **Owner cockpit landing** (minimal R7/R9) | Spec the minimal role/businessType post-auth landing | Build: `BROKER` → Executive Cockpit on login; both auth paths; fix `.env` split | Claude review → GPT/Sean |
| — | **▶ Checkpoint A — demoable pilot** | After 1–3: Luke signs in → lands on **his** cockpit → runs the ritual → sees the agent→owner story on the data we have. **Showable to Luke.** | | |
| 4 | **Google Workspace connect + value-gate** (PD-005/007, R8) | Spec OAuth connect flow states (value-gate §7 done) → review | Build: Gmail/Calendar OAuth (client/scopes/token store/callback); wire brief to Google signals; value-gate onboarding | Claude review → GPT/Sean |
| — | **▶ Checkpoint B — full Luke First Login** | After 4: the PD-007 pilot goal ("connect Google → personalized brief") is met. | | |

**Per-increment cadence:** Claude specs states (Command Center) → Codex builds to spec, CI green, one PR, self-checks acceptance → Claude reviews PASS/REFINE/BLOCK with exact fixes → GPT product approval → Sean business approval → merge → next. No increment starts until the prior is reviewed (PD-010).

**Sean's calls — ANSWERED 2026-07-12:**
1. ✅ **PR #106 approved** → merge to `main`.
2. ✅ **PD-013 ratified** (Active) — Design owns UI states; Codex implements to spec.
3. ✅ **Branch strategy:** merge PR #106 → `main`, then reconcile the Command Center/docs onto `main` so code + governance live together.
4. ✅ **Luke's first look = Checkpoint B** (full Luke First Login, Google connected). Run Increments 1→4 before showing Luke; each still ships + reviews individually (PD-010).

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

| Date | Feature / branch @ SHA | Verdict | Headline |
|---|---|---|---|
| 2026-07-11 | Morning Brief owner voice · `codex/prepare-for-luke-pilot-execution @ 9db06a3` (PR #105) | **PILOT BLOCKER** → superseded | Owner-mode brief is `OPERATOR`-only; brokerage owner Luke (provisioned `BROKER`) is locked out. **PR #105 retired per PD-014** (embedded approach chosen). |
| 2026-07-12 | Raven Morning Ritual · `work @ 28a9fa4` (PR #106) | **PASS** (ritual increment) | Embedded ritual meets the approved sequence + every Increment-1 acceptance condition; CI green. Luke-milestone gaps (Google, cockpit landing, agent→owner demo) tracked separately. |

#### Review REV-1 — Morning Brief owner voice (`9db06a3`)

**Journey tested:** owner opens `/morning-brief` → One Thing First → voice/type/skip capture → "Also watching" context → return to dashboard. (Code read from the Codex branch; not run — no DB for this tenant here.)

**Product-decision compliance:**
- ✅ PD-002 (voice-first; typing + skip always available): real `SpeechRecognition`, graceful "not available in this browser → type or skip," `[Skip for now]` always present.
- ✅ PD-006: onboarding source cards now show "First value: …" and a connect→value→expand line.
- ✅ Honesty: Google Workspace added as **planned/OAuth-after-scope-approval** (no false "connected"), with riskNotes ("do not read email bodies…"). GPT product-approved this strategy (CODEX_HANDOFF).
- 🟡 PD-004: exactly one "One Thing First" is shown (good, singular) — but it is **static text**, not an action (no Do/Defer/Dismiss, no persistence).
- 🔴 PD-002/003: the brief is a **full-screen route that replaces the view**, reached from a nav link off the (non-cockpit) dashboard — not "cockpit loads first, brief layered on top, return to cockpit." One Thing First also renders **above** the executive context, inverting the locked sequence (Executive Brief → One Thing First).

**PILOT BLOCKER (must fix first):**
- **Screen/state:** `/morning-brief` page + nav link. **Problem:** owner-mode = `OPERATOR` only (`morning-brief/page.tsx` `OWNER_MODE_ROLES=["OPERATOR"]`; `nav.ts` `OWNER_ROLES=["OPERATOR"]`). **Why it matters:** Luke is a brokerage owner; the `BROKER` role exists for exactly this persona and the pilot bootstrap provisions the owner as `BROKER` — so Luke is redirected to `/dashboard` and never sees the Morning Brief (the milestone centerpiece). **Required change:** include `BROKER` (and `MANAGER`) in owner-mode for both the page gate and the nav link; confirm Luke's provisioned role (R10). **Acceptance:** a `BROKER`-role owner reaches `/morning-brief` and sees their brief.

**REFINE (before PASS):**
- **Spoken briefing missing.** Voice today is **input** (Luke dictates his plan via STT); there is no **TTS reading the brief aloud**. PD-002/directive emphasize a *voice-first briefing* (Raven speaks). *Required:* add spoken delivery of One Thing First + watch items with obvious Play/Pause/Stop. *Acceptance:* Luke can hear the brief hands-free; written stays fully usable.
- **No greeting by name.** Header shows the business name, not "Good morning, Luke." *Required:* greet the signed-in owner by name (Clerk `currentUser`). *Acceptance:* personal greeting renders.
- **One Thing First is not actionable / not persistent.** *Required:* the single action needs Do/Defer/Dismiss and must persist into the cockpit (per required-states + PD-004 steps 10-11). *Acceptance:* completing/deferring/dismissing persists and the cockpit reflects it. (Larger item — acceptable to stage, but flag as not-yet-done for the full journey.)
- **Structural: brief replaces the cockpit.** *Required:* move toward cockpit-first with the brief as an overlay/return (depends on the net-new cockpit router, R7/R9). *Acceptance:* cockpit visible first; brief never a hard takeover; sequence Executive Brief → One Thing First.
- **Empty-data copy** says "connect a source" generically; per PD-005/007 it should point to **Google** first. *Acceptance:* empty state names Google Workspace as the first connect.

**Strengths (PASS-worthy):** voice-first-not-mandatory is correctly implemented; honest source-trust footer; Google Workspace privacy posture (no email-body reads) is exemplary; deterministic digest degrades honestly with no data.

**Coordination note:** Codex branched from `main` (`3eb01b0`), so its work does **not** include this Command Center's Product Decision Log, and this branch does not include Codex's code — the two will need reconciliation before merge.

**Recommendation for Product Approval:** Not yet. Fix the role blocker (tiny), then this is REFINE-level and pilot-viable for the brief slice. Spoken briefing + actionable/persistent One Thing First are the substantive remaining gaps for the full milestone.

**Sequencing recommendation (Claude → GPT / Codex, 2026-07-11):** Split the work into two increments rather than blocking the
brief on the big build. **Increment 1 (ship first):** the small, high-value wins — owner-mode fix (R10: `OPERATOR` + `BROKER`)
+ the ritual loop (greeting, reorder executive-context-before-One-Thing, and make One Thing First actionable / persistent /
reflected in the cockpit). PR #105 is already green and close to this. **Increment 2 (its own sprint):** the **unified
cockpit-first router (R7/R9)** + the Google value-gate (R8) — the largest build; it should not gate the brief slice from
reaching Luke. Ordering is Product's call; this is the Design-Authority recommendation.

#### Review REV-2 — Raven Morning Ritual (PR #106 / `work @ 28a9fa4`)

**Verdict: PASS** on the ritual increment (Increment 1). Verified against the pre-staged acceptance conditions:
- **BROKER reaches it** ✅ — cockpit gated to `BROKERAGE_LEADERSHIP_ROLES` (incl. `BROKER`; `INVESTOR` excluded).
- **Greeting by name** ✅ — "Good morning, {firstName}." from Clerk `currentUser().firstName`.
- **Sequence** ✅ — Cockpit → Greeting → Executive Brief → One Thing First → Return (executive context now precedes the action).
- **Actionable + persistent** ✅ — Start now / Defer / Skip today; per-day `localStorage` key; on reload it restores a "Today's focus" card with status.
- **Reflected on the cockpit** ✅ — embedded panel on the Executive Cockpit (PD-014), not a takeover.
- **No regressions** ✅ — voice input, typing, Skip, source-trust footer intact. **CI green** (tsc · test 367 · build · Codex Review · Vercel).

**REFINE (non-blocking):** persistence is browser-local (per-device, per-day) — acceptable for a personal ritual pilot; note for later server-side. TTS out of scope. Verify empty/no-data `executiveBrief` renders gracefully.

**Out of scope for this increment (Luke-milestone, tracked separately):** Google Workspace OAuth + personalized-from-Google brief (PD-005/PD-007); cockpit-first login landing so Luke lands here without navigating (R7/R9); the agent→owner rollup demo (§8).

**Recommendation:** **Ready for Sean's owner walkthrough** on a seeded preview. Merge-gate per PR #106's own checklist (preview deploy succeeds, Luke's `BROKER` access verified, Start/Defer/Skip persistence smoke in a supported browser).

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

## Design Review — Luke First Login (Claude-owned)

_Design Authority readiness review (2026-07-11) conducted **while Codex builds**, per the sprint directive. Source-of-truth
audit of the current app across the entry → connect-Google → brief → one-action journey (three parallel code reads,
file:line-grounded). **No Codex implementation has been submitted, so NO PASS / REFINE / PILOT BLOCKER verdict is issued
here** — that is reserved for Codex's delivery. This section defines the target, the required states, and pre-staged
acceptance for the milestone. Enforces PD-001…PD-008, PD-011._

### 1. Existing-UX audit — what is real today

| Area | Reality today (file evidence) | Luke First Login gap |
|---|---|---|
| **Login destination** | Sign-**in** → `/dashboard` (`sign-in/page.tsx:6`, `page.tsx:11`). Sign-**up** → `/onboarding` (`sign-up/page.tsx:6`). Only role redirect: INVESTOR-only → `/investor` (`dashboard/page.tsx:47`). | Two different first screens for "first login"; env conflict — `.env.example` sends signup to `/onboarding`, `.env.sandbox.example:25` to `/dashboard`. |
| **Cockpit entry** | **No cockpit loads first.** Landing is the restaurant-centric `DashboardView` → `HeartbeatSummary` ("Heartbeat first", `DashboardView.tsx:239`). Cockpits exist only as `/modules/**` sub-routes + demos. | 🔴 **A Raven cockpit-first landing does not exist.** Violates PD-002/PD-003 by default. |
| **Business-type routing** | None at login. All verticals render one shared `DashboardView`; `businessType` only filters modules + swaps *hard-coded placeholder* preview cards (`DashboardView.tsx:276-408`). | 🔴 A brokerage/rental owner lands on a restaurant dashboard with fake preview numbers, not their cockpit. |
| **Onboarding** | Non-blocking. Middleware enforces auth only (`middleware.ts:32`); a business-less user gets a soft "No business yet" card, not a gate. Wizard = 3 steps (`OnboardingFlow.tsx`). | 🟡 Skippable; no enforced value path. PD-006 (Connect→Value→Expand) not embodied. |
| **Google integration** | **Gmail/Calendar OAuth does not exist.** Only Google *Business Profile* (reviews/"Aura", `business.manage` scope, `google-business-profile/oauth.ts:6`). Mailbox is a TODO (`realestate/actions.ts:132`). | 🔴 **Integration #1 (PD-005) is net-new from zero** — OAuth client, scopes, data model, connect UI. |
| **Integration UI framing** | Administrative "**Source Onboarding / Setup**" (`settings/sources/page.tsx:185`), "owner approvals", "support-assisted", "secure connections". Value ("Unlocks: …") is buried. | 🔴 Reads as admin chore, not a value unlock (violates PD-006 framing). |
| **Connection states** | `DataSourceStatus` enum has only 4: PLANNED / CONNECTED / NOT_NEEDED / BLOCKED (`schema.prisma:86`). | 🔴 No connecting / syncing / expired / sync-failed states. |
| **Morning Brief** | **No owner brief.** `AdvisorBrief` = "Client conversation brief", **CONSULTANT/MANAGER only** (`DashboardView.tsx:209`), 4 **static** cards, not sequenced. | 🔴 An owner (Luke) sees no brief at all. Sequenced owner brief exists only in specs. |
| **Voice** | **Zero capability** — no SpeechSynthesis / recognition / audio anywhere. | 🔴 Voice-first brief (PD-002) is net-new. |
| **One-thing / action** | Displayed in 2 surfaces (`HeartbeatSummary` "The One Thing"; `ExecutiveCockpit` "One thing first") — both **stateless, read-only navigation**, no complete/dismiss/defer, no persistence (`signals.ts:147`). | 🔴 No persistent single-action primitive (PD-004 step 10-11). |
| **Conflicting surfaces** | **Three** "top thing" derivations: `HeartbeatSummary` + `ExecutiveCockpit` (shared `deriveTopPressure`) **and** `AdvisorBrief.topWatchout` (its *own* logic) — can co-render on `/dashboard` and **disagree**. | 🔴 No canonical single top-action source (violates PD-004). |

### 2. Intended Luke First Login journey vs. current reality

_Legend: ✅ exists · 🟡 partial · 🔴 net-new_

1. Luke signs in. — 🟡 (works, but sign-in vs sign-up land differently)
2. Cockpit loads immediately. — 🔴 (lands on restaurant heartbeat; no cockpit-first router)
3. Raven explains the value of connecting Google Workspace. — 🔴 (no Workspace concept; admin framing)
4. Luke may connect / type / skip. — 🔴 (no brief interaction surface)
5. Luke connects Gmail + Calendar. — 🔴 (no OAuth)
6. Raven returns him to the cockpit. — 🔴 (depends on 2 + OAuth return routing)
7. Morning Brief becomes available. — 🔴 (no owner brief)
8. Raven delivers a concise executive briefing. — 🔴 (AdvisorBrief is consultant static cards)
9. Exactly one recommended action. — 🟡 (displayed but conflicting, stateless, read-only)
10. Action remains visible in the cockpit. — 🔴 (no persistence)
11. Complete / dismiss / defer. — 🔴 (no action state)
12. Leaves knowing what matters next. — 🔴 (emergent from the above)

**Headline for Product (GPT) + Sean:** Luke First Login is a **build-from-near-zero**, not a refinement of existing screens. 9 of 12 steps are net-new; the entry router, Gmail/Calendar OAuth, owner brief, voice, and the persistent single-action primitive do not exist in any form today.

### 3. Required UI states (design targets for Codex)

**Google integration** _(owner-voice copy per state; note `DataSourceStatus` must gain states — Codex/schema dependency)_
- **Disconnected** — "Connect Google to let Raven brief you on what actually needs you today." `[Connect Google]`
- **Connecting** — "Opening Google…" (spinner; never a dead button).
- **Connected** — "Google connected. Pulling your last few days…"
- **Syncing** — "Reading your inbox and calendar — about 30 seconds."
- **Permission incomplete** — "Raven needs Calendar too, to see your day. `[Grant calendar access]`" (names the missing scope + one action).
- **Authorization expired** — "Google needs a quick reconnect to keep your brief current. `[Reconnect]`"
- **Sync failed** — "Couldn't reach Google just now — your cockpit still works. `[Try again]`" (what happened + what to do; cockpit never blocked).
- **No useful data** — "Nothing urgent in Google today. Here's your cockpit." (graceful, not an error).

**Morning Brief**
- **Ready** — a calm, non-blocking "Ready for your brief?" affordance; cockpit fully visible (PD-002).
- **Loading** — "Putting your brief together…"
- **Written active** — text brief, one item visible, `[Next]`/`[Skip]` always present.
- **Voice active** — spoken, with obvious `[Pause] [Stop] [Read instead]` controls.
- **Paused** — resumes where left off; cockpit reachable.
- **Skipped** — collapses to a quiet chip; cockpit unaffected; re-offer later.
- **Completed** — "That's your day. One thing needs you →" hands off to One Thing First.
- **Failed safely** — "Couldn't generate your brief — here's your cockpit and the one thing I can see." (never a dead end).

**One Thing First** _(persistent primitive — net-new; needs a store — Codex dependency)_
- **Recommended** — one action, specific + actionable, `[Do it] [Defer] [Dismiss]`.
- **Completed** — checked, quietly logged; brief won't re-surface it today.
- **Deferred** — "Back tomorrow" (or a chosen time); stays visible but muted.
- **Dismissed** — removed for today with an undo.
- **Source unavailable** — "I can't see enough yet to recommend one thing — connect Google to unlock this." (points back to the value step).

### 4. Copy & hierarchy requirements (pass conditions)

- **Executive OS, not CRM** (PD-001) — no roster tables / raw-metric grids on the first-login path; language interprets, not tabulates.
- **Cockpit is stable home base** (PD-002/003) — the cockpit is always visible; brief/onboarding overlay, never replace it.
- **Google = value-enabling** (PD-006) — connect copy leads with what Luke *gets* ("so Raven can brief you"), not "authorize this system."
- **AI subordinate to cockpit** — the assistant is an affordance on the cockpit, never a full-screen takeover.
- **Singular action** (PD-004) — exactly one recommended action, unmistakable; the three conflicting "top thing" surfaces must collapse to one canonical source.
- **Error language** — every error says *what happened* + *what to do next*, in plain, non-technical words; cockpit stays usable.

### 5. Voice-first, not voice-mandatory (validation checklist)

- Voice is the **emphasized** brief experience (PD-002) — but…
- **Typing** is always available; **Skip** is always available.
- Voice controls (play / pause / stop) are **obvious**, not hidden.
- The user can **stop or leave** the brief at any point and land back in the cockpit.
- **Written content is fully usable** when audio is unavailable (no audio-only information).

### 6. Readiness dependencies & decisions to route (not built by Claude)

**Codex / Engineering (PD-009) — net-new, flagged as dependencies:**
- Gmail + Calendar OAuth (client, scopes, token store, callback + return routing).
- A cockpit-first **post-auth router** keyed on `businessType`/role (today only INVESTOR is routed).
- Owner **sequenced Morning Brief** surface (reframe/rebuild beyond `AdvisorBrief`).
- **Voice layer** (browser TTS/STT — no infra).
- **Persistent single-action** store (complete/defer/dismiss).
- Connection **state machine** — extend `DataSourceStatus` (connecting/syncing/expired/failed).
- Collapse the **three "one thing" derivations** into one canonical source (PD-004).

**Route to `Sean Decisions Required` / GPT (product):**
- Which `businessType` lands on which cockpit at login (brokerage + vacation-rental owner = same person per PD-008 → one consistent Executive Cockpit).
- Does onboarding become an enforced value-gate, or stay skippable? (PD-006 tension.)
- Resolve the sign-up vs sign-in and env-config landing conflict.

### 7. Required UI states — Unified Executive Cockpit (R7) + Google value-gate (R8)

_Design specs the states; Codex implements (PD-013 proposed). Owner-voice copy per state so Codex builds, not designs._

**Unified Executive Cockpit** (R7 — one surface across brokerage agents + rental properties; single canonical "one thing"):
- **Loading** — skeleton; never a blank screen.
- **Ready** — cockpit renders; "One Thing First" (PD-004) always present on top.
- **Partial** — some domains connected, others not: show live data where it exists; for a missing domain show a quiet "Connect {X} to light this up," not an error.
- **Empty (no sources)** — value-forward, not a dashboard of zeros: "Connect Google to get your first brief" → routes to the value-gate (R8).
- **One Thing First** — reuse §3 red/yellow/healthy; **one canonical source across both domains** (collapse the three divergent derivations flagged in the audit).
- **Brokerage panel** states: has-data (agents, worst-first "needs attention") · no-data ("Connect BoldTrail / import agents") · all-healthy ("Team's responsive — nothing needs you").
- **Rentals panel** states: has-data (properties, worst-first) · no-data ("Connect Escapia / import properties") · all-healthy.
- **Source/trust** — one quiet, honest indicator; no "modeled/plumbing" noise on the exec surface.

**Google value-gate** (R8 — light gate; connect → first value → then skippable):
- **Pitch (pre-connect)** — leads with the payoff: "Connect Google Workspace so Raven can brief you on what needs you today." `[Connect Google] [Skip for now]`
- **Connecting / Connected / Syncing / Permission-incomplete / Authorization-expired / Sync-failed / No-useful-data** — exactly the §3 Google-integration states + copy.
- **First value shown** — "Here's your first brief." → then the gate releases: "You're set — explore your cockpit." (skippable from here on).
- **Skipped-before-value** — allowed, non-punitive: "Skipped — connect Google anytime to unlock your brief." (never traps Luke; PD-006).

### 8. Demo — Agent Cockpit → Owner Cockpit rollup (design; Codex builds)

_Goal (Sean, 2026-07-12): Luke sees his cockpit **and** a demo where an agent's work in the agent cockpit reports up into
Luke's cockpit. Most of this loop already exists in the speed-to-lead spine — **reuse it, do not build a new module** (PD-006)._

**Narrative (the demo script):**
1. **Seed** via `/api/realestate/dev/bootstrap` — Luke (`BROKER`) + ≥1 agent + a spread of leads (some untouched past SLA).
2. **Owner cockpit** (`/modules/brokerage/cockpit`): the Morning Ritual's **One Thing First** surfaces an **agent-accountability** signal — e.g. "An agent has a lead untouched past 30 min" — and the "Needs attention" list names that agent.
3. **Agent cockpit / app** (`/realestate/agent`): the agent sees the untouched lead → **Call now** (stamps first touch) or **Draft reply → approve**.
4. **Rollup:** back on Luke's cockpit (refresh) — the agent's response time posts, the agent moves off "Needs attention," and the One Thing clears. **Luke's cockpit visibly changed because the agent acted.**

**Minimum Codex work (build to this; don't redesign):**
- Owner **One Thing First** (`topPressure`) must be able to surface a **speed-to-lead agent-accountability** signal derived from the roster (`computeAgentRoster` / `computeResponseStats`), so the ritual points at agent activity — not only cash/financial signals.
- Confirm the agent app, broker roster, and Executive Cockpit read the **same tenant** so an agent's touch propagates to Luke's cockpit on refresh (they share `Lead` + the response clock — should already hold; verify).
- Extend the seed/bootstrap only if needed to stage the demo spread.

**Design note:** this is the "agent → owner" story for the pilot demo; it's an assembly of existing surfaces (agent app, roster, Executive Cockpit agent-production) tied to the owner's One Thing First, not new product.

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
- 🎯 **Role (2026-07-11):** Design Authority / Pilot Acceptance for **Luke First Login**. Review Codex implementations
  against this Command Center + the Product Decision Log through Luke's lens; classify **PASS / REFINE / PILOT BLOCKER**
  with exact replacement copy/UX in `## Pilot Acceptance Reviews`. Not primary engineer; no competing implementation.
- ✅ **Design Review — Luke First Login** (see section): source-of-truth readiness audit (entry/auth, integrations/Google,
  brief/voice/action), the intended 12-step journey vs. reality, required UI states, copy/hierarchy + voice-first criteria.
  **Headline: 9 of 12 journey steps are net-new** (no cockpit-first router, no Gmail/Calendar OAuth, no owner brief, no
  voice, no persistent single action). Surfaced R7–R9 for Sean/GPT. No verdict issued — no Codex delivery yet.
- 📓 **Standing:** maintain `## Pilot Learnings` — observations to validate with Luke as features become usable.
- ✅ **Reviewed Codex Sprint 3** (`codex/prepare-for-luke-pilot-execution @ 9db06a3`, Morning Brief owner voice): verdict
  **PILOT BLOCKER** (owner-mode is OPERATOR-only → brokerage owner Luke, provisioned BROKER, locked out) with strong work
  behind it. Full REV-1 in `## Pilot Acceptance Reviews`; surfaced R10. Not authorizing next sprint — awaiting Product
  Approval (GPT) + business approval (Sean).
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

## Codex Next-Run Brief (Design Authority → Codex)

**▶ CODEX — START HERE. Current task = Increment 2 (Agent → Owner rollup demo).** This Command Center is the full handoff;
read the Execution Plan, PD-001…PD-014, Design Review §8, and REV-2, then build the "Build" list below to its acceptance conditions.

**Branch (handles the current un-merged state):**
- The **Morning Ritual** is on **PR #106 / branch `work` (@ 28a9fa4)**; these **specs** are on **PR #103 / branch
  `claude/a6-operator-laptop-run-9j934q`**. They have not yet been reconciled onto `main`.
- **Base Increment 2 on the branch that has the Morning Ritual (`work` / PR #106)** so you don't regress it, and follow this
  Increment-2 brief. If PR #106 has already been merged to `main` by the time you start, branch from `main` instead.
- Ship on its own PR, CI green, hand back for Design review (PD-010). Target for Luke's first look is **Checkpoint B**.

**Increment 1 — DONE** (PR #106, embedded `LukeFirstLoginPanel`; REV-2 **PASS**; PD-014). The standalone route (PR #105) is retired.

**Scope this run to Increment 2 — the Agent → Owner rollup demo + Luke's cockpit landing. Build to Design Review §8. Do NOT build Google Workspace OAuth (PD-007) this run.**

**Build:**
1. **Agent-accountability One Thing First (§8):** the owner's One Thing First (`topPressure`) must be able to surface a speed-to-lead agent signal from `computeAgentRoster` / `computeResponseStats` (e.g. "An agent has a lead untouched past 30 min"), so the ritual points at agent activity — not only cash/financial signals.
2. **Rollup continuity:** confirm the agent app, broker roster, and Executive Cockpit read the same tenant so an agent's Call now / approved draft propagates to Luke's cockpit on refresh — the agent leaves "Needs attention" and the One Thing clears.
3. **Owner landing (minimal):** ensure a `BROKER` owner can reach the Executive Cockpit cleanly so Luke sees *his* cockpit; the full unified cockpit-first router (R7/R9) stays its own item.
4. **Seed:** extend `/api/realestate/dev/bootstrap` only if needed to stage the demo spread (Luke `BROKER` + agent + untouched leads).

**Acceptance conditions (Design Authority verifies each):**
- From Luke's cockpit, One Thing First names an **agent-accountability item drawn from real roster data**.
- The agent acts in `/realestate/agent`; on refresh **Luke's cockpit reflects it** (agent off "Needs attention"; One Thing updates).
- A `BROKER` owner reaches the Executive Cockpit; the Morning Ritual (PR #106) renders there.
- No regressions to REV-2's ritual behavior.

**Guardrails:**
- When you later build R7/R8, implement to **Design Review §7 state specs** — do not design new panel states (PD-013, proposed).
- Keep Google Workspace **planned / OAuth-after-scope-approval** (no live-sync claims).
- **Reconcile the branch:** PR #105 is based on `main` and lacks the Product Decision Log — rebase/reconcile onto the
  Command Center's PDL before merge so governance isn't clobbered.

**Gate:** tsc + vitest + build green, then hand back for Design review.

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

- **2026-07-12 [Sean, via Claude]** **Decisions:** (1) PR #106 **approved** → merge to `main`; (2) **PD-013 ratified → Active**
  (Design owns UI states, Codex implements to spec); (3) **branch strategy** = merge #106 to `main`, then reconcile the
  Command Center/docs onto `main`; (4) **Luke's first look = Checkpoint B** (full Luke First Login, Google connected).
  Codex Next-Run Brief updated to Increment 2 (branch from `main` after #106 merges).
- **2026-07-12 [Claude]** Added an **Execution Plan — Luke First Login** (Claude ⇄ Codex), splitting remaining work into
  four increments by lane with the review-loop gate: (1) Morning Ritual — built, pending Sean walkthrough + merge PR #106;
  (2) Agent→Owner rollup demo (§8); (3) Owner cockpit landing (minimal R7/R9) → **Checkpoint A = demoable pilot**; (4) Google
  Workspace connect + value-gate → **Checkpoint B = full Luke First Login**. Flagged Sean's four unblocking calls (walkthrough/
  merge, ratify PD-013, branch strategy, Checkpoint A vs B for Luke's first look). Planning/coordination only; no app code.
- **2026-07-12 [Claude]** **REV-2: Raven Morning Ritual = PASS** (PR #106, `work @ 28a9fa4`). The embedded `LukeFirstLoginPanel`
  meets the approved sequence + every Increment-1 acceptance condition (BROKER reaches it, greeting by name, executive-context-
  before-One-Thing, actionable Start/Defer/Skip persisted per-day, reflected on the cockpit, no regressions); CI green. **Sean
  chose the embedded approach → PD-014 (Active); PR #105 retired.** Ready for Sean's owner walkthrough on a seeded preview.
  **New Sean requirement:** an **Agent → Owner rollup demo** (agent's work in the agent cockpit shows up in Luke's cockpit) —
  specced as Design Review **§8** (reuse the speed-to-lead spine; no new module) and set as the Codex **Increment 2** next-run
  brief. Out-of-scope-but-tracked for the full milestone: Google Workspace OAuth (PD-007), unified cockpit-first landing
  (R7/R9). Review/design/coordination only; no app code touched.
- **2026-07-11 [Claude]** Got ahead of the R7 build: **specced the required UI states** for the **Unified Executive Cockpit**
  and the **Google value-gate** (Design Review §7) with owner-voice copy per state, so Codex implements rather than designs
  them. **Surfaced PD-013 (Proposed):** Design owns UI states, Engineering implements to spec — clarifies PD-009; awaiting
  Sean/GPT ratification. Guidance: let Codex finish the specced brief slice, but hold the cockpit-router (R7) build until it
  builds to these states. Design/coordination only; no app code touched.
- **2026-07-11 [Claude]** **Sean resolved R7–R10** (captured during Design-Authority Q&A). **R10:** owner-mode = `OPERATOR` +
  `BROKER` (unblocks REV-1 pilot blocker). **R7:** login lands on one **unified Executive Cockpit** (brokerage +
  properties). **R9:** both sign-in/sign-up → the unified cockpit; new users onboard once first; fix `.env*` divergence.
  **R8:** light value-gate on Google (connect Workspace → first brief, then skippable). Confirmed Codex's work is **PR #105**
  (`codex/prepare-for-luke-pilot-execution`, base `main`) — CI green (Typecheck/Test/Build/Codex Review/Vercel). **Codex is
  now unblocked** to execute REV-1's punch list against these decisions. Review/coordination only; no app code touched.
- **2026-07-11 [Claude]** **Design review of Codex Sprint 3** (`codex/prepare-for-luke-pilot-execution @ 9db06a3` — Morning
  Brief owner voice). **Verdict: PILOT BLOCKER** — owner-mode is gated to `OPERATOR` only (`morning-brief/page.tsx`,
  `nav.ts`), but the brokerage-owner persona uses the `BROKER` role (the pilot bootstrap provisions BROKER), so Luke is
  redirected off the milestone centerpiece. Minimum fix: add BROKER (+ MANAGER) to owner-mode. Behind the blocker the work
  is strong (real voice-first with typing/skip fallback; honest Google Workspace planned-source posture with privacy
  riskNotes; connect→value→expand in onboarding) and flips to REFINE fast. REFINE items: no spoken (TTS) briefing — only
  voice input; no greeting by name; One Thing First is static (no Do/Defer/Dismiss, no persistence); brief full-screen
  replaces the cockpit (PD-002/003). Full REV-1 recorded in `## Pilot Acceptance Reviews`; surfaced R10. **Coordination:**
  Codex branched from `main`, so it lacks this Command Center's Product Decision Log — reconciliation needed before merge.
  **Not authorizing the next sprint** — awaiting Product Approval (GPT) + Sean. Review only; no app code touched.
- **2026-07-11 [Claude]** **Design Authority readiness review — Luke First Login** (immediate work while Codex builds).
  Ran a source-of-truth audit (three parallel code reads, file:line-grounded) of the entry→connect-Google→brief→one-action
  journey and recorded it in the new **`## Design Review — Luke First Login`** section: existing-UX audit, intended 12-step
  journey vs. reality, required UI states (Google integration / Morning Brief / One Thing First) with owner-voice copy,
  copy & hierarchy pass conditions, and the voice-first-not-mandatory checklist. **Key finding: the milestone is
  build-from-near-zero — 9/12 steps net-new** (no cockpit-first login router, no Gmail/Calendar OAuth — only Google
  Business Profile exists, no owner Morning Brief, zero voice capability, no persistent single-action primitive; and three
  conflicting "one thing" derivations that can disagree on `/dashboard`). **No PASS/REFINE/PILOT BLOCKER issued — no Codex
  implementation submitted yet.** Surfaced R7–R9 to `Sean Decisions Required`; listed Codex engineering dependencies.
  Documentation/governance only — no application code touched.
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
