import { prisma } from "@/lib/prisma";
import { loadAura } from "@/lib/modules/aura";
import { auraSnapshotTenantWhere, envAuraOwnerRestaurantId, isEnvAuraOwner } from "@/lib/modules/aura-owner";

// Aura "trending" read. Google/Yelp only return the CURRENT aggregate rating, so
// a recent-weeks trend must come from points we persist over time
// (ReputationSnapshot, written weekly by the snapshot cron). This computes the
// headline trend from the synthetic "overall" series: latest rating vs. the
// snapshot closest to `windowWeeks` ago, plus review velocity. Until ~2 weeks of
// history exist it reports "gathering" so the UI never implies a trend it can't back.

export interface ReputationTrend {
  state: "gathering" | "ready";
  weeksTracked: number; // span of available history (weeks), 1-decimal
  windowWeeks: number; // target comparison window
  delta: number | null; // latestRating − baselineRating
  direction: "up" | "down" | "flat";
  reviewsPerWeek: number | null; // review-count velocity over the span
  baselineRating: number | null;
  latestRating: number | null;
  latestAt: string | null;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FLAT_THRESHOLD = 0.05; // star change within ±0.05 reads as flat
const MIN_SPAN_WEEKS = 2; // need at least ~2 weeks before showing a trend

function isMissingSnapshotTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybePrisma = error as { code?: string; meta?: { table?: string; column?: string }; message?: string };
  // P2022 (missing column) names the column in meta.column / the message rather
  // than meta.table; a missing `restaurantId` column means the tenant-scope
  // migration hasn't been applied yet.
  const table = `${maybePrisma.meta?.table ?? ""} ${maybePrisma.meta?.column ?? ""}`;
  const message = maybePrisma.message ?? "";
  return (
    // P2021 = table missing; P2022 = column missing (tenant-scope migration not
    // applied yet). Fail closed either way.
    (maybePrisma.code === "P2021" || maybePrisma.code === "P2022") &&
    (table.includes("ReputationSnapshot") ||
      message.includes("ReputationSnapshot") ||
      (maybePrisma.code === "P2022" && (table.includes("restaurantId") || message.includes("restaurantId"))) ||
      message.includes("reputationSnapshot"))
  );
}

/**
 * Persist a reputation snapshot for every live source plus a count-weighted
 * "overall" row. Returns the number of rows written. Called by the weekly cron.
 */
export async function snapshotReputation(): Promise<number> {
  // Review sources are env-configured for the env Aura owner only, so that is
  // the only tenant with a reputation series to snapshot.
  const owner = await envAuraOwnerRestaurantId();
  if (!owner) return 0;
  const data = await loadAura(owner);
  const rows: { source: string; rating: number | null; reviewCount: number }[] = [];
  for (const card of data.sources) {
    if (card.state === "live") rows.push({ source: card.source, rating: card.rating, reviewCount: card.reviewCount });
  }
  if (data.overallRating != null) {
    rows.push({ source: "overall", rating: data.overallRating, reviewCount: data.totalReviews });
  }
  if (rows.length === 0) return 0;
  try {
    await prisma.reputationSnapshot.createMany({ data: rows.map((r) => ({ ...r, restaurantId: owner })) });
  } catch (error) {
    if (isMissingSnapshotTableError(error)) return 0;
    throw error;
  }
  return rows.length;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function loadReputationTrend(
  restaurantId: string | null | undefined,
  windowWeeks = 6,
): Promise<ReputationTrend> {
  let snaps: { rating: number | null; reviewCount: number; capturedAt: Date }[] = [];
  try {
    if (restaurantId) {
      const isOwner = isEnvAuraOwner(restaurantId, await envAuraOwnerRestaurantId());
      snaps = await prisma.reputationSnapshot.findMany({
        where: { ...auraSnapshotTenantWhere(restaurantId, isOwner), source: "overall" },
        orderBy: { capturedAt: "desc" },
        take: 60,
        select: { rating: true, reviewCount: true, capturedAt: true },
      });
    }
  } catch (error) {
    if (isMissingSnapshotTableError(error)) snaps = [];
    else throw error;
  }

  const base: ReputationTrend = {
    state: "gathering",
    weeksTracked: 0,
    windowWeeks,
    delta: null,
    direction: "flat",
    reviewsPerWeek: null,
    baselineRating: null,
    latestRating: snaps[0]?.rating ?? null,
    latestAt: snaps[0]?.capturedAt.toISOString() ?? null,
  };
  if (snaps.length < 2) return base;

  const latest = snaps[0];
  // Baseline = newest snapshot at least `windowWeeks` old; else the oldest we have.
  const target = latest.capturedAt.getTime() - windowWeeks * WEEK_MS;
  let baseline = snaps[snaps.length - 1];
  for (const s of snaps) {
    if (s.capturedAt.getTime() <= target) {
      baseline = s;
      break;
    }
  }

  const spanWeeks = (latest.capturedAt.getTime() - baseline.capturedAt.getTime()) / WEEK_MS;
  if (spanWeeks < MIN_SPAN_WEEKS || latest.rating == null || baseline.rating == null) {
    return { ...base, weeksTracked: round1(spanWeeks) };
  }

  const delta = latest.rating - baseline.rating;
  const direction = delta > FLAT_THRESHOLD ? "up" : delta < -FLAT_THRESHOLD ? "down" : "flat";

  return {
    state: "ready",
    weeksTracked: round1(spanWeeks),
    windowWeeks,
    delta,
    direction,
    reviewsPerWeek: spanWeeks > 0 ? (latest.reviewCount - baseline.reviewCount) / spanWeeks : null,
    baselineRating: baseline.rating,
    latestRating: latest.rating,
    latestAt: latest.capturedAt.toISOString(),
  };
}
