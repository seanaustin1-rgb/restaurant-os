/**
 * Toast Analytics (era) API client — enterprise-metrics:read.
 *
 * The analytics API is a separate surface from the operational REST APIs that
 * `client.ts`/`toastFetch` target:
 *   - It identifies restaurants via a `restaurantIds` array in the request BODY,
 *     NOT the `Toast-Restaurant-External-ID` header — so we use raw fetch here.
 *   - Reports are generated ASYNCHRONOUSLY: POST a request to get a
 *     `reportRequestGuid`, then GET the consolidated `/era/v1/metrics/{guid}`
 *     endpoint, polling until the report is ready.
 *
 * Verified live (2026-06-12) against https://ws-api.toasttab.com with the
 * enterprise-metrics:read credentials. See scripts/toast-analytics-probe.ts.
 *
 * NOTE: the legacy `/era/v1/metrics/{timeRange}/{guid}` GET is 410 Gone — always
 * retrieve from the consolidated `/era/v1/metrics/{guid}`.
 */

import { getAccessToken } from "./auth";
import { getToastConfig, getToastAnalyticsCredentials } from "./config";
import { ToastApiError } from "./client";

export type EraTimeRange = "day" | "week" | "month" | "year";
export type MetricsGroupBy = "REVENUE_CENTER" | "DINING_OPTION" | "ORDER_SOURCE";

/** A single row of aggregated metrics for one restaurant + business date. */
export interface MetricsRow {
  restaurantGuid: string;
  /** Business date as a "YYYYMMDD" string. */
  businessDate: string;
  guestCount: number;
  ordersCount: number;
  openOrdersCount: number;
  closedOrdersCount: number;
  voidOrdersCount: number;
  discountOrderCount: number;
  netSalesAmount: number;
  grossSalesAmount: number;
  discountAmount: number;
  voidOrdersAmount: number;
  refundAmount: number;
  avgOrderValue: number;
  /** Actual worked labor hours (hourly jobs). Scheduled hours are NOT in era. */
  hourlyJobTotalHours: number;
  hourlyJobTotalPay: number;
  hourlyJobSalesPerLaborHour: number;
  /** groupBy dimensions add extra keys; keep this open. */
  [key: string]: unknown;
}

export interface MetricsReportRequest {
  /** Business date (YYYYMMDD int). For timeRange "day", start and end must be equal. */
  startBusinessDate: number;
  endBusinessDate: number;
  /** Defaults to the configured restaurant GUID. */
  restaurantIds?: string[];
  excludedRestaurantIds?: string[];
  groupBy?: MetricsGroupBy[];
  /** Defaults to "day". */
  timeRange?: EraTimeRange;
  /** Only valid for timeRange "day": DAY (default) or HOUR for intraday rows. */
  aggregateBy?: "DAY" | "HOUR";
}

export interface EraPollOptions {
  /** Max poll attempts for report readiness. Default 10. */
  attempts?: number;
  /** Delay between polls in ms. Default 2000. */
  intervalMs?: number;
  signal?: AbortSignal;
}

