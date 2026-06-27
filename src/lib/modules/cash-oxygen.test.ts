import { describe, expect, it } from "vitest";
import { calculateCashOxygenFloor, loadCashOxygenFloor } from "./cash-oxygen";

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

  it("prefers clean ledger fixed burn when ledger entries exist", async () => {
    const db = {
      restaurant: {
        findUnique: async () => ({
          cashBalanceAnchor: 100000,
          cashBalanceAnchorDate: new Date("2026-04-01"),
        }),
      },
      ledgerEntry: {
        findFirst: async () => ({ ledgerDate: new Date("2026-06-27") }),
        aggregate: async () => ({ _sum: { cashEffect: -10000 } }),
        findMany: async () => [
          { ledgerAccount: "FIXED_OPEX", memo: "Rent", debit: 30000, allocationBucket: "OPEX" },
          { ledgerAccount: "DEBT_SERVICE", memo: "Debt Service", debit: 15000, allocationBucket: "PROFIT" },
        ],
      },
      transaction: {
        findFirst: async () => ({ date: new Date("2026-06-27") }),
        findMany: async () => [],
      },
    };

    const result = await loadCashOxygenFloor("restaurant-1", db as never, 90);

    expect(result.source).toBe("clean_ledger");
    expect(result.currentCash).toBe(90000);
    expect(result.fixedBurnTotal).toBe(45000);
    expect(result.avgDailyFixedBurn).toBe(500);
    expect(result.oxygenDays).toBe(180);
    expect(result.mappedCategories.map((line) => line.categoryName)).toEqual(["Rent", "Debt Service"]);
  });
});
