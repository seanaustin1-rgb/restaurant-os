# Spec A.1 — Tax Vault Ledger Convergence (first module of Spec A)

**Status:** Queued — gated on Spec C shipping and Stone's exceptions cleared
**Branch convention:** New branch off main, one session, one PR, Codex `/review` before commit.

## Context

Read `CLAUDE.md` and `docs/PRODUCT-MAP.md` before writing anything — verify every path and model name below against the repo; this spec was drafted from a session summary and the map is authoritative.

Spec A's overall arc: converge dashboard modules onto the clean ledger (RawSourceEvent → NormalizedFinancialEvent → LedgerEntry), ledger-first with legacy fallback, following the pattern Cash Oxygen already established. Tax Vault goes first because DAVO pulls daily — it's the module where the two spines disagreeing hurts most and where convergence is verifiable against an external truth (actual DAVO withdrawals hitting the bank via Plaid).

## Precondition — hard gate

Stone's open SyncExceptions must be at or near zero before this ships. Sandbox Diner (48 exceptions, 0 ledger entries) is the canary tenant — if the ledger read path can't produce sane numbers for a tenant with unresolved exceptions, the fallback must engage cleanly, not render garbage. Test both states.

## Feature 1 — Ledger-first read path for Tax Vault

Refactor the Tax Vault module's data source to read tax-relevant LedgerEntry rows first, falling back to the legacy Transaction → Category path when ledger coverage for the period is incomplete. Copy the Cash Oxygen fallback pattern exactly — same coverage heuristic, same code shape; extract to a shared lib function if Cash Oxygen's version isn't already reusable, so Cash Flow/Spending (Spec A.2) inherits it for free.

## Feature 2 — Accrual vs. cleared reconciliation

Tax Vault shows two numbers with explicit labels:

- **Accrued** (owed) = per-check sales tax from the Toast daily sync
- **Cleared** = DAVO withdrawals identified in the ledger

The delta is the vault balance — what should be sitting reserved.

Tax logic per tenant config, not hardcoded: Stone's profile is PA retail liquor license (alcohol exempt, 6% food/non-alcoholic, no York county add-on), but the field lives on the tenant so vertical #2 doesn't inherit restaurant tax law.

## Feature 3 — Drift signal

If cleared DAVO pulls diverge from accrued Toast tax by more than a configurable threshold (default 5%) over a trailing 30-day window, emit a signal through `signals.ts` using the existing deterministic ranking — this is a Top Pressure candidate, not a silent badge. Wire it into the shared operator+investor signal surface like everything else.

## Feature 4 — Source trust indicator

Tax Vault displays which spine served the data (ledger / legacy fallback / mixed) using whatever source-trust affordance the dashboard already has from `signals.ts`. No new UI vocabulary.

## Constraints

- No writes in this spec — read-path convergence only.
- No changes to the DAVO/Plaid sync or Toast sync.
- Legacy path stays fully intact and reachable; deleting it is a later Spec A cleanup, not now.
- Vitest on the coverage heuristic, the fallback switch, the accrual/cleared delta math, and the drift threshold; 196+ existing tests green.
- Payroll tax stays cleared-pulls-only — forward accrual is blocked on a payroll feed and is explicitly out of scope here.

## Definition of done

- Stone renders Tax Vault ledger-first with accrued/cleared/vault-balance visible and matching a manual spot-check against Toast tax reports and DAVO bank pulls for the trailing month.
- Sandbox Diner renders via legacy fallback without error and shows the fallback indicator.
- Drift signal fires in a test fixture where DAVO and Toast disagree by >5%.