/** Convert a Date to a Toast businessDate integer (YYYYMMDD). */
export function toBusinessDate(d: Date): number {
  return Number(
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`,
  );
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });

async function eraAuthHeaders(): Promise<Record<string, string>> {
  // Analytics (era) runs on the enterprise-metrics credential set, which is
  // separate from the operational (Standard) creds used by toastFetch.
  const token = await getAccessToken(false, getToastAnalyticsCredentials());
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

/**
 * Run an aggregated-metrics report end to end: create the request, then poll
 * until the data is ready. Returns the report rows (one per restaurant +
 * business-date bucket).
 */
export async function runMetricsReport(
  req: MetricsReportRequest,
  poll: EraPollOptions = {},
): Promise<MetricsRow[]> {
  const { hostname, restaurantGuid } = getToastConfig();
  const timeRange = req.timeRange ?? "day";

  if (timeRange === "day" && req.startBusinessDate !== req.endBusinessDate) {
    throw new Error(
      `runMetricsReport: timeRange "day" requires startBusinessDate === endBusinessDate ` +
        `(got ${req.startBusinessDate}..${req.endBusinessDate}). Use getMetricsForDays() for a range.`,
    );
  }

  const body = {
    startBusinessDate: req.startBusinessDate,
    endBusinessDate: req.endBusinessDate,
    restaurantIds: req.restaurantIds ?? [restaurantGuid],
    excludedRestaurantIds: req.excludedRestaurantIds ?? [],
    groupBy: req.groupBy ?? [],
  };

  const query = new URLSearchParams();
  if (req.aggregateBy) query.set("aggregateBy", req.aggregateBy);
  const qs = query.toString() ? `?${query.toString()}` : "";

  // 1. Create the report request → reportRequestGuid (returned as a JSON string).
  const headers = await eraAuthHeaders();
  const postRes = await fetch(`${hostname}/era/v1/metrics/${timeRange}${qs}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: poll.signal,
  });
  if (!postRes.ok) {
    throw new ToastApiError({
      status: postRes.status,
      statusText: postRes.statusText,
      path: `/era/v1/metrics/${timeRange}`,
      body: (await postRes.text()).slice(0, 2000),
    });
  }
  const reportGuid = (await postRes.text()).trim().replace(/^"|"$/g, "");

  // 2. Poll the consolidated GET until ready (200). 202/404 = still generating.
  const attempts = poll.attempts ?? 10;
  const intervalMs = poll.intervalMs ?? 2000;
  for (let i = 0; i < attempts; i++) {
    const getRes = await fetch(`${hostname}/era/v1/metrics/${reportGuid}`, {
      headers: await eraAuthHeaders(),
      signal: poll.signal,
    });
    if (getRes.status === 200) {
      const data = JSON.parse((await getRes.text()) || "[]");
      return (Array.isArray(data) ? data : [data]) as MetricsRow[];
    }
    if (getRes.status === 202 || getRes.status === 404) {
      await sleep(intervalMs, poll.signal);
      continue;
    }
    throw new ToastApiError({
      status: getRes.status,
      statusText: getRes.statusText,
      path: `/era/v1/metrics/${reportGuid}`,
      body: (await getRes.text()).slice(0, 2000),
    });
  }
  throw new Error(
    `runMetricsReport: report ${reportGuid} not ready after ${attempts} polls.`,
  );
}

/** Convenience: metrics for a single business date (one row per restaurant). */
export async function getMetricsForDay(
  businessDate: number,
  opts: Omit<MetricsReportRequest, "startBusinessDate" | "endBusinessDate" | "timeRange"> = {},
  poll?: EraPollOptions,
): Promise<MetricsRow[]> {
  return runMetricsReport(
    { ...opts, timeRange: "day", startBusinessDate: businessDate, endBusinessDate: businessDate },
    poll,
  );
}

// ——— Menu reporting (/era/v1/menu) ———

export type MenuGroupBy = "MENU" | "MENU_GROUP" | "MENU_ITEM" | "MODIFIER";

/** A row of the menu report. Dimension fields present per the groupBy used. */
export interface MenuReportRow {
  restaurantGuid: string;
  businessDate: string; // "YYYYMMDD" — rows are per business date within the range
  netSalesAmount: number;
  grossSalesAmount: number;
  discountAmount: number;
  refundAmount: number;
  voidAmount: number;
  quantitySold: number;
  averagePrice: number;
  wasteCount: number;
  wasteAmount: number;
  menuGuid?: string;
  menuName?: string;
  menuGroupGuid?: string;
  menuGroupName?: string;
  menuItemGuid?: string;
  menuItemName?: string;
  modifierGuid?: string;
  modifierName?: string;
  [key: string]: unknown;
}

