/**
 * Toast API client — a thin, typed fetch wrapper.
 *
 * Responsibilities:
 *   - attach the bearer token (via the cached auth module),
 *   - attach the `Toast-Restaurant-External-ID` header on every request,
 *   - transparently re-authenticate once on a 401,
 *   - surface non-2xx responses as a typed `ToastApiError`.
 *
 * It deliberately knows nothing about specific Toast endpoints (orders, labor,
 * menus). Those data layers are built later, on top of `toastFetch` — keeping
 * this scaffolding small and stable per the handoff's "scaffold only" scope.
 */

import { getAccessToken } from "./auth";
import { getToastConfig } from "./config";

export class ToastApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly path: string;
  readonly body: string;

  constructor(args: {
    status: number;
    statusText: string;
    path: string;
    body: string;
  }) {
    super(`Toast API ${args.status} ${args.statusText} on ${args.path}`);
    this.name = "ToastApiError";
    this.status = args.status;
    this.statusText = args.statusText;
    this.path = args.path;
    this.body = args.body;
  }
}

export interface ToastRequestOptions {
  /** HTTP method. Defaults to GET. */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Query parameters; undefined/null values are skipped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** JSON request body (will be stringified). */
  body?: unknown;
  /** Extra headers, merged over the defaults. */
  headers?: Record<string, string>;
  /** Override the restaurant GUID for this call (defaults to the configured one). */
  restaurantGuid?: string;
  /** Optional AbortSignal for cancellation/timeouts. */
  signal?: AbortSignal;
}

/**
 * Perform an authenticated request against the Toast API and parse the JSON
 * response. `path` is relative to the configured hostname and should start with
 * "/", e.g. `/labor/v1/timeEntries`.
 *
 * Retries exactly once on a 401 with a forced token refresh, to ride out a
 * token that expired between the freshness check and the request landing.
 */
export async function toastFetch<T = unknown>(
  path: string,
  options: ToastRequestOptions = {},
): Promise<T> {
  const res = await rawToastFetch(path, options);

  if (res.status === 401) {
    // Token may have expired server-side; refresh once and retry.
    const retry = await rawToastFetch(path, options, /* forceRefresh */ true);
    return parse<T>(retry, path);
  }

  return parse<T>(res, path);
}

async function rawToastFetch(
  path: string,
  options: ToastRequestOptions,
  forceRefresh = false,
): Promise<Response> {
  const { hostname, restaurantGuid: defaultGuid } = getToastConfig();
  const token = await getAccessToken(forceRefresh);

  const url = new URL(`${hostname}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Toast-Restaurant-External-ID": options.restaurantGuid ?? defaultGuid,
    Accept: "application/json",
    ...options.headers,
  };

  let body: string | undefined;
  if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
    signal: options.signal,
  });
}

async function parse<T>(res: Response, path: string): Promise<T> {
  const text = await res.text();

  if (!res.ok) {
    throw new ToastApiError({
      status: res.status,
      statusText: res.statusText,
      path,
      body: text.slice(0, 2000),
    });
  }

  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
