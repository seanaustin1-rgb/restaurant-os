import type { BusinessType } from "@prisma/client";
import type { DashboardData } from "@/lib/dashboard/data";
import type { CategorySpend, TapGauge } from "@/components/dashboard/TapGauges";
import { calculatePrimeCost, calculateRealRevenue, getHealthStatus } from "@/lib/profit-first/calculator";
import { assessGoLiveReadiness } from "@/lib/modules/go-live-coach";
import { sourceMapFor } from "@/lib/source-map";

const MONTH = "Jun 2026 - MTD";

const COMPANIES: Record<BusinessType, string> = {
  RESTAURANT: "Demo Bistro",
  SERVICE: "Keystone Service Co.",
  CONTRACTOR: "Iron Ridge Field Services",
  REAL_ESTATE_BROKERAGE: "Harbor & Main Realty",
  VACATION_RENTAL: "Shoreline Stay Group",
  RETAIL: "Copper Lane Goods",
};

const SAMPLE: Record<BusinessType, { revenue: number; food: number; liquor: number; beverage: number; labor: number; opex: number; cash: number }> = {
  RESTAURANT: { revenue: 312_450, food: 56_240, liquor: 33_180, beverage: 8_900, labor: 99_980, opex: 61_400, cash: 118_000 },
  SERVICE: { revenue: 194_850, food: 0, liquor: 0, beverage: 0, labor: 82_600, opex: 43_200, cash: 96_500 },
  CONTRACTOR: { revenue: 428_700, food: 118_400, liquor: 0, beverage: 0, labor: 134_200, opex: 78_900, cash: 172_000 },
  REAL_ESTATE_BROKERAGE: { revenue: 286_000, food: 0, liquor: 0, beverage: 0, labor: 34_800, opex: 58_500, cash: 142_000 },
  VACATION_RENTAL: { revenue: 286_400, food: 0, liquor: 0, beverage: 0, labor: 42_200, opex: 84_900, cash: 133_000 },
  RETAIL: { revenue: 221_900, food: 92_300, liquor: 0, beverage: 0, labor: 43_800, opex: 38_600, cash: 88_200 },
};

function sourceSetup(type: BusinessType) {
  const map = sourceMapFor(type);
  const minimum = map.groups.flatMap((group) => group.options.filter((option) => option.minimum).map((option) => option.name));
  return {
    minimumAutoInput: map.minimumAutoInput,
    requiredCount: minimum.length,
    connectedCount: Math.max(1, minimum.length - 1),
    plannedCount: 1,
    blockedCount: 0,
    notNeededCount: 0,
    missingRequired: minimum.slice(0, 1),
  };
}

function gauge(key: string, label: string, tapPct: number, target: number, spent: number, categories: CategorySpend[] = []): TapGauge {
  const usagePct = target > 0 ? (spent / target) * 100 : 0;
  return { key, label, tapPct, target, spent, usagePct, health: getHealthStatus(usagePct), categories };
}

