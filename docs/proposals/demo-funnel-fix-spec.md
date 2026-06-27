# Demo funnel — fix spec (Codex implementation)

**Status:** spec-of-record (design/spec track). Implementation is the engineering
track's (Codex). Source of findings: `/impeccable critique` of the public demo
funnel, snapshot `.impeccable/critique/2026-06-27T13-12-23Z__src-app-demo-public-funnel.md`
(score 26/40). Ordered by the operator's chosen priority. Honor `PRODUCT.md`
(principle #1 "heartbeat first"; WCAG 2.1 AA) and `DESIGN.md` tokens.

Surfaces: `/demo` (`src/app/demo/DemoEstimator.tsx`), `/demo/service`, `/demo/contractor`,
`/demo/real-estate`, `/demo/retail`, `/demo/vacation-rental` (`*Estimator.tsx`),
`/demo/tour` (`src/app/demo/tour/page.tsx`).

---

## 1. Heartbeat-first — value before the full form  *(P1, do first)*

**Problem:** each estimator asks for ~8–12 empty money fields before showing any
read. That violates principle #1 and greets a first-timer with a wall of inputs.

**Target behavior:** the *first* meaningful input yields an immediate, partial
heartbeat; the rest of the form refines it.

- Make the result component render from **partial input**. The single required
  field (`Average weekly sales` / `Average weekly revenue` / VR `Properties · ADR ·
  Occupancy`, already marked `*`) is enough to compute a first read. Everything
  else adjusts the existing result rather than gating it.
- Reorder each estimator so step 2 ("Known weekly numbers") and the live result
  come **before** "Monthly fixed bills". Fixed bills become a progressively
  disclosed "Add fixed bills to see break-even" section (collapsed by default),
  not a precondition for the first number.
- Show the result inline as soon as the required field has a value — debounce
  ~300ms; no submit needed for the first read. Keep "See my estimate" as the
  affirmative commit / scroll-to-detail.
- Empty/initial state of the result panel: a one-line prompt ("Enter weekly sales
  to see your first read"), not a blank or a zeroed gauge.

**Acceptance:** typing only the required field produces a visible heartbeat;
fixed-bill fields are collapsed until requested; no full-form completion required
for a first result.

---

## 2. Contrast & placeholders — legibility / AA  *(P1)*

**Problem:** every field shows a gray Space-Mono sample (`$ 60,000`). Entered vs
sample is ambiguous, and gray mono on Ink likely fails AA 4.5:1.

- Entered values render at `ink-text` (#E6E8E4), full weight — never the muted/gray
  placeholder color.
- Placeholders: demote visually but keep ≥4.5:1 against the field bg (Ink #0B0D0B).
  Re-tone the placeholder token up the ink ramp until it passes; do not leave it at
  `muted` (#8A8F89) if it fails on Ink. Verify each with a contrast check.
- Prefix sample values with intent so they don't read as data: `e.g. 60,000`
  (label or `aria`-friendly), or move the example into the field helper.
- Apply the same treatment to the select controls (Field software, PMS, gross/net)
  so chosen vs default is unambiguous.

**Acceptance:** all field text (entered, placeholder, affix, select) passes AA
4.5:1 on its background; entered values are visually distinct from samples.

---

## 3. Mobile horizontal clipping  *(P0)*

**Problem (root cause in code):** hardcoded multi-column grids with no responsive
prefix, plus a page shell without horizontal padding. At 360px the fields, the
"Tour" pills, and the serif H1 are cut off (screenshots 02/04/08).

Exact changes (apply the pattern everywhere it occurs, not only these lines):

- **Estimator field grids → stack on mobile.** In every `*Estimator.tsx`:
  - `grid grid-cols-2 …` → `grid grid-cols-1 sm:grid-cols-2 …`
    (`DemoEstimator.tsx:227,235,247,282`; `VacationRentalEstimator.tsx:160,180,199`; same in service/contractor/real-estate/retail).
  - `grid grid-cols-3 …` → `grid grid-cols-1 sm:grid-cols-3 …`
    (`VacationRentalEstimator.tsx:175`).
  - Result-panel sub-grids that are pure figures (`grid-cols-3 gap-2 text-center`)
    may stay multi-column but must not set a min width; verify they fit 360px.
- **Page shells get horizontal padding + width clamp.** Form wrappers
  (`*Estimator.tsx` `mx-auto max-w-xl`) and the tour container
  (`tour/page.tsx:59 mx-auto max-w-6xl`) → add `w-full … px-4 sm:px-6`.
- **Responsive H1.** The serif display H1 truncates on mobile. Apply
  `text-3xl sm:text-4xl lg:text-5xl leading-tight text-balance` and ensure the
  page root has no element forcing width beyond the viewport (`overflow-x` should
  never be needed once padding + stacking are in).
- **Tour cards.** Keep `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` (already
  responsive); the clipping there is the missing shell padding above. Ensure each
  card is `w-full` and the `flex items-start justify-between` keeps the Tour pill
  inside.
- **Sticky mobile CTA.** Add a thumb-zone sticky "See my estimate"
  (`sticky bottom-0 bg-ink/90 backdrop-blur px-4 py-3`) so the primary action is
  reachable without scrolling past the form.

(Full breakpoint intent is in `onboarding-design-copy-spec.md` §2 — build to it.)

**Acceptance:** at 360px every estimator and the tour picker show no horizontal
scroll/clip; H1 wraps cleanly; Tour pills visible; primary CTA reachable in the
thumb zone.

---

## 4. Identity-helper copy drift  *(P2)*

Standardize the first section across all estimators:

> **Optional identity** · Skip it or fill it in — we don't save this.

Move sector-specific notes to the **field** level (e.g. restaurant name field:
"We'll try a live Google rating match"). Remove the per-sector *section*-helper
divergence ("personalize the estimate" vs "try a live Google rating match").
Lift the standardized strings verbatim from `onboarding-design-copy-spec.md` §3.1.

---

## 5. Choice overload atop `/demo`  *(P2)*

The five "Try the X estimate" cross-links currently sit above the form and compete
with the task. Demote them: move below the form, or collapse into a single
"Different business? Switch estimate" affordance. The current sector's form stays
the clear focus. See `onboarding-design-copy-spec.md` §3.3/§3.4 for the related
"Based on:" footer and card-differentiation patterns.

---

## Re-check

After implementation, re-run `/impeccable critique src/app/demo` and `/impeccable
audit` to confirm the score moves and AA passes. Trend is tracked under slug
`src-app-demo-public-funnel`.
