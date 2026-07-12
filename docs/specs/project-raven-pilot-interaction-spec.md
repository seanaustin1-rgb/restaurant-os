# Project Raven — Pilot Interaction Spec (Claude Lane)

**Mission.** Turn the current cockpit experience into a coherent first-week pilot
for **Luke — a brokerage owner who also runs a large vacation-rental division** —
without redesigning the product or changing backend contracts. Luke needs a
direct, concise **executive-assistant** experience that tells him *what matters,
what to do next, and why.*

**Scope / lane.** UX + copy + interaction design only. This spec **reuses existing
screens, components, routes, signals, and contracts** and identifies the *minimum*
routing/hierarchy changes to wire them into a pilot flow. It is the
implementation-ready companion to the audit at
`docs/specs/project-raven-cockpit-ux-audit.md`.

**Claude must not change** (Codex/backend lane): `prisma/schema.prisma`,
migrations, analytics calculations, `src/lib/modules/brokerage-analytics.ts`,
`property-portfolio.ts`, `rental-property-rollup.ts`, brokerage/rental data
contracts, `src/lib/brokerage/**`, ingestion jobs, integration code, auth, shared
backend services.

**Reading key** — every recommendation is tagged:
- **[UX]** interaction/layout decision · **[COPY]** exact wording · **[ENG]** engineering implication (for Codex/eng after approval) · **⚑ SEAN** a decision only Sean can make (kept minimal).

**Source-of-truth routes/components referenced:**
- Executive Cockpit — `/modules/brokerage/cockpit` → `src/components/cockpit/ExecutiveCockpit.tsx`
- Morning/Advisor Brief — `src/components/dashboard/AdvisorBrief.tsx`
- Brokerage Agent Cockpit — `/modules/brokerage/agent-cockpit` → inline `AgentCockpit`
- Property Cockpit — `/modules/rentals/cockpit` → `src/components/cockpit/PropertyCockpit.tsx`
- Agent daily app (speed-to-lead) — `/realestate/agent` → `src/app/realestate/agent/AgentAppView.tsx`
- "Needs attention" ordering — `src/lib/cockpit/needs-attention.ts`

---

## 0. AI behavior & tone standard (governs all copy below)

Raven behaves like a seasoned executive assistant, not a chatbot. Every string in
this spec obeys these rules:

1. **Concise** — lead with the answer; no preamble, no "Great question."
2. **Calm** — urgency is conveyed by *order and word choice*, not exclamation marks or red everything.
3. **Direct** — second person, by name; make the call ("Here's the one thing"), don't hedge.
4. **Transparent** — always give the *why* in one clause, grounded in the real signal ("3 leads sat past 30 min").
5. **Never chatty** — one greeting per session, max. No filler acknowledgements.
6. **Never repetitive** — don't restate the cockpit; say what *changed* or *needs action*.
7. **Asks only when necessary** — see the auto-execute boundary (§7).
8. **Executes obvious actions automatically** — reversible/internal actions happen without asking (logging a touch, drafting a reply, ordering the list). Raven reports what it did.
9. **Surfaces uncertainty clearly** — "I estimated this from X; want me to confirm?" when a number is modeled, not measured.

**[UX] Two voices, branched by role (reuses existing role data — no new field):**
- `OPERATOR` / `MANAGER` (Luke) → **owner voice**: spoken *to* Luke, conversational brief, makes the call.
- `CONSULTANT` → **advisor voice**: keep the *existing* "Client conversation brief" in `AdvisorBrief.tsx` unchanged — it correctly prepares a consultant to talk to a client.
- `INVESTOR` → unchanged (read-only `/investor`; no brief).

---

## 1. The first 3 minutes — Morning Brief interaction

**[UX] Core principle: the cockpit is visible first; the brief is offered, never forced.**
When Luke opens the cockpit, `ExecutiveCockpit` renders fully as it does today. A
calm, **non-blocking** assistant bar docks at the top (not a modal) with the
greeting + a ready prompt. Nothing obscures his numbers.

### State model

```
[COCKPIT]  ── open ──▶  greeting bar appears (cockpit still fully visible)
   │
   │  greeting: "Good morning, Luke. {one-line state}. Ready for the 2-min brief?"
   │  actions:  [ Begin ]   [ Skip ]   [ Later ]
   │
   ├─ Skip  ──▶ bar collapses to a quiet "Brief" chip; cockpit as normal
   ├─ Later ──▶ same as Skip, but Raven re-offers at next visit / after lunch
   └─ Begin ──▶ [BRIEFING]
                   │  item-by-item; each item = one interpreted line + one action
                   │  controls per item: [ Do it ]  [ Next ]  [ Ask ]  [ End ]
                   │
                   ├─ Do it ──▶ executes/opens the action, marks item handled, advances
                   ├─ Ask ────▶ [FOLLOW-UP] one question in; concise answer; returns to item
                   ├─ Interrupt (tap cockpit / start talking / Esc) ──▶ pause, return to COCKPIT,
                   │                                                     state saved ("Resume brief")
                   └─ End / last item done ──▶ [WRAP] one-line summary ──▶ [COCKPIT]
```

