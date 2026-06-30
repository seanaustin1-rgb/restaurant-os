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
