import { describe, expect, it } from "vitest";
import { ledgerMappingForTap } from "./bank-transactions";

describe("bank transaction ledger mapping", () => {
  it("keeps generic opex out of the fixed-burn ledger account", () => {
    expect(
      ledgerMappingForTap({
        tapBucket: "OPEX",
        categoryName: "Office supplies",
        bucket: "OPEX_SUPPLIES",
        amount: 125,
      }),
    ).toEqual({ eventType: "OPEX", ledgerAccount: "OPEX" });
  });

  it("maps fixed-looking opex to the Cash Oxygen fixed-burn account", () => {
    expect(
      ledgerMappingForTap({
        tapBucket: "OPEX",
        categoryName: "Rent",
        bucket: "OPEX_RENT",
        amount: 4500,
      }),
    ).toEqual({ eventType: "FIXED_OPEX", ledgerAccount: "FIXED_OPEX" });
  });
});
