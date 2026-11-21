import { describe, it, expect } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  evaluateCleanDayForTenant,
  loadStoredDays,
  recordCleanDay,
} from "./clean-day-loader";
import { TOAST_SYNC_KEY, recordSyncCompletion } from "./sync-completion";

// 7:30am ET on Nov 21, 2026 → today's window starts 05:00Z.
const NOW = new Date("2026-11-21T12:30:00Z");
const START = new Date("2026-11-21T05:00:00Z");

interface Stub {
  newExceptions?: number;
  openBlocking?: number;
  openBacklog?: number;
  /** Active Plaid connection ids. */
  plaidConnections?: string[];
  /** Plaid connection ids that have a completion marker inside today's window. */
  plaidCompleted?: string[];
  toastPosConnections?: number;
  /** DailySales rows with source "toast", ever. */
  toastEverWroteSales?: number;
  /** Toast completion markers inside today's window. */
  toastCompleted?: number;
  txns?: Array<{ amount: number; categoryId: string | null }>;
  lines?: Array<{ ledgerAccount: string; debit: number; credit: number }>;
}

function stubDb(s: Stub = {}) {
  const calls = {
    exceptionWheres: [] as unknown[],
    completionWheres: [] as unknown[],
    dailySalesWheres: [] as unknown[],
    upserts: [] as unknown[],
    completionUpserts: [] as unknown[],
  };
  const conns = s.plaidConnections ?? ["conn1"];
  const completed = s.plaidCompleted ?? conns;
  const db = {
    restaurant: { findUnique: async () => ({ timezone: "America/New_York" }) },
    syncException: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        calls.exceptionWheres.push(where);
        if ("createdAt" in where) return s.newExceptions ?? 0;
        if (where.severity === "BLOCKING") return s.openBlocking ?? 0;
        return s.openBacklog ?? 0;
      },
    },
    plaidConnection: { findMany: async () => conns.map((id) => ({ id })) },
    syncCompletion: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        calls.completionWheres.push(where);
        return completed.map((sourceKey) => ({ sourceKey }));
      },
      count: async ({ where }: { where: Record<string, unknown> }) => {
        calls.completionWheres.push(where);
        return s.toastCompleted ?? 1;
      },
      upsert: async (args: unknown) => void calls.completionUpserts.push(args),
    },
    posConnection: { count: async () => s.toastPosConnections ?? 0 },
    dailySales: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        calls.dailySalesWheres.push(where);
        return s.toastEverWroteSales ?? 3;
      },
    },
    transaction: { findMany: async () => s.txns ?? [] },
    category: { findMany: async () => [] },
    ledgerEntry: { findMany: async () => s.lines ?? [] },
    reconciliationDay: {
      upsert: async (args: unknown) => void calls.upserts.push(args),
      findMany: async () => [
        { date: new Date("2026-11-21T00:00:00Z"), clean: true },
        { date: new Date("2026-11-20T00:00:00Z"), clean: false },
      ],
    },
  };
  return { db: db as unknown as PrismaClient, calls };
}

const check = (r: Awaited<ReturnType<typeof evaluateCleanDayForTenant>>, key: string) =>
  r.verdict.checks.find((c) => c.key === key);

