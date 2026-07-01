import type { DataSourceStatus, PrismaClient } from "@prisma/client";
import type { BusinessType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sourceMapFor } from "@/lib/source-map";
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
import type { TapGauge, CategorySpend, SubGroup } from "@/components/dashboard/TapGauges";
import type { CostRatioGauge } from "@/components/dashboard/BeverageCostGauges";
import { loadGoLiveCoach, type GoLiveCoachData } from "@/lib/modules/go-live-coach";
import { loadCashOxygenFloor, type CashOxygenFloor } from "@/lib/modules/cash-oxygen";
import { loadPrimeCost } from "@/lib/modules/prime-cost";
import { loadRentalPropertyRollup, type RentalPropertyRollupData } from "@/lib/modules/rental-property-rollup";
import { loadAura, type AuraData } from "@/lib/modules/aura";
import { loadSourceConfigSnapshots } from "@/lib/source-status";

export interface DashboardData {
  restaurantId: string;
  name: string;
  businessType: BusinessType;
  periodLabel: string;
  hasData: boolean;
  realRevenue: number;
  operatingProfit: DashboardOperatingProfit;
  heartbeat: HeartbeatData;
  revenue: RevenueData;
  goLiveCoach: GoLiveCoachData;
  cashSafety: DashboardCashSafety;
  aura: DashboardAuraSummary;
  sourceSetup: SourceSetupSummary;
  rentalPropertyRollup: RentalPropertyRollupData | null;
  gauges: TapGauge[];
  costRatios: CostRatioGauge[];
}

export interface DashboardCashSafety {
  currentCash: number | null;
  oxygenDays: number | null;
  avgDailyFixedBurn: number | null;
  netCashChangePeriod: number | null;
  pendingReviewCount: number;
  source: CashOxygenFloor["source"];
  asOfDate: string | null;
  status: CashOxygenFloor["status"];
}

export interface DashboardOperatingProfit {
  amount: number;
  marginPct: number | null;
  components: {
    revenue: number;
    cogs: number;
    labor: number;
    opex: number;
  };
  excludes: string[];
}

export interface DashboardAuraSummary {
  configuredCount: number;
  liveCount: number;
  overallRating: number | null;
  totalReviews: number;
  health: AuraData["health"];
  hasAnyData: boolean;
  intentMetrics: AuraData["intentMetrics"];
}

