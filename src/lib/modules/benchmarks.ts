import { prisma } from "@/lib/prisma";
import type { HealthStatus } from "@/lib/profit-first/calculator";

// Peer Benchmarks module — the operator's core operating ratios banded against
// full-service / casual-dining INDUSTRY REFERENCE RANGES. These ranges are
// static, well-established operating norms (not live peer data) — the honest
// scaffold for the "benchmarks" tile until a real peer dataset lands, at which
// point the ranges below get swapped for cohort percentiles with no UI change.
//
// Metrics (all % of net sales unless noted), with the standard references:
//   • Prime Cost   ≤ 60% ideal, 60–65% watch, >65% high
//   • COGS         28–32% typical, >35% high
//   • Labor        28–34% typical, >36% high
//   • Net Margin   ≥ 6% healthy, 3–6% thin, <3% poor (higher is better)
//
// Data path mirrors Prime Cost / Break-even: net sales + labor from DailySales
// (Toast); COGS, OPEX and debt service cash-basis from categorized transactions.

export interface BenchmarkRow {
  key: string;
  label: string;
  value: number; // the operator's actual, in `unit`
  unit: "%";
  lowerIsBetter: boolean;
  // Axis + zone edges (ascending) that drive both the verdict and the bar.
  scaleMax: number;
  greenMax: number | null; // lowerIsBetter: ≤ this = green
  yellowMax: number | null; // lowerIsBetter: ≤ this = yellow, above = red
  greenMin: number | null; // higherIsBetter: ≥ this = green
  yellowMin: number | null; // higherIsBetter: ≥ this = yellow, below = red
  typicalLow: number; // annotated "industry typical" band
  typicalHigh: number;
  status: HealthStatus;
  note: string;
}

export interface BenchmarksData {
  periodLabel: string;
  cohort: string; // which peer group the ranges describe
  netSales: number;
  rows: BenchmarkRow[];
  overall: HealthStatus; // worst-of, the headline read
  greenCount: number;
  hasData: boolean;
}

const COGS_BUCKETS = new Set(["COGS_FOOD", "COGS_LIQUOR", "COGS_BEVERAGE"]);
const n = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const COHORT = "Full-service / casual dining";

function weekStartUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

function bandLower(value: number, greenMax: number, yellowMax: number): HealthStatus {
  if (value <= greenMax) return "green";
  if (value <= yellowMax) return "yellow";
  return "red";
}
function bandHigher(value: number, greenMin: number, yellowMin: number): HealthStatus {
  if (value >= greenMin) return "green";
  if (value >= yellowMin) return "yellow";
  return "red";
}

function costNote(value: number, typicalLow: number, typicalHigh: number, status: HealthStatus): string {
  if (status === "green") return value < typicalLow ? "below typical — lean" : "within typical range";
  if (status === "yellow") return `${(value - typicalHigh).toFixed(1)} pts above typical`;
  return `${(value - typicalHigh).toFixed(1)} pts over — high vs. peers`;
}
function profitNote(value: number, typicalLow: number, status: HealthStatus): string {
  if (status === "green") return "healthy vs. peers";
  if (status === "yellow") return "thin — below the healthy band";
  return value < 0 ? "operating at a loss this window" : `${(typicalLow - value).toFixed(1)} pts under healthy`;
}

const empty = (periodLabel = ""): BenchmarksData => ({
  periodLabel,
  cohort: COHORT,
  netSales: 0,
  rows: [],
  overall: "green",
  greenCount: 0,
  hasData: false,
});

export async function loadBenchmarks(restaurantId: string, weeks = 8): Promise<BenchmarksData> {
  const latestRow = await prisma.dailySales.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latestRow) return empty();

  const end = latestRow.date;
  const windowStart = new Date(weekStartUTC(end));
  windowStart.setUTCDate(windowStart.getUTCDate() - 7 * (weeks - 1));

  const [salesRows, cats] = await Promise.all([
    prisma.dailySales.findMany({
      where: { restaurantId, date: { gte: windowStart, lte: end } },
      select: { netSales: true, laborCost: true },
    }),
    prisma.category.findMany({ where: { restaurantId }, select: { id: true, tapBucket: true } }),
  ]);
  const tapByCat = new Map(cats.map((c) => [c.id, c.tapBucket as string]));
  const txns = await prisma.transaction.findMany({
    where: { restaurantId, date: { gte: windowStart, lte: end } },
    select: { categoryId: true, amount: true },
  });

  let netSales = 0;
  let laborCost = 0;
  for (const r of salesRows) {
    netSales += n(r.netSales);
    laborCost += n(r.laborCost);
  }

  let cogs = 0;
  let opex = 0;
  let debt = 0;
  for (const t of txns) {
    const tap = t.categoryId ? tapByCat.get(t.categoryId) : undefined;
    if (!tap) continue;
    const amt = n(t.amount);
    if (amt <= 0) continue;
    if (COGS_BUCKETS.has(tap)) cogs += amt;
    else if (tap === "OPEX") opex += amt;
    else if (tap === "PROFIT") debt += amt; // debt service
  }

  if (netSales <= 0) return empty(`${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`);

  const pct = (v: number) => (v / netSales) * 100;
  const primeCostPct = pct(cogs + laborCost);
  const cogsPct = pct(cogs);
  const laborPct = pct(laborCost);
  const netMarginPct = pct(netSales - (cogs + laborCost + opex + debt));

  const rows: BenchmarkRow[] = [];

  // Prime Cost — lower is better.
  {
    const status = bandLower(primeCostPct, 60, 65);
    rows.push({
      key: "prime", label: "Prime Cost", value: primeCostPct, unit: "%", lowerIsBetter: true,
      scaleMax: 85, greenMax: 60, yellowMax: 65, greenMin: null, yellowMin: null,
      typicalLow: 55, typicalHigh: 60, status, note: costNote(primeCostPct, 55, 60, status),
    });
  }
  // COGS — lower is better.
  {
    const status = bandLower(cogsPct, 32, 35);
    rows.push({
      key: "cogs", label: "COGS", value: cogsPct, unit: "%", lowerIsBetter: true,
      scaleMax: 50, greenMax: 32, yellowMax: 35, greenMin: null, yellowMin: null,
      typicalLow: 28, typicalHigh: 32, status, note: costNote(cogsPct, 28, 32, status),
    });
  }
  // Labor — lower is better.
  {
    const status = bandLower(laborPct, 34, 36);
    rows.push({
      key: "labor", label: "Labor", value: laborPct, unit: "%", lowerIsBetter: true,
      scaleMax: 50, greenMax: 34, yellowMax: 36, greenMin: null, yellowMin: null,
      typicalLow: 28, typicalHigh: 34, status, note: costNote(laborPct, 28, 34, status),
    });
  }
  // Net Margin — higher is better.
  {
    const status = bandHigher(netMarginPct, 6, 3);
    rows.push({
      key: "margin", label: "Net Margin", value: netMarginPct, unit: "%", lowerIsBetter: false,
      scaleMax: 20, greenMax: null, yellowMax: null, greenMin: 6, yellowMin: 3,
      typicalLow: 6, typicalHigh: 12, status, note: profitNote(netMarginPct, 6, status),
    });
  }

  const rank: Record<HealthStatus, number> = { green: 0, yellow: 1, red: 2 };
  const overall = rows.reduce<HealthStatus>((worst, r) => (rank[r.status] > rank[worst] ? r.status : worst), "green");

  return {
    periodLabel: `${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`,
    cohort: COHORT,
    netSales,
    rows,
    overall,
    greenCount: rows.filter((r) => r.status === "green").length,
    hasData: true,
  };
}
