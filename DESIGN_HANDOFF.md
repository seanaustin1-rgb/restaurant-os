# DESIGN_HANDOFF — front-end design session

Handoff for the next session to pick up front-end design work on **OutFront Data**, using the `impeccable` skill. Read this, then start with the recommended first command below.

## Where init left things
- **Register:** `product` (design serves the task — app UI / dashboards), confirmed from `PRODUCT.md`.
- **`PRODUCT.md`:** present and strong — brand is *clear, grounded, financially disciplined* with a *restrained cool factor*; explicit anti-references (no generic SaaS, no bank-scare screen, no flashy AI toy); 5 design principles; WCAG 2.1 AA target. Treat it as the brief.
- **`DESIGN.md`:** **MISSING.** This is the main gap — the visual system isn't documented, so design variants/critiques have nothing canonical to anchor to. **Generate it first** (see step 1).
- **`.impeccable/live/config.json`:** already present — live mode is configured (`/impeccable live` works once a dev server is up: `npm run dev` → :3000).

## Design system as it stands (to be canonicalized by `/impeccable document`)
Dark, distinctive fintech aesthetic — deliberately *not* generic-SaaS-cream:
- **Theme:** dark. `ink #0B0D0B` (bg), `surface #141614` (cards/panels), `line #232623` (hairlines), `muted #8A8F89`.
- **Accent:** `copper` (DEFAULT `#C8873A`, soft `#D9A35E`, dim `#7A5526`).
- **Status:** `health.green #5FA777` / `yellow #D9A35E` / `red #C8643A`.
- **Type:** `Cormorant Garamond` (display serif) + `DM Sans` (body) + `Space Mono` (tabular figures, `.tnum`). Serif-display + mono-numerals is a genuine POV, on-brand for "credible, not sterile."
- **Stack:** Next 14 App Router, Tailwind (tokens in `tailwind.config.ts` + `globals.css`), lucide-react icons.

## What's strong
- The palette/type system is committed and credible — it already avoids the AI-slop cream-and-navy defaults.
- Per-industry **data** modeling is real and test-covered (`src/lib/industry-templates*`, `src/lib/demo/*-estimate.ts`, property-*). Principle #4 ("every industry intentionally modeled") is honored at the data layer.

## Highest-value design opportunities (grounded, prioritized)
1. **Accessibility of status signals (PRODUCT.md-mandated).** Red/yellow/green health is everywhere (Heartbeat, TAP gauges, benchmarks, break-even). PRODUCT.md *requires* status to carry text/label/icon, not color alone — and AA contrast on the dark surface. Some tiles already pair color with a text note; many need an audit. → `audit`.
2. **Industry distinctiveness in the UI.** The data is modeled per industry; the *visual experience* mostly reuses one dark dashboard. Risk = "labels pasted on a template," the exact anti-reference. Does a contractor tour *feel* different from a brokerage tour beyond numbers/copy? → `critique` the industry demos/tours against principle #4.
3. **Card density & hierarchy.** The dashboard leans on uniform `border + bg-surface` cards (module grid, gauge tiles, source cards) — the "identical card grid" reflex impeccable flags. "Show the heartbeat first" (principle #1) wants stronger scan hierarchy, not a wall of equal cards. → `layout`.
4. **Demo funnel coherence.** `/demo` + `/demo/service` + `/demo/retail` + `/demo/real-estate` + `/demo/tour` + `/demo/tour/[type]` grew fast with cross-links and several CTAs ("Start free" / "Enter your numbers" / "Change business type"). Make the funnel feel designed, not accreted. → `critique`.
5. **First-run / empty / go-live.** Principle #3 ("trust ahead of automation") + "don't trap the owner in setup before value." New `/modules/go-live`, onboarding, and empty states deserve a pass. → `onboard`.

## Recommended command sequence (next session)
1. **`/impeccable document`** — generate `DESIGN.md` from the real tokens/components. Foundation; do this first so everything after is anchored.
2. **`/impeccable critique /demo/tour/restaurant`** (or `/dashboard`) — scored UX review of the primary surface; sets the backlog.
3. **`/impeccable audit`** the health/status components — the PRODUCT.md-mandated color-not-alone + AA contrast pass.
4. Then targeted, as critique/audit surface them: **`/impeccable layout`** (card rhythm), **`/impeccable critique`** the per-industry tours (principle #4), **`/impeccable onboard`** (first-run), **`/impeccable live`** for in-browser iteration.

## Key surfaces to design against
- **Marketing/funnel:** `/` (landing), `/demo`, `/demo/{service,retail,real-estate}`, `/demo/tour`, `/demo/tour/[type]`
- **App shell + heartbeat:** `/dashboard` (`src/components/dashboard/DashboardView.tsx`, `HeartbeatStrip`, `TapGauges`, `ModuleGrid`)
- **Modules:** `src/components/modules/*` (benchmarks, break-even, aura, prime-cost, cash-flow, property-heartbeat, …)
- **Flows:** `/connections`, `/onboarding`, `/modules/go-live`, `/settings/*`, `/import/rentals`

## Constraints / guardrails
- Honor `PRODUCT.md` anti-references and the 5 principles; brand is calm + credible with a *restrained* cool factor — not flashy.
- Status must never rely on color alone (WCAG AA).
- Must work on phones (quick checks/demos) while staying dense and scan-friendly on desktop.
- Respect `prefers-reduced-motion`; motion conveys state, not decoration (product register).
- `main` = production (auto-deploys on push). Do design work on a branch.

## Repo facts
- Path: `C:\Users\Default_50\restaurant-os` · Branch at handoff: `feat/demo-automation`
- Run: `npm install` → `npm run dev` (:3000). Checks: `npm test` (vitest), `npx tsc --noEmit`, `npm run build`. Lint (`next lint`) is unconfigured.
- See `CODEX_HANDOFF.md` for backend/state context (incl. the pending Aura migration).
