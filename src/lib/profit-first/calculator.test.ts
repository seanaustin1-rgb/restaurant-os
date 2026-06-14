import { describe, it, expect } from "vitest";
import {
  calculateRealRevenue,
  calculateTargets,
  calculateUsagePct,
  getHealthStatus,
  calculatePrimeCost,
  calculateRevPASH,
  USAGE_GREEN_MAX_PCT,
  USAGE_YELLOW_MAX_PCT,
  type Taps,
} from "./calculator";

describe("calculateRealRevenue", () => {
  it("is total sales minus food and liquor COGS", () => {
    expect(calculateRealRevenue(312450, 56240, 33180)).toBe(223030);
  });
  it("ignores non-COGS costs (labor, opex)", () => {
    expect(calculateRealRevenue(100000, 20000, 10000)).toBe(70000);
  });
});

describe("calculateTargets", () => {
  const taps: Taps = {
    profitPct: 5,
    ownerPayPct: 5,
    cogsFoodPct: 18,
    cogsLiquorPct: 12,
    laborPct: 32,
    opexPct: 28,
  };
  it("allocates each bucket as base × pct/100", () => {
    const t = calculateTargets(312450, taps);
    expect(t.profit).toBeCloseTo(15622.5, 4);
    expect(t.ownerPay).toBeCloseTo(15622.5, 4);
    expect(t.cogsFood).toBeCloseTo(56241, 4);
    expect(t.cogsLiquor).toBeCloseTo(37494, 4);
    expect(t.labor).toBeCloseTo(99984, 4);
    expect(t.opex).toBeCloseTo(87486, 4);
  });
  it("defaults spill to 0 when spillPct is absent", () => {
    expect(calculateTargets(100000, taps).spill).toBe(0);
  });
  it("honors spillPct when provided", () => {
    expect(calculateTargets(100000, { ...taps, spillPct: 3 }).spill).toBeCloseTo(3000, 4);
  });
  it("the six live TAPs sum to the base when they total 100%", () => {
    const t = calculateTargets(100000, taps);
    const sum = t.profit + t.ownerPay + t.cogsFood + t.cogsLiquor + t.labor + t.opex;
    expect(sum).toBeCloseTo(100000, 4);
  });
});

describe("calculateUsagePct", () => {
  it("is spent over target as a percent", () => {
    expect(calculateUsagePct(45, 90)).toBeCloseTo(50, 6);
    expect(calculateUsagePct(99980, 99984)).toBeCloseTo(99.996, 3);
  });
  it("returns 0 when there is no target", () => {
    expect(calculateUsagePct(500, 0)).toBe(0);
    expect(calculateUsagePct(500, -10)).toBe(0);
  });
});

describe("getHealthStatus (budget-usage lens, lower is better)", () => {
  it("is green at or below the green max", () => {
    expect(getHealthStatus(0)).toBe("green");
    expect(getHealthStatus(89.9)).toBe("green");
    expect(getHealthStatus(USAGE_GREEN_MAX_PCT)).toBe("green"); // 90 → green
  });
  it("is yellow between green max and yellow max", () => {
    expect(getHealthStatus(90.01)).toBe("yellow");
    expect(getHealthStatus(95)).toBe("yellow");
    expect(getHealthStatus(USAGE_YELLOW_MAX_PCT)).toBe("yellow"); // 100 → yellow
  });
  it("is red above the yellow max", () => {
    expect(getHealthStatus(100.01)).toBe("red");
    expect(getHealthStatus(130)).toBe("red");
  });
});

describe("calculatePrimeCost", () => {
  it("is (food + beverage + labor) over revenue, as a percent", () => {
    // Note: this core uses the food/beverage/labor components it is handed.
    expect(calculatePrimeCost(56240, 8900, 99980, 312450)).toBeCloseTo(52.85, 2);
  });
  it("returns 0 for non-positive revenue", () => {
    expect(calculatePrimeCost(100, 100, 100, 0)).toBe(0);
    expect(calculatePrimeCost(100, 100, 100, -5)).toBe(0);
  });
});

describe("calculateRevPASH", () => {
  it("is revenue over seat-hours of capacity", () => {
    expect(calculateRevPASH(312450, 215, 390)).toBeCloseTo(3.726, 3);
  });
  it("returns 0 when capacity is zero", () => {
    expect(calculateRevPASH(100000, 0, 390)).toBe(0);
    expect(calculateRevPASH(100000, 215, 0)).toBe(0);
  });
});
