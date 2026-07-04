import { describe, it, expect } from "vitest";
import type { LedgerAccount, TapBucket } from "@prisma/client";
import {
  CANONICAL_BUCKETS,
  computeSpineDeltas,
  ledgerAccountToCanonical,
  spinesConverged,
  tapBucketToCanonical,
} from "./spine-compare";

describe("tapBucketToCanonical", () => {
  const cases: Array<[TapBucket | null, string]> = [
    ["REVENUE", "REVENUE"],
    ["COGS_FOOD", "COGS"],
    ["COGS_LIQUOR", "COGS"],
    ["COGS_BEVERAGE", "COGS"],
    ["LABOR", "LABOR"],
    ["OPEX", "OPEX"],
    ["TAX_SALES", "TAX"],
    ["TAX_PAYROLL", "TAX"],
    ["OWNER_PAY", "OWNER_PAY"],
    ["PROFIT", "DEBT_SERVICE"],
    ["EXCLUDED", "OTHER"],
    [null, "OTHER"],
  ];
  it.each(cases)("maps %s -> %s", (tap, expected) => {
    expect(tapBucketToCanonical(tap)).toBe(expected);
  });
});

describe("ledgerAccountToCanonical", () => {
  it("skips OPERATING_CASH (the double-entry cash contra side)", () => {
    expect(ledgerAccountToCanonical("OPERATING_CASH")).toBeNull();
  });
  const cases: Array<[LedgerAccount, string]> = [
    ["REVENUE", "REVENUE"],
    ["REAL_REVENUE", "REVENUE"],
    ["COGS", "COGS"],
    ["LABOR", "LABOR"],
    ["OPEX", "OPEX"],
    ["FIXED_OPEX", "OPEX"], // collapsed to match legacy's single OPEX bucket
    ["TAX_VAULT", "TAX"],
    ["OWNER_PAY", "OWNER_PAY"],
    ["DEBT_SERVICE", "DEBT_SERVICE"],
    ["PROFIT", "DEBT_SERVICE"],
    ["INTERNAL_TRANSFER", "OTHER"],
    ["SUSPENSE", "OTHER"],
    ["PASS_THROUGH_PAYABLE", "OTHER"],
    ["AGENT_PAYABLE", "OTHER"],
  ];
  it.each(cases)("maps %s -> %s", (account, expected) => {
    expect(ledgerAccountToCanonical(account)).toBe(expected);
  });

  it("covers every LedgerAccount that isn't cash into a canonical bucket", () => {
    // Guards against a new LedgerAccount silently vanishing from parity.
    const all: LedgerAccount[] = [
      "OPERATING_CASH", "REVENUE", "REAL_REVENUE", "PASS_THROUGH_PAYABLE", "AGENT_PAYABLE",
      "COGS", "LABOR", "OPEX", "FIXED_OPEX", "TAX_VAULT", "PROFIT", "OWNER_PAY",
      "DEBT_SERVICE", "INTERNAL_TRANSFER", "SUSPENSE",
    ];
    for (const a of all) {
      const c = ledgerAccountToCanonical(a);
      expect(c === null || CANONICAL_BUCKETS.includes(c)).toBe(true);
    }
  });
});

describe("computeSpineDeltas", () => {
  it("emits one row per non-zero bucket in canonical order, with delta + pct", () => {
    const deltas = computeSpineDeltas(
      { REVENUE: 10000, COGS: 3000, OPEX: 2000 },
      { REVENUE: 10000, COGS: 3030, OPEX: 1900 },
    );
    expect(deltas.map((d) => d.bucket)).toEqual(["REVENUE", "COGS", "OPEX"]);
    expect(deltas[0]).toMatchObject({ delta: 0, pctDelta: 0 });
    expect(deltas[1]).toMatchObject({ legacy: 3000, ledger: 3030, delta: 30, pctDelta: 1 });
    expect(deltas[2]).toMatchObject({ delta: -100, pctDelta: 5 });
  });

  it("skips buckets where both spines are zero", () => {
    const deltas = computeSpineDeltas({ REVENUE: 100 }, { REVENUE: 100 });
    expect(deltas).toHaveLength(1);
    expect(deltas[0].bucket).toBe("REVENUE");
  });

  it("reports a bucket present in only one spine (drift the parity is meant to catch)", () => {
    const deltas = computeSpineDeltas({ OPEX: 500 }, {});
    expect(deltas).toEqual([{ bucket: "OPEX", legacy: 500, ledger: 0, delta: -500, pctDelta: 100 }]);
  });

  it("uses null pctDelta when there's no legacy baseline", () => {
    const deltas = computeSpineDeltas({}, { OTHER: 250 });
    expect(deltas[0]).toMatchObject({ bucket: "OTHER", legacy: 0, ledger: 250, delta: 250, pctDelta: null });
  });
});

describe("spinesConverged", () => {
  it("passes when every bucket is within tolerance", () => {
    const deltas = computeSpineDeltas({ REVENUE: 10000, OPEX: 2000 }, { REVENUE: 10050, OPEX: 2010 });
    expect(spinesConverged(deltas, 1)).toBe(true); // 0.5% and 0.5%
  });
  it("fails when a bucket drifts beyond tolerance", () => {
    const deltas = computeSpineDeltas({ OPEX: 2000 }, { OPEX: 2100 }); // 5%
    expect(spinesConverged(deltas, 1)).toBe(false);
  });
  it("holds a no-baseline bucket to the absolute floor, not the percentage", () => {
    expect(spinesConverged(computeSpineDeltas({}, { OTHER: 0.5 }), 1, 1)).toBe(true);
    expect(spinesConverged(computeSpineDeltas({}, { OTHER: 5 }), 1, 1)).toBe(false);
  });
});
