import { describe, it, expect } from "vitest";
import {
  computeBreakEven,
  bandMarginOfSafety,
  MOS_HEALTHY_PCT,
  MOS_CAUTION_PCT,
} from "./break-even";

describe("computeBreakEven (contribution-margin model)", () => {
  it("derives break-even and the normalized projections for a healthy window", () => {
    // 65% prime cost → CM 0.35; $28k fixed → break-even $80k over 56 days.
    const d = computeBreakEven({
      netSales: 100_000,
      variableCost: 65_000,
      fixedCost: 28_000,
      days: 56,
      targetCmRatio: 0.38,
    });
    expect(d.cmRatio).toBeCloseTo(0.35, 6);
    expect(d.cmPositive).toBe(true);
    expect(d.primeCostPct).toBeCloseTo(65, 6);
    expect(d.breakEvenSales).toBeCloseTo(80_000, 4);
    expect(d.breakEvenPerDay).toBeCloseTo(80_000 / 56, 4);
    expect(d.breakEvenPerWeek).toBeCloseTo((80_000 / 56) * 7, 4);
    expect(d.monthlyBreakEven).toBeCloseTo((80_000 / 56) * 30.44, 4);
    expect(d.monthlyNetSales).toBeCloseTo((100_000 / 56) * 30.44, 4);
    expect(d.dollarsAboveBreakEven).toBeCloseTo(20_000, 4);
    expect(d.marginOfSafety).toBeCloseTo(20, 6);
    expect(d.targetBreakEvenSales).toBeCloseTo(28_000 / 0.38, 4);
    expect(d.health).toBe("green");
  });

  it("reports no break-even when variable costs swallow all sales (CM ≤ 0)", () => {
    const d = computeBreakEven({
      netSales: 50_000,
      variableCost: 55_000,
      fixedCost: 10_000,
      days: 30,
      targetCmRatio: 0.3,
    });
    expect(d.cmPositive).toBe(false);
    expect(d.breakEvenSales).toBeNull();
    expect(d.breakEvenPerDay).toBeNull();
    expect(d.breakEvenPerWeek).toBeNull();
    expect(d.monthlyBreakEven).toBeNull();
    // Underwater fallbacks are honest, not zeroed.
    expect(d.dollarsAboveBreakEven).toBe(-10_000);
    expect(d.marginOfSafety).toBe(-100);
    expect(d.primeCostPct).toBeCloseTo(110, 6);
    expect(d.health).toBe("red");
    // The "if you hit plan" reference still computes off the target CM.
    expect(d.targetBreakEvenSales).toBeCloseTo(10_000 / 0.3, 4);
  });

  it("handles an empty window (no sales) without dividing by zero", () => {
    const d = computeBreakEven({ netSales: 0, variableCost: 0, fixedCost: 5_000, days: 0, targetCmRatio: 0.4 });
    expect(d.cmRatio).toBe(0);
    expect(d.cmPositive).toBe(false);
    expect(d.breakEvenSales).toBeNull();
    expect(d.monthlyNetSales).toBe(0);
    expect(d.primeCostPct).toBe(0);
    expect(d.marginOfSafety).toBe(-100);
    expect(d.health).toBe("red");
  });

  it("returns a null target break-even when the target CM is non-positive", () => {
    const d = computeBreakEven({ netSales: 100_000, variableCost: 60_000, fixedCost: 20_000, days: 30, targetCmRatio: 0 });
    expect(d.targetBreakEvenSales).toBeNull();
  });
});

describe("bandMarginOfSafety (cushion lens, higher is better)", () => {
  it("is green at or above the healthy threshold", () => {
    expect(bandMarginOfSafety(MOS_HEALTHY_PCT)).toBe("green"); // 20 → green
    expect(bandMarginOfSafety(35)).toBe("green");
  });
  it("is yellow in the caution band", () => {
    expect(bandMarginOfSafety(MOS_HEALTHY_PCT - 0.01)).toBe("yellow");
    expect(bandMarginOfSafety(MOS_CAUTION_PCT)).toBe("yellow"); // 10 → yellow
  });
  it("is red below the caution threshold", () => {
    expect(bandMarginOfSafety(MOS_CAUTION_PCT - 0.01)).toBe("red");
    expect(bandMarginOfSafety(-100)).toBe("red");
  });
});
