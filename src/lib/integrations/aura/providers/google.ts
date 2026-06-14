import { getAuraSourceEnv } from "../config";
import type { AuraProvider, AuraReview, AuraSourceSummary } from "../types";

// Google Places — Place Details (legacy JSON endpoint; stable and simple). Pulls
// the aggregate rating, total rating count, and the most-recent reviews Google
// exposes (it caps at ~5). Gated by config: only invoked when both env vars are
// set, so it never runs or throws at import time.

const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";
const REVALIDATE_SECONDS = 3600; // reputation moves slowly; cache hourly

interface GoogleReview {
  author_name?: string;
  rating?: number;
  text?: string;
  time?: number; // unix seconds
  author_url?: string;
}
interface GoogleDetailsResult {
  rating?: number;
  user_ratings_total?: number;
  reviews?: GoogleReview[];
  url?: string;
}
interface GoogleDetailsResponse {
  status: string;
  error_message?: string;
  result?: GoogleDetailsResult;
}

export const googleProvider: AuraProvider = {
  source: "google",
  async fetchSummary(): Promise<AuraSourceSummary> {
    const env = getAuraSourceEnv("google");
    const url = new URL(DETAILS_URL);
    url.searchParams.set("place_id", env.GOOGLE_PLACE_ID);
    url.searchParams.set("fields", "rating,user_ratings_total,reviews,url");
    url.searchParams.set("key", env.GOOGLE_PLACES_API_KEY);

    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`);
    const data = (await res.json()) as GoogleDetailsResponse;
    if (data.status !== "OK") {
      throw new Error(`Google Places status ${data.status}${data.error_message ? `: ${data.error_message}` : ""}`);
    }
    const r = data.result ?? {};
    const recent: AuraReview[] = (r.reviews ?? []).slice(0, 5).map((rv) => ({
      source: "google",
      author: rv.author_name ?? "Google user",
      rating: typeof rv.rating === "number" ? rv.rating : null,
      text: rv.text ?? "",
      createdAt: rv.time ? new Date(rv.time * 1000).toISOString() : null,
      url: rv.author_url ?? null,
    }));

    return {
      source: "google",
      rating: typeof r.rating === "number" ? r.rating : null,
      reviewCount: r.user_ratings_total ?? 0,
      recent,
      profileUrl: r.url ?? null,
    };
  },
};
