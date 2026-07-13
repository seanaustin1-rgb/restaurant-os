import { describe, it, expect } from "vitest";
import {
  calculateTaxDrift,
  loadTaxVault,
  parseTaxProfile,
  splitLedgerTaxPulls,
  splitLegacyTaxPulls,
} from "./tax-vault";

describe("splitLedgerTaxPulls", () => {
  it("routes TAX_PAYROLL lines to payroll and everything else on TAX_VAULT to sales", () => {
    const pulls = splitLedgerTaxPulls([
      { allocationBucket: "TAX_SALES", debit: 500 },
      { allocationBucket: "TAX_PAYROLL", debit: 300 },
      { allocationBucket: null, debit: 120 }, // unlabelled tax line → sales
    ]);
    expect(pulls).toEqual({ salesPulled: 620, payrollPulled: 300 });
  });

  it("ignores non-positive debits (a TAX_VAULT credit is not a pull)", () => {
    const pulls = splitLedgerTaxPulls([
      { allocationBucket: "TAX_SALES", debit: 0 },
      { allocationBucket: "TAX_SALES", debit: -50 },
      { allocationBucket: "TAX_SALES", debit: 200 },
    ]);
    expect(pulls).toEqual({ salesPulled: 200, payrollPulled: 0 });
  });
});

describe("splitLegacyTaxPulls", () => {
  const tapByCat = new Map([
    ["c-sales", "TAX_SALES"],
    ["c-pay", "TAX_PAYROLL"],
    ["c-food", "COGS_FOOD"],
  ]);
  it("sums TAX_SALES / TAX_PAYROLL outflows and ignores inflows + other buckets", () => {
    const pulls = splitLegacyTaxPulls(
      [
        { amount: 400, categoryId: "c-sales" },
        { amount: 200, categoryId: "c-pay" },
        { amount: -1000, categoryId: "c-sales" }, // inflow → ignored
        { amount: 300, categoryId: "c-food" }, // not a tax bucket → ignored
        { amount: 75, categoryId: null }, // uncategorized → ignored
      ],
      tapByCat,
    );
    expect(pulls).toEqual({ salesPulled: 400, payrollPulled: 200 });
  });
});

describe("tax profile and drift", () => {
  it("parses tenant tax profile config with safe defaults", () => {
    expect(
      parseTaxProfile({
        label: "PA retail liquor license",
        taxableRatePct: 6,
        effectiveRateNote: "Alcohol is exempt.",
        driftThresholdPct: 4,
        driftWindowDays: 45,
      }),
    ).toEqual({
      label: "PA retail liquor license",
      taxableRatePct: 6,
      effectiveRateNote: "Alcohol is exempt.",
      driftThresholdPct: 4,
      driftWindowDays: 45,
    });

    expect(parseTaxProfile({ driftThresholdPct: -1, driftWindowDays: 0 }).driftThresholdPct).toBe(5);
    expect(parseTaxProfile(null).label).toMatch(/generic/i);
  });

  it("flags drift when cleared tax pulls diverge past the threshold", () => {
    const drift = calculateTaxDrift({ accrued: 1000, cleared: 900, thresholdPct: 5, windowDays: 30 });

    expect(drift).toMatchObject({
      state: "drift",
      accrued: 1000,
      cleared: 900,
      variance: 100,
      variancePct: 10,
      thresholdPct: 5,
      windowDays: 30,
    });
    expect(drift.readout).toMatch(/below Toast accrued tax/i);
  });

  it("stays ok inside threshold and degrades when accrued tax is missing", () => {
    expect(calculateTaxDrift({ accrued: 1000, cleared: 970, thresholdPct: 5, windowDays: 30 })).toMatchObject({
      state: "ok",
      variancePct: 3,
    });
    expect(calculateTaxDrift({ accrued: 0, cleared: 100, thresholdPct: 5, windowDays: 30 })).toMatchObject({
      state: "insufficient-data",
      variancePct: null,
    });
  });

  it("degrades when accrued tax exists but no cleared remittance channel is visible", () => {
    const drift = calculateTaxDrift({ accrued: 1000, cleared: 0, thresholdPct: 5, windowDays: 30 });

    expect(drift).toMatchObject({
      state: "insufficient-data",
      accrued: 1000,
      cleared: 0,
      variance: 1000,
      variancePct: null,
      thresholdPct: 5,
      windowDays: 30,
    });
    expect(drift.readout).toMatch(/no cleared tax remittances/i);
  });
});

