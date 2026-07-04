# Codex brief — Spec A.1 Features 2 & 3 (accrued-vs-cleared reconciliation + drift signal)

**Lane:** Codex (data-lane). Handed off 2026-07-04. Cross-lane coordination doc.
**Read first:** `CLAUDE.md`, `docs/PRODUCT-MAP.md`, `docs/fable-5/spec-a1-tax-vault.md`
(authoritative — verify every path/model against the repo).

## Why this is a Codex hand-off

Spec A.1's read-path half (Features 1 & 4 — Tax Vault reads cleared pulls
ledger-first + source-trust indicator) already shipped on `main` (PR #85). The
shared ledger-first/fallback util (`src/lib/financial-ledger/ledger-coverage.ts`,
`assessLedgerCoverage` / `describeLedgerSource`) and the `signals.ts`
coverage-gap primitive (`deriveCoverageGap`, PR #88) are also merged. What's left
in A.1 is Features 2 & 3, which carry a **schema/migration dependency** — an
operator-applied step — so it was split out to the Codex lane rather than the
mobile read-path batch.

## Hard dependency — operator applies the migration, not Codex

Feature 2 needs a **per-tenant tax-profile field** on the `Restaurant` model
(`prisma/schema.prisma`). Codex may add the schema field + generate the migration
**file**, but **must NOT run `prisma migrate deploy` against prod/demo** — that is
an operator action (see `AGENTS.md` guardrails, `CLAUDE.md` "Never run a
production database migration"). The code must not merge to `main` until the
operator has applied the migration, or it will query a column that doesn't exist
and break prod. Flag this in the PR; keep it a draft until the operator confirms.

## Feature 2 — accrued vs. cleared reconciliation

Two labelled numbers in Tax Vault (`src/lib/modules/tax-vault.ts` — already
partly there):
- **Accrued (owed)** = per-check sales tax from the Toast daily sync
  (`DailySales.salesTaxCollected`) — already loaded as `collected`.
- **Cleared** = DAVO withdrawals identified in the ledger — already read
  ledger-first as `sales.pulled` (LedgerEntry on `TAX_VAULT`, split by
  `allocationBucket`; legacy fallback = `TAX_SALES` transactions).
- **Vault balance** = accrued − cleared = what should be sitting reserved
  (already `sales.reserve`).

**New work:** move tax logic to a **per-tenant tax-profile config**, not
hardcoded. Stone's profile is PA retail liquor license: **alcohol exempt, 6%
food/non-alcoholic, no York county add-on**. The field lives on the tenant so
vertical #2 doesn't inherit restaurant tax law. Today the effective-rate copy is
hardcoded in `TaxVaultModule.tsx` ("below PA's 6% because alcohol is exempt…") —
drive it from the config instead.

## Feature 3 — drift signal

If cleared DAVO pulls diverge from accrued Toast tax by more than a **configurable
threshold (default 5%)** over a **trailing 30-day window**, emit a signal through
`src/lib/dashboard/signals.ts` using the existing **deterministic ranking** — this
is a **Top Pressure candidate**, not a silent badge. Wire it into the shared
operator+investor signal surface like everything else (`deriveAttention` /
`deriveTopPressure`). Model it on the existing pure-derivation pattern; keep it
deterministic (no AI), honest degradation when data is thin.

## Constraints (from spec-a1)

- **Read-path only** — no writes; no changes to DAVO/Plaid or Toast sync.
- Legacy path stays fully intact and reachable.
- **Vitest** on: the coverage heuristic (done), the fallback switch (done), the
  accrual/cleared delta math, the tenant tax-config, and the drift threshold.
  Full suite green (271+ tests as of PR #88).
- Payroll tax stays **cleared-pulls-only** — forward accrual is blocked on a
  payroll feed, explicitly out of scope.

## Definition of done (from spec-a1)

- Stone renders Tax Vault with accrued/cleared/vault-balance visible and matching
  a manual spot-check against Toast tax reports and DAVO bank pulls for the
  trailing month.
- Sandbox Diner renders via legacy fallback without error (fallback indicator).
- Drift signal fires in a test fixture where DAVO and Toast disagree by >5%.

## Landmarks

- `src/lib/modules/tax-vault.ts` — the module (accrued/cleared already computed).
- `src/components/modules/TaxVaultModule.tsx` — source-trust badge + the
  hardcoded PA rate copy to move into config.
- `src/lib/dashboard/signals.ts` — `deriveAttention`/`deriveTopPressure` (wire the
  drift signal here); `deriveCoverageGap` is the newest example of a pure signal.
- `src/lib/financial-ledger/ledger-coverage.ts` — reuse `assessLedgerCoverage`; do
  NOT fork it (if it needs changing to fit, the extraction was too narrow — stop
  and check).
- `prisma/schema.prisma` — `Restaurant` model (add the tax-profile field here).
