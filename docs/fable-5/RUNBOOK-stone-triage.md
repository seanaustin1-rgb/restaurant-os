# RUNBOOK — Stone sync-exception triage (373 backlog)

**Precondition:** PR `claude/rule-guardrails-and-triage` merged to main and deployed. Guardrails must be live before clearing, or the 6:00 ET fan-out can regenerate the same exceptions.

**Timing:** Run between ~7:00 ET (after Plaid fan-out + Toast 5:30 pull settle) and end of day. Do not run while a fan-out is in flight.

> Adjust script name/flags to match the actual CLI in the branch — the sequence and safety gates below are the contract. Run from repo root with production env loaded the same way existing ops scripts are run (never paste connection strings into a shell history — use the env file / Vercel pull you already use).

## 0. Snapshot the before-state

```bash
npx tsx scripts/triage-exceptions.ts --tenant stone --count-only
```

Expected: `open: 373`. If the number differs materially, stop — new exceptions have accrued since 07-03; re-check what generated them before proceeding (fresh rule noise means guardrails aren't deployed or a new source pattern appeared).

Also snapshot ledger row count for the invariant check in step 4:

```bash
npx tsx scripts/triage-exceptions.ts --tenant stone --ledger-count
```

## 1. Dry run

```bash
npx tsx scripts/triage-exceptions.ts --tenant stone --dry-run --report out/stone-triage-dryrun.json
```

Review the report before anything mutates:

- **Distribution sanity:** what % resolves to auto-categorize vs needs-rule vs exclude vs still-ambiguous. If >~15% lands "still-ambiguous," the batch clear will just shrink the pile, not clear it — decide whether that's acceptable today or whether a rules pass comes first.
- **Spot-check 10 rows per bucket** by hand against the raw event. Pay attention to: transfers between accounts (must not become revenue/expense), Toast deposit batches vs earned-sales duplication, and payroll pulls.
- **No REVENUE reclassification surprises:** inflows are REVENUE by sign — any dry-run row proposing to flip an inflow out of REVENUE gets manual eyes.

## 2. Live run

Only after dry-run review:

```bash
npx tsx scripts/triage-exceptions.ts --tenant stone --execute --report out/stone-triage-live.json
```

## 3. Verify after-state

```bash
npx tsx scripts/triage-exceptions.ts --tenant stone --count-only
```

- Open exceptions should equal the dry-run's predicted residual (the still-ambiguous count), not zero-by-force.
- Ledger entry count: `before + resolved` — nothing deleted, exceptions resolve *into* the ledger or into explicit exclusions, never vanish.

## 4. Invariant checks (5 minutes, in the app)

- Cash Oxygen on Stone: runway number should move only by the net of newly-landed ledger entries — if it jumps wildly, an exclusion/categorization bucket went wrong. Compare against yesterday's screenshot/known value.
- Signals: Top Pressure shouldn't produce a nonsense signal from a mis-bucketed batch.
- `/settings/sources`: Plaid + Toast still LIVE, no new exceptions generated in the hour after the run.

## 5. Next morning check

After the next 6:00 ET fan-out: open-exception count on Stone should grow by ~normal daily volume (single digits), not re-accumulate. If it re-accumulates, a rule guardrail gap exists — capture the pattern, write the rule, re-run triage on the small residual.

## 6. Then: Sandbox Diner

Same sequence, `--tenant sandbox-diner`. Expect a **different** failure mode: 48 exceptions with 0 ledger entries suggests normalization mappings missing entirely, not rule noise. If the dry run shows near-100% still-ambiguous, that's a mapping fix, not a triage run — log it and stop.

## Rollback

There is no destructive step: exceptions are resolved, not deleted, and each resolution writes an audit trail (report JSON). If a bucket was wrong, re-open by status flip using the report's ID list — worst case is re-running triage on that subset after a rule fix.