export interface SourceSetupSummary {
  minimumAutoInput: string;
  requiredCount: number;
  connectedCount: number;
  plannedCount: number;
  blockedCount: number;
  notNeededCount: number;
  missingRequired: string[];
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
const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Loads + computes the dashboard for one restaurant from live DB data.
 *
 * Period = the calendar month of the most recent DailySales row (falls back to
 * the current month). Sales/operational metrics come from DailySales (POS tier);
 * costs come from categorized Transactions (bank tier). All ratios run through
 * the Profit First calculator.
 */
export async function loadDashboardData(
  restaurantId: string,
  db: PrismaClient = prisma,
): Promise<DashboardData> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    include: { tapSettings: true, targetSettings: true },
  });
  const name = restaurant?.name ?? "Restaurant";
  const seatCount = restaurant?.seatCount ?? 0;
  const businessType = restaurant?.businessType ?? "RESTAURANT";

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
  const latest = await db.dailySales.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const ref = latest?.date ?? new Date();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  const periodLabel = `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()} · MTD`;

  // Sales/operational from DailySales.
  const sales = await db.dailySales.aggregate({
    where: { restaurantId, date: { gte: start, lt: end } },
    _sum: { netSales: true, liquorSales: true, beverageSales: true, covers: true, checkCount: true, hoursOpen: true },
  });
  const revenue = n(sales._sum.netSales);
  const liquorSalesActual = n(sales._sum.liquorSales);
  const beverageSalesActual = n(sales._sum.beverageSales);
  const covers = n(sales._sum.covers);
  const checks = n(sales._sum.checkCount);
  const hoursOpen = n(sales._sum.hoursOpen);

  // Costs/spend per TAP, rolled up from each transaction's Category -> tapBucket.
  // (Two-level model: operator-extensible categories sum into the fixed TAP set.)
  const cats = await db.category.findMany({
    where: { restaurantId },
    select: { id: true, name: true, tapBucket: true },
  });
  const tapByCatId = new Map(cats.map((c) => [c.id, c.tapBucket as string]));
  const nameByCatId = new Map(cats.map((c) => [c.id, c.name]));

  const byCat = await db.transaction.groupBy({
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
  const profitSpend = tap("PROFIT"); // Debt Service — serviced from Profit (PF), not OpEx
  // TAX_SALES, TAX_PAYROLL, REVENUE, and EXCLUDED are intentionally not gauged.

  // Last 7 days of covers for the sparkline.
  const recent = await db.dailySales.findMany({
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

  const mkGauge = (
    key: string,
    label: string,
    tapPct: number,
    target: number,
    spent: number,
    categories: CategorySpend[],
    subGroups?: SubGroup[],
  ): TapGauge => {
    const usagePct = calculateUsagePct(spent, target);
    return { key, label, tapPct, target, spent, usagePct, health: getHealthStatus(usagePct), categories, subGroups };
  };

  // COGS is one headline line that drills into Food / Wine & Spirits / Beer.
  // In PA wine + spirits share one vendor (PLCB state store) → COGS_LIQUOR; beer
  // has its own distributors → COGS_BEVERAGE. Overall COGS spend includes all
  // three; the target stays the existing Food + Liquor TAP (30%) because beer has
  // no TAP % of its own yet — that's set with the allocation %s at
  // /settings/allocation (deferred until the operator confirms the redistribution).
  const cogsSubGroups: SubGroup[] = [
    { key: "food", label: "Food", amount: cogsFood, categories: catsForTap("COGS_FOOD") },
    { key: "wineSpirits", label: "Wine & Spirits", amount: cogsLiquor, categories: catsForTap("COGS_LIQUOR") },
    { key: "beer", label: "Beer", amount: cogsBeverage, categories: catsForTap("COGS_BEVERAGE") },
  ].filter((sg) => sg.amount > 0 || sg.categories.length > 0);

  const gauges: TapGauge[] = [
    mkGauge("profit", "Profit", taps.profitPct, targets.profit, profitSpend, catsForTap("PROFIT")),
    mkGauge("ownerPay", "Owner Pay", taps.ownerPayPct, targets.ownerPay, ownerPay, catsForTap("OWNER_PAY")),
    mkGauge(
      "cogs",
      "COGS",
      taps.cogsFoodPct + taps.cogsLiquorPct,
      targets.cogsFood + targets.cogsLiquor,
      cogsFood + cogsLiquor + cogsBeverage,
      [],
      cogsSubGroups,
    ),
    mkGauge("labor", "Labor", taps.laborPct, targets.labor, labor, catsForTap("LABOR")),
    mkGauge("opex", "OpEx + Spill", taps.opexPct, targets.opex, opex, catsForTap("OPEX")),
  ];

  // Beverage cost ratios (Milestone B). Denominator = real per-day alcohol sales
  // when present (future: Toast populates DailySales.liquorSales/.beverageSales),
  // else estimated from the operator's manual sales-mix %. Targets are operator-set
  // as a % of alcohol sales; lower is better.
  const ts = restaurant?.targetSettings;
  const targetLiquorPour = ts?.targetLiquorPourPct != null ? n(ts.targetLiquorPourPct) : null;
  const targetBeveragePour = ts?.targetBeveragePourPct != null ? n(ts.targetBeveragePourPct) : null;
  const costRatio = (
    key: string,
    label: string,
    cogs: number,
    actualSales: number,
    mixPct: number,
    target: number | null,
  ): CostRatioGauge => {
    let salesDenom = 0;
    let basis: CostRatioGauge["basis"] = "none";
    if (actualSales > 0) {
      salesDenom = actualSales;
      basis = "actual";
    } else if (mixPct > 0 && revenue > 0) {
      salesDenom = revenue * (mixPct / 100);
      basis = "estimated";
    }
    const costPct = salesDenom > 0 ? (cogs / salesDenom) * 100 : null;
    const health =
      costPct != null && target != null && target > 0 ? getHealthStatus((costPct / target) * 100) : "green";
    return { key, label, cogs, sales: salesDenom, costPct, target, health, basis };
  };
  const costRatios: CostRatioGauge[] = [
    costRatio("liquor", "Liquor Pour Cost", cogsLiquor, liquorSalesActual, n(ts?.liquorSalesMixPct), targetLiquorPour),
    costRatio("beverage", "Beer / Beverage Cost", cogsBeverage, beverageSalesActual, n(ts?.beverageSalesMixPct), targetBeveragePour),
  ];

  const hasData = revenue > 0 || byCat.length > 0;

  const rentalPropertyRollup = businessType === "VACATION_RENTAL" ? await loadRentalPropertyRollup(restaurantId, db) : null;
  const aura = await loadDashboardAura(restaurantId);
  const [cashOxygen, sourceSetup, netCashChangePeriod, primeCost] = await Promise.all([
    loadCashOxygenFloor(restaurantId, db),
    loadSourceSetupSummary(restaurantId, sourceMapFor(businessType), db),
    loadPeriodNetCashChange(restaurantId, start, end, db),
    loadPrimeCost(restaurantId, 8, db),
  ]);
  const goLiveCoach = await loadGoLiveCoach(restaurantId, db, cashOxygen);
  const operatingProfitAmount = revenue - (cogsFood + cogsLiquor + cogsBeverage) - labor - opex;

  return {
    restaurantId,
    name,
    businessType,
    periodLabel: rentalPropertyRollup?.periodLabel ?? periodLabel,
    hasData: businessType === "VACATION_RENTAL" ? Boolean(rentalPropertyRollup?.hasImportedRentalData || hasData) : hasData,
    realRevenue,
    operatingProfit: {
      amount: r2(operatingProfitAmount),
      marginPct: revenue > 0 ? r2((operatingProfitAmount / revenue) * 100) : null,
      components: {
        revenue: r2(revenue),
        cogs: r2(cogsFood + cogsLiquor + cogsBeverage),
        labor: r2(labor),
        opex: r2(opex),
      },
      excludes: ["owner pay", "debt service", "depreciation/amortization", "tax set-aside", "untracked spend"],
    },
    goLiveCoach,
    cashSafety: {
      currentCash: cashOxygen.currentCash,
      oxygenDays: cashOxygen.oxygenDays,
      avgDailyFixedBurn: cashOxygen.avgDailyFixedBurn,
      netCashChangePeriod,
      pendingReviewCount: cashOxygen.pendingFixedEventCount,
      source: cashOxygen.source,
      asOfDate: cashOxygen.asOfDate,
      status: cashOxygen.status,
    },
    aura,
    sourceSetup,
    rentalPropertyRollup,
    heartbeat: {
      primeCostPct: calculatePrimeCost(cogsFood, cogsLiquor + cogsBeverage, labor, revenue),
      primeCostTrendPts: primeCost.wowPrimeDelta,
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
    costRatios,
  };
}

async function loadPeriodNetCashChange(
  restaurantId: string,
  start: Date,
  end: Date,
  db: PrismaClient,
): Promise<number | null> {
  const txns = await db.transaction.aggregate({
    where: { restaurantId, date: { gte: start, lt: end } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  if (txns._count._all === 0) return null;

  // Transaction sign convention: outflows are positive, inflows are negative.
  return r2(-n(txns._sum.amount));
}

async function loadDashboardAura(restaurantId: string): Promise<DashboardAuraSummary> {
  try {
    const aura = await loadAura(restaurantId);
    return {
      configuredCount: aura.configuredCount,
      liveCount: aura.sources.filter((source) => source.state === "live").length,
      overallRating: aura.overallRating,
      totalReviews: aura.totalReviews,
      health: aura.health,
      hasAnyData: aura.hasAnyData,
      intentMetrics: aura.intentMetrics,
    };
  } catch {
    return {
      configuredCount: 0,
      liveCount: 0,
      overallRating: null,
      totalReviews: 0,
      health: "yellow",
      hasAnyData: false,
      intentMetrics: [],
    };
  }
}

async function loadSourceSetupSummary(
  restaurantId: string,
  sourceMap: ReturnType<typeof sourceMapFor>,
  db: PrismaClient,
): Promise<SourceSetupSummary> {
  const minimumOptions = sourceMap.groups.flatMap((group) =>
    group.options.filter((option) => option.minimum).map((option) => ({ category: group.category, providerName: option.name })),
  );
  let configs: { category: string; providerName: string; status: DataSourceStatus }[] = [];

  try {
    configs = await loadSourceConfigSnapshots(restaurantId, db);
  } catch {
    // Older/demo DBs may not have the source-planning table until migrations run.
    configs = [];
  }

  const statusByKey = new Map(configs.map((config) => [`${config.category}::${config.providerName}`, config.status]));
  const count = (status: DataSourceStatus) => configs.filter((config) => config.status === status).length;
  const missingRequired = minimumOptions
    .filter((option) => statusByKey.get(`${option.category}::${option.providerName}`) !== "CONNECTED")
    .map((option) => option.providerName);

  return {
    minimumAutoInput: sourceMap.minimumAutoInput,
    requiredCount: minimumOptions.length,
    connectedCount: count("CONNECTED"),
    plannedCount: count("PLANNED"),
    blockedCount: count("BLOCKED"),
    notNeededCount: count("NOT_NEEDED"),
    missingRequired,
  };
}
