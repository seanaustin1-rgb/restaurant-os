# CLAUDE.md — Restaurant OS / OutFront Data

**Read `docs/PRODUCT-MAP.md` first.** It is the single-page orientation for this
repo: data model, live connectors, dashboard architecture, current debt, and
the two active execution specs (ledger convergence, Toast multi-tenancy).

**Business model & priorities:** `docs/strategy/2026-10-18-business-model-and-v1-gate.md`
— OutFront is the business, Spirit Vault is an operator-toggled module, V1 on Stone
Grille is the gate. Read it before any billing, entitlement, channel, or Vault work.

## Non-negotiables

- **Two financial spines exist.** Legacy `Transaction`→`TapBucket` and the
  clean ledger (`RawSourceEvent`→`NormalizedFinancialEvent`→`LedgerEntry`).
  New dashboard math reads the ledger with a legacy fallback (Cash Oxygen is
  the pattern). Never add a third path.
- **Categorization goes through `categorize()`** in
  `src/lib/categorization/rules.ts` — the one decision shared by Plaid sync,
  statement import, and `scripts/reapply-rules.ts`. Never fork it.
- **Rule edits do NOT retro-move existing rows.** After any rule change, run
  `scripts/reapply-rules.ts --tenant <slug>` (dry run), then again with
  `--commit`. It moves bank-fed, non-override rows and re-mirrors each to the
  ledger; rows already decided on `/settings/sources/review` are held, not
  overwritten. Don't use `reapply-categorization-ledger.ts` for this — it only
  fills UNCATEGORIZED / confidence ≤ 0 rows.
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
- V1 gate streak: `scripts/recon-health.ts --tenant <slug> --since <cutover>`
- Module registry: `src/lib/modules.ts` · Source maps: `src/lib/source-map.ts`
- Profit First engine: `src/lib/profit-first/` · Inngest: `src/lib/inngest/functions.ts`
