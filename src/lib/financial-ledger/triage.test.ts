import { describe, it, expect } from "vitest";
import { compileRule, type CompiledRule, type RuleInput } from "../categorization/rules";
import { classifyException, tallyDecisions, type TriageCategory } from "./triage";

// Build a compiled KEYWORD rule set from (pattern → categoryId) pairs.
function rules(pairs: Array<{ pattern: string; categoryId: string }>): CompiledRule[] {
  return pairs
    .map(({ pattern, categoryId }, i) => {
      const input: RuleInput = { id: `r${i}`, matchType: "KEYWORD", pattern, categoryId, priority: 5, confidence: 0.9 };
      return compileRule(input);
    })
    .filter((r): r is CompiledRule => r !== null);
}

const CATEGORIES = new Map<string, TriageCategory>([
  ["c-food", { id: "c-food", name: "Food Purchases", tapBucket: "COGS_FOOD" }],
  ["c-labor", { id: "c-labor", name: "Payroll", tapBucket: "LABOR" }],
  ["c-rent", { id: "c-rent", name: "Rent", tapBucket: "OPEX" }],
  ["c-xfer", { id: "c-xfer", name: "Owner Transfer", tapBucket: "EXCLUDED" }],
  ["c-sales", { id: "c-sales", name: "Sales Deposits", tapBucket: "REVENUE" }],
]);

describe("classifyException", () => {
  it("leaves an event with no rule match as ambiguous", () => {
    const d = classifyException(
      { eventType: "OPEX", amount: 250, counterparty: "UNKNOWN VENDOR LLC", description: null },
      rules([{ pattern: "SYSCO", categoryId: "c-food" }]),
      CATEGORIES,
    );
    expect(d.action).toBe("ambiguous");
    expect(d.eventType).toBeNull();
  });

  it("approves a positive vendor match and maps to the category's ledger classification", () => {
    const d = classifyException(
      { eventType: "OPEX", amount: 812.44, counterparty: "SYSCO FOODS", description: null },
      rules([{ pattern: "SYSCO", categoryId: "c-food" }]),
      CATEGORIES,
    );
    expect(d.action).toBe("approve");
    expect(d.matchedCategoryName).toBe("Food Purchases");
    expect(d.eventType).toBe("COGS");
    expect(d.ledgerAccount).toBe("COGS");
    expect(d.tapBucket).toBe("COGS_FOOD");
  });

  it("flags an EXCLUDED-bucket match as exclude, not approve", () => {
    const d = classifyException(
      { eventType: "OPEX", amount: 5000, counterparty: "TRANSFER TO OWNER", description: null },
      rules([{ pattern: "TRANSFER", categoryId: "c-xfer" }]),
      CATEGORIES,
    );
    expect(d.action).toBe("exclude");
    expect(d.eventType).toBe("EXCLUDED");
  });

  it("refuses to move an event OUT of revenue in bulk (revenue guardrail)", () => {
    // Current event is REVENUE, but a vendor rule would pull it to OpEx.
    const d = classifyException(
      { eventType: "REVENUE", amount: 1200, counterparty: "RENT PAYMENT", description: null },
      rules([{ pattern: "RENT", categoryId: "c-rent" }]),
      CATEGORIES,
    );
    expect(d.action).toBe("ambiguous");
    expect(d.reason).toMatch(/revenue/i);
  });

  it("refuses to move an inflow INTO an expense bucket (revenue guardrail, sign-based)", () => {
    // Negative amount = inflow → ledgerMappingForTap yields REVENUE regardless of
    // the matched vendor rule; event is currently OPEX, so the flip is ambiguous.
    const d = classifyException(
      { eventType: "OPEX", amount: -900, counterparty: "SYSCO REFUND", description: null },
      rules([{ pattern: "SYSCO", categoryId: "c-food" }]),
      CATEGORIES,
    );
    expect(d.action).toBe("ambiguous");
    expect(d.reason).toMatch(/revenue/i);
  });

  it("treats a match on a foreign/unknown category as ambiguous, never a blind post", () => {
    const d = classifyException(
      { eventType: "OPEX", amount: 100, counterparty: "SYSCO", description: null },
      rules([{ pattern: "SYSCO", categoryId: "c-not-in-map" }]),
      CATEGORIES,
    );
    expect(d.action).toBe("ambiguous");
    expect(d.reason).toMatch(/unknown\/foreign/i);
  });

  it("keeps a same-side re-map (revenue stays revenue) as an approve", () => {
    const d = classifyException(
      { eventType: "REVENUE", amount: -1500, counterparty: "SQUARE DEPOSIT", description: null },
      rules([{ pattern: "SQUARE", categoryId: "c-sales" }]),
      CATEGORIES,
    );
    expect(d.action).toBe("approve");
    expect(d.eventType).toBe("REVENUE");
  });
});

describe("tallyDecisions", () => {
  it("rolls decisions into per-action counts", () => {
    const decs = [
      classifyException({ eventType: "OPEX", amount: 10, counterparty: "SYSCO", description: null }, rules([{ pattern: "SYSCO", categoryId: "c-food" }]), CATEGORIES),
      classifyException({ eventType: "OPEX", amount: 10, counterparty: "NOPE", description: null }, rules([{ pattern: "SYSCO", categoryId: "c-food" }]), CATEGORIES),
      classifyException({ eventType: "OPEX", amount: 10, counterparty: "TRANSFER", description: null }, rules([{ pattern: "TRANSFER", categoryId: "c-xfer" }]), CATEGORIES),
    ];
    expect(tallyDecisions(decs)).toEqual({ approve: 1, exclude: 1, ambiguous: 1 });
  });
});
