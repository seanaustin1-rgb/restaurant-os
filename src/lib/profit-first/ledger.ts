// Profit First — persisted allocation ledger (production phase).
//
// Turns the pure engine (allocation.ts) + real data into PERSISTED state:
//   - BucketAllocation: one auditable row per business day (idempotent by date).
//   - VirtualAccount.balance: the running per-bucket balance, RECOMPUTED from the
//     allocation log, sweeps, and cleared spend — never mutated incrementally, so
//     a re-run/backfill is always safe and self-correcting.
//   - BucketSweep: Profit + Owner's Pay zeroed on the 10th & 25th (simulation —
//     no real money moves, just a logged distribution).
//
// Allocation basis = EARNED (DailySales net sales), per spec "CRITICAL: EARNED vs
// BANKABLE" — net sales is tax-exclusive, so there's no tax to skim off it; the
// collected sales tax accrues SEPARATELY into the tax_reserve bucket and draws
// down as Davo pulls (TAX_SALES) clear. Draw-down buckets net cleared spend.
//
// Obligation/reconciliation sub-tables (TaxObligation/BucketObligation/
// BucketReconciliation) and MarginEdge/Davo pull-clear event handlers are spec'd
// but DEFERRED — they need integrations that don't exist as discrete feeds yet;
// obligations are derived from categorized Transactions here.

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runAllocation, prevSweepDate, isSweepDue } from "./allocation";
import type { Taps } from "./calculator";

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number => (v == null ? 0 : Number(v));

export type BucketKind = "accrue" | "reserve" | "drawdown";
export interface BucketDef {
  key: string;
  name: string;
  kind: BucketKind;
}

// The Tier-1 account list (spec §C2 LOCKED), minus INCOME (a pass-through landing
// account, not a Profit First allocation bucket in simulation).
export const BUCKETS: BucketDef[] = [
  { key: "profit", name: "Profit", kind: "accrue" },
  { key: "owner_pay", name: "Owner's Pay", kind: "accrue" },
  { key: "spill", name: "Spill / Vault", kind: "accrue" },
  { key: "tax_reserve", name: "Tax Reserve", kind: "reserve" },
  { key: "cogs_food", name: "COGS — Food", kind: "drawdown" },
  { key: "cogs_liquor", name: "COGS — Wine & Spirits", kind: "drawdown" },
  { key: "cogs_beverage", name: "COGS — Beer", kind: "drawdown" },
  { key: "labor", name: "Labor", kind: "drawdown" },
  { key: "opex", name: "OpEx", kind: "drawdown" },
];

/** Accrue-only buckets that sweep on the 10th & 25th. */
const SWEEP_KEYS = ["profit", "owner_pay"] as const;