describe("evaluateCleanDayForTenant", () => {
  it("clean when everything is green", async () => {
    const { db } = stubDb();
    const r = await evaluateCleanDayForTenant(db, "r1", NOW);
    expect(r.date).toBe("2026-11-21");
    expect(r.verdict.clean).toBe(true);
  });

  it("counts only exceptions created inside today's local window, WARNING and above", async () => {
    const { db, calls } = stubDb({ newExceptions: 2 });
    const r = await evaluateCleanDayForTenant(db, "r1", NOW);
    expect(r.verdict.clean).toBe(false);
    const windowed = calls.exceptionWheres.find((w) => (w as Record<string, unknown>).createdAt) as {
      severity: { in: string[] };
      createdAt: { gte: Date; lt: Date };
    };
    expect(windowed.severity.in).toEqual(["WARNING", "BLOCKING"]);
    expect(windowed.createdAt.gte.toISOString()).toBe(START.toISOString());
    expect(windowed.createdAt.lt.toISOString()).toBe(NOW.toISOString());
  });

  describe("Plaid: explicit completion, not per-page progress", () => {
    it("a connection with NO completion marker today is stale — even if a page committed (the partial-run case)", async () => {
      // lastSyncedAt would be fresh after page 1; the marker is only written at the end.
      const { db } = stubDb({ plaidConnections: ["conn1"], plaidCompleted: [] });
      const r = await evaluateCleanDayForTenant(db, "r1", NOW);
      expect(check(r, "PLAID_SYNCED")?.pass).toBe(false);
      expect(r.verdict.clean).toBe(false);
    });

    it("every active connection must have completed: one stale of two fails the day", async () => {
      const { db } = stubDb({ plaidConnections: ["a", "b"], plaidCompleted: ["a"] });
      const r = await evaluateCleanDayForTenant(db, "r1", NOW);
      expect(check(r, "PLAID_SYNCED")?.pass).toBe(false);
      expect(check(r, "PLAID_SYNCED")?.detail).toContain("1 of 2");
    });

    it("a marker for a different (e.g. inactive) connection doesn't count for an active one", async () => {
      const { db } = stubDb({ plaidConnections: ["a"], plaidCompleted: ["old-inactive"] });
      expect(check(await evaluateCleanDayForTenant(db, "r1", NOW), "PLAID_SYNCED")?.pass).toBe(false);
    });

    it("only markers inside today's window are queried", async () => {
      const { db, calls } = stubDb();
      await evaluateCleanDayForTenant(db, "r1", NOW);
      const w = calls.completionWheres.find((x) => (x as { source: string }).source === "plaid") as {
        completedAt: { gte: Date };
      };
      expect(w.completedAt.gte.toISOString()).toBe(START.toISOString());
    });
  });

  describe("Toast: explicit completion + applicability that survives an outage", () => {
    it("no completion marker today is dirty — a partial refresh (some days upserted) doesn't pass", async () => {
      const { db } = stubDb({ toastEverWroteSales: 40, toastCompleted: 0 });
      const r = await evaluateCleanDayForTenant(db, "r1", NOW);
      expect(check(r, "TOAST_SYNCED")?.pass).toBe(false);
      expect(r.verdict.clean).toBe(false);
    });

    it("a long outage keeps gating: Toast wrote rows long ago, none lately → still applicable and dirty", async () => {
      // 'ever' count is > 0 even though nothing was written in the last 14+ days.
      const { db, calls } = stubDb({ toastEverWroteSales: 200, toastCompleted: 0 });
      const r = await evaluateCleanDayForTenant(db, "r1", NOW);
      expect(check(r, "TOAST_SYNCED")?.pass).toBe(false);
      const ever = calls.dailySalesWheres[0] as Record<string, unknown>;
      expect(ever).toEqual({ restaurantId: "r1", source: "toast" }); // no date bound
    });

    it("an active PosConnection makes Toast applicable even before any rows exist", async () => {
      const { db } = stubDb({ toastPosConnections: 1, toastEverWroteSales: 0, toastCompleted: 0 });
      expect(check(await evaluateCleanDayForTenant(db, "r1", NOW), "TOAST_SYNCED")?.pass).toBe(false);
    });

    it("a tenant that has never used Toast is not applicable and doesn't gate", async () => {
      const { db } = stubDb({ toastPosConnections: 0, toastEverWroteSales: 0, toastCompleted: 0 });
      const r = await evaluateCleanDayForTenant(db, "r1", NOW);
      expect(check(r, "TOAST_SYNCED")?.pass).toBeNull();
      expect(r.verdict.clean).toBe(true);
    });

    it("passes when the completion marker is present today", async () => {
      const { db } = stubDb({ toastEverWroteSales: 40, toastCompleted: 1 });
      expect(check(await evaluateCleanDayForTenant(db, "r1", NOW), "TOAST_SYNCED")?.pass).toBe(true);
    });
  });

  it("diverging spines (legacy outflow with no ledger) are dirty", async () => {
    const { db } = stubDb({ txns: [{ amount: 500, categoryId: null }] });
    expect(check(await evaluateCleanDayForTenant(db, "r1", NOW), "SPINES_CONVERGED")?.pass).toBe(false);
  });

  it("converged spines pass (ledger revenue matches legacy inflow)", async () => {
    const { db } = stubDb({
      txns: [{ amount: -1000, categoryId: null }],
      lines: [{ ledgerAccount: "REVENUE", debit: 0, credit: 1000 }],
    });
    expect(check(await evaluateCleanDayForTenant(db, "r1", NOW), "SPINES_CONVERGED")?.pass).toBe(true);
  });
});

describe("recordCleanDay / loadStoredDays", () => {
  it("upserts on (restaurantId, local date) so a re-run overwrites rather than duplicates", async () => {
    const { db, calls } = stubDb();
    const result = await evaluateCleanDayForTenant(db, "r1", NOW);
    await recordCleanDay(db, "r1", result);
    await recordCleanDay(db, "r1", result);
    const first = calls.upserts[0] as {
      where: { restaurantId_date: { restaurantId: string; date: Date } };
      create: { clean: boolean };
      update: { clean: boolean };
    };
    expect(calls.upserts).toHaveLength(2);
    expect(first.where.restaurantId_date.restaurantId).toBe("r1");
    expect(first.where.restaurantId_date.date.toISOString()).toBe("2026-11-21T00:00:00.000Z");
    expect(first.create.clean).toBe(true);
    expect(first.update.clean).toBe(true);
  });

  it("maps stored rows to YYYY-MM-DD for cleanStreak", async () => {
    const { db } = stubDb();
    expect(await loadStoredDays(db, "r1")).toEqual([
      { date: "2026-11-21", clean: true },
      { date: "2026-11-20", clean: false },
    ]);
  });
});

describe("recordSyncCompletion", () => {
  it("upserts one marker per (tenant, source, key); a later run overwrites the timestamp", async () => {
    const { db, calls } = stubDb();
    await recordSyncCompletion(db, "r1", "plaid", "conn1", NOW);
    await recordSyncCompletion(db, "r1", "toast", TOAST_SYNC_KEY, NOW);
    const [plaid, toast] = calls.completionUpserts as Array<{
      where: { restaurantId_source_sourceKey: { restaurantId: string; source: string; sourceKey: string } };
      create: { completedAt: Date };
      update: { completedAt: Date };
    }>;
    expect(plaid.where.restaurantId_source_sourceKey).toEqual({
      restaurantId: "r1",
      source: "plaid",
      sourceKey: "conn1",
    });
    expect(toast.where.restaurantId_source_sourceKey.sourceKey).toBe("toast");
    expect(plaid.create.completedAt).toBe(NOW);
    expect(plaid.update.completedAt).toBe(NOW);
  });
});
