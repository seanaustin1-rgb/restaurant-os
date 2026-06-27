import { describe, expect, it } from "vitest";
import {
  buildLedgerDraftLines,
  chooseSourceMappingRule,
  decideFinancialMapping,
  readPayloadField,
  type SourceMappingRuleInput,
} from "./source-mapping";

const baseRule: SourceMappingRuleInput = {
  id: "rule-1",
  sourceSystem: "qbo",
  sourceObjectType: "expense",
  sourceField: "vendor.name",
  matchType: "KEYWORD",
  matchPattern: "rent",
  mapsToEventType: "FIXED_OPEX",
  mapsToLedgerAccount: "FIXED_OPEX",
  mapsToTapBucket: "OPEX",
  confidence: 0.95,
  requiresReview: false,
  enabled: true,
};

describe("financial source mapping", () => {
  it("reads nested source fields without leaking custom payload shape into ledger logic", () => {
    expect(readPayloadField({ vendor: { name: "Main Street Rent" } }, "vendor.name")).toBe("Main Street Rent");
    expect(readPayloadField({ vendor: null }, "vendor.name")).toBeUndefined();
  });

  it("chooses the highest confidence source-specific mapping rule", () => {
    const decision = chooseSourceMappingRule(
      {
        sourceSystem: "qbo",
        sourceObjectType: "expense",
        payload: { vendor: { name: "Main Street Rent" } },
      },
      [
        { ...baseRule, id: "lower", confidence: 0.7 },
        { ...baseRule, id: "higher", confidence: 0.96, matchPattern: "main street rent" },
      ],
    );

    expect(decision?.id).toBe("higher");
  });

  it("keeps unmapped records out of the approved ledger path", () => {
    const decision = decideFinancialMapping(
      {
        sourceSystem: "skyslope",
        sourceObjectType: "deal",
        payload: { customField: "agent cap adjustment" },
      },
      [baseRule],
    );

    expect(decision.status).toBe("PENDING_REVIEW");
    expect(decision.exception?.issueType).toBe("MISSING_MAPPING");
    expect(decision.ledgerAccount).toBeNull();
  });

  it("requires review when a matching rule is marked review-only", () => {
    const decision = decideFinancialMapping(
      {
        sourceSystem: "qbo",
        sourceObjectType: "expense",
        payload: { vendor: { name: "Main Street Rent" } },
      },
      [{ ...baseRule, requiresReview: true }],
    );

    expect(decision.status).toBe("PENDING_REVIEW");
    expect(decision.ruleId).toBe("rule-1");
    expect(decision.exception?.severity).toBe("INFO");
  });
});

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
