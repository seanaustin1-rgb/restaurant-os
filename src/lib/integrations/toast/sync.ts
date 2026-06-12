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

import { prisma } from "@/lib/prisma";
import { isToastConfigured } from "./config";
import { getMetricsForDay, toBusinessDate } from "./analytics";

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
