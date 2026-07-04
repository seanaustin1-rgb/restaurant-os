# Spec C — Review Flow Upgrades (/settings/sources/review)

**Status:** Ready to execute
**Branch convention:** New branch off main, one session, one PR, Codex `/review` before commit.
**Gates:** None. This spec unblocks Spec A.1 (clearing Stone's open exceptions is A.1's precondition).

## Context

Read `CLAUDE.md` and `docs/PRODUCT-MAP.md` first. Verify all file paths below against the actual repo before writing code — this spec was drafted from a session summary and the map is authoritative.

Current review flow supports approve and exclude only. Goal: make clearing large exception batches fast enough that a new customer's first review session takes minutes, and Stone's 373 open exceptions can be cleared today.

## Feature 1 — Approve-as-category (inline re-type)

On each exception row, replace the flat Approve button with Approve + a category selector (default = rule engine's current guess from `categorize()`). Approving writes the LedgerEntry with the chosen category, not just the guessed one. No navigation away from the review page.

## Feature 2 — Rule-save-from-review

When a user approves with a changed category, offer a one-click "save as rule" affordance that pre-fills the manual rule form logic (vendor signature → chosen category). Must route through the existing `keywordPatternProblem` guardrail in `suggestions.ts` — no bypass path. If the derived pattern fails the guardrail, show why and fall back to approve-without-rule.

## Feature 3 — Bulk-apply

Group view: exceptions grouped by issueType + vendor signature (same grouping logic as `scripts/summarize-sync-exceptions.ts` — extract shared grouping into a lib function rather than duplicating). Per group: approve all as [category], or exclude all. Show count and $ total per group before confirm. Confirm step required for any bulk action touching >10 rows.

## Constraints

- Ledger writes only through the existing NormalizedFinancialEvent → LedgerEntry path — no new write paths.
- Bulk actions must be transactional (all-or-nothing per group).
- Every bulk action logged (who, when, group signature, count) for audit.
- Vitest coverage on the grouping extraction and the guardrail integration; all 196 existing tests stay green.
- Rule saves from review do NOT retro-move historical rows — that stays `recategorize-transactions.ts --commit`, unchanged.

## Definition of done

Stone's 373 exceptions clearable in under 10 minutes using bulk-apply.

Demo path: run summarize script → open review → clear top 3 groups → re-run script showing counts dropped.
