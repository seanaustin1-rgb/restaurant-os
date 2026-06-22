import { describe, expect, it } from "vitest";
import { computeAgentPerformance, computeAgentPerformanceList } from "./real-estate-agent-performance";

describe("real estate agent performance", () => {
  it("measures retained company dollar and weighted pipeline by agent", () => {
    const result = computeAgentPerformance({
      name: "Avery",
      closedGci: 40_000,
      agentSplitPct: 70,
      capRemaining: 12_000,
      pendingDeals: 3,
      avgDealGci: 9_000,
      expectedCloseRatePct: 80,
      leadSpend: 2_000,
    });

    expect(result.companyDollar).toBeCloseTo(12_000, 2);
    expect(result.companyDollarYieldPct).toBeCloseTo(30, 2);
    expect(result.weightedPipelineGci).toBeCloseTo(21_600, 2);
    expect(result.expectedPipelineCompanyDollar).toBeCloseTo(6_480, 2);
    expect(result.leadRoi).toBeCloseTo(3.24, 2);
    expect(result.overallHealth).toBe("green");
  });

  it("flags cap pressure when an agent is at cap", () => {
    const result = computeAgentPerformance({
      name: "Morgan",
      closedGci: 55_000,
      agentSplitPct: 95,
      capRemaining: 0,
      pendingDeals: 2,
      avgDealGci: 8_000,
      expectedCloseRatePct: 70,
      leadSpend: 0,
    });

    expect(result.companyDollarYieldPct).toBeCloseTo(5, 2);
    expect(result.capPressureHealth).toBe("red");
    expect(result.overallHealth).toBe("red");
    expect(result.note).toContain("cap");
  });

  it("sorts agent rows by total current and expected company dollar", () => {
    const rows = computeAgentPerformanceList([
      { name: "Low", closedGci: 10_000, agentSplitPct: 80, capRemaining: 10_000, pendingDeals: 0, avgDealGci: 0, expectedCloseRatePct: 0, leadSpend: 0 },
      { name: "High", closedGci: 25_000, agentSplitPct: 70, capRemaining: 10_000, pendingDeals: 2, avgDealGci: 8_000, expectedCloseRatePct: 75, leadSpend: 0 },
    ]);

    expect(rows[0].name).toBe("High");
  });
});
