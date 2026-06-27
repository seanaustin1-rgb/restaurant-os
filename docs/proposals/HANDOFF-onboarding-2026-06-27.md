# Handoff — Onboarding / Sector Templates / Codex Integration

**Date:** 2026-06-27 · **Repo:** seanaustin1-rgb/restaurant-os · **Working branch:** `claude/keen-hamilton-maxses`

This is a cold-start handoff for the next chat. It captures what's done, what's
live, the open decisions, and how to resume. Claude is on the **design/copy/spec**
track; Codex is on the **engineering** track (keeping code stable).

---

## 1. Current state — what's DONE and merged to `main`

**Codex review CI integration (fully shipped, merged):**
- `.github/workflows/codex-review.yml` posts an advisory (non-blocking) Codex
  review on every PR. Path to working took 3 fixes, all merged:
  - #36 initial integration · #39 auth (`codex login --with-api-key`, fixes 401
    "Missing bearer") · #42 sandbox bypass (`--dangerously-bypass-approvals-and-sandbox`,
    fixes `bwrap: loopback` on hosted runners) + hardening (same-repo-PR gate,
    `OPENAI_API_KEY` dropped from the review step env).
- Requires repo secret `OPENAI_API_KEY` (set; user added API credit). **Recommended
  follow-up (operator):** swap it for a dedicated, spend-capped key.
- Known trait: the review comment truncates at 60k chars; long investigations
  show no final "Finding:" block — that's truncation, not a clean review.

**Sector onboarding — phase-1 engineering (already on `main`, implemented by Codex):**
- `src/lib/industry-templates.ts` — `IndustryTemplate` extended with
  `scaleAnchor`, `seedAccounts`, `defaultTargets`, `profileQuestions` for all six
  `BusinessType`s (RESTAURANT, SERVICE, CONTRACTOR, REAL_ESTATE_BROKERAGE,
  VACATION_RENTAL, RETAIL). Matches PR #43 proposal nearly verbatim.
- `src/app/onboarding/actions.ts` — `createRestaurant` now consumes the template
  (`seedAccounts`, `targetData()`, `profile`, `scaleValue`) + sector-aware
  `firstRunPath()`.
- `prisma/schema.prisma` — `Restaurant.profile Json?` is live; new
  `BusinessAccessInvite` model + `accessInvites` relation; `UserRole` enum =
  OPERATOR/CONSULTANT/INVESTOR/MANAGER.

---

## 2. Open PR — #43 (draft)

- **PR #43** (https://github.com/seanaustin1-rgb/restaurant-os/pull/43), branch
  `claude/keen-hamilton-maxses`, **draft, all CI green.** Docs-only. Contains:
  - `docs/proposals/sector-onboarding-templates.md` — the sector-template spec
    (types, all six templates, `createRestaurant` refactor, storage note,
    phase-1/phase-2 caveat, validation invariants).
  - `docs/proposals/onboarding-design-copy-spec.md` — Claude's design+copy track
    output (mobile-first layout, copy rules, authenticated-flow screens, reusable
    components).
  - `docs/proposals/HANDOFF-onboarding-2026-06-27.md` — this file.
  - `docs/screenshots/onboarding-2026-06-27/` — 6 demo screenshots + README.
- User wants it to **stay a draft** for now (Codex points to it for review/compare).

**Important nuance (phase 1 vs phase 2):** `VirtualAccount` is flexible, but the
daily Profit First waterfall is NOT — `TapSettings`, `calculator.ts`/`allocation.ts`,
and `BucketAllocation` are hardwired to the 6 restaurant buckets. So non-restaurant
`seedAccounts` show correct targets but won't actually accrue until phase 2
generalizes the engine (keyed by `VirtualAccount.key`, restaurant output kept
identical, extend `calculator.test.ts` first). See the caveat section in the
sector-templates doc.

---

## 3. Two-track plan (agreed with Codex)

**Codex (engineering):** fix mobile clipping (collapse field grids to 1 col, remove
fixed/min widths, `w-full max-w-*` containers, responsive H1); re-test demo pages;
build shared sector-question definitions; refactor estimators/onboarding to the
shared config; capture fresh screenshots; capture signed-in onboarding once logged in.

**Claude (design/copy/spec):** mobile-first layout rec; tighten copy; design the
authenticated onboarding screens; flag reusable components. **Stay out of component
code** so Codex keeps the app stable.

