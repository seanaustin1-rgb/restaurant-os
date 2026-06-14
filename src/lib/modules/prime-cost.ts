import { prisma } from "@/lib/prisma";
import { calculatePrimeCost, getHealthStatus, type HealthStatus } from "@/lib/profit-first/calculator";

// Prime Cost module — the single most-watched restaurant operating number, given
// its own tile. Prime Cost = (COGS + Labor) / Net Sales. The dashboard Heartbeat
// shows the current MTD figure; this module breaks it into its anatomy (Food /
// Liquor / Beer / Labor as a share of sales), trends it by week, and bands it
// against the operator's TAP-derived target.
//
// Data tiers (consistent with the dashboard): Net Sales + Labor cost come from
// DailySales (POS tier, Toast); COGS comes from categorized Transactions (bank
// tier, cash-basis — counted when paid). Because COGS is cash-basis, the weekly
// series can be lumpy (a large food invoice lands in one week); the window total
// is the stable headline and the per-week trend is directional. This caveat is
// surfaced in the tile footnote — we never invent accrual we don't have.

export interface PrimeCostWeek {
  weekStart: string; // YYYY-MM-DD (Mon, UTC)
  netSales: number;
  cogs: number; // food + liquor + beer
  laborCost: number;
  primeCostPct: number; // (cogs + labor) / netSales * 100
  cogsPct: number;
  laborPct: number;
  partial: boolean; // fewer than 7 days of sales data
}

export interface PrimeCostComposition {
  cogsFood: number;
  cogsLiquor: number;
  cogsBeverage: number;
  labor: number;
  netSales: number;
}

export interface PrimeCostData {
  periodLabel: string;
  targetPct: number; // COGS (food+liquor) + Labor TAP %, from the operator's settings
  weeks: PrimeCostWeek[]; // oldest → newest
  latest: PrimeCostWeek | null;
  // Window totals (the stable headline).
  netSales: number;
  cogs: number;
  laborCost: number;
  primeCostPct: number;
  cogsPct: number;
  laborPct: number;
  composition: PrimeCostComposition;
  varianceVsTargetPts: number; // primeCostPct − targetPct (positive = over target)
  dollarsVsTarget: number; // variance in points applied to window net sales
  health: HealthStatus;
  wowPrimeDelta: number | null; // latest vs prior full week, in points
  hasData: boolean;
}

// Defaults mirror DEFAULT_TAPS in src/lib/dashboard/data.ts.
const DEFAULT_COGS_FOOD_PCT = 18;
const DEFAULT_COGS_LIQUOR_PCT = 12;
const DEFAULT_LABOR_PCT = 32;

const COGS_BUCKETS = new Set(["COGS_FOOD", "COGS_LIQUOR", "COGS_BEVERAGE"]);

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Monday (UTC) of the week containing `d`. */
function weekStartUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

const empty = (periodLabel = "", targetPct = DEFAULT_COGS_FOOD_PCT + DEFAULT_COGS_LIQUOR_PCT + DEFAULT_LABOR_PCT): PrimeCostData => ({
  periodLabel,
  targetPct,
  weeks: [],
  latest: null,
  netSales: 0,
  cogs: 0,
  laborCost: 0,
  primeCostPct: 0,
  cogsPct: 0,
  laborPct: 0,
  composition: { cogsFood: 0, cogsLiquor: 0, cogsBeverage: 0, labor: 0, netSales: 0 },
  varianceVsTargetPts: 0,
  dollarsVsTarget: 0,
  health: "green",
  wowPrimeDelta: null,
  hasData: false,
});

