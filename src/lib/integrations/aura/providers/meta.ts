import { getAuraSourceEnv } from "../config";
import type { AuraProvider, AuraReview, AuraSourceSummary } from "../types";

// Meta Graph — Facebook Page ratings/recommendations. `overall_star_rating` +
// `rating_count` give the aggregate; the `ratings` edge gives recent entries.
// Facebook moved from star ratings to yes/no recommendations, so a rating can be
// null with `recommendation_type` "positive"/"negative" instead — we map a
// positive recommendation to 5 and negative to 1 so it still rolls into a score,
// and keep the raw text. Gated by config.

const GRAPH_BASE = "https://graph.facebook.com/v19.0";
const REVALIDATE_SECONDS = 3600;

interface FbRating {
  created_time?: string;
  rating?: number | null;
  review_text?: string;
  recommendation_type?: "positive" | "negative";
  reviewer?: { name?: string };
}
interface FbPageResponse {
  overall_star_rating?: number;
  rating_count?: number;
  ratings?: { data?: FbRating[] };
  link?: string;
  error?: { message?: string };
}

function recommendationToStars(r: FbRating): number | null {
  if (typeof r.rating === "number") return r.rating;
  if (r.recommendation_type === "positive") return 5;
  if (r.recommendation_type === "negative") return 1;
  return null;
}

export const metaProvider: AuraProvider = {
  source: "facebook",
  async fetchSummary(): Promise<AuraSourceSummary> {
    const env = getAuraSourceEnv("facebook");
    const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(env.FACEBOOK_PAGE_ID)}`);
    url.searchParams.set(
      "fields",
      "overall_star_rating,rating_count,link,ratings.limit(5){created_time,rating,review_text,recommendation_type,reviewer}",
    );
    url.searchParams.set("access_token", env.META_GRAPH_TOKEN);

    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    const data = (await res.json()) as FbPageResponse;
    if (!res.ok || data.error) {
      throw new Error(`Meta Graph ${res.status}${data.error?.message ? `: ${data.error.message}` : ""}`);
    }

    const recent: AuraReview[] = (data.ratings?.data ?? []).map((rt) => ({
      source: "facebook",
      author: rt.reviewer?.name ?? "Facebook user",
      rating: recommendationToStars(rt),
      text: rt.review_text ?? "",
      createdAt: rt.created_time ? new Date(rt.created_time).toISOString() : null,
      url: data.link ?? null,
    }));

    return {
      source: "facebook",
      rating: typeof data.overall_star_rating === "number" ? data.overall_star_rating : null,
      reviewCount: data.rating_count ?? 0,
      recent,
      profileUrl: data.link ?? null,
    };
  },
};
