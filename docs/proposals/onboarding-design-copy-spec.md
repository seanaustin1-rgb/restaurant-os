# Onboarding & Demo — Design + Copy Spec

**Status:** spec-of-record (design/spec track). Pairs with the engineering track (Codex).
No component code changed here. Grounded in the 2026-06-27 screenshots
(`docs/screenshots/onboarding-2026-06-27/`) and the live code
(`OnboardingFlow.tsx`, `/access`, `SetupOverviewCard.tsx`, the `/demo/*` estimators).

Design tokens (from `tailwind.config.ts`): `ink #0B0D0B`, `surface #141614`,
`line #232623`, `muted #8A8F89`, `ink-text #E6E8E4`, `copper.*`; fonts
`display` = Cormorant Garamond (serif), `body` = DM Sans, `mono` = Space Mono.

---

## 1. Screenshot review (summary)

**Strong (desktop 01/03/07):** polished dark theme; numbered step structure
(Optional identity → Known weekly numbers → Monthly fixed bills) reads clearly;
microcopy is good; sector tailoring already real (service has Field-software
dropdown; VR has PMS / ADR / occupancy / gross-vs-net). This already converges
with the PR #43 `profileQuestions` spec.

**Must-fix (mobile 02/04/08):** horizontal overflow on every mobile view —
cards/fields run off the right edge, "Tour" buttons disappear (02), headline
truncates ("dashbo… / say?", 04), 3-up field rows overflow (08). Root cause is
responsive layout, not content. (Engineering track owns the fix; §2 is the
design intent to build to.)

---

## 2. Mobile-first layout recommendation

Applies to: `demo/tour` (template picker), restaurant estimate (`/demo`),
service estimate (`/demo/service`), vacation rental estimate (`/demo/vacation-rental`).

### 2.1 Page shell (all four)
- **One column by default.** Design every screen for a 360px viewport first; add
  columns only at `sm`/`lg`.
- **Container:** centered, `w-full max-w-xl mx-auto px-4 sm:px-6`. Estimators
  max-w-xl (~576px single column); template picker max-w-6xl for its grid.
- **No fixed/min widths** on cards or field wrappers (the 08 overflow). Any
  `min-w-[…]` becomes `w-full sm:min-w-[…]`.
- **Vertical rhythm:** sections `space-y-8`, fields within a section `space-y-4`.

### 2.2 Responsive headline
The serif H1 is wrapping mid-phrase on mobile. Spec:
- `font-display text-3xl sm:text-4xl lg:text-5xl leading-tight text-balance`
- Subhead `text-sm sm:text-base text-muted text-pretty max-w-prose mx-auto`.
- Center on mobile; keep the eyebrow (`OUTFRONT DATA`) at `text-[11px] tracking-wider`.

### 2.3 Field grids → stack on mobile
Every two/three-up money row collapses to one column:
- Two-up (`Weekly labor | Weekly food`): `grid grid-cols-1 sm:grid-cols-2 gap-4`.
- Three-up (VR `Properties | ADR | Occupancy`): `grid grid-cols-1 sm:grid-cols-3 gap-4`.
- Money inputs full width, `$`/`%` affix inside the field, `inputMode="numeric"`,
  `tnum` for figures.

### 2.4 Template picker (`demo/tour`) grid
- `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`.
- Cards `w-full` (kills the right-edge clip); whole card is the tap target,
  `Tour` pill top-right stays inside via `flex items-start justify-between`.
- Min tap height 44px; card padding `p-4`.

### 2.5 Estimator step pattern (shared)
Each numbered section = a labeled group:
- Step header row: numbered chip (`h-6 w-6 rounded-full border`) + bold label +
  inline helper that **wraps under** the label on mobile (`flex flex-col sm:flex-row sm:items-center sm:gap-2`).
- Sticky bottom action bar on mobile for the primary CTA
  (`sticky bottom-0 bg-ink/90 backdrop-blur px-4 py-3`) so "See my estimate" is
  always reachable without scrolling past long forms.