export async function loadPrimeCost(restaurantId: string, weeks = 8): Promise<PrimeCostData> {
  // Prime Cost target = the COGS (food + liquor) + Labor TAP %s the operator set.
  // Beer COGS is included in actual prime cost but has no TAP of its own yet, so
  // it is not in the target (mirrors the COGS gauge on the dashboard).
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { tapSettings: { select: { cogsFoodPct: true, cogsLiquorPct: true, laborPct: true } } },
  });
  const targetPct = restaurant?.tapSettings
    ? n(restaurant.tapSettings.cogsFoodPct) + n(restaurant.tapSettings.cogsLiquorPct) + n(restaurant.tapSettings.laborPct)
    : DEFAULT_COGS_FOOD_PCT + DEFAULT_COGS_LIQUOR_PCT + DEFAULT_LABOR_PCT;

  // Window anchors on the latest day with sales data (netSales is always present).
  const latestRow = await prisma.dailySales.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latestRow) return empty();

  const end = latestRow.date;
  const currentWeekStart = weekStartUTC(end);
  const windowStart = new Date(currentWeekStart);
  windowStart.setUTCDate(windowStart.getUTCDate() - 7 * (weeks - 1));

  // Sales + labor by day (POS tier).
  const salesRows = await prisma.dailySales.findMany({
    where: { restaurantId, date: { gte: windowStart, lte: end } },
    orderBy: { date: "asc" },
    select: { date: true, netSales: true, laborCost: true },
  });

  // COGS by transaction (bank tier). Map each txn's category → TAP bucket.
  const cats = await prisma.category.findMany({
    where: { restaurantId },
    select: { id: true, tapBucket: true },
  });
  const tapByCatId = new Map(cats.map((c) => [c.id, c.tapBucket as string]));
  const txns = await prisma.transaction.findMany({
    where: { restaurantId, date: { gte: windowStart, lte: end } },
    select: { date: true, categoryId: true, amount: true },
  });

  // Bucket sales/labor and COGS into weeks.
  interface Bucket {
    netSales: number;
    laborCost: number;
    cogsFood: number;
    cogsLiquor: number;
    cogsBeverage: number;
    days: number;
  }
  const mk = (): Bucket => ({ netSales: 0, laborCost: 0, cogsFood: 0, cogsLiquor: 0, cogsBeverage: 0, days: 0 });
  const buckets = new Map<string, Bucket>();
  const keyOf = (d: Date) => weekStartUTC(d).toISOString().slice(0, 10);

  for (const r of salesRows) {
    const b = buckets.get(keyOf(r.date)) ?? mk();
    b.netSales += n(r.netSales);
    b.laborCost += n(r.laborCost);
    b.days += 1;
    buckets.set(keyOf(r.date), b);
  }
  for (const t of txns) {
    const tap = t.categoryId ? tapByCatId.get(t.categoryId) : undefined;
    if (!tap || !COGS_BUCKETS.has(tap)) continue;
    // COGS outflows are stored positive (inflows negative); sum as-is.
    const b = buckets.get(keyOf(t.date)) ?? mk();
    const amt = n(t.amount);
    if (tap === "COGS_FOOD") b.cogsFood += amt;
    else if (tap === "COGS_LIQUOR") b.cogsLiquor += amt;
    else b.cogsBeverage += amt;
    buckets.set(keyOf(t.date), b);
  }

  const weekList: PrimeCostWeek[] = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekStart, b]) => {
      const cogs = b.cogsFood + b.cogsLiquor + b.cogsBeverage;
      return {
        weekStart,
        netSales: b.netSales,
        cogs,
        laborCost: b.laborCost,
        primeCostPct: calculatePrimeCost(b.cogsFood, b.cogsLiquor + b.cogsBeverage, b.laborCost, b.netSales),
        cogsPct: b.netSales > 0 ? (cogs / b.netSales) * 100 : 0,
        laborPct: b.netSales > 0 ? (b.laborCost / b.netSales) * 100 : 0,
        partial: b.days < 7,
      };
    });

  // Window totals (the stable headline) — sum the buckets directly.
  const totals = [...buckets.values()].reduce(
    (acc, b) => {
      acc.netSales += b.netSales;
      acc.laborCost += b.laborCost;
      acc.cogsFood += b.cogsFood;
      acc.cogsLiquor += b.cogsLiquor;
      acc.cogsBeverage += b.cogsBeverage;
      return acc;
    },
    { netSales: 0, laborCost: 0, cogsFood: 0, cogsLiquor: 0, cogsBeverage: 0 },
  );
  const cogs = totals.cogsFood + totals.cogsLiquor + totals.cogsBeverage;
  const primeCostPct = calculatePrimeCost(totals.cogsFood, totals.cogsLiquor + totals.cogsBeverage, totals.laborCost, totals.netSales);
  const varianceVsTargetPts = primeCostPct - targetPct;

  const latest = weekList.length ? weekList[weekList.length - 1] : null;
  const fullWeeks = weekList.filter((w) => !w.partial);
  const wowPrimeDelta =
    fullWeeks.length >= 2
      ? fullWeeks[fullWeeks.length - 1].primeCostPct - fullWeeks[fullWeeks.length - 2].primeCostPct
      : null;

  return {
    periodLabel: `${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`,
    targetPct,
    weeks: weekList,
    latest,
    netSales: totals.netSales,
    cogs,
    laborCost: totals.laborCost,
    primeCostPct,
    cogsPct: totals.netSales > 0 ? (cogs / totals.netSales) * 100 : 0,
    laborPct: totals.netSales > 0 ? (totals.laborCost / totals.netSales) * 100 : 0,
    composition: {
      cogsFood: totals.cogsFood,
      cogsLiquor: totals.cogsLiquor,
      cogsBeverage: totals.cogsBeverage,
      labor: totals.laborCost,
      netSales: totals.netSales,
    },
    varianceVsTargetPts,
    dollarsVsTarget: (varianceVsTargetPts / 100) * totals.netSales,
    // Cost metric — lower is better; band on how prime tracks its target.
    health: targetPct > 0 ? getHealthStatus((primeCostPct / targetPct) * 100) : "green",
    wowPrimeDelta,
    hasData: totals.netSales > 0,
  };
}
