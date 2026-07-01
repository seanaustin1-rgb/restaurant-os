"use server";

// Best-effort reputation lookup for the public Instant-Estimate demo.
//
// Resolves a prospect's business by name + city via Google Places Text Search
// (one call — it returns rating & total directly) so the Aura tile can show
// their REAL stars. This is the "that's MY business" hook.
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
  types?: string[];
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

type ReputationLookupKind = "restaurant" | "real_estate" | "contractor" | "service" | "retail" | "lodging";

const LOOKUP_CONFIG: Record<ReputationLookupKind, { querySuffix: string; type?: string; rejectTypes?: string[] }> = {
  restaurant: { querySuffix: "restaurant", type: "restaurant" },
  real_estate: {
    querySuffix: "real estate agency",
    type: "real_estate_agency",
    rejectTypes: ["restaurant", "bar", "cafe", "meal_takeaway", "bakery", "food"],
  },
  contractor: { querySuffix: "contractor", type: "general_contractor" },
  service: { querySuffix: "service business" },
  retail: { querySuffix: "store", type: "store" },
  lodging: { querySuffix: "lodging", type: "lodging" },
};

function acceptableResult(result: PlacesTextResult, kind: ReputationLookupKind): boolean {
  const rejectTypes = LOOKUP_CONFIG[kind].rejectTypes ?? [];
  if (!rejectTypes.length) return true;
  const types = result.types ?? [];
  return !types.some((type) => rejectTypes.includes(type));
}

export async function lookupReputation(
  name: string,
  city: string,
  kind: ReputationLookupKind = "restaurant",
): Promise<ReputationResult> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const query = [name, city].map((s) => s?.trim()).filter(Boolean).join(" ");
  if (!key || !query) return NOT_FOUND;

  try {
    const config = LOOKUP_CONFIG[kind];
    const url = new URL(TEXT_SEARCH_URL);
    url.searchParams.set("query", `${query} ${config.querySuffix}`);
    if (config.type) url.searchParams.set("type", config.type);
    url.searchParams.set("key", key);

    // Reputation moves slowly; let Next cache identical lookups for an hour.
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return NOT_FOUND;

    const data = (await res.json()) as PlacesTextResponse;
    if (data.status !== "OK" || !data.results?.length) return NOT_FOUND;

    const top = data.results.find((result) => acceptableResult(result, kind)) ?? data.results[0];
    if (!acceptableResult(top, kind)) return NOT_FOUND;
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
