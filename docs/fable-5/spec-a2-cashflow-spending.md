# Spec A.2 — Cash Flow / Spending Ledger Convergence (second module of Spec A)

**Status:** Queued — gated on Spec A.1 merged
**Branch convention:** New branch off main, one session, one PR, Codex `/review` before commit.

## Context

Read `CLAUDE.md` and `docs/PRODUCT-MAP.md` first; verify paths and model names against the repo — the map is authoritative over this spec.

Prerequisite: Spec A.1 (Tax Vault) merged, which means the shared ledger-first fallback function extracted from Cash Oxygen now exists as a lib utility. This spec is mostly wiring that function into two more modules plus category-mapping work — deliberately smaller than A.1.

## Feature 1 — Ledger-first read path for Cash Flow

Point the Cash Flow module's data source at LedgerEntry rows via the shared fallback function. Same coverage heuristic, same fallback-to-legacy behavior, same source-trust indicator as Tax Vault.

Zero new fallback logic — if the shared function needs modification to serve this module, that's a smell; stop and check whether A.1's extraction was too narrow before patching around it.

## Feature 2 — Ledger-first read path for Spending

Same treatment. The complication here is category granularity: Spending renders by Category/TapBucket, and LedgerEntry categorization comes from the shared `categorize()` in `src/lib/categorization/rules.ts`.

Verify the ledger's category vocabulary maps 1:1 onto what Spending's UI expects. If there's a mismatch (legacy buckets that don't exist in ledger vocabulary or vice versa), build an explicit mapping table in code — no silent coercion, and any unmappable category renders as "Unmapped" with a count so the drift is visible instead of hidden.

## Feature 3 — Cross-spine parity check (dev tooling, not UI)

A read-only script — `scripts/compare-spines.ts`, modeled on `summarize-sync-exceptions.ts` conventions — that computes period totals per category from both spines for a given tenant slug and date range, and prints deltas.

Run:

```
npx dotenv -e .env.local -o -- tsx scripts/compare-spines.ts [slug] [from] [to]
```

This is the acceptance instrument for the whole of Spec A: when deltas are ~zero for Stone across a trailing month, the spines have converged for that tenant and later cleanup (legacy deletion) becomes safe to schedule.

## Feature 4 — Coverage-gap signal

When a module serves legacy fallback because ledger coverage is incomplete for the requested period, emit a low-priority signal through `signals.ts` identifying the gap window.

Operator-facing framing: "X days in this view are served from legacy data" — it should nudge toward resolving whatever exceptions are blocking ledger writes, not alarm. Must not fire for tenants with no ledger sources configured at all (fallback is their normal state, not a gap).

## Constraints

- Read-path only — no writes, no sync changes, no allocation changes.
- Allocation basis stays Toast earned sales; this spec does not touch BucketAllocation or the sweep schedule.
- Legacy path stays intact and reachable.
- Vitest on the category mapping table (every legacy bucket accounted for — mapped or explicitly unmapped), the parity script's delta math, and the coverage-gap signal conditions; full suite green.

## Definition of done

- Stone renders Cash Flow and Spending ledger-first with source-trust indicators.
- `compare-spines.ts` shows per-category deltas under 1% for Stone's trailing 30 days (or every residual delta is explained by a named open exception).
- Sandbox Diner falls back cleanly on both modules.
- Coverage-gap signal fires in a fixture with a deliberate 5-day ledger hole and stays silent for a no-ledger-source tenant.
