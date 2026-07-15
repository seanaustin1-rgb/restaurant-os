import { describe, expect, it } from "vitest";
import type { LedgerAccount, TapBucket } from "@prisma/client";
import {
  CANONICAL_BUCKETS,
  LEDGER_ACCOUNT_TO_CANONICAL,
  LEDGER_INTENTIONAL_UNMAPPED_ACCOUNTS,
  LEDGER_NON_SPEND_ACCOUNTS,
  LEDGER_SPEND_ACCOUNTS,
  TAP_BUCKET_TO_FINANCIAL_EVENT_TYPE,
  TAP_BUCKET_TO_CANONICAL,
  TAP_BUCKET_TO_LEDGER_ACCOUNT,
  isLedgerNonSpendAccount,
  isLedgerSpendAccount,
  ledgerAccountToCanonicalBucket,
  tapBucketToCanonicalBucket,
  tapBucketToFinancialEventType,
  tapBucketToLedgerAccount,
} from "./bucket-map";

const ALL_TAP_BUCKETS: TapBucket[] = [
  "COGS_FOOD",
  "COGS_LIQUOR",
  "COGS_BEVERAGE",
  "LABOR",
  "OWNER_PAY",
  "OPEX",
  "TAX_SALES",
  "TAX_PAYROLL",
  "REVENUE",
  "EXCLUDED",
  "PROFIT",
];

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

describe("bucket-map", () => {
  it("maps every TapBucket to a ledger account and canonical bucket", () => {
    for (const bucket of ALL_TAP_BUCKETS) {
      expect(tapBucketToLedgerAccount(bucket)).toBe(TAP_BUCKET_TO_LEDGER_ACCOUNT[bucket]);
      expect(tapBucketToFinancialEventType(bucket)).toBe(TAP_BUCKET_TO_FINANCIAL_EVENT_TYPE[bucket]);
      expect(tapBucketToCanonicalBucket(bucket)).toBe(TAP_BUCKET_TO_CANONICAL[bucket]);
      expect(CANONICAL_BUCKETS).toContain(tapBucketToCanonicalBucket(bucket));
    }
    expect(tapBucketToCanonicalBucket(null)).toBe("OTHER");
  });

  it("maps every LedgerAccount into canonical, cash contra, spend, non-spend, or explicit unmapped", () => {
    const spend = new Set<LedgerAccount>(LEDGER_SPEND_ACCOUNTS);
    const nonSpend = new Set<LedgerAccount>(LEDGER_NON_SPEND_ACCOUNTS);
    const unmapped = new Set<LedgerAccount>(LEDGER_INTENTIONAL_UNMAPPED_ACCOUNTS);

    for (const account of ALL_LEDGER_ACCOUNTS) {
      const classes = [spend.has(account), nonSpend.has(account), unmapped.has(account)].filter(Boolean);
      expect(classes).toHaveLength(1);

      const canonical = ledgerAccountToCanonicalBucket(account);
      if (account === "OPERATING_CASH") {
        expect(canonical).toBeNull();
      } else {
        expect(canonical).toBe(LEDGER_ACCOUNT_TO_CANONICAL[account]);
        expect(CANONICAL_BUCKETS).toContain(canonical);
      }
    }
  });

  it("exposes spend classification helpers", () => {
    expect(isLedgerSpendAccount("COGS")).toBe(true);
    expect(isLedgerSpendAccount("REVENUE")).toBe(false);
    expect(isLedgerNonSpendAccount("REVENUE")).toBe(true);
    expect(isLedgerNonSpendAccount("SUSPENSE")).toBe(false);
  });
});
