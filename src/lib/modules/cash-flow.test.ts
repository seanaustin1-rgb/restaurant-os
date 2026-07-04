import { describe, it, expect } from "vitest";
import {
  accumulateLedgerCash,
  accumulateLegacyCash,
  buildCashFlowDays,
  loadCashFlow,
} from "./cash-flow";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("accumulateLedgerCash", () => {
  it("splits cashEffect into inflow (+) / outflow (−) per day and ignores zero-cash lines", () => {
    const byDay = accumulateLedgerCash([
      { ledgerDate: d("2026-06-05"), cashEffect: 1000 },
      { ledgerDate: d("2026-06-05"), cashEffect: -400 },
      { ledgerDate: d("2026-06-06"), cashEffect: -100 },
      { ledgerDate: d("2026-06-06"), cashEffect: 0 }, // non-cash leg → ignored
    ]);
    expect(byDay.get("2026-06-05")).toEqual({ inflow: 1000, outflow: 400 });
    expect(byDay.get("2026-06-06")).toEqual({ inflow: 0, outflow: 100 });
  });
});

describe("accumulateLegacyCash", () => {
  it("treats negative amounts as inflow and positive as outflow", () => {
    const byDay = accumulateLegacyCash([
      { date: d("2026-06-10"), amount: -2000 },
      { date: d("2026-06-10"), amount: 800 },
      { date: d("2026-06-11"), amount: 0 }, // ignored
    ]);
    expect(byDay.get("2026-06-10")).toEqual({ inflow: 2000, outflow: 800 });
    expect(byDay.has("2026-06-11")).toBe(false);
  });
});

describe("buildCashFlowDays", () => {
  it("sorts by date and carries a running cumulative net", () => {
    const byDay = new Map([
      ["2026-06-06", { inflow: 0, outflow: 100 }],
      ["2026-06-05", { inflow: 1000, outflow: 400 }],
    ]);
    const { days, totalIn, totalOut } = buildCashFlowDays(byDay);
    expect(days.map((x) => x.date)).toEqual(["2026-06-05", "2026-06-06"]);
    expect(days[0]).toMatchObject({ net: 600, running: 600 });
    expect(days[1]).toMatchObject({ net: -100, running: 500 });
    expect({ totalIn, totalOut }).toEqual({ totalIn: 1000, totalOut: 500 });
  });
});

// Minimal Prisma stand-in for the ledger-first-vs-legacy switch.
interface FakeOpts {
  ledgerCount: number;
  txnCount: number;
  pendingCount?: number;
  ledgerLines?: Array<{ ledgerDate: Date; cashEffect: number }>;
  legacyTxns?: Array<{ date: Date; amount: number }>;
}
function fakeDb(opts: FakeOpts) {
  const ref = d("2026-06-15");
  return {
    transaction: {
      findFirst: async () => ({ date: ref }),
      count: async () => opts.txnCount,
      findMany: async () => opts.legacyTxns ?? [],
    },
    ledgerEntry: {
      findFirst: async () => ({ ledgerDate: ref }),
      count: async () => opts.ledgerCount,
      findMany: async () => opts.ledgerLines ?? [],
    },
    normalizedFinancialEvent: { count: async () => opts.pendingCount ?? 0 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("loadCashFlow — ledger-first / legacy fallback switch", () => {
  it("reads from the ledger's cashEffect when the ledger covers the period", async () => {
    const data = await loadCashFlow(
      "r1",
      fakeDb({
        ledgerCount: 4,
        txnCount: 10,
        pendingCount: 1,
        ledgerLines: [
          { ledgerDate: d("2026-06-05"), cashEffect: 1000 },
          { ledgerDate: d("2026-06-05"), cashEffect: -400 },
          { ledgerDate: d("2026-06-06"), cashEffect: -100 },
        ],
        legacyTxns: [{ date: d("2026-06-05"), amount: 9999 }], // must be ignored
      }),
    );
    expect(data.source).toBe("ledger");
    expect(data.sourceLabel).toMatch(/ledger/i);
    expect(data.pendingReviewCount).toBe(1);
    expect(data.totalIn).toBe(1000);
    expect(data.totalOut).toBe(500);
    expect(data.net).toBe(500);
    expect(data.days).toHaveLength(2);
  });

  it("falls back to legacy Transactions when the ledger has no coverage", async () => {
    const data = await loadCashFlow(
      "r1",
      fakeDb({
        ledgerCount: 0,
        txnCount: 3,
        legacyTxns: [
          { date: d("2026-06-10"), amount: -2000 },
          { date: d("2026-06-10"), amount: 800 },
          { date: d("2026-06-11"), amount: 300 },
        ],
        ledgerLines: [{ ledgerDate: d("2026-06-10"), cashEffect: 9999 }], // ignored
      }),
    );
    expect(data.source).toBe("legacy");
    expect(data.sourceLabel).toMatch(/legacy/i);
    expect(data.totalIn).toBe(2000);
    expect(data.totalOut).toBe(1100);
    expect(data.net).toBe(900);
  });
});
