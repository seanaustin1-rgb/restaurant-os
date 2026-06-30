# Investor & Owner Dashboard — Plan & Architecture **v2 (Reconciled)**

**Status:** RECONCILED — supersedes v1 (`investor-owner-dashboard-plan.md`). Build-aligned.
**Author:** Claude (with operator). **Date:** 2026-06-30.
**Reconciles three inputs:**
1. **v1 plan** (`investor-owner-dashboard-plan.md`) — Claude's locked decisions + Track A–E change set.
2. **Outside master doc** (`response.txt`) — the multi-industry **polymorphic** production blueprint.
3. **Build reality** — what actually landed on `feat/heartbeat-landing` (`f9666f3`, `416448f`, `1100318`, `4e1befa`).

> The single most important thing this doc records: **the reconciliation already converged in code.**
> Codex extended `DashboardData` *additively* (it did **not** adopt the polymorphic rewrite), derived
> signals in a tested `signals.ts` helper (it did **not** bloat `DashboardData` with `attention`/`topPressure`),
> and shipped the distributable-profit reframe. v2 ratifies that direction and fixes the two places the
> outside doc regressed.

---

## 0. The reconciliation verdict (3-way)

| Decision | v1 (Claude) | Outside doc (`response.txt`) | **v2 — reconciled** | Why |
|---|---|---|---|---|
| **Multi-industry model** | Hospitality concrete, additive | Rewrite `DashboardData` → `industryType` + `manifest` + `financialVitals` **now** | **Additive now (Phase 1 hospitality); polymorphic `IndustryManifest` is the NORTH STAR (Phase 2)** | 1 live tenant (Stone Grille). Premature polymorphism = unmaintainable switch forest before a 2nd industry has real data. Code already went additive. |
| **`DashboardData` shape** | Extend, read-only contract | Replace with polymorphic schema | **Extend additively** (current shape stands) | Replacing the contract breaks every consumer for zero present benefit. |
| **`attention` / `topPressure`** | Promote to `DashboardData` fields | Compute in data layer, expose as `DashboardData` fields | **Tested `src/lib/dashboard/signals.ts` helper** (`deriveAttention`/`rankAttention`/`deriveTopPressure`/`deriveSourceTrust`) | Single tested definition, shared by both views, **without** bloating the contract. Already built + unit-tested. |
| **"The One Thing"** | Deterministic worst-red-bucket, show math, no AI | Deterministic `topPressure` contract | **`deriveTopPressure` (deterministic, no AI)** — DONE | Meets the locked operator decision. |
| **Net margin label** | "Net margin" w/ inclusions stated | "Distributable Profit Pool" $ reframe | **Operating margin / "distributable profit pool"** — DONE (`operatingProfit`) | Resolves v1 open decision #1. Honest: states what's excluded. |
| **`MetricNote.audience`** | `audience(INTERNAL\|INVESTOR)` is a **blocker** | **Dropped the field** ❌ | **RESTORE `audience`** | Without it, an internal note ("laid off 3 staff", "missed debt payment") leaks to investors. Correctness/trust harm, not a nicety. |
| **`MetricNote` index** | `[restaurantId, metricKey]` | `[restaurantId, metricKey, eventDate]` | **Adopt the 3-col index** | Outside doc's chronological-sort optimization is genuinely better. |
| **Fixed/Variable + breakeven (D2)** | Operator asked for it | Hard-defer; fall back to generalized OpEx | **Defer D2 — but acknowledge the ask, don't silently shelve** | Cost-classification is volatile across industries. Ship unclassified OpEx now; D2 returns single-industry-first as a fast-follow. |
| **`DashboardView.tsx`** | Keep edits minimal/additive | Pure role-routing gateway; no layout logic inside | **Adopt: `DashboardView` = role router only** | Best collision-reducer for the Claude↔Codex shared file. (Components TBD — see §4.) |
| **Notes default audience (open #2)** | Lean INTERNAL + one-tap share | n/a | **Default INTERNAL, explicit opt-in to share** | Safe-by-default; pairs with restoring `audience`. |

---

## 1. Goal (unchanged)

One engine, two curated views off the same `DashboardData`:
- **Operator view** — full, granular, the "why" and "how."
- **Investor view** — curated assurance + progress, **notes-bridged**: every red metric carries a dated note so an investor sees the *why* without a phone call.

Governing rule: **surface the signal + show the math, never overclaim.** Several items exist specifically to *fix* current overclaims.

## 2. North Star vs Phase 1 (the polymorphic seam)

The outside doc's **Multi-Industry Polymorphic Translation Matrix** is adopted as the **Phase 2 design target**, not deleted:

| Industry | Primary pressure | Cash floor target | Value signal |
|---|---|---|---|
| Hospitality *(Phase 1, live)* | Prime Cost (COGS+Labor) | 30–45 days | Reputation Aura (Google/Yelp) |
| Real-estate brokerage | Company-dollar retention | 90–180 days (cyclical) | Active listing volume / desk count |
| Contractor | WIP slippage (est. vs actual) | 60–90 days | Backlog multiplier / bonding rating |
| Retail | GMROI / inventory turnover | 45–60 days | Digital traffic / avg basket |

**The seam (so Phase 2 is additive, not a rewrite):**
- Phase 1 hardcodes hospitality labels/thresholds **in the view**, but reads pressure/floor/value-signal through **named accessors** (one function per concept) — so Phase 2 swaps the source from constant → `manifest` without touching tiles.
- `IndustryManifest` (`labels`, `thresholds`) is introduced **only when a 2nd industry has live data**. Until then it is a documented interface, not a built dependency.
- `DashboardData` gains `industryType` + `manifest` **additively** in Phase 2; nothing is removed.

## 3. Change set — REAL status (as of 2026-06-30)

Legend: ✅ done · 🟡 prototyped · ⬜ todo · 🔒 gated on PR #47

### Track A — Investor Matrix (`/investor`)
- ✅ A1. "Profit discipline" bug fixed → **Tax & reserve discipline** from `buckets[tax-reserve].signal`.
- ✅ A2. Redundant "Investor return signal" tile removed.
- ✅ A3. **Operating margin** tile = `operatingProfit` ("distributable profit pool", excludes stated).
- ✅ A4. **Reputation** tile (`data.aura`, Google/Yelp).
- ✅ A5. "Source freshness" → **trust footnote** via `deriveSourceTrust` (lists missing sources).
- ✅ A6. *(new)* No-auth dev mirror `app/demo/investor-preview` reconciled to the same contract.

### Track B — Trust layer
- 🟡 B1. **Attention Required** zone (`deriveAttention` + `rankAttention`) — wired in preview, client-state.
- 🟡 B2. **Contextual dated notes** ("managed event") — `AttentionAndNotes.tsx`, **client-state prototype**.
- 🔒 B3. Persist: **`MetricNote` model + server action** — see §5. Migration **after** #47.
- 🔒 B4. Integrate Attention+notes into real `DashboardView`, **server-side role-gated**.

### Track C — Owner-view de-bloat
- ✅ C3. **"The One Thing"** — `deriveTopPressure` deterministic, wired into owner heartbeat (`4e1befa`).
- ⬜ C1. Collapse Modules grid behind **"More tools"** (default = pinned).
- ⬜ C2. Collapse Setup/Template/Sources strip → **System Health** gear (top-right).

### Track D — Cash clarity (consolidated)
- ✅ D1-data. `cashSafety.{currentCash,oxygenDays,avgDailyFixedBurn,netCashChangePeriod,pendingReviewCount,status}` exposed + rendered (owner heartbeat + investor cash tile).
- ⬜ D1-ui. Single merged **owner** cash tile with expand-on-click (investor read is done; owner consolidation remains).
- ⬜ D2. **Fixed vs Variable + breakeven** — **DEFERRED** (operator ask acknowledged; returns single-industry-first once cost-classification is stable).
- ⬜ D3. Demo seed: cash anchor + balance (removes "Anchor needed").

### Track E — Trend / velocity
- ✅ E1-data. `heartbeat.primeCostTrendPts` (from `prime-cost.wowPrimeDelta`) exposed + arrow hook on `HeartbeatStrip`.
- ⬜ E1-ui. Surface the ▲/▼ on the investor Operating-pressure tile (data is ready).
- ⬜ E2. True MoM sparklines — needs a prior-period loader (deferred until real history).

## 4. Architecture

### 4.1 Data contract (current, ratified)
`DashboardData` is consumed **read-only** by the view lane. Derived presentation values live in **`signals.ts`**, not on the contract:
- `deriveAttention(data)` → red/yellow gauges + costRatios + buckets, then `rankAttention`.
- `deriveTopPressure(data)` → deterministic worst-pressure pick ("The One Thing").
- `deriveSourceTrust(data)` → source-coverage footnote; escalates when `missingRequired.length > 0`.

Contract-level (data layer, because they need real computation): `operatingProfit`, `cashSafety`, `heartbeat.primeCostTrendPts`. Pure ratios stay in the view.

### 4.2 `MetricNote` v2 — **with `audience` restored**
```prisma
model MetricNote {
  id           String      @id @default(cuid())
  restaurantId String
  metricKey    String      // namespaced: "gauge-opex" | "bucket-tax-reserve" | "ratio-liquor"
  eventDate    DateTime    // the dated event the note explains
  periodKey    String      // e.g. "2026-06" — which period the note applies to
  body         String      // length-limited at the server action
  audience     NoteAudience @default(INTERNAL)  // INTERNAL hidden from investors; INVESTOR shared
  authorId     String      // clerkUserId
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  resolvedAt   DateTime?   // when the managed event is closed out
  restaurant   Restaurant  @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  @@index([restaurantId, metricKey, eventDate])  // chronological sort (from outside doc)
}

enum NoteAudience { INTERNAL INVESTOR }
```
- Server action create/list/update; **writes gated server-side** to OPERATOR/MANAGER/CONSULTANT; investor reads **only `audience = INVESTOR`**. Hidden buttons are not access control — enforce on every endpoint.
- Default `INTERNAL`; sharing to an investor is an explicit one-tap action (open decision #2 → resolved this way).
- Migration created **only after PR #47 lands on `main`** so it never stacks on `20260627183000` or desyncs demo-DB history.

### 4.3 Component / lane hygiene
- `DashboardView.tsx` becomes a **role-routing gateway only** (outside doc §5) — no layout logic inside it.
- Extract presentation into `src/components/dashboard/*` (`InvestorMatrix`, `AttentionZone`, `CashTile`). *Note: `DashboardShell`/`OperatorMatrix`/`InvestorMatrix` do **not** exist yet — this is the target, built incrementally, not a precondition.*
- Role curation reuses the existing system (`UserRestaurantRole`, `Role.INVESTOR`, `landingPathForRole`).

### 4.4 Sequencing & gating
- **Unblocked now** (current branch): B1/B2 promotion, C1/C2, D1-ui, E1-ui, A6 cleanup.
- **Gated on PR #47 → `main`**: B3/B4 (MetricNote migration + server-gated integration). Reason unchanged: avoid stacking on the contested `20260627183000` migration.
- **Deferred**: D2 (fixed/variable), E2 (MoM history), all of Phase 2 polymorphism.

## 5. What changed from each input (audit trail)

**Rejected from `response.txt`:**
- Rewriting `DashboardData` to `industryType`/`manifest`/`financialVitals` **now** → deferred to Phase 2 (additive).
- `IndustryManifest` as a Phase-1 build dependency → North Star only.
- **MetricNote without `audience`** → restored (this was a regression that would leak internal notes to investors).
- Silently dropping the operator's fixed/variable ask → explicitly acknowledged as a deferred fast-follow.

**Adopted from `response.txt`:**
- `MetricNote` 3-column chronological index `[restaurantId, metricKey, eventDate]`.
- `DashboardView` as a pure role-routing gateway.
- "Distributable profit pool" framing (already shipped).
- The polymorphic translation matrix, as the Phase 2 North Star.

**Ratified from v1 + build reality:**
- Additive contract; `signals.ts` helper over `DashboardData` bloat.
- Deterministic "One Thing", no AI; weekly ▲/▼ trend now, MoM later.
- All locked operator decisions in §2 of v1 stand.

## 6. Open items for the operator
1. **Decision #2 — notes audience default.** v2 recommends **default INTERNAL + explicit share**. Confirm.
2. **PR #47 timeline** — B3/B4 (real notes) are gated on it. When does it land on `main`?
3. **Phase 2 trigger** — confirm IndustryManifest stays parked until a 2nd industry (brokerage?) has live data.
4. **D2 fast-follow** — confirm fixed/variable returns *after* Phase 1 ships, single-industry-first (not silently dropped).
