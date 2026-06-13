/**
 * Toast authentication — OAuth2 client-credentials ("machine client") flow
 * with a process-local token cache.
 *
 * Toast issues a short-lived bearer token from:
 *   POST {hostname}/authentication/v1/authentication/login
 *   body: { clientId, clientSecret, userAccessType: "TOAST_MACHINE_CLIENT" }
 *   200 : { token: { tokenType, accessToken, expiresIn, ... } }
 *
 * Tokens are cached in module scope and reused until shortly before expiry, so
 * we are not logging in on every request. The cache is per-process (fine for a
 * single server / serverless warm instance); a cold start simply re-authenticates.
 *
 * Scaffolding note: no network call happens at import time. `getAccessToken()`
 * is the first thing that actually talks to Toast, and only when invoked.
 */

import { getToastConfig } from "./config";

/** Skew applied before expiry so an in-flight request never uses a dead token. */
const EXPIRY_SKEW_MS = 60_000; // refresh 60s early

interface CachedToken {
  accessToken: string;
  /** Absolute epoch ms at which we consider the token stale (already skewed). */
  expiresAt: number;
}

interface ToastLoginResponse {
  token?: {
    tokenType?: string;
    accessToken?: string;
    /** Lifetime in seconds. */
    expiresIn?: number;
  };
}

/** A Toast OAuth2 credential pair. Operational and Analytics use different ones. */
export interface ToastCredentials {
  clientId: string;
  clientSecret: string;
}

// Module-scoped caches keyed by clientId, so multiple credential sets
// (operational + analytics) coexist without evicting each other.
const cache = new Map<string, CachedToken>();
/** In-flight logins keyed by clientId, so concurrent callers share one request. */
const inFlight = new Map<string, Promise<string>>();

function isFresh(entry: CachedToken | undefined): entry is CachedToken {
  return !!entry && entry.expiresAt > Date.now();
}

/**
 * Return a valid Toast bearer access token, logging in (and caching) as needed.
 * Concurrent callers for the same credential set share a single login request.
 *
 * @param forceRefresh bypass the cache (e.g. after a 401) and re-authenticate.
 * @param creds which credential set to authenticate. Defaults to the base
 *   operational creds (`TOAST_CLIENT_ID/SECRET`); analytics callers pass
 *   `getToastAnalyticsCredentials()`.
 */
export async function getAccessToken(
  forceRefresh = false,
  creds?: ToastCredentials,
): Promise<string> {
  const { clientId, clientSecret } = creds ?? getToastConfig();

  if (!forceRefresh && isFresh(cache.get(clientId))) {
    return cache.get(clientId)!.accessToken;
  }

  // Coalesce concurrent logins for this clientId into one request.
  let pending = inFlight.get(clientId);
  if (!pending) {
    pending = login({ clientId, clientSecret }).finally(() => {
      inFlight.delete(clientId);
    });
    inFlight.set(clientId, pending);
  }
  return pending;
}

/** Drop all cached tokens. Useful in tests or after credential rotation. */
export function clearTokenCache(): void {
  cache.clear();
}

async function login(creds: ToastCredentials): Promise<string> {
  const { hostname } = getToastConfig();
  const { clientId, clientSecret } = creds;

  const res = await fetch(
    `${hostname}/authentication/v1/authentication/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        clientSecret,
        userAccessType: "TOAST_MACHINE_CLIENT",
      }),
    },
  );

  if (!res.ok) {
    // Never include the response body verbatim — it can echo request creds.
    throw new Error(
      `Toast authentication failed (HTTP ${res.status} ${res.statusText}). ` +
        `Verify TOAST_CLIENT_ID / TOAST_CLIENT_SECRET / TOAST_API_HOSTNAME.`,
    );
  }

  const data = (await res.json()) as ToastLoginResponse;
  const accessToken = data.token?.accessToken;
  const expiresIn = data.token?.expiresIn;

  if (!accessToken) {
    throw new Error("Toast authentication response did not include an access token.");
  }

  // Default to a conservative 5-minute life if Toast omits expiresIn.
  const lifetimeMs = (typeof expiresIn === "number" ? expiresIn : 300) * 1000;
  cache.set(clientId, {
    accessToken,
    expiresAt: Date.now() + Math.max(lifetimeMs - EXPIRY_SKEW_MS, 0),
  });

  return accessToken;
}
