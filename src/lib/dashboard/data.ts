import { prisma } from "@/lib/prisma";
import {
  calculatePrimeCost,
  calculateRealRevenue,
  calculateRevPASH,
  calculateTargets,
  calculateUsagePct,
  getHealthStatus,
  type Taps,
} from "@/lib/profit-first/calculator";
import type { HeartbeatData } from "@/components/dashboard/HeartbeatStrip";
import type { RevenueData } from "@/components/dashboard/RevenueRow";
import type { TapGauge, CategorySpend } from "@/components/dashboard/TapGauges";

export interface DashboardData {
  restaurantId: string;
  name: string;
  periodLabel: string;
  hasData: boolean;
  realRevenue: number;
  heartbeat: HeartbeatData;
  revenue: RevenueData;
  gauges: TapGauge[];
}

const DEFAULT_TAPS: Taps = {
  profitPct: 5,
  ownerPayPct: 5,
  cogsFoodPct: 18,
  cogsLiquorPct: 12,
  laborPct: 32,
  opexPct: 28,
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const n = (v: unknown): number => (v == null ? 0 : Number(v));

/**
 * Loads + computes the dashboard for one restaurant from live DB data.
 *
 * Period = the calendar month of the most recent DailySales row (falls back to
 * the current month). Sales/operational metrics come from DailySales (POS tier);
 * costs come from categorized Transactions (bank tier). All ratios run through
 * the Profit First calculator.
 */
export async function loadDashboardData(restaurantId: string): Promise<DashboardData> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { tapSettings: true },
  });
  const name = restaurant?.name ?? "Restaurant";
  const seatCount = restaurant?.seatCount ?? 0;

  const taps: Taps = restaurant?.tapSettings
    ? {
        profitPct: n(restaurant.tapSettings.profitPct),
        ownerPayPct: n(restaurant.tapSettings.ownerPayPct),
        cogsFoodPct: n(restaurant.tapSettings.cogsFoodPct),
        cogsLiquorPct: n(restaurant.tapSettings.cogsLiquorPct),
        laborPct: n(restaurant.tapSettings.laborPct),
        opexPct: n(restaurant.tapSettings.opexPct),
      }
    : DEFAULT_TAPS;

  // Period = month of latest DailySales (else current month).
  const latest = await prisma.dailySales.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const ref = latest?.date ?? new Date();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  const periodLabel = `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()} · MTD`;

  // Sales/operational from DailySales.
  const sales = await prisma.dailySales.aggregate({
    where: { restaurantId, date: { gte: start, lt: end } },
    _sum: { netSales: true, covers: true, checkCount: true, hoursOpen: true },
  });
  const revenue = n(sales._sum.netSales);
  const covers = n(sales._sum.covers);
  const checks = n(sales._sum.checkCount);
  const hoursOpen = n(sales._sum.hoursOpen);

  // Costs/spend per TAP, rolled up from each transaction's Category -> tapBucket.
  // (Two-level model: operator-extensible categories sum into the fixed TAP set.)
  const cats = await prisma.category.findMany({
    where: { restaurantId },
    select: { id: true, name: true, tapBucket: true },
  });
  const tapByCatId = new Map(cats.map((c) => [c.id, c.tapBucket as string]));
  const nameByCatId = new Map(cats.map((c) => [c.id, c.name]));

  const byCat = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { restaurantId, date: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  const tapSum: Record<string, number> = {};
  // Per-TAP category breakdown (for the dashboard drill-down). Keyed by TAP, then
  // by category name so a real "Misc" row and null-category spend merge cleanly.
  const breakdown: Record<string, Map<string, number>> = {};
  for (const row of byCat) {
    // Null category -> Misc -> OpEx (operator decision: nothing is dropped).
    const tap = (row.categoryId && tapByCatId.get(row.categoryId)) || "OPEX";
    const amount = n(row._sum.amount);
    tapSum[tap] = (tapSum[tap] ?? 0) + amount;
    const name = (row.categoryId && nameByCatId.get(row.categoryId)) || "Misc";
    const m = (breakdown[tap] ??= new Map());
    m.set(name, (m.get(name) ?? 0) + amount);
  }
  const tap = (b: string) => tapSum[b] ?? 0;
  // Sorted, positive-spend category rows for a TAP bucket (largest first).
  const catsForTap = (b: string): CategorySpend[] =>
    [...(breakdown[b]?.entries() ?? [])]
      .map(([name, amount]) => ({ name, amount }))
      .filter((c) => c.amount > 0)
      .sort((a, b2) => b2.amount - a.amount);

  const cogsFood = tap("COGS_FOOD");
  const cogsLiquor = tap("COGS_LIQUOR");
  const cogsBeverage = tap("COGS_BEVERAGE");
  const labor = tap("LABOR"); // Payroll — Paper Checks already maps to LABOR
  const opex = tap("OPEX");
  const ownerPay = tap("OWNER_PAY");
  // TAX_SALES, TAX_PAYROLL, REVENUE, and EXCLUDED are intentionally not gauged.

  // Last 7 days of covers for the sparkline.
  const recent = await prisma.dailySales.findMany({
    where: { restaurantId },
    orderBy: { date: "desc" },
    take: 7,
    select: { covers: true },
  });
  const coversSparkline = recent.map((r) => n(r.covers)).reverse();

  // Profit First math.
  const realRevenue = calculateRealRevenue(revenue, cogsFood, cogsLiquor);
  // TAP targets are a % of Total Sales (COGS is itself a TAP bucket).
  const targets = calculateTargets(revenue, taps);

  const gaugeDefs = [
    { key: "profit", label: "Profit", tapPct: taps.profitPct, target: targets.profit, spent: 0, bucket: "" },
    { key: "ownerPay", label: "Owner Pay", tapPct: taps.ownerPayPct, target: targets.ownerPay, spent: ownerPay, bucket: "OWNER_PAY" },
    { key: "cogsFood", label: "COGS — Food", tapPct: taps.cogsFoodPct, target: targets.cogsFood, spent: cogsFood, bucket: "COGS_FOOD" },
    { key: "cogsLiquor", label: "COGS — Liquor", tapPct: taps.cogsLiquorPct, target: targets.cogsLiquor, spent: cogsLiquor, bucket: "COGS_LIQUOR" },
    { key: "labor", label: "Labor", tapPct: taps.laborPct, target: targets.labor, spent: labor, bucket: "LABOR" },
    { key: "opex", label: "OpEx + Spill", tapPct: taps.opexPct, target: targets.opex, spent: opex, bucket: "OPEX" },
  ];
  const gauges: TapGauge[] = gaugeDefs.map(({ bucket, ...g }) => {
    const usagePct = calculateUsagePct(g.spent, g.target);
    return { ...g, usagePct, health: getHealthStatus(usagePct), categories: catsForTap(bucket) };
  });

  const hasData = revenue > 0 || byCat.length > 0;

  return {
    restaurantId,
    name,
    periodLabel,
    hasData,
    realRevenue,
    heartbeat: {
      primeCostPct: calculatePrimeCost(cogsFood, cogsLiquor + cogsBeverage, labor, revenue),
      laborPct: revenue > 0 ? (labor / revenue) * 100 : 0,
      foodPct: revenue > 0 ? (cogsFood / revenue) * 100 : 0,
      liquorPct: revenue > 0 ? (cogsLiquor / revenue) * 100 : 0,
      beveragePct: revenue > 0 ? (cogsBeverage / revenue) * 100 : 0,
      coversMTD: covers,
      coversSparkline,
    },
    revenue: {
      revenueMTD: revenue,
      realRevenueMTD: realRevenue,
      checkAverage: checks > 0 ? revenue / checks : 0,
      revPASH: calculateRevPASH(revenue, seatCount, hoursOpen),
    },
    gauges,
  };
}
