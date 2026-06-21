import { prisma } from "@/lib/prisma";
import { loadAura } from "@/lib/modules/aura";

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

/**
 * Persist a reputation snapshot for every live source plus a count-weighted
 * "overall" row. Returns the number of rows written. Called by the weekly cron.
 */
export async function snapshotReputation(): Promise<number> {
  const data = await loadAura();
  const rows: { source: string; rating: number | null; reviewCount: number }[] = [];
  for (const card of data.sources) {
    if (card.state === "live") rows.push({ source: card.source, rating: card.rating, reviewCount: card.reviewCount });
  }
  if (data.overallRating != null) {
    rows.push({ source: "overall", rating: data.overallRating, reviewCount: data.totalReviews });
  }
  if (rows.length === 0) return 0;
  await prisma.reputationSnapshot.createMany({ data: rows });
  return rows.length;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function loadReputationTrend(windowWeeks = 6): Promise<ReputationTrend> {
  const snaps = await prisma.reputationSnapshot.findMany({
    where: { source: "overall" },
    orderBy: { capturedAt: "desc" },
    take: 60,
    select: { rating: true, reviewCount: true, capturedAt: true },
  });

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