---

## 3. Copy rules

### 3.1 Identity helper — one consistent pattern
Every estimator's first section is titled **"Optional identity"** with the same
helper, regardless of sector:

> **Optional identity** · Skip it or fill it in — we don't save this.

Sector-specific notes move to the **field level**, not the section header:
- Restaurant name field note: *"We'll try a live Google rating match."*
- Others: no field note (the section helper covers it).

This removes today's drift ("try a live Google rating match" vs "personalize the
estimate" as *section* helpers).

### 3.2 Vacation-rental headline/subhead — simplify
Current subhead packs in a formula. Replace:
- **H1:** `Vacation rental estimate` (unchanged)
- **Subhead:** *"A 60-second, no-login read on occupancy, nightly rate, and
  what's left after cleaning, fees, and owner payouts."*
- Move `occupancy × ADR × …` out of the header entirely; if useful, show it as a
  small caption above the result, not the intro.

### 3.3 "What this estimate is based on" — standard footer line
Every estimator ends its inputs with one consistent, scannable line (chips or a
single sentence) so users know what drove the read:

> **Based on:** average weekly sales · labor · food · beverage · fixed bills.

Per sector, swap the list:
- Restaurant: `weekly sales · labor · food · beverage · fixed bills`
- Service: `weekly revenue · payroll · materials · subcontractors · fixed bills`
- Contractor: `weekly revenue · materials · field labor · subs · fixed bills`
- Vacation rental: `occupancy · nightly rate · cleaning · platform & mgmt fees · fixed bills`

Pattern: `text-xs text-muted`, chips separated by `·`. Same placement on all four
(directly above the CTA).

### 3.4 Template-picker card differentiation
Cards read samey today (label + one descriptor line). Add two differentiators:
1. **A signature metric chip** per sector (the one number that sector lives or
   dies on), e.g.:
   - Restaurant → `Prime cost`
   - Service → `Payroll load`
   - Contractor → `Job margin`
   - Real estate → `Company dollar`
   - Vacation rental → `Occupancy`
   - Retail → `Gross margin`
2. **A "who it's for" sub-line** in plain language, e.g. Restaurant →
   *"Full-service, QSR, bar, or café."* This also previews the sector's first
   profile question (`serviceModel`).

Keep the dual path (per-card `Tour` pill + the text estimate links below).

---

## 4. Authenticated onboarding flow (evolve, don't reinvent)

The flow exists: `OnboardingFlow.tsx` (Details → Template → Data source) inside a
single `max-w-lg` card with a 3-dot stepper — already mostly mobile-safe. The
changes are about **sequence + sector questions + the post-create hub**, wiring
in the PR #43 template fields (`scaleAnchor`, `profileQuestions`, `seedAccounts`).

Recommended order: **Industry first**, then name + scale, then sector questions,
then data source — so the form can adapt to the chosen sector.

### Screen 1 — Industry selection (move to first)
- **H1:** "What kind of business is this?"  **Sub:** "This shapes your heartbeat
  and which modules show up first. You can change it later."
- Reuse the picker pattern from `demo/tour` (§2.4) but in the onboarding card:
  `grid grid-cols-1 sm:grid-cols-2 gap-2`, each option = label + description +
  `primarySetup` hint (already in `IndustryTemplate`).
- Selecting a sector sets the template that drives screens 2–3.

### Screen 2 — Business name + scale anchor
- **H1:** "Add your business."
- **Field 1 — Business name** (existing).
- **Field 2 — Scale anchor**, label driven by `template.scaleAnchor.label`
  (seats / clients / jobs / agents / units / SKUs) instead of the hardcoded
  "Seat count / team size." Optional, numeric.
- (Optional) **Cash-on-hand anchor** — small, collapsible: "Bank balance today
  (optional)" → seeds Cash Runway. Maps to existing `cashBalanceAnchor`.

### Screen 3 — Sector questions (NEW, the "particularly")
- **H1:** "A few specifics for {sector}."  **Sub:** "Rough answers are fine —
  they tune your targets and benchmarks."
