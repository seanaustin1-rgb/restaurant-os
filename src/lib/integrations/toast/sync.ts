/**
 * Toast → DailySales sync.
 *
 * Pulls daily metrics from the Toast Analytics (era) API and upserts them into
 * the existing `DailySales` table (source = "toast"), keyed by (restaurantId,
 * date). This runs OFF the page-render path — era reports are slow async pulls,
 * so tiles read the synced `DailySales` rows (fast) rather than calling Toast
 * during a request. Invoke from a script or an Inngest job.
 *
 * Mapping (era MetricsRow → DailySales):
 *   grossSalesAmount → grossSales, netSalesAmount → netSales,
 *   guestCount → covers, ordersCount → checkCount,
 *   hourlyJobTotalPay → laborCost.
 * (Food/liquor/beverage splits + hoursOpen are not in the daily metrics report.)
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isToastConfigured, getToastConfig } from "./config";
import {
  getMetricsForDay,
  runMetricsReport,
  runMenuReport,
  toBusinessDate,
} from "./analytics";
import { getSalesTaxCollectedForDay } from "./orders";

/** One revenue center's slice of a day's sales (stored in DailySales.mixByRevenueCenter). */
export interface RevenueCenterSlice {
  revenueCenter: string;
  netSales: number;
  orders: number;
  guests: number;
}

/**
 * Resolve which DB restaurant the configured Toast GUID maps to.
 *
 * Single-tenant for now (one global TOAST_RESTAURANT_GUID in env). Prefers an
 * explicit PosConnection (provider TOAST, externalId = the GUID); falls back to
 * the lone Customer-Zero restaurant by name. Returns null if Toast isn't
 * configured or no restaurant can be resolved. When per-restaurant Toast creds
 * move onto PosConnection, the scheduler can fan out across all of them.
 */
export async function resolveToastRestaurantId(): Promise<string | null> {
  if (!isToastConfigured()) return null;
  const { restaurantGuid } = getToastConfig();

  const conn = await prisma.posConnection.findFirst({
    where: { provider: "TOAST", externalId: restaurantGuid, isActive: true },
    select: { restaurantId: true },
  });
  if (conn) return conn.restaurantId;

  const fallback = await prisma.restaurant.findFirst({
    where: { name: { contains: "Stone Grille and Tap" } },
    select: { id: true },
  });
  return fallback?.id ?? null;
}

export interface ToastSyncResult {
  restaurantId: string;
  daysRequested: number;
  daysWritten: number;
  fromBusinessDate: string | null;
  toBusinessDate: string | null;
}

/** "YYYYMMDD" → a UTC-midnight Date for the @db.Date column. */
function businessDateToUtcDate(bd: string): Date {
  const y = Number(bd.slice(0, 4));
  const m = Number(bd.slice(4, 6));
  const d = Number(bd.slice(6, 8));
  return new Date(Date.UTC(y, m - 1, d));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sync the last `days` closed business days (yesterday backwards) into
 * DailySales for one restaurant. Days the era API returns no data for are
 * skipped. Spaced to respect rate limits — expect ~`days` seconds.
 */
export async function syncToastDailyMetrics(
  restaurantId: string,
  days = 21,
  spacingMs = 1100,
): Promise<ToastSyncResult> {
  if (!isToastConfigured()) {
    throw new Error("Toast is not configured — cannot sync daily metrics.");
  }

  let written = 0;
  let firstWritten: string | null = null;
  let lastWritten: string | null = null;

  // Oldest → newest so firstWritten/lastWritten read naturally.
  for (let offset = days; offset >= 1; offset--) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const businessDate = toBusinessDate(d);

    const rows = await getMetricsForDay(businessDate);
    const row = rows[0];
    if (row) {
      const date = businessDateToUtcDate(row.businessDate);
      const values = {
        grossSales: row.grossSalesAmount,
        netSales: row.netSalesAmount,
        covers: row.guestCount,
        checkCount: row.ordersCount,
        laborCost: row.hourlyJobTotalPay,
        laborHours: row.hourlyJobTotalHours,
        source: "toast",
      };
      await prisma.dailySales.upsert({
        where: { restaurantId_date: { restaurantId, date } },
        update: values,
        create: { restaurantId, date, ...values },
      });
      written++;
      firstWritten = firstWritten ?? row.businessDate;
      lastWritten = row.businessDate;
    }
    if (offset > 1) await sleep(spacingMs);
  }

  return {
    restaurantId,
    daysRequested: days,
    daysWritten: written,
    fromBusinessDate: firstWritten,
    toBusinessDate: lastWritten,
  };
}

/**
 * Sync collected sales tax into DailySales.salesTaxCollected for the last `days`
 * closed business days. Reads the Toast Orders API (per-check taxAmount sum) —
 * the source for the pre-allocation Sales-Tax skim (spec §C3.3). Upserts onto the
 * existing daily row (the metrics sync creates it); a day with no checks is
 * skipped. Idempotent. Needs the `orders:read` scope.
 */
export async function syncToastSalesTax(
  restaurantId: string,
  days = 21,
  spacingMs = 1100,
): Promise<ToastSyncResult> {
  if (!isToastConfigured()) {
    throw new Error("Toast is not configured — cannot sync sales tax.");
  }

  let written = 0;
  let firstWritten: string | null = null;
  let lastWritten: string | null = null;

  for (let offset = days; offset >= 1; offset--) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const bd = String(toBusinessDate(d));

    const { salesTaxCollected, checkCount } = await getSalesTaxCollectedForDay(bd);
    if (checkCount > 0) {
      const date = businessDateToUtcDate(bd);
      await prisma.dailySales.upsert({
        where: { restaurantId_date: { restaurantId, date } },
        update: { salesTaxCollected },
        // Fallback create (0 sales) only if the metrics sync hasn't run for this day.
        create: { restaurantId, date, grossSales: 0, netSales: 0, salesTaxCollected, source: "toast" },
      });
      written++;
      firstWritten = firstWritten ?? bd;
      lastWritten = bd;
    }
    if (offset > 1) await sleep(spacingMs);
  }

  return {
    restaurantId,
    daysRequested: days,
    daysWritten: written,
    fromBusinessDate: firstWritten,
    toBusinessDate: lastWritten,
  };
}