### Flow copy (owner voice)

- **Greeting — something needs him** — `[COPY]`
  > "Good morning, Luke. One thing needs you today. Ready for the 2-minute brief?"  `[ Begin ]  [ Skip ]  [ Later ]`
- **Greeting — healthy** — `[COPY]`
  > "Good morning, Luke. Nothing's on fire — want the 90-second rundown anyway?"  `[ Begin ]  [ Skip ]`
- **Per-item shape** — `[COPY]` — one interpreted sentence, then one action:
  > "Response time slipped this week — 3 leads sat untouched past 30 minutes."  `[ Nudge the agents ]  [ Next ]  [ Ask ]`
- **Ask a follow-up** — `[COPY]` — Raven answers in one or two sentences, grounded:
  > Luke: "Which agents?" → "Priya and Marcus — both on Zillow leads from Tuesday. Want me to reassign the oldest to backup?"
- **Interrupt** — `[COPY]` — no scolding, state saved:
  > (Luke taps a tile) → brief docks: "Paused. Resume the brief anytime." `[ Resume ]`
- **End / wrap** — `[COPY]`:
  > "That's it — 2 items, 1 handled. You're back in your cockpit." (bar collapses to the chip)
- **Skip** — `[COPY]`:
  > "No brief. I'll flag it here if anything needs you." (collapses to chip; the always-on "One thing first" in the cockpit still carries the top signal — §3)

### Decisions embedded

