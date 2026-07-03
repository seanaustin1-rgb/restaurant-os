# CLAUDE.md — Restaurant OS / OutFront Data

**Read `docs/PRODUCT-MAP.md` first.** It is the single-page orientation for this
repo: data model, live connectors, dashboard architecture, current debt, and
the two active execution specs (ledger convergence, Toast multi-tenancy).

## Non-negotiables

- **Two financial spines exist.** Legacy `Transaction`→`TapBucket` and the
  clean ledger (`RawSourceEvent`→`NormalizedFinancialEvent`→`LedgerEntry`).
  New dashboard math reads the ledger with a legacy fallback (Cash Oxygen is
  the pattern). Never add a third path.
- **Categorization goes through `categorize()`** in
  `src/lib/categorization/rules.ts` — the one decision shared by Plaid sync,
  statement import, and the recategorize script. Never fork it.
- **Rule edits do NOT retro-move existing rows.** After any rule change, run
  `scripts/recategorize-transactions.ts --commit`.
- **KEYWORD rules are guarded** — word-start matching in the engine, stopword
  rejection in `signatureOf` and `keywordPatternProblem`. Don't relax these;
  a broad keyword rule misfiled $17.7k of labor in June 2026.
- **Signals stay deterministic.** `src/lib/dashboard/signals.ts` is shared by
  Operator and Investor views — no AI, no overclaiming, honest degradation.
- **Allocation basis = Toast earned sales, not bank deposits.** Cash-tip-heavy
  restaurants make deposits an unreliable basis. Plaid is fundability truth.
- **Demo writes only ever hit `DEMO_DATABASE_URL`** (`demoPrisma` no-ops when
  unset). Production data is untouchable from demo paths.
- **Investor role is read-only** and hard-redirected to `/investor`.

## Conventions

- Tests: Vitest, colocated `*.test.ts`. `npm test` must be green before push.
- Scripts follow the `scripts/run-allocation-ledger.ts` style: doc header with
  the exact `npx dotenv -e .env.local -o -- tsx …` run line; dry-run by default
  when they write.
- `AGENTS.md` holds Codex reviewer conventions; `docs/SESSION-HANDOFF.md`
  RESUME HERE blocks hold session state. Update the handoff when you stop.

## Useful entry points

- Exception triage: `scripts/summarize-sync-exceptions.ts [slug]`
- Module registry: `src/lib/modules.ts` · Source maps: `src/lib/source-map.ts`
- Profit First engine: `src/lib/profit-first/` · Inngest: `src/lib/inngest/functions.ts`
