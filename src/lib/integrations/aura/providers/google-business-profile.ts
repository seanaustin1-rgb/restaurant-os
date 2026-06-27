import { accessTokenForGoogleBusinessProfile } from "@/lib/integrations/google-business-profile/oauth";
import { prisma } from "@/lib/prisma";

export const GOOGLE_BUSINESS_PROFILE_ENV = [
  "GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID",
  "GOOGLE_BUSINESS_PROFILE_LOCATION_ID",
  "GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN",
] as const;

export const GOOGLE_BUSINESS_PROFILE_REFRESH_ENV = [
  "GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID",
  "GOOGLE_BUSINESS_PROFILE_LOCATION_ID",
  "GOOGLE_BUSINESS_PROFILE_CLIENT_ID",
  "GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET",
  "GOOGLE_BUSINESS_PROFILE_REFRESH_TOKEN",
] as const;

export const GOOGLE_BUSINESS_PROFILE_SOURCE = "google_business_profile";

export type GoogleBusinessProfileMetric =
  | "CALL_CLICKS"
  | "WEBSITE_CLICKS"
  | "BUSINESS_DIRECTION_REQUESTS"
  | "BUSINESS_IMPRESSIONS_DESKTOP_MAPS"
  | "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH"
  | "BUSINESS_IMPRESSIONS_MOBILE_MAPS"
  | "BUSINESS_IMPRESSIONS_MOBILE_SEARCH";

export interface GoogleBusinessProfilePoint {
  metric: GoogleBusinessProfileMetric;
  date: string;
  value: number;
}

interface GoogleDate {
  year?: number;
  month?: number;
  day?: number;
}

interface GoogleDatedValue {
  date?: GoogleDate;
  value?: string;
}

interface GoogleDailyMetricTimeSeries {
  dailyMetric?: GoogleBusinessProfileMetric;
  timeSeries?: { datedValues?: GoogleDatedValue[] };
}

interface GoogleMultiDailyMetricTimeSeries {
  dailyMetricTimeSeries?: GoogleDailyMetricTimeSeries[];
}

interface GooglePerformanceResponse {
  multiDailyMetricTimeSeries?: GoogleMultiDailyMetricTimeSeries[];
  error?: { message?: string; status?: string };
}

const PERFORMANCE_URL = "https://businessprofileperformance.googleapis.com/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function missingGoogleBusinessProfileEnv(): string[] {
  const missingRefresh = GOOGLE_BUSINESS_PROFILE_REFRESH_ENV.filter((name) => !process.env[name]?.trim());
  if (missingRefresh.length === 0) return [];
  return GOOGLE_BUSINESS_PROFILE_ENV.filter((name) => !process.env[name]?.trim());
}

export function isGoogleBusinessProfileConfigured(): boolean {
  return missingGoogleBusinessProfileEnv().length === 0;
}

async function getGoogleBusinessProfileAccessToken(restaurantId?: string | null): Promise<string> {
  if (restaurantId) return accessTokenForGoogleBusinessProfile(restaurantId);

  const clientId = process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_BUSINESS_PROFILE_REFRESH_TOKEN?.trim();
  if (clientId && clientSecret && refreshToken) {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
    if (!res.ok || !data.access_token) {
      throw new Error(data.error_description ?? data.error ?? `Google OAuth token refresh HTTP ${res.status}`);
    }
    return data.access_token;
  }

  const accessToken = process.env.GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN?.trim();
  if (!accessToken) throw new Error("Google Business Profile access token is missing.");
  return accessToken;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDateParams(url: URL, prefix: string, date: Date) {
  url.searchParams.set(`${prefix}.year`, String(date.getUTCFullYear()));
  url.searchParams.set(`${prefix}.month`, String(date.getUTCMonth() + 1));
  url.searchParams.set(`${prefix}.day`, String(date.getUTCDate()));
}

function googleDateToIso(date: GoogleDate | undefined): string | null {
  if (!date?.year || !date.month || !date.day) return null;
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export async function fetchGoogleBusinessProfilePerformance(days = 30, restaurantId?: string | null): Promise<GoogleBusinessProfilePoint[]> {
  const missing = missingGoogleBusinessProfileEnv();
  if (!restaurantId && missing.length > 0) {
    throw new Error(`Google Business Profile is not configured: ${missing.join(", ")}`);
  }

  const locationId = process.env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID?.trim() ?? "";
  const accessToken = await getGoogleBusinessProfileAccessToken(restaurantId);
  let resolvedLocationId = locationId;
  if (restaurantId) {
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        restaurantId,
        provider: "GOOGLE_BUSINESS_PROFILE",
        isActive: true,
        externalLocationId: { notIn: ["pending", "unselected"] },
      },
      orderBy: { updatedAt: "desc" },
      select: { externalLocationId: true },
    });
    resolvedLocationId = connection?.externalLocationId ?? locationId;
  }
  if (!resolvedLocationId) throw new Error("Google Business Profile location is missing.");
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(1, days - 1));

  const metrics: GoogleBusinessProfileMetric[] = [
    "CALL_CLICKS",
    "WEBSITE_CLICKS",
    "BUSINESS_DIRECTION_REQUESTS",
    "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  ];

  const url = new URL(`${PERFORMANCE_URL}/locations/${encodeURIComponent(resolvedLocationId)}:fetchMultiDailyMetricsTimeSeries`);
  for (const metric of metrics) url.searchParams.append("dailyMetrics", metric);
  addDateParams(url, "dailyRange.startDate", start);
  addDateParams(url, "dailyRange.endDate", end);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json().catch(() => ({}))) as GooglePerformanceResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Google Business Profile Performance HTTP ${res.status}`);
  }

  const points: GoogleBusinessProfilePoint[] = [];
  for (const group of data.multiDailyMetricTimeSeries ?? []) {
    for (const series of group.dailyMetricTimeSeries ?? []) {
      if (!series.dailyMetric) continue;
      for (const point of series.timeSeries?.datedValues ?? []) {
        const date = googleDateToIso(point.date);
        if (!date) continue;
        points.push({
          metric: series.dailyMetric,
          date,
          value: point.value == null ? 0 : Number(point.value),
        });
      }
    }
  }

  // Google omits zero-value points, so preserve a useful no-data result rather
  // than assuming the fetch failed.
  if (points.length === 0) {
    return metrics.map((metric) => ({ metric, date: isoDate(end), value: 0 }));
  }
  return points;
}