- **[UX]** The brief **narrates the same items already in `AdvisorBrief.tsx`** (top watchout / top win / etc.), reframed to owner voice (§2) and delivered one at a time instead of as four static cards.
- **[UX]** "Begin" is never the only path — Skip/Later are first-class so the brief never blocks a busy owner.
- **[ENG]** Implement as a **client-side brief state machine** in `src/components/dashboard/**` over the existing dashboard data/signals. No backend contract change.
- **[ENG]** Voice (TTS greeting + STT follow-up) can use the browser Web Speech API — **no server dependency**; ships behind a toggle (§7, ⚑ SEAN #1).
- **[ENG]** The **follow-up Q&A** is the one net-new capability: a scoped LLM call answering only from the brief's already-loaded signals (reuse the existing Anthropic path used by `draftMessage`). Bounded, optional. ⚑ SEAN #3.

---

## 2. Owner-voice copy specification

Replace consultant/interrogation language (`Ask the operator: "…"`, "Use the
conversation prompt to confirm the operator agrees…") everywhere in the owner
view. **Every item ends in exactly one clear next action.** `[COPY]` throughout.

| State | Owner-voice copy | The one action |
|---|---|---|
| **Healthy day** | "You're clear today, Luke. Nothing needs you. Strongest signal: owner proceeds hit 47% — your best this quarter." | `[ See what's driving it ]` |
| **One urgent issue** | "One thing needs you: 3 leads sat untouched past 30 minutes this week." | `[ Nudge the agents ]` |
| **Multiple issues** | "Two things need you today. First — cash covers 34 days, nearing your 30-day floor. Then — Whitaker's pending file is missing disclosures, 26 hours in." | `[ Start with cash ]` then `[ Next ]` (ordered worst-first; one at a time) |
| **Incomplete data** | "I'm working with an estimate here — your starting cash balance isn't set, so runway is approximate." | `[ Set starting balance ]` (once; then it leaves the daily brief) |
| **Positive business signal** | "Good news worth knowing: your team's response time is back under 5 minutes — fastest all quarter." | `[ See the team view ]` (optional; a win needs no forced action) |
| **Recommended action (Raven proposes, Luke approves)** | "I drafted a reply to the Thompson lead in Priya's voice — want to send it, or should she?" | `[ Send ]  ·  [ Let Priya ]` |

**Rules encoded:**
- Second person, by name; the product makes the call, it does not interview Luke.
- Worst-first ordering for multiples (mirrors `needs-attention.ts` and the roster's existing worst-first sort).
- "Incomplete data" is stated as *Raven's* limitation ("I'm working with an estimate"), not a chore list aimed at Luke — and it appears **once during onboarding**, not daily.
- Wins are allowed to end without an action; everything else ends in one.

---

## 3. Always-on "One thing first"

**[UX] The callout must never disappear.** Today it renders only when a hard
threshold trips; on a healthy day the assistant voice vanishes and Luke sees a
wall of green tiles. Make it always render, with three copy modes. This applies
identically on Executive Cockpit, Brokerage Cockpit, and Property Cockpit.

| Health | `[COPY]` One-thing copy | Action |
|---|---|---|
| **Red** | "Needs you now: {issue, one clause}." e.g. "Needs you now: 3 leads sat untouched past 30 min." | `[ {direct action} ]` e.g. `[ Nudge agents ]` |
| **Yellow** | "Worth a look: {issue}." e.g. "Worth a look: cash covers 34 days, nearing your 30-day floor." | `[ See runway ]` |
| **Healthy (green)** | "You're clear. Strongest signal: {positive}." e.g. "You're clear — owner proceeds at 47%, best this quarter." | `[ See what's driving it ]` (optional) |

**[ENG]** The red/yellow branches already exist via `topPressure` /
`deriveBrokerageTopPressure` / property `noteFor`. The **only new behavior is the
green fallback**: when `topPressure` is null, surface the single strongest
*positive* signal instead of rendering nothing. The positive-signal selection is a
**view-layer pick over data the contract already exposes** (retention, owner
proceeds, response time) — no contract change. If a deterministic "top positive"
helper is wanted in the data layer, that is a Codex-lane addition to coordinate
(not required for v1; the view can choose).

---

## 4. Screen-to-screen pilot flow

**[UX] One front door that routes.** Luke should never choose between the three
brokerage doors (Analytics / Executive / Agent). The cockpit is home; the brief
and the "Needs attention" list *route him* to the right detail and back.

### The path (reusing current screens)

```
Executive Cockpit                    /modules/brokerage/cockpit        (home)
  └─ Morning Brief (docked)          AdvisorBrief.tsx                  (§1)
       └─ "Needs attention" item     needs-attention.ts ordering
            ├─ agent slipping ──▶ Agent coaching detail   /modules/brokerage/agent-cockpit?agentId=…
            │                        └─ [Nudge / Draft message] ──▶ communication action
            └─ property slipping ─▶ Rental property detail  /modules/rentals/cockpit  (+ per-property drill)
                                     └─ [Approve price drop / Send owner report] ──▶ communication action
  ◀── Return to cockpit ── every detail has a single clear "Back to cockpit"
```

### Minimum routing / hierarchy changes (all Claude-lane: `src/app/**`, `src/components/cockpit/**`)

- **[UX/ENG]** Make cockpit **"Needs attention" rows clickable**, linking to the relevant detail: agent rows → `/modules/brokerage/agent-cockpit?agentId={id}` (endpoint already exists per handoff doc); property rows → the property detail. *Today they are dead ends.*
- **[UX/ENG]** Make **Property Cockpit production rows tappable** to a per-property view (audit flagged the dead end). If a full per-property route doesn't exist yet, v1 can open the existing demo-style drawer pattern in-place — **view-only, no contract change**.
- **[UX]** Add a consistent **"Back to cockpit"** affordance on each detail (some only have a generic "Dashboard" link today).
- **[UX]** **Consolidate the three brokerage doors** so the cockpit is the single entry and Analytics/Agent are reached *through* it (via Needs-attention routing), not as co-equal top-level choices. ⚑ SEAN #6 (do now vs. after pilot).
- **[COPY]** Communication actions reuse what exists: the agent app's **Draft reply → approve/send** (`approveMessage` in `src/app/realestate/actions.ts`) and the demo's **owner-report** pattern. No new send pipeline.

**[ENG] Nothing here changes a data contract** — these are link targets, click handlers, and a routing consolidation inside Claude-owned view files. `nav.ts` changes (if the consolidation touches it) must be **coordinated with Codex** (flagged in the July-3 log as Codex-sensitive).

---

## 5. Agent first-week adoption rhythm

Reuses the speed-to-lead agent app (`/realestate/agent`) already built. The goal
is a daily rhythm an agent actually keeps, so the owner's cockpit fills with real
activity. **No new modules.**

| Moment | What the agent sees / does | Reuses | New? |
|---|---|---|---|
| **Morning brief** | Opens `/realestate/agent`: "Good morning, {name}. 2 leads need you now." + today's plan (untouched-first, band-colored). | `AgentAppView` Live/Today tabs | ✅ exists |
| **Daily execution** | Tap **Call now** (cell-bridge, stamps first touch) or **Draft reply**. | `initiateCall`, `draftForLead` | ✅ exists |
| **AI email/text** | Draft appears in "Drafts to approve"; agent approves → sends. | `approveMessage` | ✅ exists |
| **Automatic CRM update** | On call/approve, the touch logs back to the brokerage's CRM (BoldTrail/FUB) so the agent never double-enters. | — | **[ENG] Codex/ingestion lane** — CRM *write-back* adapter; internal `CallEvent`/`MessageEvent` already record it, the outbound push to CRM is the gap. Not Claude-lane. |
| **Evening review** | "Today: 4 leads touched, 1 still open. Reassign the open one to backup tonight?" | new light view in `AgentAppView` | **[UX] small, reuses data** |
| **Tomorrow preview** | "3 follow-ups queued for tomorrow; your first showing is 9am." | new light view | **[UX] small, reuses data** |

**[UX]** The morning + evening bookends are the adoption hooks; both are thin
views over data the app already has. The **CRM write-back** is the one real
engineering dependency and it belongs to Codex's ingestion lane — flag, don't
build.

---

## 6. Evening Debrief

**[UX] A three-minute, optional, conversational wrap-up.** Same non-blocking,
voice-optional pattern as the morning brief (§1). Never forced — offered via a
quiet end-of-day prompt; Luke can ignore it.

### Content (owner voice, `[COPY]`)

1. **Wins** — "Two deals moved to pending today, and the team's response time held under 5 minutes."
2. **Unfinished** — "One lead's still untouched from this morning." → *one confirmation question, only because it's actionable:* `[ Reassign to backup tonight? ]`
3. **What Raven learned** — "You've approved every one of Priya's drafts this week. Want me to auto-send hers from now on?" `[ Yes ]  ·  [ Keep approving ]`
4. **What tomorrow looks like** — "Three closings this week; Thursday's your heavy day — two of them land together."
5. **Close** — "That's your day. Rest easy — I'll flag anything overnight."

**Rules:**
- **[UX]** Exactly **one confirmation question**, and only when something is genuinely actionable (the reassign, or a learned-automation opt-in). Otherwise the debrief is pure narration.
- **[UX]** "What Raven learned" turns observed patterns into *offered automation* — this is where the product earns "AI operating system," but every automation is **opt-in**, never silently enabled.
- **[ENG]** Same client-side state machine + optional Web Speech as the morning brief. The "learned" suggestions are **pattern reads over existing event history** (e.g., approval rate on a given agent's drafts) — surfaced as a suggestion, executed only on approval. Any persistence of an "auto-send" rule is a **Codex-lane** setting (coordinate). ⚑ SEAN #4.

---

## 7. Auto-execute boundary (what Raven does vs. asks)

**[UX] The line that makes Raven feel like an assistant, not a liability:**

| Raven does automatically (reports after) | Raven always asks first |
|---|---|
| Log a call/touch, order the "needs attention" list, draft a reply, mark a lead contacted, compute/refresh a signal | **Send** any outward message (email/SMS to a lead/owner), **reassign** a lead between agents, **enable** a standing automation, anything **irreversible or client-facing** |

- **[UX]** Reversible + internal → do it, then report ("I drafted a reply — take a look").
- **[UX]** Outward-facing + irreversible → propose + one-tap approve ("Send it?").
- This mirrors the product's existing posture (drafts are created but a human approves the send in `approveMessage`).

---

## ⚑ Sean decisions (minimal, consolidated)

1. **Voice default** — recommend **text-first, voice opt-in** (toggle). Web Speech only; no infra cost.
2. **Brief entry** — recommend a **non-blocking greeting bar** (cockpit visible first) over an auto-opening modal. (This spec assumes the recommendation.)
3. **Follow-up Q&A** — approve the one net-new capability: a **scoped LLM answer over the brief's already-loaded data** (reuses the existing Anthropic path). Bounded to the brief context.
4. **Learned automations** — confirm the **opt-in only** rule for "what Raven learned" (e.g., auto-send a trusted agent's drafts); persistence would be a Codex-lane setting.
5. **CRM write-back priority** — the agent rhythm's "automatic CRM update" depends on pilot CRM creds; confirm it's in-scope for week one or deferred.
6. **Door consolidation timing** — collapse the three brokerage doors into one front door **now** or after the first pilot week.

---

## Engineering-implication summary (for Codex, after design approval)

Claude-lane (view/route/copy) work — no contract change:
- Owner-voice + role branch in `AdvisorBrief.tsx`; conversational brief state machine (client-side) in `src/components/dashboard/**`.
- Always-on "One thing first" green fallback in the three cockpit components.
- Clickable "Needs attention" + tappable property rows + "Back to cockpit" in `src/app/**` / `src/components/cockpit/**`.
- Agent app morning/evening bookend views in `AgentAppView.tsx`.

Codex-lane dependencies to coordinate (not Claude):
- CRM **write-back** adapter (agent rhythm) — ingestion lane.
- Optional deterministic "top positive signal" helper if wanted in the data layer.
- Persistence of any opt-in automation rule (e.g., auto-send).
- Any `nav.ts` change from door consolidation.
