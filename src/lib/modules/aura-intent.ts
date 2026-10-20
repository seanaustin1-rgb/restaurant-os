import { prisma } from "@/lib/prisma";
import {
  auraSnapshotTenantWhere,
  envAuraOwnerRestaurantId,
  isEnvAuraOwner,
  preferTenantScopedRows,
} from "@/lib/modules/aura-owner";
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
  const maybePrisma = error as { code?: string; meta?: { table?: string; column?: string }; message?: string };
  // P2022 (missing column) names the column in meta.column / the message rather
  // than meta.table; a missing `restaurantId` column means the tenant-scope
  // migration hasn't been applied yet.
  const table = `${maybePrisma.meta?.table ?? ""} ${maybePrisma.meta?.column ?? ""}`;
  const message = maybePrisma.message ?? "";
  return (
    // P2021 = table missing; P2022 = column missing (tenant-scope migration not
    // applied yet). Either way: fail closed — read nothing, write nothing.
    (maybePrisma.code === "P2021" || maybePrisma.code === "P2022") &&
    (table.includes("AuraIntentSnapshot") ||
      message.includes("AuraIntentSnapshot") ||
      (maybePrisma.code === "P2022" && (table.includes("restaurantId") || message.includes("restaurantId"))) ||
      message.includes("auraIntentSnapshot"))
  );
}

function utcDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

async function persistPoints(restaurantId: string, points: GoogleBusinessProfilePoint[]): Promise<void> {
  if (points.length === 0) return;
  try {
    await prisma.$transaction(
      points.map((point) =>
        prisma.auraIntentSnapshot.upsert({
          where: {
            restaurantId_source_metric_date: {
              restaurantId,
              source: GOOGLE_BUSINESS_PROFILE_SOURCE,
              metric: point.metric,
              date: utcDate(point.date),
            },
          },
          update: { value: Math.round(point.value) },
          create: {
            restaurantId,
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

async function loadStoredPoints(restaurantId: string, isOwner: boolean): Promise<GoogleBusinessProfilePoint[]> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - SNAPSHOT_DAYS);
  try {
    const rows = await prisma.auraIntentSnapshot.findMany({
      where: {
        ...auraSnapshotTenantWhere(restaurantId, isOwner),
        source: GOOGLE_BUSINESS_PROFILE_SOURCE,
        date: { gte: start },
      },
      select: { restaurantId: true, metric: true, date: true, value: true },
    });
    // Owner may have a legacy NULL row AND a scoped row for the same day.
    return preferTenantScopedRows(rows, (row) => `${row.metric}|${row.date.toISOString().slice(0, 10)}`).map((row) => ({
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

/**
 * Daily cron: snapshot GBP performance for every tenant that has its own active
 * GBP connection, plus the env Aura owner (env-configured fallback). Each
 * tenant's points are written under its own restaurantId. One tenant's failure
 * doesn't block the others.
 */
export async function syncAuraIntentSnapshots(days = SNAPSHOT_DAYS): Promise<{ points: number; tenants: number; failed: number }> {
  const owner = await envAuraOwnerRestaurantId();
  const connected = await prisma.integrationConnection.findMany({
    where: {
      provider: "GOOGLE_BUSINESS_PROFILE",
      isActive: true,
      externalLocationId: { notIn: ["pending", "unselected"] },
    },
    select: { restaurantId: true },
    distinct: ["restaurantId"],
  });
  const tenants = new Set(connected.map((c) => c.restaurantId));
  if (owner && isGoogleBusinessProfileConfigured()) tenants.add(owner);

  let points = 0;
  let failed = 0;
  for (const restaurantId of tenants) {
    try {
      const fetched = await fetchGoogleBusinessProfilePerformance(days, restaurantId, {
        allowEnvFallback: isEnvAuraOwner(restaurantId, owner),
      });
      await persistPoints(restaurantId, fetched);
      points += fetched.length;
    } catch {
      failed += 1;
    }
  }
  return { points, tenants: tenants.size, failed };
}

export async function loadAuraIntentMetrics(restaurantId?: string | null): Promise<AuraIntentMetric[]> {
  if (!restaurantId) {
    return configuredFallback("Connect Google Business Profile to see calls, directions and profile views.", "not_configured");
  }
  const owner = await envAuraOwnerRestaurantId();
  const isOwner = isEnvAuraOwner(restaurantId, owner);

  const hasOwnConnection =
    (await prisma.integrationConnection.count({
      where: {
        restaurantId,
        provider: "GOOGLE_BUSINESS_PROFILE",
        isActive: true,
        externalLocationId: { notIn: ["pending", "unselected"] },
      },
    })) > 0;
  if (!hasOwnConnection && !(isOwner && isGoogleBusinessProfileConfigured())) {
    return configuredFallback(
      isOwner
        ? `Connect Google Business Profile performance data: ${missingGoogleBusinessProfileEnv().join(", ")}`
        : "Connect Google Business Profile to see calls, directions and profile views.",
      "not_configured",
    );
  }

  const stored = await loadStoredPoints(restaurantId, isOwner);
  if (stored.length > 0) return rollup(stored);

  try {
    const live = await fetchGoogleBusinessProfilePerformance(SNAPSHOT_DAYS, restaurantId, { allowEnvFallback: isOwner });
    await persistPoints(restaurantId, live);
    return rollup(live);
  } catch (error) {
    return configuredFallback(
      error instanceof Error ? error.message : "Google Business Profile performance sync failed.",
      "error",
    );
  }
}
