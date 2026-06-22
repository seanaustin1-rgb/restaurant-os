import { describe, expect, it } from "vitest";
import { computeRealEstateEstimate, type RealEstateEstimateInputs } from "./real-estate-estimate";

const base: RealEstateEstimateInputs = {
  name: "Example Realty",
  market: "York, PA",
  monthlyGci: 120_000,
  agentSplitPct: 70,
  franchiseFeePct: 6,
  referralFeePct: 4,
  monthlyOpex: 22_000,
  currentCash: 80_000,
  pendingDeals: 12,
  avgSalePrice: 350_000,
  avgCommissionPct: 2.5,
  expectedCloseRatePct: 80,
  avgBrokerageSharePct: 24,
  daysToClose: 60,
};

describe("computeRealEstateEstimate", () => {
  it("bases Profit First and break-even on company dollar, not GCI", () => {
    const result = computeRealEstateEstimate(base);

    expect(result.passThrough).toBeCloseTo(96_000, 2);
    expect(result.companyDollar).toBeCloseTo(24_000, 2);
    expect(result.companyDollarPct).toBeCloseTo(20, 2);
    expect(result.breakEvenCompanyDollar).toBe(22_000);
    expect(result.gciNeededToBreakEven).toBeCloseTo(110_000, 2);
    expect(result.breakEvenCushion).toBeCloseTo(2_000, 2);
    expect(result.pf.find((line) => line.key === "profit")?.amount).toBeCloseTo(1_200, 2);
  });

  it("converts pending deals into weighted expected company dollar", () => {
    const result = computeRealEstateEstimate(base);

    expect(result.expectedPipelineGci).toBeCloseTo(105_000, 2);
    expect(result.weightedPipelineGci).toBeCloseTo(84_000, 2);
    expect(result.expectedPipelineCompanyDollar).toBeCloseTo(20_160, 2);
  });
});
