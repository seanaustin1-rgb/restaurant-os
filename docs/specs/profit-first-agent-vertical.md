# Profit First — Philosophy, Go-Live Coaching & the Agent Vertical

Purpose: a plain-language brief on (1) what Profit First is and how OutFront
coaches a user from *watching* to *going live*, and (2) how the same engine
extends to a real-estate agent's own 1099 business cycle — what's built, what
isn't, and how an agent opts in.

Related: `src/lib/profit-first/` (the engine), `heartbeat-go-live-readiness.md`
(the five-stage go-live PRD), `allocation-variance-engine.md`. Non-negotiable:
**one Profit First core — never a second allocation path.**

---

## Part 1 — The philosophy, and the path to "going live"

### The mindset flip

Conventional accounting: `Sales − Expenses = Profit`. Profit is the leftover —
and there's usually nothing left. Profit First inverts it:

> `Sales − Profit = Expenses`

Take profit (and tax, and owner pay) *first*, off the top, the moment money
arrives, and force the business to run on what remains. It is **behavioral, not
accounting**: every dollar is assigned a job before it can be spent, held in
separate accounts so the tax money can't be accidentally spent. Envelopes for a
business.

### How OutFront implements the basis (in the engine today)

- **Real Revenue = Total Sales − COGS** — the basis every allocation is computed
  from (`calculateRealRevenue`).
- Money splits across **TAP buckets** (Target Allocation Percentages) — Profit,
  Owner Pay, COGS, Labor, OpEx — that sum to 100% (`calculateTargets`).
- Allocations **sweep twice a month (the 10th and 25th)**.
- **Allocation basis = earned sales (Toast), not bank deposits** — cash-tip-heavy
  restaurants make deposits an unreliable basis. Plaid is fundability truth.

### The five-stage go-live ladder

"Going live" is not a switch — it is a progression from visibility to real money
movement, and the app walks the user up it (per `heartbeat-go-live-readiness.md`):

1. **Observe** — connect the stack (bank, POS, expenses); show the live heartbeat.
2. **Simulate** — run Profit First *virtually* against real activity. No money moves.
3. **Coach** — show what *should* have happened to each dollar vs. what did, find
   the shortfalls, and explain in plain language: *"You can protect tax, but not
   profit yet,"* or *"Labor is eating dollars that should become owner pay."*
4. **Pilot** — turn on *one safe bucket* with approval required — usually Tax
   Reserve first, then a 1% Profit skim — not the whole system at once.
5. **Enforce** — after a second onboarding (identity, bank ownership, guardrails),
   automate real transfers.

### Readiness is computed, not guessed

Before recommending go-live the app scores three axes:

- **Data readiness** — enough connected history and categorization coverage.
- **Cash readiness** — can Tax Reserve be funded without driving OpEx below
  minimum? Is labor/COGS within tolerance? Can a 1–5% profit skim survive without
  repeated shortfalls?
- **Behavior readiness** — has the operator reviewed shortfalls, accepted or
  adjusted targets, chosen pilot buckets, and acknowledged transfer timing?

### The governing principle

**Earn trust before moving money.** v1 is virtual and advisory; real ACH movement
is deliberately gated behind Pilot/Enforce and the associated legal/banking work.
Every recommendation is explainable from visible inputs — never a black box.

---

## Part 2 — Profit First for the agent's own business cycle

### Is it built for agents today?

**No — but the core is designed to extend to them.** The engine's foundation
(`calculateRealRevenue` → `calculateTargets`) is **vertical-agnostic**, and the
product map lists Profit First as an *extensible core across verticals*
(restaurant is the live one). What is restaurant-shaped today is the bucket set
and the surrounding metrics (COGS food/liquor, Prime Cost, RevPASH). An
**agent/1099 vertical is not wired yet** — but adding it is a **vertical
configuration on the existing engine, not a rebuild.**

### Why it fits an agent unusually well

Arguably better than a restaurant:

- Commission income is **lumpy and unpredictable** (feast-or-famine between closings).
- **No tax withholding** on 1099 income → the year-end tax shock.
- Personal and business money blur together for solo agents.

Profit First is the direct antidote — a high-value add for the agents already in
the brokerage overlay.

### The agent TAP mapping

The bucket set an agent uses instead of the restaurant one:

| Bucket | Agent meaning |
|---|---|
| **Basis** | **Earned commission / GCI, net of broker split & referral fees** — the analog of "earned sales, not deposits." The check that hits the bank isn't the basis; the earned commission is. |
| **Tax Reserve** | The big one, ~25–35%, taken first so April is a non-event. |
| **Owner Pay** | The agent's steady paycheck, smoothing the lumpiness. |
| **Profit** | The skim that proves the business works. |
| **OpEx** | Marketing, MLS/board dues, CRM, car, E&O insurance, lead-gen. |

Same twice-a-month sweep cadence; same **Observe → Simulate → Coach → Pilot →
Enforce** ladder. The agent is coached exactly like an operator: *"Your tax
reserve is short this quarter; protect that before you skim profit."*

### How an agent opts in (self-serve)

A per-agent Profit First profile that selects the **agent TAP template**, then
runs on the *same* `calculator.ts` core and the *same* Go-Live Coach. Because it
reuses the engine, it honors the non-negotiable — no second financial path, one
Profit First core.

### The overlay bonus

This dovetails with the brokerage AI overlay: the broker cockpit can surface each
agent's Profit First health at a glance, and the embedded AI can coach the agent
in plain language toward *their own* go-live. That turns OutFront from "the
broker's visibility tool" into "the thing that also makes each agent financially
healthier" — a retention and recruiting story for the broker.

---

## Build notes

- **Reuse, don't fork.** The agent vertical is a TAP template + bucket labels +
  a commission-based basis feeding the existing `calculateRealRevenue` /
  `calculateTargets` / go-live readiness logic. Restaurant-specific metrics
  (Prime Cost, RevPASH) simply don't apply and are omitted from the agent view.
- **Keep it virtual first**, exactly as the restaurant path does — an agent earns
  trust in the simulation before any real bucket movement.
- **Demo isolation holds** — any agent Profit First demo runs on generated data
  under the demo-DB tenant; production data is untouched.