/** Map a categorized Transaction's tapBucket → the draw-down bucket it clears. */
const TAPBUCKET_TO_KEY: Record<string, string> = {
  COGS_FOOD: "cogs_food",
  COGS_LIQUOR: "cogs_liquor",
  COGS_BEVERAGE: "cogs_beverage",
  LABOR: "labor",
  OPEX: "opex",
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function loadTaps(restaurantId: string): Promise<Taps> {
  const ts = await prisma.tapSettings.findUnique({ where: { restaurantId } });
  return {
    profitPct: ts ? num(ts.profitPct) : 5,
    ownerPayPct: ts ? num(ts.ownerPayPct) : 5,
    cogsFoodPct: ts ? num(ts.cogsFoodPct) : 18,
    cogsLiquorPct: ts ? num(ts.cogsLiquorPct) : 12,
    laborPct: ts ? num(ts.laborPct) : 32,
    opexPct: ts ? num(ts.opexPct) : 28,
    spillPct: 0, // no column yet — held at 0 (see calculator.ts / spec §C2.1)
  };
}

/** Ensure a VirtualAccount row exists for every bucket. Idempotent. */
export async function ensureBucketAccounts(restaurantId: string): Promise<void> {
  const existing = await prisma.virtualAccount.findMany({
    where: { restaurantId },
    select: { key: true },
  });
  const have = new Set(existing.map((a) => a.key));
  const missing = BUCKETS.filter((b) => !have.has(b.key));
  if (missing.length === 0) return;
  await prisma.virtualAccount.createMany({
    data: missing.map((b) => ({ restaurantId, key: b.key, name: b.name, balance: 0 })),
    skipDuplicates: true,
  });
}

/**
 * Write a BucketAllocation row for every DailySales day with net sales that
 * doesn't already have one. Idempotent by (restaurantId, date). Returns the count
 * of new allocation rows written.
 */
export async function runDailyAllocations(restaurantId: string): Promise<number> {
  const taps = await loadTaps(restaurantId);

  const sales = await prisma.dailySales.findMany({
    where: { restaurantId, netSales: { gt: 0 } },
    select: { date: true, netSales: true, salesTaxCollected: true },
    orderBy: { date: "asc" },
  });
  if (sales.length === 0) return 0;

  const already = await prisma.bucketAllocation.findMany({
    where: { restaurantId },
    select: { date: true, salesTaxReserved: true },
  });
  const reservedByDate = new Map(already.map((a) => [iso(a.date), num(a.salesTaxReserved)]));

  const rows = sales
    .filter((s) => !reservedByDate.has(iso(s.date)))
    .map((s) => {
      const netSales = num(s.netSales);
      // Earned basis is tax-exclusive → no skim here; split net sales across TAPs.
      const a = runAllocation({
        grossDeposit: netSales,
        salesTaxCollected: 0,
        payrollTaxAccrued: 0,
        taps,
      });
      return {
        restaurantId,
        date: s.date,
        netSalesBasis: netSales,
        salesTaxReserved: r2(num(s.salesTaxCollected)),
        allocable: a.allocableRemainder,
        profit: a.byBucket.profit,
        ownerPay: a.byBucket.ownerPay,
        cogsFood: a.byBucket.cogsFood,
        cogsLiquor: a.byBucket.cogsLiquor,
        cogsBeverage: 0, // beer has no TAP % yet (held with 27/20/13)
        labor: a.byBucket.labor,
        opex: a.byBucket.opex,
        spill: a.byBucket.spill,
        source: "toast",
      };
    });

  if (rows.length > 0) {
    await prisma.bucketAllocation.createMany({ data: rows, skipDuplicates: true });
  }

  // Re-sync salesTaxReserved on EXISTING rows whose DailySales tax changed since
  // they were first allocated (e.g. the sales-tax backfill ran after the day was
  // allocated). The reserve balance recomputes off these rows, so without this a
  // post-hoc tax load stays invisible — this keeps the "re-run/backfill is always
  // safe and self-correcting" promise true for the tax reserve too.
  const resyncs = sales
    .filter((s) => reservedByDate.has(iso(s.date)))
    .filter((s) => reservedByDate.get(iso(s.date)) !== r2(num(s.salesTaxCollected)))
    .map((s) =>
      prisma.bucketAllocation.update({
        where: { restaurantId_date: { restaurantId, date: s.date } },
        data: { salesTaxReserved: r2(num(s.salesTaxCollected)) },
      }),
    );
  for (let i = 0; i < resyncs.length; i += 50) {
    await prisma.$transaction(resyncs.slice(i, i + 50));
  }

  return rows.length;
}

/**
 * Sweep Profit + Owner's Pay if a scheduled sweep (10th/25th) has passed since
 * each account was last swept. Records a BucketSweep for the accrued amount and
 * advances lastSweptAt. Idempotent — re-running after a sweep is a no-op until the
 * next scheduled date. Returns the swept events.
 */
export async function runSweeps(
  restaurantId: string,
  asOf: Date,
): Promise<{ key: string; amount: number; sweptAt: string }[]> {
  await ensureBucketAccounts(restaurantId);
  const accounts = await prisma.virtualAccount.findMany({
    where: { restaurantId, key: { in: SWEEP_KEYS as unknown as string[] } },
    select: { id: true, key: true, lastSweptAt: true },
  });

  const sweepDate = prevSweepDate(asOf);
  const swept: { key: string; amount: number; sweptAt: string }[] = [];

  for (const acct of accounts) {
    if (!isSweepDue(asOf, acct.lastSweptAt)) continue;

    // Accrued since the last sweep = sum of this bucket's allocations after
    // lastSweptAt, up to (and including) the sweep date.
    const col = acct.key === "profit" ? "profit" : "ownerPay";
    const allocs = await prisma.bucketAllocation.findMany({
      where: {
        restaurantId,
        date: {
          gt: acct.lastSweptAt ?? new Date(0),
          lte: sweepDate,
        },
      },
      select: { profit: true, ownerPay: true },
    });
    const amount = r2(allocs.reduce((s, a) => s + num(col === "profit" ? a.profit : a.ownerPay), 0));

    if (amount > 0) {
      await prisma.bucketSweep.create({
        data: { restaurantId, key: acct.key, amount, sweptAt: sweepDate },
      });
    }
    await prisma.virtualAccount.update({
      where: { id: acct.id },
      data: { lastSweptAt: sweepDate },
    });
    swept.push({ key: acct.key, amount, sweptAt: iso(sweepDate) });
  }
  return swept;
}

/**
 * Recompute every bucket's running balance from the allocation log, sweeps, and
 * cleared spend, then persist onto VirtualAccount. Authoritative + idempotent.
 *   accrue (profit/owner) : sum(allocations after lastSweptAt)  — resets at sweep
 *   accrue (spill)        : sum(allocations)                    — manual sweep only
 *   reserve (tax)         : sum(salesTaxReserved) − cleared TAX_SALES
 *   drawdown (cogs/labor/opex): sum(allocations) − cleared spend in that bucket
 */
export async function recomputeBalances(restaurantId: string): Promise<void> {
  await ensureBucketAccounts(restaurantId);

  const allocs = await prisma.bucketAllocation.findMany({
    where: { restaurantId },
    select: {
      date: true, profit: true, ownerPay: true, spill: true, salesTaxReserved: true,
      cogsFood: true, cogsLiquor: true, cogsBeverage: true, labor: true, opex: true,
    },
  });
  const firstAllocatedAt = allocs.length
    ? allocs.reduce((mn, a) => (a.date < mn ? a.date : mn), allocs[0].date)
    : null;
  const lastAllocatedAt = allocs.length
    ? allocs.reduce((mx, a) => (a.date > mx ? a.date : mx), allocs[0].date)
    : null;

  const accounts = await prisma.virtualAccount.findMany({
    where: { restaurantId },
    select: { id: true, key: true, lastSweptAt: true },
  });
  const lastSwept = new Map(accounts.map((a) => [a.key, a.lastSweptAt]));

  // Cleared spend per draw-down bucket + cleared sales tax (TAX_SALES), from txns.
  // Keep the cleared side on the same date range as the allocation log. Otherwise
  // old bank-import history can be charged against a newer allocation window and
  // make live bucket balances look falsely short.
  const cats = await prisma.category.findMany({
    where: { restaurantId },
    select: { id: true, tapBucket: true },
  });
  const tapByCat = new Map(cats.map((c) => [c.id, c.tapBucket as string]));
  const txns = await prisma.transaction.findMany({
    where: {
      restaurantId,
      ...(firstAllocatedAt && lastAllocatedAt
        ? { date: { gte: firstAllocatedAt, lte: lastAllocatedAt } }
        : {}),
    },
    select: { amount: true, categoryId: true },
  });
  const cleared: Record<string, number> = {};
  let taxSalesCleared = 0;
  for (const t of txns) {
    const amt = num(t.amount);
    if (amt <= 0) continue;
    const tb = t.categoryId ? tapByCat.get(t.categoryId) : undefined;
    if (tb === "TAX_SALES") {
      taxSalesCleared += amt;
      continue;
    }
    const key = tb ? TAPBUCKET_TO_KEY[tb] : undefined;
    if (key) cleared[key] = (cleared[key] ?? 0) + amt;
  }

  const sum = (sel: (a: (typeof allocs)[number]) => unknown, after?: Date | null) =>
    allocs.reduce((s, a) => (after && a.date.getTime() <= after.getTime() ? s : s + num(sel(a))), 0);

  const balanceFor = (key: string): number => {
    switch (key) {
      case "profit":
        return r2(sum((a) => a.profit, lastSwept.get("profit") ?? null));
      case "owner_pay":
        return r2(sum((a) => a.ownerPay, lastSwept.get("owner_pay") ?? null));
      case "spill":
        return r2(sum((a) => a.spill));
      case "tax_reserve":
        return r2(sum((a) => num(a.salesTaxReserved)) - taxSalesCleared);
      case "cogs_food":
        return r2(sum((a) => a.cogsFood) - (cleared.cogs_food ?? 0));
      case "cogs_liquor":
        return r2(sum((a) => a.cogsLiquor) - (cleared.cogs_liquor ?? 0));
      case "cogs_beverage":
        return r2(sum((a) => a.cogsBeverage) - (cleared.cogs_beverage ?? 0));
      case "labor":
        return r2(sum((a) => a.labor) - (cleared.labor ?? 0));
      case "opex":
        return r2(sum((a) => a.opex) - (cleared.opex ?? 0));
      default:
        return 0;
    }
  };

  const updates = accounts.map((acct) =>
    prisma.virtualAccount.update({
      where: { id: acct.id },
      data: { balance: balanceFor(acct.key), lastAllocatedAt: lastAllocatedAt ?? undefined },
    }),
  );
  // Batched array transaction — required over the Supabase pooler.
  for (let i = 0; i < updates.length; i += 50) {
    await prisma.$transaction(updates.slice(i, i + 50));
  }
}

export interface LedgerSnapshot {
  hasLedger: boolean;
  balances: { key: string; name: string; kind: BucketKind; balance: number; lastSweptAt: string | null }[];
  recentSweeps: { key: string; amount: number; sweptAt: string }[];
  allocationDays: number;
  lastAllocatedAt: string | null;
}

/** Read the persisted ledger for display. Pure read — never mutates. */
export async function getLedgerSnapshot(restaurantId: string, db: PrismaClient = prisma): Promise<LedgerSnapshot> {
  const [accounts, sweeps, allocCount, lastAlloc] = await Promise.all([
    db.virtualAccount.findMany({ where: { restaurantId }, select: { key: true, name: true, balance: true, lastSweptAt: true } }),
    db.bucketSweep.findMany({ where: { restaurantId }, orderBy: { sweptAt: "desc" }, take: 6, select: { key: true, amount: true, sweptAt: true } }),
    db.bucketAllocation.count({ where: { restaurantId } }),
    db.bucketAllocation.findFirst({ where: { restaurantId }, orderBy: { date: "desc" }, select: { date: true } }),
  ]);
  const byKey = new Map(accounts.map((a) => [a.key, a]));
  return {
    hasLedger: allocCount > 0,
    balances: BUCKETS.map((b) => {
      const a = byKey.get(b.key);
      return {
        key: b.key,
        name: b.name,
        kind: b.kind,
        balance: a ? num(a.balance) : 0,
        lastSweptAt: a?.lastSweptAt ? iso(a.lastSweptAt) : null,
      };
    }),
    recentSweeps: sweeps.map((s) => ({ key: s.key, amount: num(s.amount), sweptAt: iso(s.sweptAt) })),
    allocationDays: allocCount,
    lastAllocatedAt: lastAlloc ? iso(lastAlloc.date) : null,
  };
}

/** Full ledger run: allocate new days → recompute balances → sweep if due → recompute. */
export async function runLedger(restaurantId: string, asOf: Date = new Date()): Promise<{
  allocated: number;
  swept: { key: string; amount: number; sweptAt: string }[];
}> {
  await ensureBucketAccounts(restaurantId);
  const allocated = await runDailyAllocations(restaurantId);
  await recomputeBalances(restaurantId);
  const swept = await runSweeps(restaurantId, asOf);
  if (swept.length) await recomputeBalances(restaurantId);
  return { allocated, swept };
}
