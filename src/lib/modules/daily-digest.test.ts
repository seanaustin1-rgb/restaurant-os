import { describe, it, expect } from "vitest";
import type { DashboardData } from "@/lib/dashboard/data";
import type { ForwardCashData } from "@/lib/modules/forward-cash";
import { buildDailyDigest, renderDigestText } from "./daily-digest";

function dashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    restaurantId: "r1",
    name: "Stone Grille",
    businessType: "RESTAURANT",
    periodLabel: "Jun 2026 · MTD",
    hasData: true,
    realRevenue: 100_000,
    operatingProfit: {
      amount: 50_000,
      marginPct: 25,
      components: { revenue: 200_000, cogs: 60_000, labor: 60_000, opex: 30_000 },
      excludes: [],
    },
    heartbeat: {
      primeCostPct: 61, primeCostTrendPts: 1.5, laborPct: 34, foodPct: 20,
      liquorPct: 10, beveragePct: 2, coversMTD: 4000, coversSparkline: [],
    },
    revenue: { revenueMTD: 200_000, realRevenueMTD: 100_000, checkAverage: 40, revPASH: 20 },
    cashSafety: {
      currentCash: 100_000, oxygenDays: 45, avgDailyFixedBurn: 2_000, netCashChangePeriod: 10_000,
      pendingReviewCount: 0, source: "clean_ledger", asOfDate: "2026-06-30", status: "green",
    },
    goLiveCoach: {
      periodLabel: "Jun 2026 · MTD", hasData: true, stage: "coach", stageLabel: "Coach",
      stageNote: "", recommendation: "", summary: "", netSales: 200_000, salesDays: 20,
      transactionCount: 10, categorizationCoveragePct: 95, buckets: [], shortfalls: [], checks: [], pilotPlan: [],
      cashSafety: {
        hasAnchor: true, currentCash: 100_000, minimumOperatingCash: 50_000, oxygenDays: 45,
        avgDailyFixedBurn: 2_000, pilotSetAside: 0, cushionAfterPilot: 50_000, ready: true, detail: "",
      },
      decisions: [],
      assumptions: { operatingCashFloor: null, operatingCashFloorSource: "auto", pilotProfitPct: 1, investorReturnPct: 0 },
    },
    aura: { configuredCount: 0, liveCount: 0, overallRating: null, totalReviews: 0, health: "yellow", hasAnyData: false, intentMetrics: [] },
    sourceSetup: { minimumAutoInput: "", requiredCount: 2, connectedCount: 2, plannedCount: 0, blockedCount: 0, notNeededCount: 0, missingRequired: [] },
    rentalPropertyRollup: null,
    gauges: [],
    costRatios: [],
    ...overrides,
  } as DashboardData;
}

function forwardCash(overrides: Partial<ForwardCashData> = {}): ForwardCashData {
  return {
    hasAnchor: true, hasData: true, startDate: "2026-06-30", startBalance: 40_000,
    windowDays: 30, staleDays: 1, days: [], lowPoint: { date: "2026-07-10", balance: 12_000 },
    endBalance: 20_000, totalScheduledOut: 28_000, breachesZero: false, obligationCount: 4, note: "",
    ...overrides,
  };
}

const redBucket = {
  key: "labor", label: "Labor", kind: "drawdown", target: 100, actual: 130, gap: -30,
  usagePct: 130, signal: "red", ready: false, note: "Labor is over target.",
};

