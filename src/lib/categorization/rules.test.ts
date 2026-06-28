import { describe, it, expect } from "vitest";
import { applyRules, compileRule, keywordMatchesText, sortRules, type RuleInput } from "./rules";
import { signatureOf } from "./suggestions";
import { categorizeTransaction } from "./vendor-map";

// Helper: build a single-KEYWORD engine and ask what it matches.
function keywordEngine(pattern: string, categoryId = "cat") {
  const input: RuleInput = {
    id: "r1",
    matchType: "KEYWORD",
    pattern,
    categoryId,
    priority: 5,
    confidence: 0.9,
  };
  const compiled = compileRule(input);
  return compiled ? sortRules([compiled]) : [];
}

function matches(pattern: string, text: string): boolean {
  return applyRules(keywordEngine(pattern), null, text) !== null;
}

describe("KEYWORD rules match at a word start (not arbitrary substrings)", () => {
  // The setup-wizard hazard: short tokens firing inside unrelated words.
  it("does not fire inside another word", () => {
    expect(matches("ACE", "SPACE NEEDLE LLC")).toBe(false); // sp-ACE
    expect(matches("ACE", "MARKETPLACE GOODS")).toBe(false); // pl-ACE
    expect(matches("OVER", "DISCOVERY CHANNEL")).toBe(false); // disc-OVER-y
    expect(matches("EVER", "NEVERLAND CO")).toBe(false); // n-EVER
    expect(matches("EVER", "HOWEVER INC")).toBe(false); // how-EVER
  });

  it("still matches the token as a standalone word", () => {
    expect(matches("ACE", "ACE HARDWARE #42")).toBe(true);
    expect(matches("OVER", "OVERSTOCK.COM")).toBe(true); // word-start prefix
  });

  it("allows prefix matches and tolerates truncated descriptions", () => {
    // Leading boundary only — keyword may extend into the rest of the token.
    expect(matches("WILSBACH", "WILSBACH DISTRIBUTORS")).toBe(true);
    expect(matches("PERFORMANC", "PERFORMANCE FOODSERVICE")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matches("ace hardware", "ACE HARDWARE")).toBe(true);
  });

  it("uses the same safe keyword behavior for setup-time recategorization", () => {
    expect(keywordMatchesText("ACE", null, "ACE HARDWARE #42")).toBe(true);
    expect(keywordMatchesText("ACE", null, "SPACE NEEDLE LLC")).toBe(false);
    expect(keywordMatchesText("OVER", null, "DISCOVERY CHANNEL")).toBe(false);
  });
});

describe("signatureOf rejects weak (non-vendor) keywords", () => {
  it("skips common filler that often leads a description", () => {
    expect(signatureOf(null, "THE BUTCHER SHOP")).toBe("BUTCHER");
    expect(signatureOf(null, "AND SONS PRODUCE")).toBe("SONS");
  });

  it("skips generic banking words and corporate suffixes", () => {
    expect(signatureOf(null, "CHECK PAYMENT TO WILSBACH")).toBe("WILSBACH");
    expect(signatureOf(null, "PAYROLL TOAST INC")).toBe("TOAST");
    expect(signatureOf(null, "LLC ACME SUPPLY")).toBe("ACME");
  });

  it("keeps a genuine short vendor token", () => {
    expect(signatureOf("ACE HARDWARE", null)).toBe("ACE");
    expect(signatureOf(null, "PFG FOODSERVICE")).toBe("PFG");
  });

  it("returns null when there is no distinctive word", () => {
    expect(signatureOf(null, "CHECK 10451")).toBeNull();
    expect(signatureOf(null, "ACH DEBIT")).toBeNull();
  });
});

describe("operator vendor patterns", () => {
  it("maps PA Wine and Spirits to liquor COGS", () => {
    expect(categorizeTransaction("Wine And Spirits", "DEBIT CARD PURCHASE WINE AND SPIRITS 6717 YORK PA").bucket).toBe(
      "COGS_LIQUOR",
    );
  });

  it("maps PA sales-tax withdrawals to sales tax", () => {
    expect(categorizeTransaction("Commwlthofpapath Pastsaletx Txp", "COMMWLTHOFPAPATH/PASTSALETX TXP SLS").bucket).toBe(
      "TAX_SALES",
    );
  });
});
