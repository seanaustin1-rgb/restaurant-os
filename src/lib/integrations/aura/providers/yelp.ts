import { getAuraSourceEnv } from "../config";
import type { AuraProvider, AuraReview, AuraSourceSummary } from "../types";

// Yelp Fusion — business endpoint for rating + review_count, and the reviews
// endpoint for up to 3 review excerpts (all Fusion exposes). Bearer-auth with
// the API key. Gated by config.

const API_BASE = "https://api.yelp.com/v3/businesses";
const REVALIDATE_SECONDS = 3600;

interface YelpBusiness {
  rating?: number;
  review_count?: number;
  url?: string;
}
interface YelpReview {
  text?: string;
  rating?: number;
  time_created?: string; // "YYYY-MM-DD HH:mm:ss"
  url?: string;
  user?: { name?: string };
}
interface YelpReviewsResponse {
  reviews?: YelpReview[];
}

export const yelpProvider: AuraProvider = {
  source: "yelp",
  async fetchSummary(): Promise<AuraSourceSummary> {
    const env = getAuraSourceEnv("yelp");
    const id = encodeURIComponent(env.YELP_BUSINESS_ID);
    const headers = { Authorization: `Bearer ${env.YELP_API_KEY}`, Accept: "application/json" };
    const opts = { headers, next: { revalidate: REVALIDATE_SECONDS } } as const;

    const [bizRes, revRes] = await Promise.all([
      fetch(`${API_BASE}/${id}`, opts),
      fetch(`${API_BASE}/${id}/reviews?limit=3&sort_by=newest`, opts),
    ]);
    if (!bizRes.ok) throw new Error(`Yelp business HTTP ${bizRes.status}`);
    const biz = (await bizRes.json()) as YelpBusiness;

    // Reviews are a best-effort extra — don't fail the whole source if they 4xx.
    let recent: AuraReview[] = [];
    if (revRes.ok) {
      const rev = (await revRes.json()) as YelpReviewsResponse;
      recent = (rev.reviews ?? []).map((rv) => ({
        source: "yelp",
        author: rv.user?.name ?? "Yelp user",
        rating: typeof rv.rating === "number" ? rv.rating : null,
        text: rv.text ?? "",
        createdAt: rv.time_created ? new Date(rv.time_created.replace(" ", "T") + "Z").toISOString() : null,
        url: rv.url ?? null,
      }));
    }

    return {
      source: "yelp",
      rating: typeof biz.rating === "number" ? biz.rating : null,
      reviewCount: biz.review_count ?? 0,
      recent,
      profileUrl: biz.url ?? null,
    };
  },
};
