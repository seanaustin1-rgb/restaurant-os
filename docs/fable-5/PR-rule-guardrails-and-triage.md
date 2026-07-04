# PR: Rule guardrails + sync-exception triage

**Branch:** `claude/rule-guardrails-and-triage` → `main`
**Commit:** `6923f48` on top of `b93a93b`

## What this does

Hardens the categorization rule engine and adds tooling to triage the sync-exception backlog (373 open on Stone, 48 on Sandbox Diner).

- **Rule guardrails** — validation on Rule creation/edit in `src/lib/categorization/rules.ts`: prevents overlapping/conflicting outflow rules and malformed matchers from entering the shared `categorize()` path used by both financial spines.
- **Triage script** — batch classification of open `SyncException` rows so the backlog can be cleared in bulk instead of one-by-one in the review flow (which today only supports approve/exclude).

## Why now

- The 373-exception backlog on Stone blocks trust in the ledger spine (Cash Oxygen reads ledger-first).
- Guardrails must land **before** batch-clearing, so cleared exceptions can't be re-created by a bad rule on the next 6:00 ET Plaid fan-out.

## Testing

- Vitest suite green (196 baseline + guardrail cases).
- Triage script supports `--dry-run`; see `RUNBOOK-stone-triage.md` for the production run sequence.

## Known limitations (unchanged, tracked)

- Rule edits do not retro-move already-categorized rows.
- Review flow remains approve/exclude only.
- Spec A (ledger convergence) not included — the two spines can still disagree; this PR only stops new noise entering the ledger spine.

## Merge checklist

- [ ] CI green
- [ ] No schema changes beyond additive (verify migration folder)
- [ ] After merge: run triage runbook on Stone (dry-run → live)
- [ ] After Stone clears: repeat on Sandbox Diner (48 exceptions / 0 ledger entries — expect different failure mode, likely missing normalization mappings rather than rule noise)
