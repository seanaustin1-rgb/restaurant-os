import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DAY_MS = 86_400_000;
const DEFAULT_WINDOW_DAYS = 90;
const DEFAULT_GO_LIVE_FLOOR_DAYS = 30;

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const r2 = (v: number): number => Math.round(v * 100) / 100;

const FIXED_TAP_BUCKETS = new Set(["OPEX", "PROFIT"]);
const FIXED_CATEGORY_PATTERNS = [
  /rent|lease/i,
  /utilit|electric|gas|water/i,
  /insurance/i,
  /internet|telecom|phone/i,
  /software|technology|subscription/i,
  /professional|accounting|bookkeep|legal/i,
  /maintenance|repair/i,
  /cleaning|services/i,
  /waste|trash/i,
  /debt|loan/i,
  /security/i,
];

export type CashOxygenStatus = "green" | "yellow" | "red" | "unknown";

export interface CashOxygenExpenseLine {
  categoryId: string | null;
  categoryName: string;
  tapBucket: string | null;
  amount: number;
  transactionCount: number;
}

export interface CashOxygenFloor {
  hasCash: boolean;
  hasFixedBurn: boolean;
  source: "clean_ledger" | "anchor_plus_transactions" | "live_balance" | "none";
  asOfDate: string | null;
  windowDays: number;
  currentCash: number | null;
  fixedBurnTotal: number;
  avgDailyFixedBurn: number | null;
  oxygenDays: number | null;
  goLiveFloorCash: number | null;
  status: CashOxygenStatus;
  mappedCategories: CashOxygenExpenseLine[];
  pendingFixedEventCount: number;
}

export interface CashOxygenCalculationInput {
  currentCash: number | null;
  fixedBurnTotal: number;
  windowDays?: number;
  asOfDate?: string | null;
  source?: CashOxygenFloor["source"];
  mappedCategories?: CashOxygenExpenseLine[];
  pendingFixedEventCount?: number;
}

export function calculateCashOxygenFloor(input: CashOxygenCalculationInput): CashOxygenFloor {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const fixedBurnTotal = Math.max(0, input.fixedBurnTotal);
  const avgDailyFixedBurn = fixedBurnTotal > 0 ? fixedBurnTotal / windowDays : null;
  const hasCash = input.currentCash != null;
  const hasFixedBurn = avgDailyFixedBurn != null && avgDailyFixedBurn > 0;
  const oxygenDays = hasCash && hasFixedBurn ? Math.max(0, input.currentCash ?? 0) / avgDailyFixedBurn : null;
  const status: CashOxygenStatus =
    oxygenDays == null ? "unknown" : oxygenDays >= 45 ? "green" : oxygenDays >= 21 ? "yellow" : "red";

  return {
    hasCash,
    hasFixedBurn,
    source: input.source ?? "none",
    asOfDate: input.asOfDate ?? null,
    windowDays,
    currentCash: input.currentCash == null ? null : r2(input.currentCash),
    fixedBurnTotal: r2(fixedBurnTotal),
    avgDailyFixedBurn: avgDailyFixedBurn == null ? null : r2(avgDailyFixedBurn),
    oxygenDays: oxygenDays == null ? null : r2(oxygenDays),
    goLiveFloorCash: avgDailyFixedBurn == null ? null : r2(avgDailyFixedBurn * DEFAULT_GO_LIVE_FLOOR_DAYS),
    status,
    mappedCategories: input.mappedCategories ?? [],
    pendingFixedEventCount: input.pendingFixedEventCount ?? 0,
  };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isFixedOperationalExpense(categoryName: string | null, tapBucket: string | null, isRecurring: boolean): boolean {
  if (!tapBucket || !FIXED_TAP_BUCKETS.has(tapBucket)) return false;
  if (isRecurring) return true;
  const name = categoryName ?? "";
  return FIXED_CATEGORY_PATTERNS.some((pattern) => pattern.test(name));
}

async function countPendingFixedEvents(
  restaurantId: string,
  db: PrismaClient,
  windowStart: Date,
  asOf: Date,
): Promise<number> {
  try {
    return await db.normalizedFinancialEvent.count({
      where: {
        restaurantId,
        eventDate: { gte: windowStart, lte: asOf },
        eventType: "FIXED_OPEX",
        mappingStatus: "PENDING_REVIEW",
      },
    });
  } catch {
    return 0;
  }
}

async function loadLedgerCashOxygenFloor(
  restaurantId: string,
  db: PrismaClient,
  windowDays: number,
): Promise<CashOxygenFloor | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { cashBalanceAnchor: true, cashBalanceAnchorDate: true },
  });

  const latestLedgerEntry = await db.ledgerEntry.findFirst({
    where: { restaurantId },
    orderBy: { ledgerDate: "desc" },
    select: { ledgerDate: true },
  });
  if (!latestLedgerEntry) return null;

  const asOf = latestLedgerEntry.ledgerDate;
  const windowStart = new Date(asOf.getTime() - (windowDays - 1) * DAY_MS);

  let currentCash: number | null = null;
  if (restaurant?.cashBalanceAnchor != null && restaurant.cashBalanceAnchorDate != null) {
    const cashFlowSinceAnchor = await db.ledgerEntry.aggregate({
      where: {
        restaurantId,
        ledgerDate: { gt: restaurant.cashBalanceAnchorDate },
      },
      _sum: { cashEffect: true },
    });
    currentCash = n(restaurant.cashBalanceAnchor) + n(cashFlowSinceAnchor._sum.cashEffect);
  }

  const fixedLines = await db.ledgerEntry.findMany({
    where: {
      restaurantId,
      ledgerDate: { gte: windowStart, lte: asOf },
      debit: { gt: 0 },
      ledgerAccount: { in: ["FIXED_OPEX", "DEBT_SERVICE"] },
    },
    select: {
      ledgerAccount: true,
      memo: true,
      debit: true,
      allocationBucket: true,
    },
  });
  const pendingFixedEventCount = await countPendingFixedEvents(restaurantId, db, windowStart, asOf);

  if (fixedLines.length === 0) {
    return calculateCashOxygenFloor({
      currentCash,
      fixedBurnTotal: 0,
      windowDays,
      asOfDate: iso(asOf),
      source: currentCash == null ? "none" : "clean_ledger",
      mappedCategories: [],
      pendingFixedEventCount,
    });
  }

  const grouped = new Map<string, CashOxygenExpenseLine>();
  for (const line of fixedLines) {
    const categoryName = line.memo || line.ledgerAccount.replace(/_/g, " ");
    const key = `${line.ledgerAccount}:${categoryName}`;
    const existing =
      grouped.get(key) ??
      ({
        categoryId: null,
        categoryName,
        tapBucket: line.allocationBucket ?? null,
        amount: 0,
        transactionCount: 0,
      } satisfies CashOxygenExpenseLine);
    existing.amount += n(line.debit);
    existing.transactionCount += 1;
    grouped.set(key, existing);
  }

  const mappedCategories = [...grouped.values()]
    .map((line) => ({ ...line, amount: r2(line.amount) }))
    .sort((a, b) => b.amount - a.amount);

  return calculateCashOxygenFloor({
    currentCash,
    fixedBurnTotal: mappedCategories.reduce((sum, line) => sum + line.amount, 0),
    windowDays,
    asOfDate: iso(asOf),
    source: currentCash == null ? "none" : "clean_ledger",
    mappedCategories,
    pendingFixedEventCount,
  });
}

