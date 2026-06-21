"use server";

// Best-effort reputation lookup for the public Instant-Estimate demo.
//
// Resolves a prospect's restaurant by name + city via Google Places Text Search
// (one call — it returns rating & total directly) so the Aura tile can show
// their REAL stars. This is the "that's MY restaurant" hook.
//
// Deliberately fail-soft: if the API key isn't set, no match is found, or the
// request errors, it returns { found: false } and the UI shows the Aura tile in
// a graceful "we'll pull this once you connect" state. It never throws into the
// page, and it never blocks the (purely client-side) financial estimate.

const TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";

export interface ReputationResult {
  found: boolean;
  rating: number | null;
  reviewCount: number;
  matchedName: string | null;
  matchedAddress: string | null;
}

interface PlacesTextResult {
  name?: string;
  rating?: number;
  user_ratings_total?: number;
  formatted_address?: string;
}
interface PlacesTextResponse {
  status: string;
  results?: PlacesTextResult[];
  error_message?: string;
}

const NOT_FOUND: ReputationResult = {
  found: false,
  rating: null,
  reviewCount: 0,
  matchedName: null,
  matchedAddress: null,
};

export async function lookupReputation(name: string, city: string): Promise<ReputationResult> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const query = [name, city].map((s) => s?.trim()).filter(Boolean).join(" ");
  if (!key || !query) return NOT_FOUND;

  try {
    const url = new URL(TEXT_SEARCH_URL);
    url.searchParams.set("query", `${query} restaurant`);
    url.searchParams.set("type", "restaurant");
    url.searchParams.set("key", key);

    // Reputation moves slowly; let Next cache identical lookups for an hour.
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return NOT_FOUND;

    const data = (await res.json()) as PlacesTextResponse;
    if (data.status !== "OK" || !data.results?.length) return NOT_FOUND;

    const top = data.results[0];
    if (typeof top.rating !== "number") return NOT_FOUND;

    return {
      found: true,
      rating: top.rating,
      reviewCount: top.user_ratings_total ?? 0,
      matchedName: top.name ?? null,
      matchedAddress: top.formatted_address ?? null,
    };
  } catch {
    return NOT_FOUND;
  }
}
