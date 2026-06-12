/**
 * Toast integration — environment contract & configuration guard.
 *
 * Scaffolding only: this module defines the env var names the Toast connector
 * consumes and a guard that reports whether they are present. It performs NO
 * live API calls and importing it never throws — mirroring the optional-config
 * pattern used by the Anthropic extractor (`isConfigured()` in import/llm-extract).
 *
 * The connector lights up automatically once these four vars are set in the
 * environment (see docs/SESSION-HANDOFF.md → "Where secrets go"):
 *   TOAST_CLIENT_ID, TOAST_CLIENT_SECRET, TOAST_API_HOSTNAME, TOAST_RESTAURANT_GUID
 */

export interface ToastConfig {
  /** OAuth2 client-credentials client id (machine client). */
  clientId: string;
  /** OAuth2 client-credentials secret. Never logged. */
  clientSecret: string;
  /** API hostname, e.g. https://ws-api.toasttab.com (prod) or the sandbox host. */
  hostname: string;
  /** Restaurant GUID — sent as the `Toast-Restaurant-External-ID` header. */
  restaurantGuid: string;
}

/** The env var names this connector reads. Single source of truth. */
export const TOAST_ENV_VARS = [
  "TOAST_CLIENT_ID",
  "TOAST_CLIENT_SECRET",
  "TOAST_API_HOSTNAME",
  "TOAST_RESTAURANT_GUID",
] as const;

/**
 * True when every Toast env var is present and non-empty. Cheap, side-effect
 * free — use this to gate tiles/loaders so the connector stays dark until the
 * operator drops real secrets into the environment configuration.
 */
export function isToastConfigured(): boolean {
  return TOAST_ENV_VARS.every((name) => !!process.env[name]?.trim());
}

/** Names of any missing/empty Toast env vars (for diagnostics, never values). */
export function missingToastEnvVars(): string[] {
  return TOAST_ENV_VARS.filter((name) => !process.env[name]?.trim());
}

/**
 * Read and validate the Toast configuration. Throws a clear, actionable error
 * if anything is missing — call only behind `isToastConfigured()` (or be ready
 * to catch). The hostname is normalized to drop any trailing slash so callers
 * can safely template `${hostname}/path`.
 */
export function getToastConfig(): ToastConfig {
  const missing = missingToastEnvVars();
  if (missing.length > 0) {
    throw new Error(
      `Toast is not configured — missing env var(s): ${missing.join(", ")}. ` +
        `Set them in the environment configuration (see docs/SESSION-HANDOFF.md).`,
    );
  }

  return {
    clientId: process.env.TOAST_CLIENT_ID!.trim(),
    clientSecret: process.env.TOAST_CLIENT_SECRET!.trim(),
    hostname: process.env.TOAST_API_HOSTNAME!.trim().replace(/\/+$/, ""),
    restaurantGuid: process.env.TOAST_RESTAURANT_GUID!.trim(),
  };
}
