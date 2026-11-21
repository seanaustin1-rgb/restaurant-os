// Gathers the inputs for evaluateCleanDay from the database and persists the
// verdict. All judgment lives in clean-day.ts; this file only does I/O.
//
// Sync-success signals reuse what the syncs already record — no new sync-state
// table is needed:
//   Plaid  PlaidConnection.lastSyncedAt (advanced only in the same DB transaction
//          as a committed page, so it moves only on success)
//   Toast  DailySales.updatedAt (the nightly job upserts its lookback window every
//          run, so a successful run touches rows)
import type { PrismaClient } from "@prisma/client";
import { computeSpineDeltas } from "./spine-compare";
import { loadSpineTotals } from "./spine-totals";
import {
  evaluateCleanDay,
  localDayBounds,
  type CleanDayVerdict,
  type StoredDay,
} from "./clean-day";

/** Spine parity is judged over a trailing window, not one day: single-day slices of
 * bank-lagged data flap at the 1% / $1 tolerance. Matches the gate's "trailing month". */
export const SPINE_WINDOW_DAYS = 30;
/** Toast counts as "in use" if it wrote any DailySales row this recently. */
const TOAST_ACTIVE_LOOKBACK_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CleanDayResult {
  /** Tenant-local calendar date, YYYY-MM-DD. */
  date: string;
  verdict: CleanDayVerdict;
}

export async function evaluateCleanDayForTenant(
  db: PrismaClient,
  restaurantId: string,
  now: Date = new Date(),
): Promise<CleanDayResult> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { timezone: true },
  });
  const { date, start, end } = localDayBounds(now, restaurant?.timezone ?? "America/New_York");

  // Spine window: [local date − 30d, local date) as UTC-midnight dates, matching how
  // compare-spines.ts treats Transaction.date / ledgerDate (both @db.Date).
  const today = new Date(`${date}T00:00:00.000Z`);
  const spineFrom = new Date(today.getTime() - SPINE_WINDOW_DAYS * DAY_MS);
  const toastSince = new Date(today.getTime() - TOAST_ACTIVE_LOOKBACK_DAYS * DAY_MS);

  const [
    newExceptionCount,
    openBlockingCount,
    openBacklogCount,
    plaidConnections,
    toastRecent,
    toastTouchedToday,
    spines,
  ] = await Promise.all([
    db.syncException.count({
      where: { restaurantId, severity: { in: ["WARNING", "BLOCKING"] }, createdAt: { gte: start, lt: end } },
    }),
    db.syncException.count({ where: { restaurantId, resolvedAt: null, severity: "BLOCKING" } }),
    db.syncException.count({ where: { restaurantId, resolvedAt: null } }),
    db.plaidConnection.findMany({
      where: { restaurantId, isActive: true },
      select: { lastSyncedAt: true },
    }),
    db.dailySales.count({ where: { restaurantId, source: "toast", date: { gte: toastSince } } }),
    db.dailySales.count({ where: { restaurantId, source: "toast", updatedAt: { gte: start } } }),
    loadSpineTotals(db, restaurantId, spineFrom, today),
  ]);

  const verdict = evaluateCleanDay({
    newExceptionCount,
    openBlockingCount,
    openBacklogCount,
    plaid: {
      activeConnections: plaidConnections.length,
      staleConnections: plaidConnections.filter((c) => !c.lastSyncedAt || c.lastSyncedAt < start).length,
    },
    toast: { applicable: toastRecent > 0, syncedToday: toastTouchedToday > 0 },
    spineDeltas: computeSpineDeltas(spines.legacy, spines.ledger),
  });

  return { date, verdict };
}

/** Upsert today's verdict. Idempotent per (tenant, local date): a re-run overwrites. */
export async function recordCleanDay(
  db: PrismaClient,
  restaurantId: string,
  result: CleanDayResult,
): Promise<void> {
  const date = new Date(`${result.date}T00:00:00.000Z`);
  const data = {
    clean: result.verdict.clean,
    checks: result.verdict.checks as unknown as object,
    openBacklogCount: result.verdict.openBacklogCount,
  };
  await db.reconciliationDay.upsert({
    where: { restaurantId_date: { restaurantId, date } },
    create: { restaurantId, date, ...data },
    update: data,
  });
}

/** Stored verdicts, newest first, as StoredDay for cleanStreak. */
export async function loadStoredDays(
  db: PrismaClient,
  restaurantId: string,
  limit = 30,
): Promise<StoredDay[]> {
  const rows = await db.reconciliationDay.findMany({
    where: { restaurantId },
    orderBy: { date: "desc" },
    take: limit,
    select: { date: true, clean: true },
  });
  return rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), clean: r.clean }));
}
