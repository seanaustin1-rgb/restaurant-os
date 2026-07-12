// OneSignal Web SDK configuration (single source of truth).
//
// The App ID is a PUBLIC identifier — it is shipped to every browser by the web
// SDK — so it is committed here as the default and overridable per environment
// via NEXT_PUBLIC_ONESIGNAL_APP_ID (e.g. to point at a different OneSignal app).
// The REST API Key is a SECRET and lives ONLY in the ONESIGNAL_API_KEY env var;
// it must never appear in this file or any client bundle.
export const ONESIGNAL_APP_ID =
  process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "fa9269c1-f248-4e5d-a489-91f5f17b933b";

// v16 CDN entry points (OneSignal's documented custom-code setup).
export const ONESIGNAL_PAGE_SDK = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

/** Server-side push is live only once the secret REST API Key is present. */
export function pushDispatchAvailable(): boolean {
  return !!(ONESIGNAL_APP_ID && process.env.ONESIGNAL_API_KEY);
}
