# Brokerage "Cockpit" — Living Coordination Doc (Claude ⇄ Codex)

**Single source of truth for the tandem brokerage build.** Update your own lane section + append to the
Progress Log after every step, so the other agent always knows what's done and where we are.

**Editing rule (agreed):**
- **Claude** edits `## Claude Lane Status`.
- **Codex** edits `## Codex Lane Status`.
- **Shared decisions / blockers** live in `## Shared Current State`; **handoffs** in `## Next Actions` — edit these only
  by coordination (don't rewrite the other's intent).
- Both append to `## Progress Log` with a `[Claude]` / `[Codex]` tag. `## Reference` is stable; change by coordination.

**Branch:** `feat/heartbeat-landing` · **Last updated:** 2026-07-11 by Claude ·
**Related specs:** `brokerage-data-sources.md`, `investor-owner-dashboard-plan-v2.md`, `executive-cockpit-tile-set.md`,
`project-raven-cockpit-ux-audit.md`, `project-raven-pilot-interaction-spec.md`.

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

### ⚑ Sean decisions (minimal — see spec for detail)
Voice default (text-first, voice opt-in) · brief entry as non-blocking bar vs modal · approve scoped follow-up Q&A LLM call ·
opt-in-only for learned automations · CRM write-back in week one vs deferred · door consolidation now vs after pilot.

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

_View/UX (Cockpit). Owned by Claude._
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
