/**
 * Canonical, pure, tested derivations on top of the existing DashboardData shape.
 *
 * This is the single source of truth for the cross-view "what needs attention",
 * the deterministic "one thing", and the investor-safe source/trust status — so
 * the Operator and Investor views never diverge on these signals.
 *
 * Rules (per review): deterministic only (no AI); never overclaim; degrade
 * honestly when data is thin. Reads DashboardData read-only — no DB, no math
 * changes to the data layer.
 */
import type { DashboardData } from "./data";

type Gauge = DashboardData["gauges"][number];
type CostRatio = DashboardData["costRatios"][number];
type Bucket = DashboardData["goLiveCoach"]["buckets"][number];

export type Severity = "red" | "yellow";

export interface AttentionItem {
  /** Namespaced metric key — also the MetricNote join key: gauge-* | ratio-* | bucket-*. */
  id: string;
  label: string;
  severity: Severity;
  readout: string;
  /** How far past target, normalized to a % (for ranking). null when not computable. */
  overByPct: number | null;
  /** A short system explanation, when the source data carries one. */
  systemNote?: string;
}

export type TopPressure =
  | { state: "ok" }
  | { state: "insufficient-data"; reason: string }
  | { state: "pressure"; id: string; label: string; readout: string; severity: Severity };

export interface SourceTrust {
  status: "healthy" | "partial";
  connected: number;
  required: number;
  missing: string[];
  /** When required sources aren't met, freshness can't be trusted — surface prominently, not as a footnote. */
  escalate: boolean;
}

/**
 * Stable tie-break priority — lower = more important. Compliance/cash-safety
 * (tax reserve) outranks operating pressure so an equal-magnitude tie is
 * deterministic and defensible.
 */
const PRIORITY: Record<string, number> = {
  "bucket-tax-reserve": 0,
  "bucket-labor": 1,
  "gauge-labor": 1,
  "gauge-opex": 2,
  "bucket-opex": 2,
  "bucket-food": 3,
  "gauge-cogs": 3,
  "bucket-alcohol-beverage": 4,
  "ratio-liquor": 4,
  "ratio-beverage": 5,
};

function priorityOf(id: string): number {
  return PRIORITY[id] ?? 50;
}

function gaugeOverByPct(g: Gauge): number | null {
  return g.usagePct != null ? g.usagePct - 100 : null;
}

function ratioOverByPct(c: CostRatio): number | null {
  if (c.costPct == null || c.target == null || c.target <= 0) return null;
  return (c.costPct / c.target - 1) * 100;
}

function bucketOverByPct(b: Bucket): number | null {
  if (b.target <= 0) return null;
  // gap = target - actual; a negative gap is over-spend / shortfall.
  return (Math.abs(Math.min(0, b.gap)) / b.target) * 100;
}

/** Everything currently out of band, richest-signal-first is applied by the caller via rankAttention. */
export function deriveAttention(data: DashboardData): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const g of data.gauges) {
    if (g.health === "red" || g.health === "yellow") {
      items.push({
        id: `gauge-${g.key}`,
        label: g.label,
        severity: g.health === "red" ? "red" : "yellow",
        readout:
          g.usagePct != null
            ? `${Math.round(g.usagePct)}% of virtual target`
            : "Over its virtual target",
        overByPct: gaugeOverByPct(g),
      });
    }
  }

  for (const c of data.costRatios) {
    if ((c.health === "red" || c.health === "yellow") && c.costPct != null && c.target != null) {
      items.push({
        id: `ratio-${c.key}`,
        label: c.label,
        severity: c.health === "red" ? "red" : "yellow",
        readout: `${c.costPct.toFixed(1)}% actual vs ${c.target}% target`,
        overByPct: ratioOverByPct(c),
      });
    }
  }

  for (const b of data.goLiveCoach.buckets) {
    if (b.signal === "red") {
      items.push({
        id: `bucket-${b.key}`,
        label: b.label,
        severity: "red",
        readout: `${b.gap < 0 ? "shortfall" : "over target"} on the modeled allocation`,
        overByPct: bucketOverByPct(b),
        systemNote: b.note,
      });
    }
  }

  return rankAttention(items);
}

/** Deterministic ordering: red before yellow, then largest overshoot, then fixed priority. */
export function rankAttention(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "red" ? -1 : 1;
    const ao = a.overByPct ?? -Infinity;
    const bo = b.overByPct ?? -Infinity;
    if (bo !== ao) return bo - ao;
    return priorityOf(a.id) - priorityOf(b.id);
  });
}

/**
 * "The One Thing." Deterministic, with honest degradation:
 * - no live data → insufficient-data (don't invent a pressure point)
 * - nothing red → ok (yellow alone isn't "the" problem)
 * - otherwise the top-ranked RED item.
 */
export function deriveTopPressure(data: DashboardData): TopPressure {
  if (!data.hasData) {
    return { state: "insufficient-data", reason: "No live operating data loaded for this period yet." };
  }
  const reds = deriveAttention(data).filter((i) => i.severity === "red");
  if (reds.length === 0) return { state: "ok" };
  const top = reds[0];
  return { state: "pressure", id: top.id, label: top.label, readout: top.readout, severity: "red" };
}

/**
 * Investor-safe source/trust status. Honest by construction: we report what is
 * connected vs required and escalate when the minimum map isn't met (freshness
 * can't be trusted). True per-source staleness timestamps are a data-layer add
 * (Codex lane) — not claimed here.
 */
