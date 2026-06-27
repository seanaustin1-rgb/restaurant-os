import { prisma } from "@/lib/prisma";
import type { AuraIntentMetric, AuraIntentState } from "@/lib/modules/aura";
import {
  fetchGoogleBusinessProfilePerformance,
  GOOGLE_BUSINESS_PROFILE_SOURCE,
  isGoogleBusinessProfileConfigured,
  missingGoogleBusinessProfileEnv,
  type GoogleBusinessProfileMetric,
  type GoogleBusinessProfilePoint,
} from "@/lib/integrations/aura/providers/google-business-profile";

type IntentKey = "calls" | "directions" | "website" | "views";

interface IntentDefinition {
  key: IntentKey;
  label: string;
  metrics: GoogleBusinessProfileMetric[];
}

const INTENT_DEFINITIONS: IntentDefinition[] = [
  { key: "calls", label: "Phone calls", metrics: ["CALL_CLICKS"] },
  { key: "directions", label: "Direction requests", metrics: ["BUSINESS_DIRECTION_REQUESTS"] },
  { key: "website", label: "Website clicks", metrics: ["WEBSITE_CLICKS"] },
  {
    key: "views",
    label: "Profile views",
    metrics: [
      "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
      "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
      "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    ],
  },
];

const SNAPSHOT_DAYS = 30;

function isMissingIntentTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybePrisma = error as { code?: string; meta?: { table?: string }; message?: string };
  const table = maybePrisma.meta?.table ?? "";
  const message = maybePrisma.message ?? "";
  return (
    maybePrisma.code === "P2021" &&
    (table.includes("AuraIntentSnapshot") ||
      message.includes("AuraIntentSnapshot") ||
      message.includes("auraIntentSnapshot"))
  );
}

function utcDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

async function persistPoints(points: GoogleBusinessProfilePoint[]): Promise<void> {
  if (points.length === 0) return;
  try {
    await prisma.$transaction(
      points.map((point) =>
        prisma.auraIntentSnapshot.upsert({
          where: {
            source_metric_date: {
              source: GOOGLE_BUSINESS_PROFILE_SOURCE,
              metric: point.metric,
              date: utcDate(point.date),
            },
          },
          update: { value: Math.round(point.value) },
          create: {
            source: GOOGLE_BUSINESS_PROFILE_SOURCE,
            metric: point.metric,
            date: utcDate(point.date),
            value: Math.round(point.value),
          },
        }),
      ),
    );
  } catch (error) {
    if (isMissingIntentTableError(error)) return;
    throw error;
  }
}

async function loadStoredPoints(): Promise<GoogleBusinessProfilePoint[]> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - SNAPSHOT_DAYS);
  try {
    const rows = await prisma.auraIntentSnapshot.findMany({
      where: {
        source: GOOGLE_BUSINESS_PROFILE_SOURCE,
        date: { gte: start },
      },
      select: { metric: true, date: true, value: true },
    });
    return rows.map((row) => ({
      metric: row.metric as GoogleBusinessProfileMetric,
      date: row.date.toISOString().slice(0, 10),
      value: row.value,
    }));
  } catch (error) {
    if (isMissingIntentTableError(error)) return [];
    throw error;
  }
}

function rollup(points: GoogleBusinessProfilePoint[]): AuraIntentMetric[] {
  return INTENT_DEFINITIONS.map((definition) => {
    const value = points
      .filter((point) => definition.metrics.includes(point.metric))
      .reduce((sum, point) => sum + point.value, 0);
    return {
      key: definition.key,
      label: definition.label,
      state: "live" as AuraIntentState,
      value,
      detail: `Last ${SNAPSHOT_DAYS} days from Google Business Profile.`,
    };
  });
}

function configuredFallback(detail: string, state: AuraIntentState = "waiting_history"): AuraIntentMetric[] {
  return INTENT_DEFINITIONS.map((definition) => ({
    key: definition.key,
    label: definition.label,
    state,
    value: null,
    detail,
  }));
}

export async function syncAuraIntentSnapshots(days = SNAPSHOT_DAYS): Promise<{ points: number }> {
  const points = await fetchGoogleBusinessProfilePerformance(days);
  await persistPoints(points);
  return { points: points.length };
}

export async function loadAuraIntentMetrics(): Promise<AuraIntentMetric[]> {
  if (!isGoogleBusinessProfileConfigured()) {
    return configuredFallback(
      `Connect Google Business Profile performance data: ${missingGoogleBusinessProfileEnv().join(", ")}`,
      "not_configured",
    );
  }

  const stored = await loadStoredPoints();
  if (stored.length > 0) return rollup(stored);

  try {
    const live = await fetchGoogleBusinessProfilePerformance(SNAPSHOT_DAYS);
    await persistPoints(live);
    return rollup(live);
  } catch (error) {
    return configuredFallback(
      error instanceof Error ? error.message : "Google Business Profile performance sync failed.",
      "error",
    );
  }
}
