import { describe, expect, it } from "vitest";
import { calculateCashOxygenFloor } from "./cash-oxygen";

describe("calculateCashOxygenFloor", () => {
  it("divides liquid cash by 90-day average fixed burn", () => {
    const result = calculateCashOxygenFloor({
      currentCash: 90000,
      fixedBurnTotal: 180000,
      windowDays: 90,
      asOfDate: "2026-06-27",
      source: "anchor_plus_transactions",
    });

    expect(result.avgDailyFixedBurn).toBe(2000);
    expect(result.oxygenDays).toBe(45);
    expect(result.goLiveFloorCash).toBe(60000);
    expect(result.status).toBe("green");
  });

  it("flags thin and critical oxygen bands", () => {
    expect(calculateCashOxygenFloor({ currentCash: 42000, fixedBurnTotal: 180000 }).status).toBe("yellow");
    expect(calculateCashOxygenFloor({ currentCash: 20000, fixedBurnTotal: 180000 }).status).toBe("red");
  });

  it("returns unknown when cash or fixed-burn mapping is missing", () => {
    expect(calculateCashOxygenFloor({ currentCash: null, fixedBurnTotal: 180000 }).status).toBe("unknown");
    expect(calculateCashOxygenFloor({ currentCash: 50000, fixedBurnTotal: 0 }).oxygenDays).toBeNull();
  });
});
