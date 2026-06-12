/**
 * Toast integration — public surface.
 *
 * Scaffolding only (handoff 2026-06-12): OAuth2 client-credentials auth with a
 * token cache, a typed fetch wrapper that injects the restaurant header, and a
 * config guard. No endpoint-specific data layers yet — those (Tax Vault, Food
 * Cost, Sales Mix, Menu Engineering, Covers Flow, Labor Hours) build on top of
 * `toastFetch` in a later pass.
 *
 * Usage once secrets are present:
 *   import { isToastConfigured, toastFetch } from "@/lib/integrations/toast";
 *   if (isToastConfigured()) {
 *     const entries = await toastFetch("/labor/v1/timeEntries", { query: {...} });
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
