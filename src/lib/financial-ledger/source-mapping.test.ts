import { describe, expect, it } from "vitest";
import { buildLedgerDraftLines } from "./source-mapping";

describe("ledger draft lines", () => {
  it("posts revenue as cash in and revenue credit", () => {
    const lines = buildLedgerDraftLines({
      eventType: "REVENUE",
      ledgerAccount: "REVENUE",
      amount: 1200,
      tapBucket: "REVENUE",
      memo: "Toast sales",
    });

    expect(lines).toEqual([
      expect.objectContaining({ ledgerAccount: "OPERATING_CASH", debit: 1200, credit: 0, cashEffect: 1200 }),
      expect.objectContaining({ ledgerAccount: "REVENUE", debit: 0, credit: 1200, cashEffect: 0 }),
    ]);
  });

  it("posts fixed expenses as expense debit and cash out", () => {
    const lines = buildLedgerDraftLines({
      eventType: "FIXED_OPEX",
      ledgerAccount: "FIXED_OPEX",
      amount: 3000,
      tapBucket: "OPEX",
      memo: "Rent",
    });

    expect(lines).toEqual([
      expect.objectContaining({ ledgerAccount: "FIXED_OPEX", debit: 3000, credit: 0, cashEffect: 0 }),
      expect.objectContaining({ ledgerAccount: "OPERATING_CASH", debit: 0, credit: 3000, cashEffect: -3000 }),
    ]);
  });

  it("posts non-fixed opex separately from the cash oxygen fixed-burn account", () => {
    const lines = buildLedgerDraftLines({
      eventType: "OPEX",
      ledgerAccount: "OPEX",
      amount: 3000,
      tapBucket: "OPEX",
      memo: "Supplies",
    });

    expect(lines).toEqual([
      expect.objectContaining({ ledgerAccount: "OPEX", debit: 3000, credit: 0, cashEffect: 0 }),
      expect.objectContaining({ ledgerAccount: "OPERATING_CASH", debit: 0, credit: 3000, cashEffect: -3000 }),
    ]);
  });

  it("tracks tax effect separately for tax vault events", () => {
    const lines = buildLedgerDraftLines({
      eventType: "TAX_LIABILITY",
      ledgerAccount: "TAX_VAULT",
      amount: 525,
      tapBucket: "TAX_SALES",
    });

    expect(lines[0]).toEqual(expect.objectContaining({ ledgerAccount: "TAX_VAULT", taxEffect: 525 }));
  });
});
