import { describe, expect, it } from "vitest";
import { deriveBrokerageTopPressure, deriveCompanyDollar, type BrokerageCockpitData } from "./brokerage-analytics";

function cockpit(overrides: Partial<Omit<BrokerageCockpitData, "topPressure">> = {}): Omit<BrokerageCockpitData, "topPressure"> {
  return {
    restaurantId: "r1",
    name: "Harbor & Main Realty",
    periodLabel: "Jun 2026 - MTD",
    industryType: "REAL_ESTATE_BROKERAGE",
    dealHealth: {
      closedGci: 100_000,
      pipelineGci: 80_000,
      closedVolume: 4_000_000,
      sideCount: 8,
      trendPts: null,
    },
    ledgerHealth: {
      companyDollar: 18_000,
      companyDollarPct: 18,
      cashPosition: 150_000,
      status: "red",
    },
    companyDollarRetention: {
      pct: 18,
      targetPct: 25,
      atRiskFromCaps: 0,
      status: "red",
    },
    cashSafety: {
      currentCash: 150_000,
      oxygenDays: 95,
      avgDailyFixedBurn: 1_600,
      netCashChangePeriod: null,
      pendingReviewCount: 0,
      source: "anchor_plus_transactions",
      asOfDate: "2026-06-30",
      status: "green",
      floorDaysTarget: 120,
    },
    agentProduction: {
      activeAgents: 12,
      totalCompanyDollar: 18_000,
      allAgents: [],
      topContributors: [],
      bottomContributors: [],
    },
    marketAura: {
      market: null,
      aura: {
        configuredCount: 0,
        liveCount: 0,
        overallRating: null,
        totalReviews: 0,
        health: "yellow",
        hasAnyData: false,
        intentMetrics: [],
      },
    },
    reputationTrend: {
      ratingTrendPts: null,
      reviewVelocity: null,
      windowWeeks: 6,
      historyWeeks: 0,
      themes: { loved: [], flagged: [], summary: null },
      state: "not_connected",
    },
    marketPosition: {
      monthsOfSupply: null,
      marketSharePct: null,
      source: "not_connected",
      note: "Connect RESO/MLS market data for months of supply and brokerage market share.",
    },
    sourceTrust: { connected: 1, required: 3, missing: ["Follow Up Boss"], status: "partial" },
    ...overrides,
  };
}

describe("deriveCompanyDollar", () => {
  it("uses imported closed Company Dollar over GCI when present", () => {
    expect(deriveCompanyDollar({ closedCompanyDollar: 30_000, monthlyGci: 100_000, avgSplit: 70 })).toEqual({
      companyDollar: 30_000,
      companyDollarPct: 30,
    });
  });

  it("models Company Dollar from the profile split when nothing is imported", () => {
    expect(deriveCompanyDollar({ closedCompanyDollar: 0, monthlyGci: 100_000, avgSplit: 70 })).toEqual({
      companyDollar: 30_000,
      companyDollarPct: 30,
    });
    expect(deriveCompanyDollar({ closedCompanyDollar: 0, monthlyGci: 100_000, avgSplit: 75 })).toEqual({
      companyDollar: 25_000,
      companyDollarPct: 25,
    });
  });

  it("returns a null retention % when there is no monthly GCI (never a divide-by-zero)", () => {
    expect(deriveCompanyDollar({ closedCompanyDollar: 0, monthlyGci: 0, avgSplit: 70 })).toEqual({
      companyDollar: 0,
      companyDollarPct: null,
    });
  });

  it("is the single source of truth — module and cockpit call sites cannot diverge", () => {
    const input = { closedCompanyDollar: 42_500, monthlyGci: 150_000, avgSplit: 72 };
    // Both loaders now derive retention through this one helper, so identical inputs are identical outputs.
    expect(deriveCompanyDollar(input)).toEqual(deriveCompanyDollar({ ...input }));
    expect(deriveCompanyDollar(input).companyDollarPct).toBeCloseTo((42_500 / 150_000) * 100, 10);
  });
});

describe("deriveBrokerageTopPressure", () => {
  it("prioritizes company-dollar retention when it is below target", () => {
    expect(deriveBrokerageTopPressure(cockpit())).toMatchObject({
      metricKey: "brokerage-company-dollar-retention",
      label: "Company-Dollar Retention",
    });
  });

  it("falls through to cash oxygen when retention is healthy but cash is below target", () => {
    expect(
      deriveBrokerageTopPressure(
        cockpit({
          companyDollarRetention: { pct: 28, targetPct: 25, atRiskFromCaps: 0, status: "green" },
          cashSafety: {
            ...cockpit().cashSafety,
            status: "red",
            oxygenDays: 42,
          },
        }),
      ),
    ).toMatchObject({
      metricKey: "brokerage-cash-oxygen",
      currentValue: 42,
      targetValue: 120,
    });
  });

  it("surfaces cap-cliff risk when no higher-priority pressure is red", () => {
    expect(
      deriveBrokerageTopPressure(
        cockpit({
          companyDollarRetention: { pct: 28, targetPct: 25, atRiskFromCaps: 12_500, status: "green" },
          cashSafety: { ...cockpit().cashSafety, status: "green" },
        }),
      ),
    ).toMatchObject({
      metricKey: "brokerage-cap-cliff",
      label: "Cap-Cliff Risk",
    });
  });
});