- Render `template.profileQuestions` generically by `type`
  (`select`/`number`/`percent`/`money`/`boolean`), 3–5 fields, single column,
  each with its `helper`. Required-marked questions gate Continue.
- This is the screen that makes a contractor stop being asked "seat count" and
  start being asked trade / materials split / deposit %.

### Screen 3b — Roster import (brokerage & vacation rental only)
Sectors with sub-entities skip the abstract "how many / average split" question
and import the **whole roster** instead — agents for a brokerage, properties for
a VR manager. (Shown only when `businessType` is `REAL_ESTATE_BROKERAGE` or
`VACATION_RENTAL`; see the templates doc "Roster import" for the schema.)

- **H1:** "Bring in your {agents | properties}."  **Sub:** "Import once and
  they're set up — splits and targets fill in, and each one gets a status light
  on your morning roster."
- **Three entry tiles** (`ChoiceCard`, single column on mobile):
  1. **Import from your software** *(recommended)* — "Drop a CSV/Excel export
     from {Brokermint, Sisu, BoldTrail, KW Command… | Guesty, Hostaway, OwnerRez…}."
     Opens the column mapper.
  2. **Upload a spreadsheet** — "Any Excel/CSV — we'll map the columns."
  3. **Add manually** — "Just a few? Add them by hand."
- **Column mapper:** detected columns on the left, target fields on the right
  (`Name`, `Agent split %` / `Mgmt fee %`, `YTD GCI` / `ADR`, `Occupancy`, …).
  Show a 3-row live preview; flag unmapped required fields inline.
- **Confirmation line** (the payoff): *"Imported 14 agents · blended company
  dollar 26% · 3 flagged for a closer look."* — previews the RAG read (§6) before
  they even reach the dashboard.
- **Skippable.** "I'll do this later" drops to the manual path; the sector
  default split/fee stands until a roster lands.

### Screen 4 — Data source / tier (existing)
- Keep the four-tier picker (TIER_1…4) and copy ("nobody gets turned away").
- Add a one-line preview of the sector's `primarySetup` ("Typical for {sector}:
  POS, bank, payroll, reviews") so the tier choice has context.

