import { describe, it, expect } from "vitest";
import { BROKERAGE_RULE_SEEDS } from "./brokerage-seeds";
import { keywordPatternProblem } from "./suggestions";
import { BROKERAGE_CATEGORIES, DEFAULT_CATEGORIES, categoriesFor } from "./categories";
import { ruleSeedsFor, DEFAULT_RULE_SEEDS } from "./rules";

describe("brokerage rule seeds", () => {
  it("every KEYWORD seed passes the keyword guardrail (no generic/short tokens)", () => {
    const offenders = BROKERAGE_RULE_SEEDS.filter(
      (s) => s.matchType === "KEYWORD" && keywordPatternProblem(s.pattern) !== null,
    ).map((s) => `${s.pattern}: ${keywordPatternProblem(s.pattern)}`);
    expect(offenders).toEqual([]);
  });

  it("every seed targets a category that the brokerage taxonomy actually seeds", () => {
    const names = new Set(BROKERAGE_CATEGORIES.map((c) => c.name));
    const dangling = BROKERAGE_RULE_SEEDS.filter((s) => !names.has(s.categoryName)).map((s) => s.categoryName);
    expect(dangling).toEqual([]);
  });

  it("has unique patterns and orders the commission 'dotloop payout' ahead of the bare software 'dotloop'", () => {
    const patterns = BROKERAGE_RULE_SEEDS.map((s) => s.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);

    const payout = BROKERAGE_RULE_SEEDS.find((s) => s.pattern === "dotloop payout");
    const bare = BROKERAGE_RULE_SEEDS.find((s) => s.pattern === "dotloop");
    expect(payout && bare && payout.priority < bare.priority).toBe(true);
  });
});

describe("business-type taxonomy + seed selection", () => {
  it("routes brokerage tenants to the brokerage taxonomy + seeds, everyone else to the restaurant defaults", () => {
    expect(categoriesFor("REAL_ESTATE_BROKERAGE")).toBe(BROKERAGE_CATEGORIES);
    expect(ruleSeedsFor("REAL_ESTATE_BROKERAGE")).toBe(BROKERAGE_RULE_SEEDS);

    expect(categoriesFor("RESTAURANT")).toBe(DEFAULT_CATEGORIES);
    expect(ruleSeedsFor("RESTAURANT")).toBe(DEFAULT_RULE_SEEDS);
    // Unknown / null (e.g. a tenant row that couldn't be read) falls back to restaurant defaults.
    expect(categoriesFor(null)).toBe(DEFAULT_CATEGORIES);
    expect(ruleSeedsFor(undefined)).toBe(DEFAULT_RULE_SEEDS);
  });

  it("keeps the brokerage taxonomy on the existing TapBucket set (no migration needed)", () => {
    const allowed = new Set([
      "REVENUE", "COGS_FOOD", "COGS_LIQUOR", "COGS_BEVERAGE", "LABOR",
      "OWNER_PAY", "OPEX", "TAX_SALES", "TAX_PAYROLL", "EXCLUDED", "PROFIT",
    ]);
    const bad = BROKERAGE_CATEGORIES.filter((c) => !allowed.has(c.tapBucket)).map((c) => c.name);
    expect(bad).toEqual([]);
    // Commission income is the only revenue line; agent splits are people cost (LABOR).
    expect(BROKERAGE_CATEGORIES.find((c) => c.name === "Commission Income")?.tapBucket).toBe("REVENUE");
    expect(BROKERAGE_CATEGORIES.find((c) => c.name === "Agent Commission Split")?.tapBucket).toBe("LABOR");
  });
});
