import { describe, expect, it } from "vitest";
import { deriveAgentCoachingSignals, deriveBrokerageTopPressure, type BrokerageCockpitData } from "./brokerage-analytics";

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

function agentSignals(overrides: Partial<Parameters<typeof deriveAgentCoachingSignals>[0]> = {}): Parameters<typeof deriveAgentCoachingSignals>[0] {
  return {
    production: {
      closedGci: 50_000,
      closedVolume: 1_400_000,
      closedSides: 3,
      agentNetCommission: 35_000,
      annualCap: 24_000,
      capPaid: 12_000,
      capRemaining: 12_000,
      capProgressPct: 50,
    },
    forecast: {
      grossPipelineGci: 80_000,
      weightedPipelineGci: 56_000,
      projectedAgentNetCommission: 39_200,
      pendingDeals: 4,
      monthlyIncomeGoal: 20_000,
      incomeGoalCoveragePct: 371,
    },
    leads: {
      spend: 2_500,
      attributedGci: 15_000,
      attributedDeals: 2,
      grossRoiMultiple: 6,
      netCommissionRoiMultiple: 4.2,
      appointmentConversionPct: 22,
      closeConversionPct: 8,
      speedToLeadMinutes: 12,
    },
    activity: {
      sourceSystem: "BoldTrail",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      loginCount: 20,
      newLeadCount: 25,
      contactCount: 21,
      appointmentCount: 6,
      cmaCount: 3,
      activePipelineCount: 4,
    },
    ...overrides,
  };
}

describe("deriveAgentCoachingSignals", () => {
  it("prioritizes a severe income target gap", () => {
    const signals = deriveAgentCoachingSignals(
      agentSignals({
        forecast: {
          ...agentSignals().forecast,
          incomeGoalCoveragePct: 62,
        },
      }),
    );

    expect(signals[0]).toMatchObject({
      key: "goal_gap",
      severity: "red",
      source: "setup",
    });
  });

  it("flags company lead spend that has no matched return yet", () => {
    const signals = deriveAgentCoachingSignals(
      agentSignals({
        leads: {
          ...agentSignals().leads,
          attributedGci: 0,
          grossRoiMultiple: null,
          netCommissionRoiMultiple: null,
          speedToLeadMinutes: null,
        },
      }),
    );

    expect(signals.map((signal) => signal.key)).toEqual(expect.arrayContaining(["lead_waste", "speed_to_lead_missing"]));
  });

  it("flags cap sprint when the agent is close to capping", () => {
    const signals = deriveAgentCoachingSignals(
      agentSignals({
        production: {
          ...agentSignals().production,
          capRemaining: 2_000,
          capProgressPct: 91.7,
        },
      }),
    );

    expect(signals[0]).toMatchObject({
      key: "cap_sprint",
      severity: "red",
      source: "AppFiles",
    });
  });

  it("does not manufacture coaching pressure from healthy data", () => {
    expect(deriveAgentCoachingSignals(agentSignals())).toEqual([]);
  });
});
