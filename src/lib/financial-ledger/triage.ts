// Bulk triage policy for open clean-ledger sync exceptions.
//
// This is the *decision* layer only — pure, DB-free, unit-tested. The CLI
// (`scripts/triage-exceptions.ts`) does the I/O and, on --execute, calls the
// canonical resolution functions (`approveFinancialEvent` / `excludeFinancialEvent`
// in review.ts) with whatever this classifier decided. We deliberately reuse the
// same building blocks the ingest path uses — `applyRules` (the one shared
// categorize decision) and `ledgerMappingForTap` (the one tap→ledger mapping) —
// so a bulk clear can never diverge from what a single-row review would do.
//
// Safety stance (see docs/fable-5/RUNBOOK-stone-triage.md): only a *positive*
// rule match is auto-actionable. Everything else stays PENDING_REVIEW for a
// human. We never blanket-approve the pipeline's original low-confidence guess,
// and we never auto-flip an event into or out of REVENUE.
import type { FinancialEventType, LedgerAccount, TapBucket } from "@prisma/client";
import { applyRules, type CompiledRule } from "../categorization/rules";
import { ledgerMappingForTap } from "./bank-transactions";

export type TriageAction = "approve" | "exclude" | "ambiguous";

export interface TriageEventInput {
  /** The event's current normalized eventType (the pipeline's ingest guess). */
  eventType: FinancialEventType;
  /** Signed amount as normalized (inflows are negative by the ingest convention). */
  amount: number;
  counterparty: string | null;
  description: string | null;
}

export interface TriageCategory {
  id: string;
  name: string;
  tapBucket: TapBucket;
}

export interface TriageDecision {
  action: TriageAction;
  reason: string;
  matchedCategoryId: string | null;
  matchedCategoryName: string | null;
  /** Target classification for an "approve" (or the excluded mapping); null when ambiguous. */
  eventType: FinancialEventType | null;
  ledgerAccount: LedgerAccount | null;
  tapBucket: TapBucket | null;
}

function isRevenue(eventType: FinancialEventType): boolean {
  return eventType === "REVENUE" || eventType === "REAL_REVENUE";
}

const AMBIGUOUS = (reason: string): TriageDecision => ({
  action: "ambiguous",
  reason,
  matchedCategoryId: null,
  matchedCategoryName: null,
  eventType: null,
  ledgerAccount: null,
  tapBucket: null,
});

/**
 * Decide what a single open exception's normalized event should become.
 *
 * - `approve`  — current rules positively match a category; re-map to that
 *                category's ledger classification and post it.
 * - `exclude`  — the matched category is an EXCLUDED bucket (transfers etc.).
 *                Only *applied* when the caller opts in; still surfaced in a dry run.
 * - `ambiguous`— no rule match, a foreign/unknown category, or a change that would
 *                flip the event into/out of REVENUE. Always left for a human.
 */
export function classifyException(
  event: TriageEventInput,
  rules: CompiledRule[],
  categoriesById: ReadonlyMap<string, TriageCategory>,
): TriageDecision {
  const match = applyRules(rules, event.counterparty, event.description);
  if (!match) return AMBIGUOUS("no rule match");

  const category = categoriesById.get(match.categoryId);
  if (!category) return AMBIGUOUS("matched a rule pointing at an unknown/foreign category");

  const mapping = ledgerMappingForTap({
    tapBucket: category.tapBucket,
    categoryName: category.name,
    // Neutral bucket: tapBucket + amount sign are the authoritative signals here.
    bucket: "UNCATEGORIZED",
    amount: event.amount,
  });

  // REVENUE guardrail: never let a bulk pass silently move money into or out of
  // revenue — that's the one reclassification a human must eyeball (runbook §1).
  if (isRevenue(event.eventType) !== isRevenue(mapping.eventType)) {
    return AMBIGUOUS(
      `would change revenue classification (${event.eventType} → ${mapping.eventType}) — needs manual review`,
    );
  }

  const base = {
    matchedCategoryId: category.id,
    matchedCategoryName: category.name,
    eventType: mapping.eventType,
    ledgerAccount: mapping.ledgerAccount,
    tapBucket: category.tapBucket,
  };

  if (mapping.eventType === "EXCLUDED") {
    return { action: "exclude", reason: `matched "${category.name}" (excluded bucket)`, ...base };
  }
  return { action: "approve", reason: `matched "${category.name}"`, ...base };
}

export interface TriageTally {
  approve: number;
  exclude: number;
  ambiguous: number;
}

/** Roll a set of decisions into per-action counts (for the dry-run distribution). */
export function tallyDecisions(decisions: readonly TriageDecision[]): TriageTally {
  const tally: TriageTally = { approve: 0, exclude: 0, ambiguous: 0 };
  for (const d of decisions) tally[d.action] += 1;
  return tally;
}
