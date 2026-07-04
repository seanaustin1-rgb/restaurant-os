import { describe, it, expect } from "vitest";
import type { LedgerAccount, TapBucket } from "@prisma/client";
import {
  aggregateLedgerSpending,
  aggregateLegacySpending,
  loadSpendingByCategory,
  LEDGER_SPEND_ACCOUNTS,
  LEDGER_NON_SPEND_ACCOUNTS,
} from "./spending-by-category";

// Every LedgerAccount enum member (mirrors prisma/schema.prisma). If a new one is
// added, the completeness test below fails until it's classified deliberately.
const ALL_LEDGER_ACCOUNTS: LedgerAccount[] = [
  "OPERATING_CASH",
  "REVENUE",
  "REAL_REVENUE",
  "PASS_THROUGH_PAYABLE",
  "AGENT_PAYABLE",
  "COGS",
  "LABOR",
  "OPEX",
  "FIXED_OPEX",
  "TAX_VAULT",
  "PROFIT",
  "OWNER_PAY",
  "DEBT_SERVICE",
  "INTERNAL_TRANSFER",
  "SUSPENSE",
];

describe("ledger account classification is total", () => {
  it("accounts for every LedgerAccount — mapped spend, explicit non-spend, or intentional Unmapped", () => {
    const spend = new Set(Object.keys(LEDGER_SPEND_ACCOUNTS));
    const nonSpend = new Set<string>(LEDGER_NON_SPEND_ACCOUNTS);
    const leftover = ALL_LEDGER_ACCOUNTS.filter((a) => !spend.has(a) && !nonSpend.has(a));
    // Only SUSPENSE is deliberately left to render as "Unmapped"; anything else
    // unclassified is a bug (a spend account silently dropped from parity).
    expect(leftover).toEqual(["SUSPENSE"]);
  });
});

describe("aggregateLedgerSpending", () => {
  it("maps spend accounts to groups, takes revenue from positive cashEffect, and flags unmapped accounts", () => {
    const agg = aggregateLedgerSpending([
      { ledgerAccount: "OPERATING_CASH", debit: 1000, cashEffect: 1000 }, // revenue inflow, not spend
      { ledgerAccount: "COGS", debit: 300, cashEffect: 0 },
      { ledgerAccount: "LABOR", debit: 200, cashEffect: 0 },
      { ledgerAccount: "SUSPENSE", debit: 50, cashEffect: 0 }, // unmapped spend
      { ledgerAccount: "COGS", debit: 0, cashEffect: 0 }, // no debit → skipped
    ]);
    expect(agg.revenue).toBe(1000);
    expect(agg.totalSpend).toBe(550); // 300 + 200 + 50, NOT the 1000 cash debit
    expect(agg.unmappedCount).toBe(1);
    expect(agg.catAgg.get("Cost of Goods Sold")).toMatchObject({ group: "Food & Beverage (COGS)", total: 300 });
    expect(agg.catAgg.get("Unmapped")).toMatchObject({ group: "Other / Uncategorized", total: 50 });
    expect(agg.groupAgg.get("Labor")).toBe(200);
  });
});

describe("aggregateLegacySpending", () => {
  it("sums outflows by Category name/group and revenue from inflows", () => {
    const catMeta = new Map<string, { name: string; tap: TapBucket }>([
      ["c-food", { name: "Food — Distributor", tap: "COGS_FOOD" }],
      ["c-rent", { name: "Rent", tap: "OPEX" }],
    ]);
    const agg = aggregateLegacySpending(
      [
        { amount: -1500, categoryId: null }, // inflow → revenue
        { amount: 300, categoryId: "c-food" },
        { amount: 700, categoryId: "c-rent" },
        { amount: 90, categoryId: null }, // uncategorized outflow
      ],
      catMeta,
    );
    expect(agg.revenue).toBe(1500);
    expect(agg.totalSpend).toBe(1090);
    expect(agg.unmappedCount).toBe(0);
    expect(agg.catAgg.get("Rent")).toMatchObject({ group: "Operating Expenses", total: 700 });
    expect(agg.catAgg.get("Uncategorized")).toMatchObject({ group: "Other / Uncategorized", total: 90 });
  });
});

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
interface FakeOpts {
  ledgerCount: number;
  txnCount: number;
  pendingCount?: number;
  ledgerLines?: Array<{ ledgerAccount: string; debit: number; cashEffect: number }>;
  legacyTxns?: Array<{ amount: number; categoryId: string | null }>;
  cats?: Array<{ id: string; name: string; tapBucket: string }>;
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
    category: { findMany: async () => opts.cats ?? [] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("loadSpendingByCategory — ledger-first / legacy fallback switch", () => {
  it("reads from the ledger accounts when the ledger covers the period", async () => {
    const data = await loadSpendingByCategory(
      "r1",
      fakeDb({
        ledgerCount: 5,
        txnCount: 9,
        pendingCount: 2,
        ledgerLines: [
          { ledgerAccount: "OPERATING_CASH", debit: 1000, cashEffect: 1000 },
          { ledgerAccount: "COGS", debit: 300, cashEffect: 0 },
          { ledgerAccount: "SUSPENSE", debit: 50, cashEffect: 0 },
        ],
        legacyTxns: [{ amount: 9999, categoryId: null }], // ignored under ledger
      }),
    );
    expect(data.source).toBe("ledger");
    expect(data.revenue).toBe(1000);
    expect(data.totalSpend).toBe(350);
    expect(data.unmappedCount).toBe(1);
    expect(data.pendingReviewCount).toBe(2);
  });

  it("falls back to legacy Transactions when the ledger has no coverage", async () => {
    const data = await loadSpendingByCategory(
      "r1",
      fakeDb({
        ledgerCount: 0,
        txnCount: 4,
        legacyTxns: [
          { amount: -1500, categoryId: null },
          { amount: 700, categoryId: "c-rent" },
        ],
        cats: [{ id: "c-rent", name: "Rent", tapBucket: "OPEX" }],
        ledgerLines: [{ ledgerAccount: "COGS", debit: 9999, cashEffect: 0 }], // ignored
      }),
    );
    expect(data.source).toBe("legacy");
    expect(data.revenue).toBe(1500);
    expect(data.totalSpend).toBe(700);
    expect(data.unmappedCount).toBe(0);
    expect(data.categories[0]).toMatchObject({ name: "Rent", group: "Operating Expenses" });
  });
});
