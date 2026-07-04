export type FollowUpBossEndpoint = "people" | "deals" | "users";

export interface FollowUpBossCredentials {
  apiKey: string;
  system?: string | null;
  systemKey?: string | null;
  baseUrl?: string;
}

export interface FollowUpBossPageOptions {
  limit?: number;
  offset?: number;
  fields?: string[];
}

export interface FollowUpBossPage<T> {
  rows: T[];
  total: number | null;
  raw: unknown;
}

export class FollowUpBossApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`Follow Up Boss API request failed with ${status}`);
    this.name = "FollowUpBossApiError";
    this.status = status;
    this.body = body;
  }
}

type FetchLike = typeof fetch;

const DEFAULT_BASE_URL = "https://api.followupboss.com";
const ENDPOINT_PATHS: Record<FollowUpBossEndpoint, string> = {
  people: "/v1/people",
  deals: "/v1/deals",
  users: "/v1/users",
};

export function followUpBossAuthHeader(apiKey: string): string {
  const key = apiKey.trim();
  if (!key) throw new Error("Follow Up Boss API key is required");
  return `Basic ${Buffer.from(`${key}:`, "utf8").toString("base64")}`;
}

export async function followUpBossRequest<T = unknown>(
  credentials: FollowUpBossCredentials,
  path: string,
  query: Record<string, string | number | boolean | undefined> = {},
  fetchImpl: FetchLike = fetch,
): Promise<T> {
  const baseUrl = (credentials.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {
    accept: "application/json",
    authorization: followUpBossAuthHeader(credentials.apiKey),
  };
  if (credentials.system) headers["X-System"] = credentials.system;
  if (credentials.systemKey) headers["X-System-Key"] = credentials.systemKey;

  const response = await fetchImpl(url, { method: "GET", headers });
  if (!response.ok) {
    throw new FollowUpBossApiError(response.status, await response.text());
  }

  return (await response.json()) as T;
}

export async function listFollowUpBossPage<T = unknown>(
  credentials: FollowUpBossCredentials,
  endpoint: FollowUpBossEndpoint,
  options: FollowUpBossPageOptions = {},
  fetchImpl: FetchLike = fetch,
): Promise<FollowUpBossPage<T>> {
  const limit = clampPageLimit(options.limit);
  const raw = await followUpBossRequest(
    credentials,
    ENDPOINT_PATHS[endpoint],
    {
      limit,
      offset: Math.max(0, options.offset ?? 0),
      fields: options.fields?.filter(Boolean).join(",") || undefined,
    },
    fetchImpl,
  );

  return {
    rows: rowsFromResponse<T>(endpoint, raw),
    total: totalFromResponse(raw),
    raw,
  };
}

export async function listAllFollowUpBoss<T = unknown>(
  credentials: FollowUpBossCredentials,
  endpoint: FollowUpBossEndpoint,
  options: Omit<FollowUpBossPageOptions, "offset"> = {},
  fetchImpl: FetchLike = fetch,
): Promise<T[]> {
  const limit = clampPageLimit(options.limit);
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const page = await listFollowUpBossPage<T>(credentials, endpoint, { ...options, limit, offset }, fetchImpl);
    rows.push(...page.rows);

    offset += page.rows.length;
    if (page.rows.length < limit) break;
    if (page.total !== null && offset >= page.total) break;
  }

  return rows;
}

function clampPageLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 100;
  return Math.max(1, Math.min(100, Math.trunc(limit ?? 100)));
}

function rowsFromResponse<T>(endpoint: FollowUpBossEndpoint, value: unknown): T[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const primaryKey = endpoint;

  if (Array.isArray(record[primaryKey])) return record[primaryKey] as T[];
  if (Array.isArray(record.data)) return record.data as T[];
  return [];
}

function totalFromResponse(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const metadata = (record._metadata ?? record.metadata) as Record<string, unknown> | undefined;
  const rawTotal = metadata?.total ?? record.total;
  const total = typeof rawTotal === "number" ? rawTotal : Number(rawTotal);
  return Number.isFinite(total) ? total : null;
}