// Minimal Prisma stand-in for the ledger-first-vs-legacy switch. `ledgerCount`
// drives which spine assessLedgerCoverage picks; the branch-specific readers
// (ledgerEntry.findMany / transaction.findMany) return the configured rows.
interface FakeOpts {
  ledgerCount: number;
  txnCount: number;
  pendingCount?: number;
  ledgerLines?: Array<{ allocationBucket: string | null; debit: number }>;
  legacyTxns?: Array<{ amount: number; categoryId: string | null }>;
  cats?: Array<{ id: string; tapBucket: string }>;
}
function fakeDb(opts: FakeOpts) {
  const june = new Date("2026-06-15T00:00:00.000Z");
  const dailySales = [
    { date: new Date("2026-06-01T00:00:00.000Z"), netSales: 6000, salesTaxCollected: 360 },
    { date: new Date("2026-06-02T00:00:00.000Z"), netSales: 4000, salesTaxCollected: 240 },
  ];
  return {
    restaurant: {
      findUnique: async () => ({
        taxProfile: {
          label: "PA retail liquor license",
          taxableRatePct: 6,
          effectiveRateNote: "Alcohol is exempt; York County has no add-on.",
          driftThresholdPct: 5,
          driftWindowDays: 30,
        },
      }),
    },
    dailySales: {
      findFirst: async () => ({ date: june }),
      findMany: async () => dailySales,
    },
    ledgerEntry: {
      findFirst: async () => null,
      count: async () => opts.ledgerCount,
      findMany: async () => opts.ledgerLines ?? [],
    },
    transaction: {
      findFirst: async () => null,
      count: async () => opts.txnCount,
      findMany: async () => opts.legacyTxns ?? [],
    },
    normalizedFinancialEvent: { count: async () => opts.pendingCount ?? 0 },
    category: { findMany: async () => opts.cats ?? [] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("loadTaxVault — ledger-first / legacy fallback switch", () => {
  it("reads cleared pulls from the ledger when TAX_VAULT has coverage", async () => {
    const data = await loadTaxVault(
      "r1",
      fakeDb({
        ledgerCount: 3, // ledger covers the period → source "ledger"
        txnCount: 10,
        pendingCount: 2,
        ledgerLines: [
          { allocationBucket: "TAX_SALES", debit: 500 },
          { allocationBucket: "TAX_PAYROLL", debit: 300 },
        ],
        // legacy rows present but must be ignored when the ledger serves
        legacyTxns: [{ amount: 9999, categoryId: "c-sales" }],
        cats: [{ id: "c-sales", tapBucket: "TAX_SALES" }],
      }),
    );
    expect(data.source).toBe("ledger");
    expect(data.sourceLabel).toMatch(/ledger/i);
    expect(data.pendingReviewCount).toBe(2);
    expect(data.sales.pulled).toBe(500);
    expect(data.payroll.pulled).toBe(300);
    expect(data.sales.collected).toBe(600); // 360 + 240 from Toast
    expect(data.taxProfile.label).toBe("PA retail liquor license");
    expect(data.sales.drift.state).toBe("drift");
    expect(data.sales.reserve).toBe(100); // 600 collected − 500 pulled
  });

  it("falls back to legacy Transactions when the ledger has no TAX_VAULT coverage", async () => {
    const data = await loadTaxVault(
      "r1",
      fakeDb({
        ledgerCount: 0, // no ledger coverage
        txnCount: 5, // but legacy has data → source "legacy"
        legacyTxns: [
          { amount: 400, categoryId: "c-sales" },
          { amount: 200, categoryId: "c-pay" },
        ],
        cats: [
          { id: "c-sales", tapBucket: "TAX_SALES" },
          { id: "c-pay", tapBucket: "TAX_PAYROLL" },
        ],
        // ledger rows present but must be ignored when falling back
        ledgerLines: [{ allocationBucket: "TAX_SALES", debit: 9999 }],
      }),
    );
    expect(data.source).toBe("legacy");
    expect(data.sourceLabel).toMatch(/legacy/i);
    expect(data.sales.pulled).toBe(400);
    expect(data.payroll.pulled).toBe(200);
  });
});
