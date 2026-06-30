import { describe, expect, it } from "vitest";
import type { DashboardData } from "@/lib/dashboard/data";
import { deriveAttention, deriveSourceTrust, deriveTopPressure } from "@/lib/dashboard/signals";

function dashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    restaurantId: "r1",
    name: "Stone Grille",
    businessType: "RESTAURANT",
    periodLabel: "Jun 2026 · MTD",
    hasData: true,
    realRevenue: 100_000,
    heartbeat: {
      primeCostPct: 61,
      laborPct: 34,
      foodPct: 20,
      liquorPct: 10,
      beveragePct: 2,
      coversMTD: 4000,
      coversSparkline: [],
    },
    revenue: {
      revenueMTD: 200_000,
      realRevenueMTD: 100_000,
      checkAverage: 40,
      revPASH: 20,
    },
    cashSafety: {
      currentCash: 100_000,
      oxygenDays: 45,
      avgDailyFixedBurn: 2_000,
      netCashChangePeriod: 10_000,
      pendingReviewCount: 0,
      source: "clean_ledger",
      asOfDate: "2026-06-30",
      status: "green",
    },
    goLiveCoach: {
      periodLabel: "Jun 2026 · MTD",
      hasData: true,
      stage: "coach",
      stageLabel: "Coach",
      stageNote: "",
      recommendation: "",
      summary: "",
      netSales: 200_000,
      salesDays: 20,
      transactionCount: 10,
      categorizationCoveragePct: 95,
      buckets: [],
      shortfalls: [],
      checks: [],
      pilotPlan: [],
      cashSafety: {
        hasAnchor: true,
        currentCash: 100_000,
        minimumOperatingCash: 50_000,
        oxygenDays: 45,
        avgDailyFixedBurn: 2_000,
        pilotSetAside: 0,
        cushionAfterPilot: 50_000,
        ready: true,
        detail: "",
      },
      decisions: [],
      assumptions: {
        operatingCashFloor: null,
        operatingCashFloorSource: "auto",
        pilotProfitPct: 1,
        investorReturnPct: 0,
      },
    },
    aura: {
      configuredCount: 0,
      liveCount: 0,
      overallRating: null,
      totalReviews: 0,
      health: "yellow",
      hasAnyData: false,
      intentMetrics: [],
    },
    sourceSetup: {
      minimumAutoInput: "",
      requiredCount: 2,
      connectedCount: 2,
      plannedCount: 0,
      blockedCount: 0,
      notNeededCount: 0,
      missingRequired: [],
    },
    rentalPropertyRollup: null,
    gauges: [],
    costRatios: [],
    ...overrides,
  } as DashboardData;
}

describe("dashboard signals", () => {
  it("ranks tax reserve ahead of an equal-magnitude pressure tie", () => {
    const data = dashboard({
      goLiveCoach: {
        ...dashboard().goLiveCoach,
        buckets: [
          {
            key: "labor",
            label: "Labor",
            kind: "drawdown",
            target: 100,
            actual: 120,
            gap: -20,
            usagePct: 120,
            signal: "red",
            ready: false,
            note: "Labor is over target.",
          },
          {
            key: "tax-reserve",
            label: "Tax Reserve",
            kind: "reserve",
            target: 100,
            actual: 120,
            gap: -20,
            usagePct: 120,
            signal: "red",
            ready: false,
            note: "Tax reserve is short.",
          },
        ],
      },
    });

    const attention = deriveAttention(data);

    expect(attention[0]?.id).toBe("bucket-tax-reserve");
    expect(deriveTopPressure(data)).toMatchObject({ state: "pressure", id: "bucket-tax-reserve" });
  });

  it("uses largest red overshoot before lower-priority pressure", () => {
    const data = dashboard({
      gauges: [
        {
          key: "opex",
          label: "OpEx + Spill",
          tapPct: 28,
          target: 100,
          spent: 175,
          usagePct: 175,
          health: "red",
          categories: [],
        },
        {
          key: "labor",
          label: "Labor",
          tapPct: 32,
          target: 100,
          spent: 130,
          usagePct: 130,
          health: "red",
          categories: [],
        },
      ],
    });

    expect(deriveTopPressure(data)).toMatchObject({ state: "pressure", id: "gauge-opex" });
  });

  it("does not invent a top pressure when no operating data is loaded", () => {
    expect(deriveTopPressure(dashboard({ hasData: false }))).toEqual({
      state: "insufficient-data",
      reason: "No live operating data loaded for this period yet.",
    });
  });

  it("treats missing required sources as partial even when optional sources are connected", () => {
    const trust = deriveSourceTrust(
      dashboard({
        sourceSetup: {
          minimumAutoInput: "",
          requiredCount: 2,
          connectedCount: 3,
          plannedCount: 0,
          blockedCount: 0,
          notNeededCount: 0,
          missingRequired: ["Plaid"],
        },
      }),
    );

    expect(trust).toMatchObject({ status: "partial", escalate: true });
  });
});
