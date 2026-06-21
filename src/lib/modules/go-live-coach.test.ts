import { describe, expect, it } from "vitest";
import { assessGoLiveReadiness, type GoLiveCoachInput } from "./go-live-coach";

const baseInput = (overrides: Partial<GoLiveCoachInput> = {}): GoLiveCoachInput => ({
  periodLabel: "Jun 2026 MTD",
  salesDays: 21,
  netSales: 100000,
  transactionCount: 20,
  categorizedTransactionCount: 20,
  salesTaxCollected: 6000,
  salesTaxCleared: 5000,
  taps: {
    profitPct: 5,
    ownerPayPct: 5,
    cogsFoodPct: 18,
    cogsLiquorPct: 12,
    laborPct: 32,
    opexPct: 28,
  },
  spendByTap: {
    COGS_FOOD: 15000,
    COGS_LIQUOR: 9000,
    LABOR: 28000,
    OPEX: 22000,
  },
  ...overrides,
});

describe("assessGoLiveReadiness", () => {
  it("observes when there is no heartbeat data yet", () => {
    const result = assessGoLiveReadiness(
      baseInput({
        salesDays: 0,
        netSales: 0,
        transactionCount: 0,
        categorizedTransactionCount: 0,
        salesTaxCollected: 0,
        salesTaxCleared: 0,
        spendByTap: {},
      }),
    );

    expect(result.stage).toBe("observe");
    expect(result.hasData).toBe(false);
  });

  it("keeps the system virtual while sales history is thin", () => {
    const result = assessGoLiveReadiness(baseInput({ salesDays: 7 }));

    expect(result.stage).toBe("simulate");
    expect(result.recommendation).toContain("Keep Profit First virtual");
  });

  it("coaches when a bucket would break under modeled movement", () => {
    const result = assessGoLiveReadiness(
      baseInput({
        spendByTap: {
          COGS_FOOD: 15000,
          COGS_LIQUOR: 9000,
          LABOR: 39000,
          OPEX: 22000,
        },
      }),
    );

    expect(result.stage).toBe("coach");
    expect(result.shortfalls.some((b) => b.key === "labor")).toBe(true);
    expect(result.recommendation).toContain("Labor");
  });

  it("recommends a narrow pilot when buckets are stable", () => {
    const result = assessGoLiveReadiness(baseInput({ currentCash: 50000, minimumOperatingCash: 15000 }));

    expect(result.stage).toBe("pilot_ready");
    expect(result.recommendation).toContain("Tax Reserve");
    expect(result.recommendation).toContain("Profit");
    expect(result.pilotPlan.find((p) => p.key === "tax-reserve")?.mode).toBe("pilot_candidate");
    expect(result.pilotPlan.find((p) => p.key === "profit")?.mode).toBe("pilot_candidate");
    expect(result.cashSafety.ready).toBe(true);
    expect(result.decisions.find((d) => d.key === "move-money")?.verdict).toBe("go");
  });

  it("rolls beer and beverage spend into the alcohol/beverage target", () => {
    const result = assessGoLiveReadiness(
      baseInput({
        spendByTap: {
          COGS_FOOD: 15000,
          COGS_LIQUOR: 7000,
          COGS_BEVERAGE: 3000,
          LABOR: 28000,
          OPEX: 22000,
        },
        currentCash: 50000,
        minimumOperatingCash: 15000,
      }),
    );

    const bucket = result.buckets.find((b) => b.key === "alcohol-beverage");
    expect(bucket?.actual).toBe(10000);
    expect(bucket?.target).toBe(12000);
    expect(bucket?.signal).not.toBe("red");
    expect(result.shortfalls.some((b) => b.key === "beer")).toBe(false);
  });

  it("waits when the virtual pilot would dip below the cash floor", () => {
    const result = assessGoLiveReadiness(baseInput({ currentCash: 16000, minimumOperatingCash: 15000 }));

    expect(result.stage).toBe("pilot_ready");
    expect(result.cashSafety.ready).toBe(false);
    expect(result.cashSafety.cushionAfterPilot).toBeLessThan(0);
    expect(result.decisions.find((d) => d.key === "move-money")?.verdict).toBe("wait");
    expect(result.checks.find((c) => c.key === "cash-floor")?.ready).toBe(false);
  });

  it("requires collected tax before piloting tax reserve", () => {
    const result = assessGoLiveReadiness(
      baseInput({
        salesTaxCollected: 0,
        salesTaxCleared: 500,
      }),
    );

    expect(result.stage).toBe("coach");
    expect(result.checks.find((c) => c.key === "tax-source")?.ready).toBe(false);
    expect(result.pilotPlan.find((p) => p.key === "tax-reserve")?.mode).toBe("not_ready");
  });
});