/**
 * Sync the revenue-center sales mix into DailySales.mixByRevenueCenter for the
 * last `days` closed business days. One era report per day (groupBy
 * REVENUE_CENTER); upserts the JSON slice array onto the existing daily row
 * (creating it from the slice sums if it doesn't exist). Idempotent.
 */
export async function syncToastSalesMix(
  restaurantId: string,
  days = 21,
  spacingMs = 1100,
): Promise<ToastSyncResult> {
  if (!isToastConfigured()) {
    throw new Error("Toast is not configured — cannot sync sales mix.");
  }

  let written = 0;
  let firstWritten: string | null = null;
  let lastWritten: string | null = null;

  for (let offset = days; offset >= 1; offset--) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const businessDate = toBusinessDate(d);

    const rows = await runMetricsReport({
      startBusinessDate: businessDate,
      endBusinessDate: businessDate,
      timeRange: "day",
      groupBy: ["REVENUE_CENTER"],
    });

    if (rows.length > 0) {
      const slices: RevenueCenterSlice[] = rows.map((r) => ({
        revenueCenter: String(r.revenueCenter ?? "Unknown"),
        netSales: Number(r.netSalesAmount ?? 0),
        orders: Number(r.ordersCount ?? 0),
        guests: Number(r.guestCount ?? 0),
      }));
      const date = businessDateToUtcDate(String(rows[0].businessDate));
      const grossSales = rows.reduce((s, r) => s + Number(r.grossSalesAmount ?? 0), 0);
      const netSales = slices.reduce((s, r) => s + r.netSales, 0);
      const covers = slices.reduce((s, r) => s + r.guests, 0);
      const checkCount = slices.reduce((s, r) => s + r.orders, 0);
      const mixJson = slices as unknown as Prisma.InputJsonValue;

      await prisma.dailySales.upsert({
        where: { restaurantId_date: { restaurantId, date } },
        update: { mixByRevenueCenter: mixJson },
        create: {
          restaurantId,
          date,
          grossSales,
          netSales,
          covers,
          checkCount,
          source: "toast",
          mixByRevenueCenter: mixJson,
        },
      });
      written++;
      firstWritten = firstWritten ?? String(rows[0].businessDate);
      lastWritten = String(rows[0].businessDate);
    }
    if (offset > 1) await sleep(spacingMs);
  }

  return {
    restaurantId,
    daysRequested: days,
    daysWritten: written,
    fromBusinessDate: firstWritten,
    toBusinessDate: lastWritten,
  };
}

/**
 * Sync per-item menu sales into MenuItemSales for the last `weeks` weeks
 * (ending yesterday). One weekly era menu report per week (groupBy MENU_ITEM —
 * the API allows exactly one groupBy, and only on day/week ranges); rows come
 * back per business date × item and are upserted by (restaurantId, date, item).
 * Batched $transaction([...]) per week — required over the Supabase pooler.
 */
export async function syncToastMenuItemSales(
  restaurantId: string,
  weeks = 4,
  spacingMs = 1100,
): Promise<ToastSyncResult & { rowsWritten: number }> {
  if (!isToastConfigured()) {
    throw new Error("Toast is not configured — cannot sync menu item sales.");
  }

  let rowsWritten = 0;
  let daysSeen = new Set<string>();
  let firstWritten: string | null = null;
  let lastWritten: string | null = null;

  for (let w = weeks; w >= 1; w--) {
    const end = new Date();
    end.setDate(end.getDate() - 1 - 7 * (w - 1));
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    const rows = await runMenuReport({
      startBusinessDate: toBusinessDate(start),
      endBusinessDate: toBusinessDate(end),
      timeRange: "week",
      groupBy: "MENU_ITEM",
    });

    const writes = rows
      .filter((r) => r.menuItemGuid && r.businessDate)
      .map((r) => {
        const date = businessDateToUtcDate(String(r.businessDate));
        daysSeen.add(String(r.businessDate));
        const values = {
          menuItemName: String(r.menuItemName ?? "Unknown"),
          quantitySold: Math.round(Number(r.quantitySold ?? 0)),
          netSales: Number(r.netSalesAmount ?? 0),
          avgPrice: r.averagePrice == null ? null : Number(r.averagePrice),
          source: "toast",
        };
        return prisma.menuItemSales.upsert({
          where: {
            restaurantId_date_menuItemGuid: {
              restaurantId,
              date,
              menuItemGuid: String(r.menuItemGuid),
            },
          },
          update: values,
          create: { restaurantId, date, menuItemGuid: String(r.menuItemGuid), ...values },
        });
      });

    // Chunk the batched transaction to keep statements per txn reasonable.
    for (let i = 0; i < writes.length; i += 200) {
      await prisma.$transaction(writes.slice(i, i + 200));
    }
    rowsWritten += writes.length;

    const dates = [...daysSeen].sort();
    firstWritten = dates[0] ?? firstWritten;
    lastWritten = dates[dates.length - 1] ?? lastWritten;
    if (w > 1) await sleep(spacingMs);
  }

  return {
    restaurantId,
    daysRequested: weeks * 7,
    daysWritten: daysSeen.size,
    fromBusinessDate: firstWritten,
    toBusinessDate: lastWritten,
    rowsWritten,
  };
}
