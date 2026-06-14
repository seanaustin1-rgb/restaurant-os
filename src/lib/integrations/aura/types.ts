import type { AuraSourceKey } from "./config";

// Shared shapes for the Aura reputation layer. Every source normalizes into a
// SourceSummary so the loader can aggregate Google / Yelp / Facebook uniformly.

export interface AuraReview {
  source: AuraSourceKey;
  author: string;
  rating: number | null; // 1–5; null when the source gives a recommendation, not a star
  text: string;
  /** ISO date string when available. */
  createdAt: string | null;
  /** Deep link to the review/source, when the API provides one. */
  url: string | null;
}

export interface AuraSourceSummary {
  source: AuraSourceKey;
  rating: number | null; // average star rating, 1–5
  reviewCount: number; // total ratings/reviews the source reports
  /** A few most-recent reviews (providers cap this small). */
  recent: AuraReview[];
  /** Public URL of the listing, when known. */
  profileUrl: string | null;
}

/** A source provider: fetches a normalized summary. Only called when configured. */
export interface AuraProvider {
  source: AuraSourceKey;
  fetchSummary(): Promise<AuraSourceSummary>;
}
