import { describe, it, expect } from "vitest";
import type { LedgerAccount } from "@prisma/client";
import { assessLedgerCoverage, describeLedgerSource, pickReadSource } from "./ledger-coverage";

describe("pickReadSource", () => {
  it("reads the ledger whenever it has entries on the requested accounts", () => {
    expect(pickReadSource({ ledgerEntryCount: 5, legacyTransactionCount: 0 })).toBe("ledger");
    expect(pickReadSource({ ledgerEntryCount: 5, legacyTransactionCount: 99 })).toBe("ledger");
  });
  it("falls back to legacy only when the ledger is empty but legacy has data", () => {
    expect(pickReadSource({ ledgerEntryCount: 0, legacyTransactionCount: 12 })).toBe("legacy");
  });
  it("reports 'none' when neither spine has data", () => {
    expect(pickReadSource({ ledgerEntryCount: 0, legacyTransactionCount: 0 })).toBe("none");
  });
});

describe("describeLedgerSource", () => {
  it("captions each source", () => {
    expect(describeLedgerSource("ledger")).toMatch(/ledger/i);
    expect(describeLedgerSource("legacy")).toMatch(/legacy/i);
    expect(describeLedgerSource("none")).toMatch(/setup/i);
  });
});

// Minimal Prisma stand-in: ledgerEntry.count inspects the `where` so we can
// assert the account scoping the caller passed in.
interface FakeOpts {
  latestLedgerDate?: Date | null;
  latestTxnDate?: Date | null;
  ledgerCount?: (where: Record<string, unknown>) => number;
  txnCount?: number;
  pendingCount?: number;
}
function fakeDb(opts: FakeOpts) {
  return {
    ledgerEntry: {
      findFirst: async () => (opts.latestLedgerDate ? { ledgerDate: opts.latestLedgerDate } : null),
      count: async ({ where }: { where: Record<string, unknown> }) => (opts.ledgerCount ? opts.ledgerCount(where) : 0),
    },
    transaction: {
      findFirst: async () => (opts.latestTxnDate ? { date: opts.latestTxnDate } : null),
      count: async () => opts.txnCount ?? 0,
    },
    normalizedFinancialEvent: {
      count: async () => opts.pendingCount ?? 0,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const ASOF = new Date("2026-06-30T00:00:00.000Z");

describe("assessLedgerCoverage", () => {
  it("returns 'none' with null dates when the tenant has no activity at all", async () => {
    const cov = await assessLedgerCoverage(fakeDb({}), "r1");
    expect(cov).toMatchObject({ source: "none", asOfDate: null, windowStart: null, ledgerEntryCount: 0 });
  });

  it("anchors the window on the given asOf and scopes the ledger count to the requested accounts", async () => {
    let seenAccounts: LedgerAccount[] | undefined;
    const cov = await assessLedgerCoverage(
      fakeDb({
        ledgerCount: (where) => {
          seenAccounts = (where.ledgerAccount as { in: LedgerAccount[] } | undefined)?.in;
          return 7;
        },
        txnCount: 40,
        pendingCount: 3,
      }),
      "r1",
      { accounts: ["TAX_VAULT"], asOf: ASOF, windowDays: 30 },
    );
    expect(seenAccounts).toEqual(["TAX_VAULT"]); // Tax Vault (A.1) scoping flows through
    expect(cov).toMatchObject({
      source: "ledger",
      asOfDate: "2026-06-30",
      windowStart: "2026-06-01", // 30-day window, inclusive
      windowDays: 30,
      ledgerEntryCount: 7,
      legacyTransactionCount: 40,
      pendingReviewCount: 3,
    });
  });

  it("falls back to legacy when the requested accounts have no ledger entries", async () => {
    // Cash Oxygen's account set: no ledger lines on those accounts, but legacy has txns.
    const cashOxygenAccounts: LedgerAccount[] = ["FIXED_OPEX", "DEBT_SERVICE"];
    const cov = await assessLedgerCoverage(
      fakeDb({ ledgerCount: () => 0, txnCount: 25, latestTxnDate: ASOF }),
      "r1",
      { accounts: cashOxygenAccounts },
    );
    expect(cov.source).toBe("legacy");
    expect(cov.legacyTransactionCount).toBe(25);
    expect(cov.asOfDate).toBe("2026-06-30"); // anchored on latest txn when no ledger date
  });

  it("treats an omitted account list as 'any account' (Cash Flow / Spending, A.2)", async () => {
    let scoped = true;
    const cov = await assessLedgerCoverage(
      fakeDb({
        latestLedgerDate: ASOF,
        ledgerCount: (where) => {
          scoped = "ledgerAccount" in where;
          return 12;
        },
      }),
      "r1",
      {}, // no accounts → any
    );
    expect(scoped).toBe(false); // no ledgerAccount filter applied
    expect(cov.source).toBe("ledger");
  });

  it("surfaces the pending-review count as a trust caveat even when reading ledger-first", async () => {
    const cov = await assessLedgerCoverage(
      fakeDb({ latestLedgerDate: ASOF, ledgerCount: () => 5, pendingCount: 8 }),
      "r1",
    );
    expect(cov.source).toBe("ledger");
    expect(cov.pendingReviewCount).toBe(8);
  });
});
