/**
 * Toast Orders API — sales tax collected per business day.
 *
 * The pre-allocation Sales-Tax skim (spec §C3.3) needs the *collected* sales tax
 * for a day, same-day, before Davo pulls it from the bank. That figure isn't in
 * the era/analytics metrics row — it lives on the operational Orders API as
 * per-check `taxAmount`. Summing non-voided checks for a businessDate gives the
 * day's collected sales tax (verified live 2026-06-13: matches the ~4–6% PA
 * effective rate, alcohol being sales-tax exempt).
 *
 * Needs the Standard-API `orders:read` scope (granted 2026-06-13). Uses the
 * operational `toastFetch` (restaurant-header auth), NOT the era client.
 */

import { toastFetch } from "./client";

interface ToastCheck {
  taxAmount?: number;
  voided?: boolean;
  deleted?: boolean;
}
interface ToastOrder {
  checks?: ToastCheck[];
  voided?: boolean;
  deleted?: boolean;
}

export interface SalesTaxForDay {
  /** Business date as "YYYYMMDD". */
  businessDate: string;
  /** Sum of non-voided per-check taxAmount (dollars). */
  salesTaxCollected: number;
  /** Checks counted (non-voided). */
  checkCount: number;
  /** Orders fetched. */
  orderCount: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sum the sales tax collected for one business day from the Orders API. Pages
 * `/orders/v2/ordersBulk` (pageSize 100) and sums `check.taxAmount`, skipping
 * voided/deleted orders and checks. `businessDate` is "YYYYMMDD".
 */
export async function getSalesTaxCollectedForDay(
  businessDate: string,
  opts: { restaurantGuid?: string; pageSize?: number; spacingMs?: number } = {},
): Promise<SalesTaxForDay> {
  const pageSize = opts.pageSize ?? 100;
  const spacingMs = opts.spacingMs ?? 300;

  let page = 1;
  let salesTaxCollected = 0;
  let checkCount = 0;
  let orderCount = 0;

  for (;;) {
    const batch = await toastFetch<ToastOrder[]>(
      `/orders/v2/ordersBulk?businessDate=${businessDate}&page=${page}&pageSize=${pageSize}`,
      opts.restaurantGuid ? { restaurantGuid: opts.restaurantGuid } : {},
    );
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const o of batch) {
      if (o.voided || o.deleted) continue;
      orderCount++;
      for (const c of o.checks ?? []) {
        if (c.voided || c.deleted) continue;
        salesTaxCollected += Number(c.taxAmount ?? 0);
        checkCount++;
      }
    }

    if (batch.length < pageSize) break;
    page++;
    await sleep(spacingMs);
  }

  return {
    businessDate,
    salesTaxCollected: Math.round(salesTaxCollected * 100) / 100,
    checkCount,
    orderCount,
  };
}
