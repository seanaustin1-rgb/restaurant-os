import { describe, expect, it } from "vitest";
import { computeEstimate, type EstimateInputs } from "./estimate";

const WEEKS_PER_MONTH = 4.33;

function weeklyInputs(weeklySales: number): EstimateInputs {
  const weeklyFoodBev = 14_500;
  const weeklyLabor = 18_000;
  const monthlySales = weeklySales * WEEKS_PER_MONTH;

  return {
    name: "",
    city: "",
    monthlySales,
    foodPct: (weeklyFoodBev / weeklySales) * 100,
    laborPct: (weeklyLabor / weeklySales) * 100,
    fixedCosts: 39_000,
  };
}

describe("computeEstimate public demo break-even", () => {
  it("keeps break-even tied to entered expense dollars when only sales changes", () => {
    const lowerSales = computeEstimate(weeklyInputs(38_000));
    const higherSales = computeEstimate(weeklyInputs(46_000));

    expect(lowerSales.monthlyBreakEven).toBeCloseTo(higherSales.monthlyBreakEven!, 2);
    expect(lowerSales.monthlyBreakEven! / WEEKS_PER_MONTH).toBeCloseTo(41_506.93, 2);
    expect(lowerSales.dollarsAboveBreakEven / WEEKS_PER_MONTH).toBeCloseTo(-3_506.93, 2);
    expect(higherSales.dollarsAboveBreakEven / WEEKS_PER_MONTH).toBeCloseTo(4_493.07, 2);
  });
});
