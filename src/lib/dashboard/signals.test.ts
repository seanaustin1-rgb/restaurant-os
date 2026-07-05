import { describe, expect, it } from "vitest";
import type { DashboardData } from "@/lib/dashboard/data";
import { deriveAttention, deriveCashFloorBreach, deriveCoverageGap, deriveSourceTrust, deriveTopPressure } from "@/lib/dashboard/signals";

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
      components: {
        revenue: 200_000,
        cogs: 60_000,
        labor: 60_000,
        opex: 30_000,
      },
      excludes: ["owner pay", "debt service", "depreciation/amortization", "tax set-aside", "untracked spend"],
    },
    heartbeat: {
      primeCostPct: 61,
      primeCostTrendPts: 1.5,
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
          label: "Operating Expenses",
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

describe("deriveCoverageGap", () => {
  it("fires a low-priority signal for a ledger tenant with a coverage hole", () => {
    // 5-day ledger hole in a 30-day window, tenant has a ledger source.
    const gap = deriveCoverageGap({ windowDays: 30, ledgerDaysInWindow: 25, hasLedgerSource: true });
    expect(gap).toMatchObject({ state: "gap", gapDays: 5, windowDays: 30, severity: "info" });
    if (gap.state === "gap") expect(gap.readout).toMatch(/legacy data/i);
  });

  it("treats a fully-legacy window as a gap when the tenant has a ledger source", () => {
    const gap = deriveCoverageGap({ windowDays: 30, ledgerDaysInWindow: 0, hasLedgerSource: true });
    expect(gap).toMatchObject({ state: "gap", gapDays: 30 });
  });

  it("stays silent for a tenant with no ledger source (legacy is normal, not a gap)", () => {
    const gap = deriveCoverageGap({ windowDays: 30, ledgerDaysInWindow: 0, hasLedgerSource: false });
    expect(gap).toEqual({ state: "none" });
  });

  it("stays silent at full ledger coverage", () => {
    expect(deriveCoverageGap({ windowDays: 30, ledgerDaysInWindow: 30, hasLedgerSource: true })).toEqual({
      state: "none",
    });
  });

  it("does not fire on an empty window", () => {
    expect(deriveCoverageGap({ windowDays: 0, ledgerDaysInWindow: 0, hasLedgerSource: true })).toEqual({
      state: "none",
    });
  });
});

describe("deriveCashFloorBreach", () => {
  it("fires red breach-now when estimated cash is already below the floor", () => {
    const b = deriveCashFloorBreach({ floor: 20000, currentCash: 12000, projectedLowPoint: 5000 });
    expect(b).toMatchObject({ state: "breach-now", floor: 20000, currentCash: 12000, shortfall: 8000, severity: "red" });
    if (b.state === "breach-now") expect(b.readout).toMatch(/\$12,000 is below your \$20,000 floor by \$8,000/);
  });

  it("fires red breach-projected (the pre-sweep warn) when the 30-day low-point dips below the floor", () => {
    const b = deriveCashFloorBreach({ floor: 20000, currentCash: 31000, projectedLowPoint: 14500 });
    expect(b).toMatchObject({ state: "breach-projected", floor: 20000, projectedLowPoint: 14500, shortfall: 5500, severity: "red" });
    if (b.state === "breach-projected") expect(b.readout).toMatch(/scheduled sweep/i);
  });

  it("prefers breach-now over a projected dip when both hold", () => {
    const b = deriveCashFloorBreach({ floor: 20000, currentCash: 15000, projectedLowPoint: 3000 });
    expect(b.state).toBe("breach-now");
  });

  it("stays silent when cash and the projected low-point both clear the floor", () => {
    expect(deriveCashFloorBreach({ floor: 20000, currentCash: 40000, projectedLowPoint: 25000 })).toEqual({
      state: "none",
    });
  });

  it("stays silent when no floor is configured", () => {
    expect(deriveCashFloorBreach({ floor: null, currentCash: 100, projectedLowPoint: -500 })).toEqual({
      state: "none",
    });
  });

  it("stays silent on a non-positive floor", () => {
    expect(deriveCashFloorBreach({ floor: 0, currentCash: -100, projectedLowPoint: -500 })).toEqual({
      state: "none",
    });
  });

  it("stays silent when there is no anchor (current cash unknown), even with a projection", () => {
    expect(deriveCashFloorBreach({ floor: 20000, currentCash: null, projectedLowPoint: 1000 })).toEqual({
      state: "none",
    });
  });

  it("does not require a projection to fire breach-now", () => {
    const b = deriveCashFloorBreach({ floor: 10000, currentCash: 4000, projectedLowPoint: null });
    expect(b).toMatchObject({ state: "breach-now", shortfall: 6000 });
  });
});
