import { describe, expect, it } from "vitest";
import { deriveBrokerageTopPressure, type BrokerageCockpitData } from "./brokerage-analytics";

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
    sourceTrust: { connected: 1, required: 3, missing: ["Follow Up Boss"], status: "partial" },
    ...overrides,
  };
}

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
