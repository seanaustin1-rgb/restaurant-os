import type { TransactionBucket } from "@prisma/client";
import { categorize, type CategorizationContext } from "./rules";

/**
 * Pure planner for re-applying the CURRENT rules to existing bank-fed rows.
 *
 * Rule edits never retro-move rows on their own; this decides which rows a
 * re-apply would move and whether each move may also re-mirror to the clean
 * ledger. It goes through the one shared categorize() so a re-apply can't
 * disagree with what the nightly Plaid sync would decide today.
 *
 * Re-mirroring deletes and recreates the row's NormalizedFinancialEvent, which
 * would silently undo a review-page approval/exclusion. So a row whose ledger
 * event was decided by a person (or the triage script — anything that set
 * approvedBy, or EXCLUDED) is HELD: neither spine moves, and it's reported so
 * the operator re-decides it on /settings/sources/review. Moving only the
 * legacy side would split the spines, which is worse than leaving it.
 */

export interface ReapplyTxn {
  id: string;
  plaidTxnId: string | null;
  merchantName: string | null;
  description: string | null;
  amount: number;
  categoryId: string | null;
  bucket: TransactionBucket;
}

export interface ReapplyChange {
  id: string;
  plaidTxnId: string | null;
  fromCategoryId: string | null;
  fromBucket: TransactionBucket;
  categoryId: string | null;
  bucket: TransactionBucket;
  confidence: number;
}

export interface ReapplyPlan {
  scanned: number;
  /** Moves to apply: legacy row update, plus a ledger re-mirror when plaidTxnId is set. */
  changes: ReapplyChange[];
  /** Moves NOT applied because the ledger event already carries a human/script decision. */
  held: ReapplyChange[];
}

export function planReapply(
  ctx: CategorizationContext,
  txns: ReapplyTxn[],
  humanDecidedPlaidIds: ReadonlySet<string>,
): ReapplyPlan {
  const changes: ReapplyChange[] = [];
  const held: ReapplyChange[] = [];
  for (const t of txns) {
    const next = categorize(ctx, t.merchantName, t.description, t.amount);
    if (next.categoryId === t.categoryId && next.bucket === t.bucket) continue;
    const change: ReapplyChange = {
      id: t.id,
      plaidTxnId: t.plaidTxnId,
      fromCategoryId: t.categoryId,
      fromBucket: t.bucket,
      categoryId: next.categoryId,
      bucket: next.bucket,
      confidence: next.confidence,
    };
    if (t.plaidTxnId && humanDecidedPlaidIds.has(t.plaidTxnId)) held.push(change);
    else changes.push(change);
  }
  return { scanned: txns.length, changes, held };
}

/** "from → to" move counts, largest first, for the dry-run report. */
export function summarizeMoves(
  changes: ReapplyChange[],
  categoryName: (id: string | null) => string,
): Array<{ move: string; count: number }> {
  const counts = new Map<string, number>();
  for (const c of changes) {
    const move = `${categoryName(c.fromCategoryId)}[${c.fromBucket}] -> ${categoryName(c.categoryId)}[${c.bucket}]`;
    counts.set(move, (counts.get(move) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([move, count]) => ({ move, count }))
    .sort((a, b) => b.count - a.count || a.move.localeCompare(b.move));
}
