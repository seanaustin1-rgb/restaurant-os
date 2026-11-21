import { describe, it, expect } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  evaluateCleanDayForTenant,
  loadStoredDays,
  recordCleanDay,
} from "./clean-day-loader";

// 7:30am ET on Nov 21, 2026 → today's window starts 05:00Z.
const NOW = new Date("2026-11-21T12:30:00Z");
const START = new Date("2026-11-21T05:00:00Z");

interface Stub {
  newExceptions?: number;
  openBlocking?: number;
  openBacklog?: number;
  plaid?: Array<{ lastSyncedAt: Date | null }>;
  toastRecent?: number;
  toastToday?: number;
  txns?: Array<{ amount: number; categoryId: string | null }>;
  lines?: Array<{ ledgerAccount: string; debit: number; credit: number }>;
}

function stubDb(s: Stub = {}) {
  const calls: { exceptionWheres: unknown[]; dailySalesWheres: unknown[]; upserts: unknown[] } = {
    exceptionWheres: [],
    dailySalesWheres: [],
    upserts: [],
  };
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
    plaidConnection: { findMany: async () => s.plaid ?? [{ lastSyncedAt: new Date("2026-11-21T11:00:00Z") }] },
    dailySales: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        calls.dailySalesWheres.push(where);
        return "updatedAt" in where ? (s.toastToday ?? 3) : (s.toastRecent ?? 3);
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

  it("a Plaid connection last synced before today's window is stale; never-synced is stale", async () => {
    for (const lastSyncedAt of [new Date("2026-11-20T11:00:00Z"), null]) {
      const { db } = stubDb({ plaid: [{ lastSyncedAt }] });
      const r = await evaluateCleanDayForTenant(db, "r1", NOW);
      expect(r.verdict.checks.find((c) => c.key === "PLAID_SYNCED")?.pass).toBe(false);
    }
  });

  it("Toast: applicable only if it wrote recently; dirty if not touched today", async () => {
    const dirty = await evaluateCleanDayForTenant(stubDb({ toastRecent: 5, toastToday: 0 }).db, "r1", NOW);
    expect(dirty.verdict.checks.find((c) => c.key === "TOAST_SYNCED")?.pass).toBe(false);

    const na = await evaluateCleanDayForTenant(stubDb({ toastRecent: 0, toastToday: 0 }).db, "r1", NOW);
    expect(na.verdict.checks.find((c) => c.key === "TOAST_SYNCED")?.pass).toBeNull();
    expect(na.verdict.clean).toBe(true);
  });

  it("diverging spines (legacy labor vs no ledger) are dirty", async () => {
    // Legacy: a positive outflow with no category → OTHER; ledger empty → diverges.
    const { db } = stubDb({ txns: [{ amount: 500, categoryId: null }] });
    const r = await evaluateCleanDayForTenant(db, "r1", NOW);
    expect(r.verdict.checks.find((c) => c.key === "SPINES_CONVERGED")?.pass).toBe(false);
  });

  it("converged spines pass (ledger revenue matches legacy inflow)", async () => {
    const { db } = stubDb({
      txns: [{ amount: -1000, categoryId: null }],
      lines: [{ ledgerAccount: "REVENUE", debit: 0, credit: 1000 }],
    });
    const r = await evaluateCleanDayForTenant(db, "r1", NOW);
    expect(r.verdict.checks.find((c) => c.key === "SPINES_CONVERGED")?.pass).toBe(true);
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
