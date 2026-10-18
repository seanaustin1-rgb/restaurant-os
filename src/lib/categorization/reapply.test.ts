import { describe, it, expect } from "vitest";
import type { TapBucket } from "@prisma/client";
import { compileRule, type CategorizationContext, type CompiledRule } from "./rules";
import { planReapply, summarizeMoves, type ReapplyTxn } from "./reapply";

function ctxWith(pairs: Array<{ pattern: string; categoryId: string }>): CategorizationContext {
  const rules = pairs
    .map(({ pattern, categoryId }, i) =>
      compileRule({ id: `r${i}`, matchType: "KEYWORD", pattern, categoryId, priority: 5, confidence: 0.9 }),
    )
    .filter((r): r is CompiledRule => r !== null);
  const tapById = new Map<string, TapBucket>([
    ["c-food", "COGS_FOOD"],
    ["c-labor", "LABOR"],
    ["c-sales", "REVENUE"],
    ["c-misc", "OPEX"],
  ]);
  return { rules, tapById, revenueId: "c-sales", miscId: "c-misc" };
}

function txn(over: Partial<ReapplyTxn>): ReapplyTxn {
  return {
    id: "t1",
    plaidTxnId: "p1",
    merchantName: null,
    description: null,
    amount: 100,
    categoryId: null,
    bucket: "UNCATEGORIZED",
    ...over,
  };
}

describe("planReapply", () => {
  it("moves a row the current rules now file differently", () => {
    const ctx = ctxWith([{ pattern: "SYSCO", categoryId: "c-food" }]);
    const plan = planReapply(ctx, [txn({ description: "SYSCO FOODS", categoryId: "c-labor", bucket: "LABOR" })], new Set());
    expect(plan.scanned).toBe(1);
    expect(plan.held).toHaveLength(0);
    expect(plan.changes).toEqual([
      expect.objectContaining({ id: "t1", fromCategoryId: "c-labor", categoryId: "c-food", bucket: "COGS_FOOD" }),
    ]);
  });

  it("un-files a row whose rule was disabled (falls to Misc)", () => {
    const ctx = ctxWith([]);
    const plan = planReapply(ctx, [txn({ description: "TOAST PAYROLL", categoryId: "c-labor", bucket: "LABOR" })], new Set());
    expect(plan.changes[0]).toMatchObject({ categoryId: "c-misc", bucket: "UNCATEGORIZED", confidence: 0 });
  });

  it("skips rows that already match today's decision", () => {
    const ctx = ctxWith([{ pattern: "SYSCO", categoryId: "c-food" }]);
    const plan = planReapply(ctx, [txn({ description: "SYSCO", categoryId: "c-food", bucket: "COGS_FOOD" })], new Set());
    expect(plan.changes).toHaveLength(0);
    expect(plan.held).toHaveLength(0);
  });

  it("files inflows as revenue by sign, never through vendor rules", () => {
    const ctx = ctxWith([{ pattern: "TOAST", categoryId: "c-labor" }]);
    const plan = planReapply(ctx, [txn({ description: "TOAST DEP", amount: -500, categoryId: "c-labor", bucket: "LABOR" })], new Set());
    expect(plan.changes[0]).toMatchObject({ categoryId: "c-sales", bucket: "REVENUE" });
  });

  it("holds a move whose ledger event a person already decided — neither spine moves", () => {
    const ctx = ctxWith([{ pattern: "SYSCO", categoryId: "c-food" }]);
    const plan = planReapply(
      ctx,
      [txn({ description: "SYSCO", categoryId: "c-labor", bucket: "LABOR", plaidTxnId: "p-reviewed" })],
      new Set(["p-reviewed"]),
    );
    expect(plan.changes).toHaveLength(0);
    expect(plan.held).toEqual([expect.objectContaining({ id: "t1", categoryId: "c-food" })]);
  });

  it("never holds a row with no Plaid id (nothing to re-mirror)", () => {
    const ctx = ctxWith([{ pattern: "SYSCO", categoryId: "c-food" }]);
    const plan = planReapply(ctx, [txn({ description: "SYSCO", plaidTxnId: null })], new Set(["p1"]));
    expect(plan.changes).toHaveLength(1);
    expect(plan.held).toHaveLength(0);
  });
});

describe("summarizeMoves", () => {
  it("counts moves largest first", () => {
    const name = (id: string | null) => id ?? "none";
    const base = { plaidTxnId: null, fromBucket: "LABOR" as const, bucket: "COGS_FOOD" as const, confidence: 0.9 };
    const out = summarizeMoves(
      [
        { ...base, id: "a", fromCategoryId: "c-labor", categoryId: "c-food" },
        { ...base, id: "b", fromCategoryId: "c-labor", categoryId: "c-food" },
        { ...base, id: "c", fromCategoryId: "c-misc", categoryId: "c-food", fromBucket: "UNCATEGORIZED" },
      ],
      name,
    );
    expect(out).toEqual([
      { move: "c-labor[LABOR] -> c-food[COGS_FOOD]", count: 2 },
      { move: "c-misc[UNCATEGORIZED] -> c-food[COGS_FOOD]", count: 1 },
    ]);
  });
});
