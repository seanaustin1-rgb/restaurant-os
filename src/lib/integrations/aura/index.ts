import type { AuraSourceKey } from "./config";
import type { AuraProvider } from "./types";
import { googleProvider } from "./providers/google";
import { yelpProvider } from "./providers/yelp";
import { metaProvider } from "./providers/meta";

// Provider registry. Keyed by source so the loader can pick exactly the ones
// that are configured. Importing these is side-effect free — a provider only
// touches the network when its fetchSummary() is called.
export const AURA_PROVIDERS: Record<AuraSourceKey, AuraProvider> = {
  google: googleProvider,
  yelp: yelpProvider,
  facebook: metaProvider,
};

export * from "./config";
export * from "./types";
