---
target: public demo funnel
total_score: 26
p0_count: 1
p1_count: 2
timestamp: 2026-06-27T13-12-23Z
slug: src-app-demo-public-funnel
---
# Critique — Public demo funnel (`/demo`, `/demo/tour`, sector estimators)

Scope: public no-login funnel only (template picker + restaurant/service/VR estimators),
evaluated from committed screenshots + source + DESIGN.md/PRODUCT.md. Authenticated
onboarding/dashboard not covered (no signed-in renders exist yet).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No visible inline validation; mobile clipping hides state |
| 2 | Match System / Real World | 3 | Plain, sector-true language ("what would your dashboard say?") |
| 3 | User Control & Freedom | 3 | Free-edit form; multiple estimate entry links |
| 4 | Consistency & Standards | 3 | Shared step structure; identity-helper copy drifts per sector |
| 5 | Error Prevention | 2 | $-prefixed numeric inputs, but no constraints/validation shown |
| 6 | Recognition vs Recall | 3 | Labels + helper text throughout; mobile pushes them off-screen |
| 7 | Flexibility & Efficiency | 2 | Long single-column form; no save/resume |
| 8 | Aesthetic & Minimalist | 3 | Genuinely restrained, on-brand; mobile breakage + empty-field sameness cap it |
| 9 | Error Recovery | 2 | No error states evident |
| 10 | Help & Documentation | 3 | Strong inline microcopy ("ballparks are fine") |
| **Total** | | **26/40** | **Acceptable — strong desktop foundation, broken mobile** |

## Anti-Patterns Verdict

LLM: Does NOT read as AI slop. Avoids cream-SaaS, gradient hero-metric, identical card grid.
The dark "instrument panel" identity is committed and distinctive. Tells present are restraint
*over*-applied (all-empty forms look samey) — not generic-AI tells.

Deterministic scan: `detect.mjs` on `src/app/demo` → 0 findings (exit 0). Reach caveat: static
scan over Tailwind-in-JSX; no dev server, so no rendered-DOM/contrast overlay.

## Priority Issues

- **[P0] Mobile horizontal clipping across the funnel.** Estimators hardcode `grid-cols-2`/`grid-cols-3`
  with no responsive prefix (DemoEstimator.tsx:227/235/247, VacationRentalEstimator.tsx:175); the
  tour container (tour/page.tsx:59 `mx-auto max-w-6xl`) lacks horizontal padding. On 360px: fields,
  "Tour" pills, and the H1 are cut off. Breaks the primary device for a phone-first operator.
  Fix: `grid-cols-1 sm:grid-cols-2` / `grid-cols-1 sm:grid-cols-3`; wrap shells in
  `w-full max-w-* mx-auto px-4 sm:px-6`; `text-balance` + responsive clamp on the H1. → `adapt`
- **[P1] Placeholder-only forms; low-contrast gray mono placeholders.** Every field shows a gray
  Space-Mono sample ($60,000). Entered vs sample is hard to tell, and gray mono on Ink likely fails
  AA 4.5:1. Fix: brighten entered text to ink-text, demote placeholders, label samples as "e.g.". → `audit`
- **[P1] Value comes after a wall of inputs (violates "heartbeat first").** Both estimators present
  ~8–12 empty money fields before any read. Fix: progressive disclosure — one or two inputs yield a
  first heartbeat, reveal the rest to refine; sticky "See my estimate" on mobile. → `onboard`
- **[P2] Identity-helper copy drifts per sector.** Restaurant "try a live Google rating match" vs
  service "personalize the estimate" as *section* helpers. Standardize ("Optional identity · skip or
  fill — we don't save this"); sector note at field level. → `clarify`
- **[P2] Choice overload at the top of /demo.** 5 "Try the X estimate" cross-links sit above the form.
  Group/demote so the current sector's form is the clear focus. → `layout`

## Persona Red Flags

**Casey (distracted mobile):** the funnel clips on her phone — "Tour" buttons vanish, fields run
off-screen, H1 truncates. No thumb-zone sticky CTA. This is the make-or-break device and it's broken.

**Jordan (first-timer):** "What would your dashboard say?" invites, then a wall of empty $ fields
greets them with no first result to anchor understanding. Likely abandons before the payoff.

**The Tired Operator (project persona, PRODUCT.md):** checks after hours on a phone → hits the broken
mobile layout first. Directly contradicts principle #1 "show the heartbeat first."

## Minor Observations

- Restaurant estimate placeholder identity is `Stone Grille & Taphouse` / `York, PA` — charming, but
  ensure it never reads as pre-filled real data.
- Template-picker cards are six near-identical blocks (icon-kicker + serif name + descriptor); add a
  signature-metric chip per sector to differentiate (already in the design-copy spec §3.4).
- Tour picker desktop is strong; the dual path (per-card Tour pill + text links) is good — keep it.

## Questions to Consider

- What if a single number (weekly sales) produced an instant heartbeat, and everything else only
  refined it? Would the form still feel like a form?
- Does the demo need every fixed-bill field up front, or can "break-even" unlock progressively?
- What would a confident mobile-first version of this funnel look like if designed at 360px first?
