import {
  AURA_PROVIDERS,
  AURA_SOURCES,
  AURA_SOURCE_LABEL,
  configuredAuraSources,
  isAuraSourceConfigured,
  missingAuraEnvVars,
  type AuraSourceKey,
} from "@/lib/integrations/aura";
import type { AuraReview, AuraSourceSummary } from "@/lib/integrations/aura";
import type { HealthStatus } from "@/lib/profit-first/calculator";
import { loadAuraIntentMetrics } from "@/lib/modules/aura-intent";

// Aura (Reputation) module loader. Fans out to every CONFIGURED review source,
// fetches each summary independently (one bad/un-wired source never sinks the
// tile), and aggregates into one reputation read: a count-weighted overall star
// rating, total reviews, a merged recent-reviews feed, and a per-source status
// row so the UI can show "live", "connect me", or "error" honestly.

export type AuraSourceState = "live" | "not_configured" | "error";

export interface AuraSourceCard {
  source: AuraSourceKey;
  label: string;
  state: AuraSourceState;
  rating: number | null;
  reviewCount: number;
  profileUrl: string | null;
  /** For not_configured: which env vars to set. For error: the message. */
  detail: string | null;
}

export interface AuraData {
  configuredCount: number;
  totalSources: number;
  overallRating: number | null; // count-weighted across live sources
  totalReviews: number;
  health: HealthStatus;
  sources: AuraSourceCard[]; // every source, in canonical order
  intentMetrics: AuraIntentMetric[]; // customer-intent placeholders (calls, directions, clicks)
  recent: AuraReview[]; // merged, newest first, capped
  hasAnyData: boolean; // at least one live source returned a rating/reviews
}

export type AuraIntentState = "live" | "not_configured" | "waiting_history" | "error";

export interface AuraIntentMetric {
  key: string;
  label: string;
  state: AuraIntentState;
  value: number | null;
  detail: string;
}

// Reputation bands (stars). Hospitality lives and dies above ~4.5; below 4.0 is a
// real problem. Higher is better → its own lens, not budget-usage.
const RATING_GREAT = 4.5;
const RATING_OK = 4.0;
function bandRating(rating: number | null): HealthStatus {
  if (rating == null) return "yellow";
  if (rating >= RATING_GREAT) return "green";
  if (rating >= RATING_OK) return "yellow";
  return "red";
}

const RECENT_CAP = 8;

export async function loadAura(): Promise<AuraData> {
  const configured = configuredAuraSources();
  const intentMetricsPromise = loadAuraIntentMetrics();

  // Fetch every configured source in parallel; capture failures per source.
  const summaries = new Map<AuraSourceKey, AuraSourceSummary>();
  const errors = new Map<AuraSourceKey, string>();
  await Promise.all(
    configured.map(async (source) => {
      try {
        summaries.set(source, await AURA_PROVIDERS[source].fetchSummary());
      } catch (e) {
        errors.set(source, e instanceof Error ? e.message : String(e));
      }
    }),
  );

  const sources: AuraSourceCard[] = AURA_SOURCES.map((source) => {
    const label = AURA_SOURCE_LABEL[source];
    if (!isAuraSourceConfigured(source)) {
      return {
        source,
        label,
        state: "not_configured",
        rating: null,
        reviewCount: 0,
        profileUrl: null,
        detail: `Set ${missingAuraEnvVars(source).join(", ")}`,
      };
    }
    const err = errors.get(source);
    if (err) {
      return { source, label, state: "error", rating: null, reviewCount: 0, profileUrl: null, detail: err };
    }
    const s = summaries.get(source)!;
    return {
      source,
      label,
      state: "live",
      rating: s.rating,
      reviewCount: s.reviewCount,
      profileUrl: s.profileUrl,
      detail: null,
    };
  });

  // Count-weighted overall rating across live sources that reported a rating.
  let weightedSum = 0;
  let weight = 0;
  let totalReviews = 0;
  for (const s of summaries.values()) {
    totalReviews += s.reviewCount;
    if (s.rating != null && s.reviewCount > 0) {
      weightedSum += s.rating * s.reviewCount;
      weight += s.reviewCount;
    }
  }
  const overallRating = weight > 0 ? weightedSum / weight : null;

  // Merge recent reviews newest-first.
  const recent = [...summaries.values()]
    .flatMap((s) => s.recent)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, RECENT_CAP);

  return {
    configuredCount: configured.length,
    totalSources: AURA_SOURCES.length,
    overallRating,
    totalReviews,
    health: bandRating(overallRating),
    sources,
    intentMetrics: await intentMetricsPromise,
    recent,
    hasAnyData: weight > 0 || recent.length > 0,
  };
}