export function buildDemoTourData(type: BusinessType): DashboardData {
  const sample = SAMPLE[type];
  const revenue = sample.revenue;
  const cogs = sample.food + sample.liquor + sample.beverage;
  const companyDollar = type === "REAL_ESTATE_BROKERAGE" ? revenue * 0.284 : null;
  const allocationBase = companyDollar ?? revenue;
  const realRevenue = companyDollar ?? calculateRealRevenue(revenue, sample.food, sample.liquor + sample.beverage);
  const taxReserveModel = type === "RESTAURANT" || type === "RETAIL" ? revenue * 0.06 : allocationBase * 0.06;
  const taxReserveCleared = type === "RESTAURANT" || type === "RETAIL" ? revenue * 0.045 : allocationBase * 0.05;
  const taps = { profitPct: 5, ownerPayPct: 8, cogsFoodPct: 18, cogsLiquorPct: 12, laborPct: 32, opexPct: 28 };
  const gauges = [
    gauge("profit", "Profit", 5, allocationBase * 0.05, allocationBase * 0.04),
    gauge("ownerPay", "Owner Pay", 8, allocationBase * 0.08, allocationBase * 0.07),
    gauge("cogs", type === "RESTAURANT" ? "COGS" : "Direct Costs", 30, revenue * 0.3, cogs, [{ name: type === "RETAIL" ? "Inventory purchases" : "Job costs", amount: cogs }]),
    gauge("labor", "Labor", 32, allocationBase * 0.32, sample.labor, [{ name: "Payroll", amount: sample.labor }]),
    gauge("opex", "OpEx + Spill", 28, allocationBase * 0.28, sample.opex, [{ name: "Fixed operating bills", amount: sample.opex }]),
  ];

  return {
    restaurantId: `demo-${type.toLowerCase()}`,
    name: COMPANIES[type],
    businessType: type,
    periodLabel: MONTH,
    hasData: true,
    realRevenue,
    operatingProfit: {
      amount: realRevenue - sample.labor - sample.opex,
      marginPct: revenue > 0 ? ((realRevenue - sample.labor - sample.opex) / revenue) * 100 : null,
      components: {
        revenue,
        cogs,
        labor: sample.labor,
        opex: sample.opex,
      },
      excludes: ["owner pay", "debt service", "depreciation/amortization", "tax set-aside", "untracked spend"],
    },
    cashSafety: {
      currentCash: sample.cash,
      oxygenDays: sample.opex > 0 ? Math.round((sample.cash / (sample.opex / 30)) * 10) / 10 : null,
      avgDailyFixedBurn: sample.opex > 0 ? Math.round((sample.opex / 30) * 100) / 100 : null,
      netCashChangePeriod: realRevenue - sample.labor - sample.opex - cogs,
      pendingReviewCount: 0,
      source: "anchor_plus_transactions",
      asOfDate: "2026-06-30",
      status: sample.cash >= sample.opex * 1.5 ? "green" : sample.cash >= sample.opex * 0.75 ? "yellow" : "red",
    },
    sourceSetup: sourceSetup(type),
    aura: {
      configuredCount: 1,
      liveCount: 1,
      overallRating: 4.7,
      totalReviews: 3827,
      health: "green",
      hasAnyData: true,
      intentMetrics: [
        { key: "calls", label: "Phone calls", state: "live", value: 186, detail: "Last 30 days from Google Business Profile." },
        { key: "directions", label: "Direction requests", state: "live", value: 912, detail: "Last 30 days from Google Business Profile." },
        { key: "website", label: "Website clicks", state: "live", value: 428, detail: "Last 30 days from Google Business Profile." },
        { key: "views", label: "Profile views", state: "live", value: 18420, detail: "Last 30 days from Google Business Profile." },
      ],
    },
    rentalPropertyRollup: null,
    goLiveCoach: assessGoLiveReadiness({
      periodLabel: MONTH,
      salesDays: 21,
      netSales: allocationBase,
      transactionCount: 420,
      categorizedTransactionCount: 392,
      salesTaxCollected: taxReserveModel,
      salesTaxCleared: taxReserveCleared,
      taps,
      spendByTap: {
        PROFIT: allocationBase * 0.04,
        OWNER_PAY: allocationBase * 0.07,
        COGS_FOOD: sample.food,
        COGS_LIQUOR: sample.liquor + sample.beverage,
        LABOR: sample.labor,
        OPEX: sample.opex,
      },
      currentCash: sample.cash,
      minimumOperatingCash: sample.opex * 1.5,
    }),
    heartbeat: {
      primeCostPct: calculatePrimeCost(sample.food, sample.liquor + sample.beverage, sample.labor, revenue),
      primeCostTrendPts: type === "RESTAURANT" ? 2.4 : type === "RETAIL" ? -1.2 : null,
      laborPct: revenue > 0 ? (sample.labor / revenue) * 100 : 0,
      foodPct: revenue > 0 ? (sample.food / revenue) * 100 : 0,
      liquorPct: revenue > 0 ? (sample.liquor / revenue) * 100 : 0,
      beveragePct: revenue > 0 ? (sample.beverage / revenue) * 100 : 0,
      coversMTD: type === "RESTAURANT" ? 8_420 : 0,
      coversSparkline: [280, 312, 261, 305, 338, 421, 392],
    },
    revenue: {
      revenueMTD: revenue,
      realRevenueMTD: realRevenue,
      checkAverage: type === "RESTAURANT" ? 75.84 : 0,
      revPASH: type === "RESTAURANT" ? 3.72 : 0,
    },
    gauges,
    costRatios: [
      { key: "liquor", label: "Liquor Pour Cost", cogs: sample.liquor, sales: 116_250, costPct: 28.5, target: 30, health: "green", basis: "actual" },
      { key: "beverage", label: "Beer / Beverage Cost", cogs: sample.beverage, sales: 52_000, costPct: 17.1, target: 21, health: "green", basis: "actual" },
    ],
  };
}