### Screen 5 — Setup hub (post-create; evolve `SetupOverviewCard`)
After create, land on the hub (already exists on the dashboard). Make it the
explicit "what's next" checklist:
- **Source progress** (connected / planned / blocked — already computed).
- **Targets seeded** — show the sector `seedAccounts` were applied ("Your Profit
  First targets are set for {sector}; adjust anytime").
- **Invite helpers** — entry to the access handoff (§4.6).
- Keep "Enter rough numbers" path to the matching `/demo/*` estimator for an
  instant read before sources connect.

### 4.6 Access handoff — invite + owner-approval flow
`BusinessAccessInvite` and the `UserRole` enum (OPERATOR / CONSULTANT / INVESTOR
/ MANAGER) now exist in the schema, so `/access` graduates from a static
role-explainer to a **real invite + owner-approval flow**. (Approved decisions
D9/D10.)

**Frame around "who owns vs who helps."** Lead line on `/access`:
> The business owns the data. Advisors prepare, managers run daily ops, and
> investors view — each only after the owner approves.

**Permission ceilings (per role, shown as a `MetaChip` on each role card):**

| Role | Ceiling chip | Can do | Cannot do (without owner) |
|---|---|---|---|
| **Consultant / accountant** | `Prepare setup · owner approves connections` | Draft templates, map data sources, stage imports, comment | Activate a bank/POS/payroll connection; change targets live; invite others |
| **Investor** | `Read-only heartbeat · after approval` | View the heartbeat/lenses for the business they're approved on | See ledgers/raw transactions; export; touch any setting |
| **Manager** | `Daily ops · no financial setup` | Daily ops modules, roster follow-ups, log activity | Connect accounts, change allocations/targets, manage access |

Investor scope is **per-business** by default (one invite = one business);
multi-business "portfolio view" is a later add, not the default.

**The flow (owner-initiated, explicit at every step):**
1. **Owner invites** — `/access` → "Invite a helper": enter email, pick role,
   optional scope/note. Creates a `BusinessAccessInvite` (status `PENDING`).
2. **Invitee accepts** — email link → sign in → sees a *read-only preview* of
   exactly what the role will grant, and accepts. Status → `AWAITING_APPROVAL`.
   Accepting never grants access by itself.
3. **Owner approves** — owner sees a pending-approval row on `/access` (and a
   setup-hub nudge), reviews the ceiling, and approves. Status → `ACTIVE`. Only
   now does the `UserRole` row get created and access turn on.
4. **Sensitive actions stay gated** — even when ACTIVE, every connection /
   target / money-moving action a non-owner attempts ends in an owner approval
   step. Copy must never imply a helper self-grants — always "…owner approves."
5. **Owner can revoke** anytime → status `REVOKED`, role row removed.

**States to design:** `PENDING` (invite sent), `AWAITING_APPROVAL` (accepted,
owner action needed — highlight on the owner's view), `ACTIVE`, `REVOKED`,
`EXPIRED`. Each invite row shows email · role chip · status · timestamp, with the
owner's primary action inline.

**Copy strings (final-draft, lift verbatim):**
- Invite CTA: *"Invite a helper"*
- Role-preview banner (invitee): *"This is a preview. You'll get access once {owner}
  approves."*
- Owner pending row: *"{email} accepted a {role} invite — approve to turn on access."*
- Revoke confirm: *"Remove {email}'s access? They'll lose it immediately."*

Layout already responsive (`grid-cols-1 md:grid-cols-2`); keep, ensure role
chips + status chips wrap on mobile. Reuse `ChoiceCard` for role selection in the
invite form and `MetaChip` for the ceiling/status chips.

---

## 5. Reusable component patterns to extract

These recur across demo + onboarding and should become shared primitives so copy
and layout can't drift (pairs with Codex's "shared sector-question definitions"):

| Pattern | Where it repeats | Proposed primitive |
|---|---|---|
| Page header (eyebrow + serif H1 + subhead) | every demo + onboarding screen | `<PageIntro eyebrow title subhead>` with the responsive H1 rules (§2.2) |
| Numbered step section (chip + label + helper) | all estimators, onboarding | `<StepSection index title helper>` |
| Money / percent input with affix | every estimator | `<NumericField prefix="$" suffix="%" inputMode>` (tnum, mobile-full-width) |
| Selectable option card (label + desc + tag/chip) | template picker, industry select, tier picker, access roles | `<ChoiceCard selected label desc trailing>` — single source for the tap-target + selected state |
| Signature-metric / status chip | template cards, access role ceilings, hub status | `<MetaChip>` (copper-dim border, `text-[10px]` uppercase) |
| Sticky mobile action bar | long estimator/onboarding forms | `<StickyActions>` |
| "Based on:" inputs summary | all estimators | `<EstimateBasis items=[…]>` (§3.3) |
| RAG status dot + entity row | agent roster, property roster, lens detail | `<RagRosterRow status driver action>` / `<RagRoster>` (§6) |
| Roster import column mapper | brokerage + VR onboarding | `<RosterImport accept mapTo>` (§ Screen 3b) |

Extracting `ChoiceCard` is the highest-leverage one — it's used by the template
picker, industry selector, tier picker, and access-role cards, all of which
currently re-implement the same selected/hover/border treatment.

---

## 6. RAG roster — the morning triage read

The payoff of importing a roster (§ Screen 3b, and the templates doc) is a
**red / amber / green** read on every tracked entity, sorted so the ones that
need the operator *float to the top*. A broker opens the app and instantly sees
which agents need a call today; a VR manager sees which properties are slipping —
**not** a flat alphabetical list they have to scan. Green entities don't demand
attention; they earn a quick "nice work."

This is one reusable pattern (`RagRoster`) instantiated per sector:
- **Brokerage → agent roster.** Entities = agents (from the import).
- **Vacation rental → property roster.** Entities = units/listings.
- (Generalizes later to any sub-entity: jobs for a contractor, locations for
  multi-unit retail/restaurant.)

### 6.1 Status model (red / amber / green)

Each entity rolls its key metrics up to one status, scored against the entity's
own target band:

- 🔴 **Red — needs follow-up today.** A core metric is below its floor
  (e.g. agent with stalled pipeline / no closings vs. pace; property occupancy or
  net payout below threshold; a guest/agent Aura drop).
- 🟡 **Amber — watch / drifting.** Trending toward a floor but not through it, or
  one soft signal (slipping pace, a single bad review, AR aging).
- 🟢 **Green — on or above target.** No action needed; eligible for an "attaboy."

Status = the worst lens that applies (one red metric makes the entity red), so
the roster is **exception-first** by construction. Thresholds are per sector and
tunable; defaults derive from `defaultTargets` + the entity's imported metrics.

Signature drivers per sector (the metrics that set the light):
- **Agent:** closings/GCI vs. pace · pipeline count vs. expected · days since last
  deal · lead-conversion · agent Aura (reviews/referrals).
- **Property:** occupancy vs. target · ADR trend · net owner payout trend ·
  maintenance/turnover drag · guest Aura.

### 6.2 Sort & layout

- **Sort: red → amber → green.** Within a band, worst-first (by severity, then by
  dollars at stake) so the most urgent red is row one.
- **Roster row** (`RagRosterRow`): status dot · name · the one driving metric
  ("Occupancy 41% ▼" / "0 closings in 38 days") · a trend sparkline or arrow · a
  primary action ("Call", "Review", "Adjust split"). Whole row is the tap target;
  44px min height; figures `tnum`.
- **Top band — "Needs you this morning":** the reds (and ambers) pinned in a
  highlighted group with a count chip ("3 need a closer look"). Greens collapse
  under a quiet "On track (11)" expander with a one-tap **"Send kudos"** action.
- **Mobile:** single column, status dot leads each row, driving metric on line
  two; never a horizontal table that clips (the §2 overflow lesson).

### 6.3 Copy

- Section H1: *"Your morning roster."*  Sub: *"Reds first — these need you today.
  Everyone else is holding."*
- Empty/all-green state: *"All green. Nothing needs you this morning — maybe send
  a kudos."*
- Red row helper verb is an **action**, not a label ("Call Dana — pipeline stalled"),
  so the roster reads like a to-do list, not a report.

### 6.4 Where it lives

- A **dashboard module** (`agent-roster` / `property-roster`, already added to the
  brokerage & VR `defaultModuleKeys` in the templates doc) — the operator's home
  read.
- Surfaces as the **Pressure/Momentum lens** detail for these sectors (it *is* the
  per-entity expression of those lenses).
- Phase note: the status rollup reads roster metrics + targets, so it ships on
  the **phase-1** data (no dependency on the phase-2 allocation-engine work).
  Daily auto-refresh of metrics depends on the relevant source connections.

---

## Handoff notes
- §2 is the design intent for the engineering mobile-clipping fix — build to these
  breakpoints/containers.
- §3 copy strings are final-draft; lift verbatim.
- §4 sequences the authenticated flow around the PR #43 `IndustryTemplate`
  fields; the shared sector-question structure (Codex track) is the data source
  for screens 1–3.
- §4.6 is now a real invite + owner-approval flow on `BusinessAccessInvite`
  (approved D9/D10), not a static role explainer.
- §6 (RAG roster) and Screen 3b (roster import) are the new spine: import →
  per-entity status → red-first morning read. Both ship on phase-1 data.
- §6 thresholds/scoring are defaults — expect a tuning pass once real roster data
  is connected.
- Open item: signed-in onboarding screenshots still needed for a real
  before/after comparison (README flagged `/onboarding?new=1` didn't render headless).
