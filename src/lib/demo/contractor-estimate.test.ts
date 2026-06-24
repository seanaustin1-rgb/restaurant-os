import { describe, it, expect } from "vitest";
import { computeContractorEstimate, type ContractorEstimateInputs } from "./contractor-estimate";

const base: ContractorEstimateInputs = {
  name: "Iron Ridge Field Services",
  market: "York, PA",
  software: "jobber",
  monthlyRevenue: 200000,
  materials: 70000,
  fieldLabor: 64000,
  subcontractors: 12000,
  monthlyOverhead: 30000,
  backlog: 412000,
  monthlyCapacity: 220000,
  openReceivables: 120000,
  receivablesOver30: 18200,
};

describe("computeContractorEstimate", () => {
  it("computes job margin from the materials/labor/subs split", () => {
    const r = computeContractorEstimate(base);
    expect(r.jobCost).toBe(146000);
    expect(r.jobMarginPct).toBeCloseTo(27, 1);
    expect(r.materialsPct).toBeCloseTo(35, 1);
    expect(r.laborPct).toBeCloseTo(32, 1);
    expect(r.netMarginPct).toBeCloseTo(12, 1);
    expect(r.jobMarginHealth).toBe("yellow"); // 27 in [25,35)
  });

  it("recovers overhead into a break-even with margin of safety", () => {
    const r = computeContractorEstimate(base);
    expect(r.monthlyBreakEven).toBeCloseTo(111111.11, 0); // 30,000 / 0.27
    expect(r.marginOfSafetyPct).toBeCloseTo(44.44, 1);
    expect(r.breakEvenHealth).toBe("green");
  });

  it("turns backlog into weeks of coverage", () => {
    const r = computeContractorEstimate(base);
    expect(r.hasBacklog).toBe(true);
    expect(r.backlogWeeks).toBeCloseTo(8.11, 1); // 412k / (220k/4.33)
    expect(r.backlogHealth).toBe("green");
  });

  it("turns receivables into a cash gap (days to cash)", () => {
    const r = computeContractorEstimate(base);
    expect(r.hasReceivables).toBe(true);
    expect(r.daysToCash).toBeCloseTo(18.26, 1);
    expect(r.cashGapHealth).toBe("green");
  });

  it("names the cash crunch when AR is the worst pressure", () => {
    const r = computeContractorEstimate({ ...base, openReceivables: 340000 });
    expect(r.cashGapHealth).toBe("red"); // ~51 days
    expect(r.biggestLever.title).toMatch(/receivables/i);
    expect(r.biggestLever.tone).toBe("red");
  });

  it("names a materials leak when materials run hot (and margin holds)", () => {
    const r = computeContractorEstimate({ ...base, materials: 74000, fieldLabor: 50000, subcontractors: 10000 });
    expect(r.materialsPct).toBeCloseTo(37, 0);
    expect(r.jobMarginPct).toBeGreaterThan(20);
    expect(r.biggestLever.title).toMatch(/materials/i);
  });

  it("flags a thin backlog", () => {
    const r = computeContractorEstimate({ ...base, backlog: 80000, monthlyCapacity: 200000 });
    expect(r.backlogWeeks).toBeLessThan(2);
    expect(r.backlogHealth).toBe("red");
    expect(r.biggestLever.title).toMatch(/backlog/i);
  });

  it("calls a clean shop balanced", () => {
    const r = computeContractorEstimate({
      ...base, materials: 56000, fieldLabor: 50000, subcontractors: 8000, // margin 43%
    });
    expect(r.biggestLever.tone).toBe("green");
    expect(r.biggestLever.title).toMatch(/balanced/i);
  });

  it("handles a contractor with no backlog or AR entered", () => {
    const r = computeContractorEstimate({ ...base, backlog: null, monthlyCapacity: null, openReceivables: null, receivablesOver30: null });
    expect(r.hasBacklog).toBe(false);
    expect(r.backlogWeeks).toBeNull();
    expect(r.hasReceivables).toBe(false);
    expect(r.daysToCash).toBeNull();
  });
});
