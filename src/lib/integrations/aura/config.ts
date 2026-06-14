/**
 * Aura (Reputation) integration — environment contract & per-source guards.
 *
 * Scaffolding, mirroring the Toast connector pattern: this module declares the
 * env vars each review source consumes and reports which sources are wired. It
 * performs NO live API calls and importing it never throws. Each source lights
 * up independently the moment its vars are present — so you can connect Google
 * first and add Yelp / Facebook later without touching code.
 *
 * Sources (multi-source + social):
 *   • google   — Google Places Details (rating, total, recent reviews)
 *   • yelp     — Yelp Fusion business + reviews
 *   • facebook — Meta Graph Page ratings/recommendations
 *
 * Instagram has no public review surface (it's engagement, not ratings), so the
 * social side is Facebook recommendations today; IG engagement is a later add.
 */

export type AuraSourceKey = "google" | "yelp" | "facebook";

export const AURA_SOURCES: AuraSourceKey[] = ["google", "yelp", "facebook"];

export const AURA_SOURCE_LABEL: Record<AuraSourceKey, string> = {
  google: "Google",
  yelp: "Yelp",
  facebook: "Facebook",
};

// The env var names each source reads. Single source of truth; the connect-state
// UI lists exactly these for any source that isn't wired yet.
export const AURA_SOURCE_ENV: Record<AuraSourceKey, readonly string[]> = {
  google: ["GOOGLE_PLACES_API_KEY", "GOOGLE_PLACE_ID"],
  yelp: ["YELP_API_KEY", "YELP_BUSINESS_ID"],
  facebook: ["META_GRAPH_TOKEN", "FACEBOOK_PAGE_ID"],
} as const;

/** True when every env var for a source is present and non-empty. */
export function isAuraSourceConfigured(source: AuraSourceKey): boolean {
  return AURA_SOURCE_ENV[source].every((name) => !!process.env[name]?.trim());
}

/** Names of the missing/empty env vars for a source (for the connect card; never values). */
export function missingAuraEnvVars(source: AuraSourceKey): string[] {
  return AURA_SOURCE_ENV[source].filter((name) => !process.env[name]?.trim());
}

/** The sources that are fully wired right now. */
export function configuredAuraSources(): AuraSourceKey[] {
  return AURA_SOURCES.filter(isAuraSourceConfigured);
}

/** True when at least one review source is wired. */
export function isAuraConfigured(): boolean {
  return configuredAuraSources().length > 0;
}

/** Read a source's required env vars, throwing a clear error if any are missing. */
export function getAuraSourceEnv(source: AuraSourceKey): Record<string, string> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of AURA_SOURCE_ENV[source]) {
    const v = process.env[name]?.trim();
    if (!v) missing.push(name);
    else out[name] = v;
  }
  if (missing.length > 0) {
    throw new Error(`Aura ${source} is not configured — missing env var(s): ${missing.join(", ")}.`);
  }
  return out;
}
