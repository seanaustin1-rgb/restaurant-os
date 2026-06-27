# Onboarding & Demo — Design + Copy Spec

**Status:** spec / design+copy track (Claude). Pairs with the engineering track (Codex).
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

### 4.6 Consultant / accountant / investor access handoff
`/access` already defines four roles (owner, consultant/accountant, investor,
manager) with per-role step lists — good bones. Spec refinements:
- **Frame around "who owns vs who helps."** Lead line: "The business owns the
  data. Advisors prepare; investors view after approval."
- **Each role card states its default permission ceiling** as a chip:
  - Consultant/accountant → `Can prepare setup · owner approves connections`
  - Investor → `Read-only heartbeat · after approval`
  - Manager → `Daily ops · no financial setup`
- **Approval is explicit and owner-initiated.** Copy must never imply an advisor
  or investor self-grants access — every sensitive step ends "…owner approves."
- Layout already responsive (`grid-cols-1 md:grid-cols-2`); keep, ensure role
  chips wrap on mobile.

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

Extracting `ChoiceCard` is the highest-leverage one — it's used by the template
picker, industry selector, tier picker, and access-role cards, all of which
currently re-implement the same selected/hover/border treatment.

---

## Handoff notes
- §2 is the design intent for the engineering mobile-clipping fix — build to these
  breakpoints/containers.
- §3 copy strings are final-draft; lift verbatim.
- §4 sequences the authenticated flow around the PR #43 `IndustryTemplate`
  fields; the shared sector-question structure (Codex track) is the data source
  for screens 1–3.
- Open item: signed-in onboarding screenshots still needed for a real
  before/after comparison (README flagged `/onboarding?new=1` didn't render headless).
