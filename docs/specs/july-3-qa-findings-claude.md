# July 3 Tandem QA — Claude Lane Findings

**Author:** Claude · **Date:** 2026-07-03 · **Branch:** `qa/2026-07-03-claude-lane`
**Scope:** product QA, design/copy review, source-story clarity across brokerage, vacation rental, and demo funnel
(per the Claude Help Lane in `brokerage-cockpit-handoff-to-codex.md`).
**Method:** reviewed rendered component source. The preview screenshot renderer hung on the client-heavy demo pages
(server returns 200, no console errors — a screenshot-tool issue, not the app), so "cockpit-feel" calls are from
component structure. Live visual spot-checks still advised before design lock.

**Severity:** P0 = blocks investor/early-adopter demo · P1 = fix before design lock · P2 = polish / later.
**Lane note:** items touching source labels or auth/governance are flagged **coordinate with Codex**.

> **Update (2026-07-04):** Finding #1 (the P0 — Executive Cockpit rendering the per-agent leaderboard to an INVESTOR
> role) is **resolved on `main` in PR #78**: the nav link and the route query are both gated to leadership
> (OPERATOR/MANAGER/CONSULTANT), with a decision-7 regression test in `nav.test.ts`. Findings #4/#5 (demo funnel) ship
> in this PR. Findings #2/#3 (BoldTrail/appFiles source labels) remain open for the Codex lane.

---

## Task 1 — Brokerage

### [P1 → P0 once a real investor logs in] Executive Cockpit renders per-agent leaderboard to INVESTOR role
- **Route:** `/modules/brokerage/cockpit`
- **File:** `src/app/modules/brokerage/cockpit/page.tsx` (+ `src/lib/nav.ts:21`)
- **Issue:** page gates only on *signed-in + has a REAL_ESTATE_BROKERAGE role* — no role-type check. An `INVESTOR`
  renders `ExecutiveCockpit`, which shows the named "Agent production / Top contributors / Needs attention" lists with
  per-agent company dollar. Violates **locked decision 7** ("never render for an INVESTOR role"). `nav.ts:21` also lists
  the cockpit link for `ALL_ROLES` (includes INVESTOR).
- **Fix:** gate the page to `OPERATOR`/`MANAGER`/`CONSULTANT` (mirror the agent-cockpit `canSelectAgents` check); remove
  INVESTOR from the nav entry's roles (or gate the link).
- **Status:** ✅ **Resolved in PR #78** (2026-07-04) — exactly this fix landed.
- **Lane:** page.tsx is Claude's, but it enforces a governance decision → **coordinate with Codex**.

### [P1] "BoldTrail" hardcoded as the CRM in Agent Cockpit empty/pending states
- **Route:** `/modules/brokerage/agent-cockpit`
- **File:** `src/app/modules/brokerage/agent-cockpit/page.tsx`
- **Exact copy:** `"Needs BoldTrail activity"` (:145), `"Needs BoldTrail"` (:247),
  `"Connect BoldTrail or import a CRM activity export…"` (:265).
- **Why it's a leak:** the demo estimator offers Follow Up Boss, Lofty, and Brokermint too
  (`src/app/demo/real-estate/RealEstateEstimator.tsx:198-203`); a FUB/Moxi user is shown the wrong CRM name. Same class
  as the industry copy-leak audit, one level down.
- **Suggested:** `"Needs CRM activity"` / `"Connect your CRM (BoldTrail, Follow Up Boss, Moxi)…"`.
- **Lane:** source-label copy → **coordinate with Codex** (Codex owns source labels).

### [P2] "appFiles" is an undefined, inconsistently-cased source term
- **Routes/files:** `agent-cockpit` (:215,220,242,266), `demo/real-estate` (:53,77,781,810), `import/brokerage` (:21)
- **Issue:** appears as `"appFiles/back-office exports"` etc. — reads as a typo unless the user knows AppFiles (the
  transaction/back-office product). Cased `appFiles` vs. proper `AppFiles`.
- **Suggested:** confirm it is AppFiles; standardize casing and add a one-time gloss, or use a generic
  "back-office export".
- **Lane:** **coordinate with Codex** (source labels).

### Verified acceptable
- `/modules/brokerage` (Analytics) and `ExecutiveCockpit` read brokerage-native with honest provenance labels
  ("using onboarding/profile assumptions until CRM… imported"). No restaurant cross-talk in rendered copy.
- Agent Cockpit provenance is clear and consistent (source confidence: imported / mixed / profile assumption; honest
  empty states like "Needs attribution", "Needs closed-lead match").

---

## Task 2 — Vacation rental

### Verified clean / resolved
- `src/components/cockpit/PropertyCockpit.tsx` is property-native (occupancy, ADR, RevPAR, owner proceeds, maintenance
  drag); uses a "Your portfolio" fallback; only "brokerage/agent" hits are code comments, not rendered copy.
- **Open question already resolved:** `src/app/modules/property-heartbeat/page.tsx` is already a
  `redirect("/modules/rentals/cockpit")`. No action needed.
- `/demo/vacation-rental` and `/import/rentals` show no restaurant/brokerage leakage in rendered copy.

---

## Task 3 — Demo funnel

### [P1] `/demo` defaults to the restaurant estimator under an industry-neutral header
- **Route:** `/demo`
- **File:** `src/app/demo/page.tsx` (renders `DemoEstimator.tsx`, the restaurant estimator)
- **Issue:** header reads `"What would your dashboard say?"` + a generic subhead, but the page renders the **restaurant**
  form (Seats, Covers, food/beverage, "the restaurant's master number"). A brokerage/rental prospect on the canonical
  `/demo` URL lands in a restaurant form — violates the "never route a prospect to a restaurant result" rule.
- **Decision (operator, 2026-07-03):** make `/demo` an **industry chooser** (mirror `/demo/tour`) so no prospect lands in
  a restaurant form by default.
- **Lane:** Claude.

### [P2] Encoding mojibake in `/demo` metadata + comments
- **Route:** `/demo` (browser tab / SEO)
- **File:** `src/app/demo/page.tsx`
- **Exact copy:** `title: "Instant Estimate â€" OutFront Data"` (:6, broken em-dash), a BOM at file start, and
  `"no auth, no database â€" the financial tiles"` in comments.
- **Suggested:** re-save UTF-8; replace `â€"` with `—`.
- **Lane:** Claude.

### Verified good
- Demo honesty about sample vs. API vs. CSV holds: `RealEstateEstimator.tsx:717,754` and
  `VacationRentalEstimator.tsx:343` all state what is live-from-Google, what needs API access, and what can come from
  CSV/export.
- `/demo/tour` is a clean industry chooser with honest "fictional company with realistic sample numbers already loaded"
  framing.

---

## Summary

| # | Sev | Area | Item | Lane | Status |
|---|-----|------|------|------|--------|
| 1 | P1→P0 | Brokerage | Executive Cockpit shows per-agent leaderboard to INVESTOR | Claude + coordinate | ✅ Fixed in #78 |
| 2 | P1 | Brokerage | BoldTrail hardcoded as the CRM in Agent Cockpit | coordinate w/ Codex | open |
| 3 | P2 | Brokerage | "appFiles" undefined / inconsistent casing | coordinate w/ Codex | open |
| 4 | P1 | Demo | `/demo` defaults to restaurant estimator → make chooser | Claude | ships in this PR |
| 5 | P2 | Demo | `/demo` encoding mojibake in title/comments | Claude | ships in this PR |

Claude is applying #4 and #5 on this branch. #1 was resolved separately in **PR #78** (leadership-gated cockpit);
#2 and #3 are Codex-owned source labels.
