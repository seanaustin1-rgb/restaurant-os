# ⏱️ RESUME HERE — 2026-07-03 (CHUNK 5: ENRICHMENT BACKLOG, CODE-VERIFIED)

> Safe to email — contains **no secrets**. Paste into `docs/SESSION-HANDOFF.md` above the 2026-06-15 block, or keep as its own file. This block is authoritative over prior RESUME blocks.

**Session scope:** Full-product stress test for enrichment (daily-clarity value prop, Profit First engine, 95%-confidence claim). Backlog below was **verified against `main` code**, not just the product map. Investor meeting (~1 wk, real-estate broker / vacation-property manager); launch ~1 month. Anti-bloat is law: lean core, optional modules.

---

## STILL OPEN FROM CHUNK 4 — DO FIRST
1. Open + merge PR `main...claude/rule-guardrails-and-triage` (commit `6923f48`). **`CLAUDE.md` and `docs/PRODUCT-MAP.md` are stranded on this branch** — until merged, Claude Code sessions don't auto-load them.
2. Run `npx dotenv -e .env.local -o -- tsx scripts/summarize-sync-exceptions.ts stone-grille`, then batch-clear the 373 open exceptions at `/settings/sources/review`.
3. Fix or pull Sandbox Diner demo (48 exceptions / 0 ledger entries) **before the investor meeting**.
4. Revoke all GitHub PATs pasted in chat (now four). New rule: chat tokens = fine-grained, `restaurant-os` only, Contents:Read-only, 7-day expiry. Broad tokens stay in Claude Code / `gh auth`.

---

## RANKED ENRICHMENT BACKLOG (Chunk 5 — code-verified)

| # | Item | Core/Module | Build notes (verified against main) |
|---|------|-------------|--------------------------------------|
| 0 | Spec A ledger convergence + clear exceptions | Prereq | Two spines can still disagree; blocks trust in everything below |
| 1 | **Daily digest email** (cash position, today's expected hits, top signal) | Core | Resend wired but only used in `src/lib/email/access-invite.ts`. Clone the `dailyPlaidSyncScheduler` scheduler→fan-out pattern in `src/lib/inngest/functions.ts`; cron ~7:45am ET (after 5:30 Toast / 6:00 Plaid / 7:20 Aura). Content already computed by `src/lib/dashboard/signals.ts` (Top Pressure) + cash anchor + Recurring module detections. |
| 2 | **30-day forward cash view** (expected in/out, low point + date) | Core | Assembly, not build: Recurring & Subscriptions module (live) + payroll cadence inference (avg last 4 pulls) + sweep dates from TapSettings (10th/25th). **Rescope the existing `forecast` "soon" tile** in `src/lib/modules.ts` — "blocked by: More history" is wrong for 30-day; flip it live, keep 13-wk as later upgrade. |
| 3 | **Payroll forward accrual** (inferred, no API) | Core | Detect weekly/biweekly cadence from cleared pulls; project next 2. Feeds #2. Largest predictable outflow in all six verticals. |
| 4 | **Data-health score gating confidence language** | Core | "Confidence: 71% — 373 unnamed transactions ($X). Clear to restore." Makes the 95% claim mechanically honest; investor-proof answer to "how do you know?" Turns exception backlog into a visible nudge. |
| 5 | **Cash floor + sweep safety** | Core | One setting (min operating cash). Alert when #2's projection crosses it; warn before a 10th/25th sweep would breach it. Prevents Profit First's own overdraft failure mode. |
| 6 | **Allocation residual — "Named: $X of $Y, $Z unnamed"** | Core (rework) | Verified absent from allocation module. The residual IS the leak detector; click-through → exception review. Make it a first-class signal in `signals.ts` (engine already encodes "never overclaim / degrade honestly"; tax-reserve is priority 0 in tie-break — residual slots naturally). Also: label buckets "virtual — funds remain in [operating acct]"; earmarked vs swept as two visual states; variance in dollars first ("Labor $1,840 over"), % second. |
| 7 | **Month-end pace projection** ("on pace for $X net ±$Y") | Core | Cheap once #2 exists: trailing daily avg + known obligations. |
| 8 | **Missed-deposit alert** (Toast batch missed expected window) | Core | Extend **Payment Watch** (live — already covers double-pays & off-norm). Don't build new. Same-day-phone-call severity. |
| 9 | Remaining anomaly rules: new vendor >$500 first-seen, vendor trailing-4wk spend creep >20% ($) | Module | Deterministic only, threshold visible on the tile. |
| 10 | **Signal tile standard** | Core polish | Hard cap Top 3 (signals.ts already ranks — enforce in UI). Every tile: claim + $ magnitude + evidence link + visible threshold. "Unexplained $X" / "$X above baseline" — never "you're losing $X". Dismiss/snooze with memory. |
| 11 | Self-benchmarks (vs own trailing 4/8/13 wk) | Core-lite | Mostly exists in signals.ts. |
| 12 | Peer Benchmarks | **KEEP (reversed from draft)** | `docs/benchmarks-rationale.md` is honest: static consensus norms, labeled, FAQ pre-written, swappable for live cohort later. Ranges are restaurant-only → **hide tile on brokerage/rental tenants**. Don't pitch live-cohort until tenant base exists. |

## CUT / BURY LIST
- **Aura reputation + GBP intent:** keep the module (per-source connect cards are already opt-in) but **remove from onboarding checklist & starter cards entirely** — zero API-key asks before first insight (onboarding friction is the #1 adoption risk).
- **"Soon" tiles:** hide by default for paying operators; single Roadmap page instead. Fine in demo.
- **Unlaunched verticals:** show restaurant (live) + brokerage (first investor) only; flag off service/retail/contractor/rental until real.
- **Menu-item sales-mix depth:** module, not core.
- **Any surface where the two spines can show conflicting numbers** pre-Spec A.

## INVESTOR DEMO ANGLE
Items 1–4 ARE the demo: live low-point date + the 6am digest on a phone beats a module tour. First investor runs vacation properties — forward cash + obligation calendar is his whole game. Allocation residual line is the leak-detection story.

## EXECUTION ORDER (Claude Code)
1. Merge guardrails branch → CLAUDE.md/PRODUCT-MAP.md land on main.
2. Spec A, Tax Vault first (DAVO pulls daily).
3. Backlog #1 digest → #2/#3 forward cash + payroll inference (rescope forecast tile) → #6 allocation residual → #4 data-health score → #5 floor/sweep guard → #8 Payment Watch extension.
4. Spec B (Toast multi-tenancy) before customer #2.

## RESUME PROMPT (paste into Claude Code)
> "Read README, CLAUDE.md, docs/PRODUCT-MAP.md, and docs/SESSION-HANDOFF.md. Start from the **⏱️ RESUME HERE — 2026-07-03 (CHUNK 5)** block — it's authoritative. Chunk-4 open actions come first (merge `claude/rule-guardrails-and-triage`, exception triage on Stone, Sandbox Diner fix), then Spec A Tax-Vault-first, then the ranked backlog in execution order. Anti-bloat rules apply: core stays tiny, signals cap at Top 3, every number shows its math, never overclaim."

## REMAINING DEBT (unchanged from Chunk 4)
Two spines disagree until Spec A; Toast single-tenancy blocks customer #2 until Spec B; review flow approve/exclude only (no inline re-type / rule-save-from-review / bulk-apply); rule edits don't retro-move rows (`recategorize-transactions.ts --commit`); ~19 unmerged branches; payroll tax = cleared pulls only (fixed by backlog #3).