export interface MenuReportRequest {
  startBusinessDate: number;
  endBusinessDate: number;
  restaurantIds?: string[];
  excludedRestaurantIds?: string[];
  /**
   * EXACTLY ONE dimension (the API rejects multiple), and groupBy is only
   * accepted for "day" or "week" time ranges (verified live 2026-06-12).
   */
  groupBy?: MenuGroupBy;
  /** "day" (1 day) or "week" (≤7 days) when groupBy is set; month/year otherwise. */
  timeRange?: EraTimeRange;
}

/**
 * Run a menu report end to end (POST create → poll consolidated GET
 * /era/v1/menu/{guid}). Rows come back per business date × dimension value —
 * aggregate across dates in the caller.
 */
export async function runMenuReport(
  req: MenuReportRequest,
  poll: EraPollOptions = {},
): Promise<MenuReportRow[]> {
  const { hostname, restaurantGuid } = getToastConfig();
  const timeRange = req.timeRange ?? "week";

  if (req.groupBy && timeRange !== "day" && timeRange !== "week") {
    throw new Error(
      `runMenuReport: groupBy is only supported for "day" or "week" time ranges (got "${timeRange}").`,
    );
  }

  const body = {
    startBusinessDate: req.startBusinessDate,
    endBusinessDate: req.endBusinessDate,
    restaurantIds: req.restaurantIds ?? [restaurantGuid],
    excludedRestaurantIds: req.excludedRestaurantIds ?? [],
    ...(req.groupBy ? { groupBy: [req.groupBy] } : {}),
  };

  const headers = await eraAuthHeaders();
  const postRes = await fetch(`${hostname}/era/v1/menu/${timeRange}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: poll.signal,
  });
  if (!postRes.ok) {
    throw new ToastApiError({
      status: postRes.status,
      statusText: postRes.statusText,
      path: `/era/v1/menu/${timeRange}`,
      body: (await postRes.text()).slice(0, 2000),
    });
  }
  const reportGuid = (await postRes.text()).trim().replace(/^"|"$/g, "");

  const attempts = poll.attempts ?? 10;
  const intervalMs = poll.intervalMs ?? 2000;
  for (let i = 0; i < attempts; i++) {
    const getRes = await fetch(`${hostname}/era/v1/menu/${reportGuid}`, {
      headers: await eraAuthHeaders(),
      signal: poll.signal,
    });
    if (getRes.status === 200) {
      const data = JSON.parse((await getRes.text()) || "[]");
      return (Array.isArray(data) ? data : [data]) as MenuReportRow[];
    }
    if (getRes.status === 202 || getRes.status === 404) {
      await sleep(intervalMs, poll.signal);
      continue;
    }
    throw new ToastApiError({
      status: getRes.status,
      statusText: getRes.statusText,
      path: `/era/v1/menu/${reportGuid}`,
      body: (await getRes.text()).slice(0, 2000),
    });
  }
  throw new Error(`runMenuReport: report ${reportGuid} not ready after ${attempts} polls.`);
}

/**
 * Convenience: a daily series across an inclusive Date range. Because timeRange
 * "day" only accepts a single date, this issues one report per day, spaced to
 * respect rate limits. Use for trend tiles (Covers Flow, Labor Hours) — and
 * cache the result; do not call on every page request.
 */
export async function getMetricsForDays(
  start: Date,
  end: Date,
  opts: Omit<MetricsReportRequest, "startBusinessDate" | "endBusinessDate" | "timeRange"> = {},
  spacingMs = 1100,
): Promise<MetricsRow[]> {
  const rows: MetricsRow[] = [];
  const cursor = new Date(start);
  let first = true;
  while (cursor <= end) {
    if (!first) await sleep(spacingMs);
    first = false;
    const day = toBusinessDate(cursor);
    const dayRows = await getMetricsForDay(day, opts);
    rows.push(...dayRows);
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
}
