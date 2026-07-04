// Cross-spine parity: reduce both financial spines to one coarse bucket
// vocabulary and diff them. Pure + DB-free so the mapping and delta math are
// unit-tested; the CLI (`scripts/compare-spines.ts`) does the I/O.
//
// This is the acceptance instrument for Spec A (ledger convergence): when the
// per-bucket deltas are ~zero for a tenant across a period, the legacy
// (Transaction → TapBucket) and clean-ledger (LedgerEntry) spines agree and
// later legacy deletion becomes safe. See docs/fable-5/spec-a2-cashflow-spending.md.
import type { LedgerAccount, TapBucket } from "@prisma/client";

// Coarse buckets both spines can express. Deliberately collapses distinctions
// the *legacy* spine can't make (it has no FIXED_OPEX split, and its PROFIT
// bucket is debt-service spend) so the two are comparable — a finer A.3 mapping
// can supersede this later.
export type CanonicalBucket =
  | "REVENUE"
  | "COGS"
  | "LABOR"
  | "OPEX"
  | "TAX"
  | "OWNER_PAY"
  | "DEBT_SERVICE"
  | "OTHER";

export const CANONICAL_BUCKETS: readonly CanonicalBucket[] = [
  "REVENUE",
  "COGS",
  "LABOR",
  "OPEX",
  "TAX",
  "OWNER_PAY",
  "DEBT_SERVICE",
  "OTHER",
] as const;

/** Legacy TapBucket → canonical. A null/unknown category falls to OTHER. */
export function tapBucketToCanonical(tap: TapBucket | null): CanonicalBucket {
  switch (tap) {
    case "REVENUE":
      return "REVENUE";
    case "COGS_FOOD":
    case "COGS_LIQUOR":
    case "COGS_BEVERAGE":
      return "COGS";
    case "LABOR":
      return "LABOR";
    case "OPEX":
      return "OPEX";
    case "TAX_SALES":
    case "TAX_PAYROLL":
      return "TAX";
    case "OWNER_PAY":
      return "OWNER_PAY";
    case "PROFIT":
      // Legacy PROFIT bucket is where debt-service spend lands (see
      // TAP_BUCKET_TO_LEGACY / ledgerMappingForTap).
      return "DEBT_SERVICE";
    case "EXCLUDED":
    default:
      return "OTHER";
  }
}

/**
 * Clean-ledger LedgerAccount → canonical. Returns null for OPERATING_CASH, the
 * double-entry cash contra side, which must be skipped so cash isn't double-counted
 * against the expense/revenue leg of the same event.
 */
export function ledgerAccountToCanonical(account: LedgerAccount): CanonicalBucket | null {
  switch (account) {
    case "OPERATING_CASH":
      return null;
    case "REVENUE":
    case "REAL_REVENUE":
      return "REVENUE";
    case "COGS":
      return "COGS";
    case "LABOR":
      return "LABOR";
    case "OPEX":
    case "FIXED_OPEX":
      return "OPEX";
    case "TAX_VAULT":
      return "TAX";
    case "OWNER_PAY":
      return "OWNER_PAY";
    case "DEBT_SERVICE":
    case "PROFIT":
      return "DEBT_SERVICE";
    case "PASS_THROUGH_PAYABLE":
    case "AGENT_PAYABLE":
    case "INTERNAL_TRANSFER":
    case "SUSPENSE":
    default:
      return "OTHER";
  }
}

export type SpineTotals = Partial<Record<CanonicalBucket, number>>;

export interface SpineDelta {
  bucket: CanonicalBucket;
  legacy: number;
  ledger: number;
  /** ledger − legacy (positive → ledger reads higher). */
  delta: number;
  /** |delta| / legacy × 100; null when legacy is 0 (no baseline to normalize against). */
  pctDelta: number | null;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Diff two per-bucket totals. Emits one row per canonical bucket that either
 * spine has a non-zero total for, in canonical order.
 */
export function computeSpineDeltas(legacy: SpineTotals, ledger: SpineTotals): SpineDelta[] {
  const rows: SpineDelta[] = [];
  for (const bucket of CANONICAL_BUCKETS) {
    const l = legacy[bucket] ?? 0;
    const g = ledger[bucket] ?? 0;
    if (l === 0 && g === 0) continue;
    const delta = g - l;
    rows.push({
      bucket,
      legacy: r2(l),
      ledger: r2(g),
      delta: r2(delta),
      pctDelta: l !== 0 ? r2((Math.abs(delta) / Math.abs(l)) * 100) : null,
    });
  }
  return rows;
}

/** True when every bucket's |delta| is within `tolerancePct` of the legacy total
 * (buckets with no legacy baseline must be within `absFloor` dollars instead). */
export function spinesConverged(deltas: SpineDelta[], tolerancePct = 1, absFloor = 1): boolean {
  return deltas.every((d) =>
    d.pctDelta == null ? Math.abs(d.delta) <= absFloor : d.pctDelta <= tolerancePct,
  );
}
