/**
 * Toast integration — public surface.
 *
 * Two surfaces:
 *   - Operational REST (`toastFetch`) — restaurant-header based; needs Standard
 *     API Access scopes (labor/orders/menus/…). Not yet granted on the current
 *     client (returns 403) — pending the Toast access request.
 *   - Analytics `era` (`runMetricsReport` & friends) — body-based restaurantIds,
 *     async report flow; works today on enterprise-metrics:read. Powers the
 *     Covers Flow, Sales Mix, and actual-labor-hours tiles.
 *
 * Usage:
 *   import { isToastConfigured, getMetricsForDay } from "@/lib/integrations/toast";
 *   if (isToastConfigured()) {
 *     const [row] = await getMetricsForDay(20260611);
 *     // row.netSalesAmount, row.guestCount, row.hourlyJobTotalHours, …
 *   }
 */

export {
  isToastConfigured,
  missingToastEnvVars,
  getToastConfig,
  TOAST_ENV_VARS,
  type ToastConfig,
} from "./config";

export { getAccessToken, clearTokenCache } from "./auth";

export {
  toastFetch,
  ToastApiError,
  type ToastRequestOptions,
} from "./client";

export {
  runMetricsReport,
  getMetricsForDay,
  getMetricsForDays,
  toBusinessDate,
  type MetricsRow,
  type MetricsReportRequest,
  type MetricsGroupBy,
  type EraTimeRange,
  type EraPollOptions,
} from "./analytics";

export {
  getSalesTaxCollectedForDay,
  type SalesTaxForDay,
} from "./orders";

export { getToastAnalyticsCredentials } from "./config";