export async function loadCashOxygenFloor(
  restaurantId: string,
  db: PrismaClient = prisma,
  windowDays = DEFAULT_WINDOW_DAYS,
): Promise<CashOxygenFloor> {
  const ledgerOxygen = await loadLedgerCashOxygenFloor(restaurantId, db, windowDays);
  if (ledgerOxygen?.hasFixedBurn) return ledgerOxygen;

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { cashBalanceAnchor: true, cashBalanceAnchorDate: true },
  });

  const latestTxn = await db.transaction.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const asOf = latestTxn?.date ?? restaurant?.cashBalanceAnchorDate ?? new Date();
  const windowStart = new Date(asOf.getTime() - (windowDays - 1) * DAY_MS);
  const pendingFixedEventCount = await countPendingFixedEvents(restaurantId, db, windowStart, asOf);

  let currentCash: number | null = null;
  if (restaurant?.cashBalanceAnchor != null && restaurant.cashBalanceAnchorDate != null) {
    const sinceAnchor = await db.transaction.findMany({
      where: { restaurantId, date: { gt: restaurant.cashBalanceAnchorDate } },
      select: { amount: true },
    });
    currentCash = n(restaurant.cashBalanceAnchor) + sinceAnchor.reduce((sum, t) => sum + -n(t.amount), 0);
  }

  const txns = await db.transaction.findMany({
    where: { restaurantId, date: { gte: windowStart, lte: asOf }, amount: { gt: 0 } },
    select: {
      amount: true,
      isRecurring: true,
      categoryId: true,
      category: { select: { name: true, tapBucket: true } },
    },
  });

  const grouped = new Map<string, CashOxygenExpenseLine>();
  for (const t of txns) {
    const categoryName = t.category?.name ?? "Uncategorized";
    const tapBucket = t.category?.tapBucket ?? null;
    if (!isFixedOperationalExpense(categoryName, tapBucket, t.isRecurring)) continue;
    const key = t.categoryId ?? "uncategorized";
    const existing =
      grouped.get(key) ??
      ({
        categoryId: t.categoryId,
        categoryName,
        tapBucket,
        amount: 0,
        transactionCount: 0,
      } satisfies CashOxygenExpenseLine);
    existing.amount += n(t.amount);
    existing.transactionCount += 1;
    grouped.set(key, existing);
  }

  const mappedCategories = [...grouped.values()]
    .map((line) => ({ ...line, amount: r2(line.amount) }))
    .sort((a, b) => b.amount - a.amount);

  return calculateCashOxygenFloor({
    currentCash,
    fixedBurnTotal: mappedCategories.reduce((sum, line) => sum + line.amount, 0),
    windowDays,
    asOfDate: iso(asOf),
    source: currentCash == null ? "none" : "anchor_plus_transactions",
    mappedCategories,
    pendingFixedEventCount,
  });
}