describe("buildDailyDigest", () => {
  it("surfaces the top red pressure as the one thing and alerts the subject", () => {
    const d = buildDailyDigest({
      restaurantName: "Stone Grille",
      dateLabel: "Saturday, Jul 4",
      dashboard: dashboard({ goLiveCoach: { ...dashboard().goLiveCoach, buckets: [redBucket] } as DashboardData["goLiveCoach"] }),
      forwardCash: forwardCash(),
    });
    expect(d.oneThing.tone).toBe("alert");
    expect(d.oneThing.label).toBe("Labor");
    expect(d.hasSignal).toBe(true);
    expect(d.subject).toBe("Stone Grille: Labor needs attention");
  });

  it("reads all-clear when nothing is red and sources are healthy", () => {
    const d = buildDailyDigest({
      restaurantName: "Stone Grille",
      dateLabel: "Saturday, Jul 4",
      dashboard: dashboard(),
      forwardCash: forwardCash(),
    });
    expect(d.oneThing.tone).toBe("ok");
    expect(d.watchItems).toEqual([]);
    expect(d.hasSignal).toBe(false);
    expect(d.subject).toBe("Stone Grille: all clear for Saturday, Jul 4");
  });

  it("degrades honestly to insufficient-data when no live data is loaded", () => {
    const d = buildDailyDigest({
      restaurantName: "Stone Grille",
      dateLabel: "Saturday, Jul 4",
      dashboard: dashboard({ hasData: false }),
      forwardCash: forwardCash({ hasAnchor: false, lowPoint: null }),
    });
    expect(d.oneThing.tone).toBe("info");
    expect(d.oneThing.value).toContain("No live operating data");
    expect(d.forwardCash).toBeNull();
  });

  it("excludes the one thing from watch items and caps watch at 3", () => {
    const buckets = ["labor", "opex", "food", "alcohol-beverage"].map((key, i) => ({
      ...redBucket, key, label: key, gap: -(40 - i * 5), // labor worst → becomes the one thing
    }));
    const d = buildDailyDigest({
      restaurantName: "Stone Grille",
      dateLabel: "Saturday, Jul 4",
      dashboard: dashboard({ goLiveCoach: { ...dashboard().goLiveCoach, buckets } as DashboardData["goLiveCoach"] }),
      forwardCash: forwardCash(),
    });
    expect(d.oneThing.label).toBe("labor");
    expect(d.watchItems).toHaveLength(3);
    expect(d.watchItems.map((w) => w.label)).not.toContain("labor");
  });

  it("flags a forward-cash zero breach and drives the subject when nothing else is red", () => {
    const d = buildDailyDigest({
      restaurantName: "Stone Grille",
      dateLabel: "Saturday, Jul 4",
      dashboard: dashboard(),
      forwardCash: forwardCash({ breachesZero: true, lowPoint: { date: "2026-07-12", balance: -3_000 } }),
    });
    expect(d.forwardCash?.tone).toBe("alert");
    expect(d.forwardCash?.value).toContain("goes negative");
    expect(d.subject).toBe("Stone Grille: cash dips below zero this month");
    expect(d.hasSignal).toBe(true);
  });

  it("escalates missing required sources", () => {
    const d = buildDailyDigest({
      restaurantName: "Stone Grille",
      dateLabel: "Saturday, Jul 4",
      dashboard: dashboard({ sourceSetup: { ...dashboard().sourceSetup, connectedCount: 1, requiredCount: 2, missingRequired: ["Toast"] } }),
      forwardCash: forwardCash(),
    });
    expect(d.sourceTrust.tone).toBe("alert");
    expect(d.sourceTrust.value).toContain("Toast");
    expect(d.hasSignal).toBe(true);
  });
});

describe("renderDigestText", () => {
  it("renders the one thing, watch items, forward cash, and sources in order", () => {
    const d = buildDailyDigest({
      restaurantName: "Stone Grille",
      dateLabel: "Saturday, Jul 4",
      dashboard: dashboard({ goLiveCoach: { ...dashboard().goLiveCoach, buckets: [redBucket] } as DashboardData["goLiveCoach"] }),
      forwardCash: forwardCash(),
    });
    const text = renderDigestText(d);
    expect(text).toContain("THE ONE THING");
    expect(text).toContain("Labor");
    expect(text).toContain("Forward cash");
    expect(text).toContain("Data sources");
  });
});
