/**
 * Toast connector smoke test.
 *
 * Run:  npx dotenv -e .env.local -- tsx scripts/test-toast-auth.ts
 *
 * Validates the live Toast connection in three steps and prints ONLY status —
 * never the client secret, never the access token (only its length).
 *   1. config present?            (isToastConfigured / missingToastEnvVars)
 *   2. OAuth2 login succeeds?      (getAccessToken — validates id/secret/host)
 *   3. restaurant GUID + header?   (a restaurant-scoped read; status reported)
 *
 * Exit code 0 = auth works (step 2). Step 3 is informational: a 403 just means
 * the granted scopes don't include that endpoint yet — the GUID/header plumbing
 * is still correct.
 */

import {
  isToastConfigured,
  missingToastEnvVars,
  getToastConfig,
} from "../src/lib/integrations/toast/config";
import { getAccessToken } from "../src/lib/integrations/toast/auth";
import { toastFetch, ToastApiError } from "../src/lib/integrations/toast/client";

async function main() {
  console.log("— Toast connector smoke test —\n");

  // 1. Config present?
  if (!isToastConfigured()) {
    console.log("✗ Not configured. Missing:", missingToastEnvVars().join(", "));
    console.log("  Fill these in .env.local, then re-run.");
    process.exit(1);
  }
  const { hostname, restaurantGuid } = getToastConfig();
  const env = hostname.includes("sandbox") ? "SANDBOX" : "PRODUCTION";
  console.log(`✓ Configured. host=${hostname} (${env})`);
  console.log(`  restaurant GUID ends with …${restaurantGuid.slice(-6)}\n`);

  // 2. OAuth2 login.
  let token: string;
  try {
    token = await getAccessToken();
    console.log(`✓ Auth OK. Bearer token acquired (length ${token.length}).\n`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("✗ Auth FAILED:", msg);
    console.log("  Check TOAST_CLIENT_ID / TOAST_CLIENT_SECRET / TOAST_API_HOSTNAME.");
    process.exit(1);
  }

  // 3. Restaurant-scoped read — validates the GUID + Toast-Restaurant-External-ID header.
  try {
    await toastFetch(`/restaurants/v1/restaurants/${restaurantGuid}`);
    console.log("✓ Restaurant read OK (200). GUID + header + scope all valid.");
  } catch (err) {
    if (err instanceof ToastApiError) {
      if (err.status === 403) {
        console.log(
          "△ Restaurant read 403 — authenticated, but the granted scopes don't " +
            "cover /restaurants. GUID/header plumbing is fine; request the scope when needed.",
        );
      } else if (err.status === 404) {
        console.log(
          "✗ Restaurant read 404 — GUID not found / not associated with this client. " +
            "Double-check TOAST_RESTAURANT_GUID.",
        );
      } else {
        console.log(`△ Restaurant read returned ${err.status} ${err.statusText}.`);
      }
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.log("△ Restaurant read error:", msg);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
