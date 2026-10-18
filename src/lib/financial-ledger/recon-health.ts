import { computeSpineDeltas, spinesConverged, type SpineDelta, type SpineTotals } from "./spine-compare";

/**
 * V1 gate: "Stone reconciles clean for 7 consecutive days with no manual
 * intervention." This turns that sentence into a deterministic per-day verdict
 * so the streak is a query, not a judgment call. Pure — the script gathers the
 * facts, this decides.
 *
 * A day is CLEAN when, for bank activity dated that day:
 *  - nothing is still waiting on review (PENDING_REVIEW),
 *  - nothing needed a person to approve or exclude it (approvedBy set / EXCLUDED),
 *  - the legacy and ledger spines agree for the day (spinesConverged), and
 *  - Toast earned sales for that business day synced (a DailySales row exists).
 *
 * Bank rows post late, so a past day can turn dirty when a straggler lands —
 * the verdict is recomputed on every run, never cached.
 */

export type DayIssue =
  | "pending-review"
  | "manual-intervention"
  | "spines-diverge"
  | "toast-missing";

export interface DayFacts {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  pendingReview: number;
  manuallyDecided: number;
  toastSynced: boolean;
  legacy: SpineTotals;
  ledger: SpineTotals;
}

export interface DayVerdict {
  date: string;
  clean: boolean;
  issues: DayIssue[];
  pendingReview: number;
  manuallyDecided: number;
  deltas: SpineDelta[];
}

export function classifyDay(facts: DayFacts): DayVerdict {
  const deltas = computeSpineDeltas(facts.legacy, facts.ledger);
  const issues: DayIssue[] = [];
  if (facts.pendingReview > 0) issues.push("pending-review");
  if (facts.manuallyDecided > 0) issues.push("manual-intervention");
  if (!spinesConverged(deltas)) issues.push("spines-diverge");
  if (!facts.toastSynced) issues.push("toast-missing");
  return {
    date: facts.date,
    clean: issues.length === 0,
    issues,
    pendingReview: facts.pendingReview,
    manuallyDecided: facts.manuallyDecided,
    deltas,
  };
}

/** Consecutive clean days counting back from the most recent verdict. */
export function currentStreak(verdicts: DayVerdict[]): number {
  const sorted = [...verdicts].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const v of sorted) {
    if (!v.clean) break;
    streak++;
  }
  return streak;
}

/** Every ISO date from `from` through `to`, inclusive. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export const V1_STREAK_TARGET = 7;