---

## 4. Screenshot review (from `docs/screenshots/onboarding-2026-06-27/`)

These are the **public demo estimators** (`/demo`, `/demo/service`,
`/demo/vacation-rental`, `/demo/tour`), NOT the authenticated onboarding (that's
behind sign-in and still needs a logged-in capture).

- **Desktop (01/03/07): strong.** Polished dark theme, numbered step structure,
  good microcopy, real sector tailoring (service Field-software dropdown; VR PMS /
  ADR / occupancy / gross-vs-net).
- **Mobile (02/04/08): horizontal clipping on every view** — cards/fields run off
  the right edge, "Tour" buttons vanish (02), H1 truncates (04), 3-up rows
  overflow (08). Responsive-layout bug. Codex owns the fix; design intent is in
  `onboarding-design-copy-spec.md` §2.

---

## 5. OPEN DECISIONS needed to "finish" #43

(Answer these to close it out. Recommended defaults in brackets.)

**A. Scope / done-state**
1. Finish line: merge the docs to `main` as spec-of-record [recommended], or keep
   #43 a living draft until everything's built?
2. Phase 2 (allocation-engine generalization) in scope now, or separate issue?
   [separate]

**B. Numbers needing sign-off**
3. Seed-account % splits per non-restaurant sector — match real benchmarks, or tune?
   (Service 38 payroll / Contractor 30 materials+28 labor / Brokerage 50 splits /
   VR 45 owner payouts / Retail 45 COGS.)
4. `defaultTargets` (prime-cost / labor) per sector — realistic, or adjust?

**C. Product / UX**
5. Onboarding sequence: reorder to Industry → Name+scale → sector questions →
   data source [recommended], or keep Details → Template → Data source?
6. `profileQuestions` per sector — final, or add/drop any? (e.g. is contractor
   "retainage" too niche; keep "collects sales tax"?)
7. Approve copy strings verbatim (identity helper, VR subhead, "Based on:" lines,
   card differentiation)?
8. OK to extract `ChoiceCard` (+ `StepSection`, `NumericField`, `PageIntro`,
   `MetaChip`, `StickyActions`, `EstimateBasis`) as shared primitives?

**D. Access model (BusinessAccessInvite now exists)**
9. Permission ceilings: Consultant/accountant (which actions need owner approval?);
   Investor (read-only — single business or portfolio?); Manager (daily ops only?).
10. Approval flow: invite by email + role → owner approves in-app before access
    activates? [recommended]

**E. Inputs still needed (blockers, not decisions)**
11. Signed-in onboarding screenshots (`/onboarding?new=1`) for a real before/after.

Fastest path: answer **A1, B3, C5, D9/D10**; the rest have safe defaults.

---

## 6. Other open / parked items
- **Codex `OPENAI_API_KEY`:** swap for a dedicated spend-capped key (operator, OpenAI dashboard).
- **Leftover throwaway branches** to delete from GitHub UI: `chore/codex-smoke-test`,
  `chore/codex-credit-recheck`, `chore/codex-final-verify`, `fix/codex-auth-login`,
  `fix/codex-sandbox-bypass`. (The git proxy here won't delete remote refs.)
- **Google API key thread (parked):** app reads `GOOGLE_PLACES_API_KEY` +
  `GOOGLE_PLACE_ID` (Aura reviews + `/demo`) and `GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID`
  / `_LOCATION_ID` / `_ACCESS_TOKEN` (Heartbeat metrics). No generic `GOOGLE_API_KEY`.
  "Codex says missing" = key is scoped to Vercel/.env.local, not Codex's own env;
  add it to Codex's environment. The Business-Profile token is OAuth and expires.
- **Design `§4.6` upgrade (offered, not done):** now that `BusinessAccessInvite` is
  real, upgrade the access section from a static role-explainer to a real
  invite + owner-approval flow design.

---

## 7. How to resume (next chat)
1. `git fetch origin && git checkout claude/keen-hamilton-maxses && git pull`.
2. Read the two proposal docs + this handoff in `docs/proposals/`.
3. PR #43 is the home for design/spec docs (draft). Stay in design/copy/spec mode;
   Codex owns component/engineering changes.
4. Codex review fires automatically on PRs (advisory, non-blocking).
5. Vercel posts routine preview comments on PRs — no action needed.
6. Pick up at §5 open decisions; offer to update §4.6 access design once decisions land.