export function deriveSourceTrust(data: DashboardData): SourceTrust {
  const { connectedCount, requiredCount, missingRequired } = data.sourceSetup;
  const met = requiredCount === 0 || missingRequired.length === 0;
  return {
    status: met ? "healthy" : "partial",
    connected: connectedCount,
    required: requiredCount,
    missing: missingRequired,
    escalate: !met,
  };
}

/**
 * Coverage-gap signal (Spec A.2 Feature 4). A LOW-PRIORITY, informational nudge —
 * deliberately NOT part of the red/yellow attention ranking, so it never competes
 * with real operating pressure in "The One Thing". Fires when a tenant that HAS a
 * ledger source is still being served some/all of a period from the legacy spine
 * (ledger coverage incomplete for the window), pointing at the gap so the operator
 * resolves the blocking sync exceptions. Silent for tenants with no ledger source
 * at all — legacy is their normal state, not a gap — and silent at full coverage.
 * Pure: the caller supplies how many days the ledger covers + whether a ledger
 * source exists.
 */
export interface CoverageGapInput {
  /** Length of the period the view covers, in days. */
  windowDays: number;
  /** Distinct days within that window that have ledger coverage. */
  ledgerDaysInWindow: number;
  /** Whether the tenant has any ledger source configured. If not, legacy is normal. */
  hasLedgerSource: boolean;
}

export type CoverageGap =
  | { state: "none" }
  | { state: "gap"; gapDays: number; windowDays: number; severity: "info"; readout: string };

export function deriveCoverageGap(input: CoverageGapInput): CoverageGap {
  const { windowDays, ledgerDaysInWindow, hasLedgerSource } = input;
  // No ledger source → the module always reads legacy; that's expected, not a gap.
  if (!hasLedgerSource) return { state: "none" };
  if (windowDays <= 0) return { state: "none" };
  const gapDays = Math.max(0, windowDays - Math.max(0, ledgerDaysInWindow));
  if (gapDays <= 0) return { state: "none" };
  return {
    state: "gap",
    gapDays,
    windowDays,
    severity: "info",
    readout: `${gapDays} of the last ${windowDays} days in this view ${gapDays === 1 ? "is" : "are"} served from legacy data — resolve open sync exceptions to move them onto the ledger.`,
  };
}

/**
 * Cash floor breach (B6) — deterministic cash-safety signal against the operator's
 * minimum-cash-floor setting. Two escalating states:
 *   • breach-now       — estimated cash is already below the floor.
 *   • breach-projected — cash clears the floor today, but the 30-day Forward Cash
 *                        LOW-POINT (which already stacks payroll, recurring bills,
 *                        AND the scheduled 10th/25th Profit First sweep) dips below
 *                        it. This is the "pre-sweep warn": the sweep is a modeled
 *                        obligation in that projection.
 * Silent when no floor is configured, no anchor exists (currentCash unknown), or
 * the floor is non-positive. Pure: the caller supplies the already-computed cash
 * figures — no DB, no clock.
 */
export interface CashFloorInput {
  /** Operator-set minimum cash floor, in dollars. Null = not configured (silent). */
  floor: number | null;
  /** Current estimated cash (anchor + net flow). Null = no anchor (silent). */
  currentCash: number | null;
  /** Forward Cash 30-day projected low-point balance (includes the scheduled sweep). Null = no projection. */
  projectedLowPoint: number | null;
}

export type CashFloorBreach =
  | { state: "none" }
  | {
      state: "breach-now";
      floor: number;
      currentCash: number;
      shortfall: number;
      severity: "red";
      readout: string;
    }
  | {
      state: "breach-projected";
      floor: number;
      projectedLowPoint: number;
      shortfall: number;
      severity: "red";
      readout: string;
    };

// Deterministic dollar formatter (no ICU dependency, so test strings are stable).
function usd(v: number): string {
  const neg = v < 0;
  const body = Math.round(Math.abs(v))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-$" : "$"}${body}`;
}

export function deriveCashFloorBreach(input: CashFloorInput): CashFloorBreach {
  const { floor, currentCash, projectedLowPoint } = input;
  // No floor set, or a non-positive floor, → nothing to compare against.
  if (floor == null || floor <= 0) return { state: "none" };
  // No anchor → we don't know current cash, so we can't honestly assert a breach.
  if (currentCash == null) return { state: "none" };

  // Already under the floor takes precedence over a projected dip.
  if (currentCash < floor) {
    const shortfall = Math.round((floor - currentCash) * 100) / 100;
    return {
      state: "breach-now",
      floor,
      currentCash,
      shortfall,
      severity: "red",
      readout: `Estimated cash ${usd(currentCash)} is below your ${usd(floor)} floor by ${usd(shortfall)}.`,
    };
  }

  // Pre-sweep warning: the 30-day low-point (payroll + recurring + scheduled sweep) dips below the floor.
  if (projectedLowPoint != null && projectedLowPoint < floor) {
    const shortfall = Math.round((floor - projectedLowPoint) * 100) / 100;
    return {
      state: "breach-projected",
      floor,
      projectedLowPoint,
      shortfall,
      severity: "red",
      readout: `Cash clears your ${usd(floor)} floor today, but the 30-day low-point drops to ${usd(projectedLowPoint)} — ${usd(shortfall)} under — once payroll, recurring bills, and the scheduled sweep land.`,
    };
  }

  return { state: "none" };
}
