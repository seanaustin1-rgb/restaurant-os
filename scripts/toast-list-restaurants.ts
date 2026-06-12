/**
 * Discover which restaurants are connected to this Toast API client.
 *
 * Run:  npx dotenv -e .env.local -- tsx scripts/toast-list-restaurants.ts
 *
 * Uses the partner-scoped endpoint (no Toast-Restaurant-External-ID header) to
 * list the restaurant GUID(s) this integration is authorized for — so you can
 * confirm the correct value for TOAST_RESTAURANT_GUID. Prints restaurant names
 * and GUIDs (your own restaurant identifiers — not secrets); never the token.
 */

import { getAccessToken } from "../src/lib/integrations/toast/auth";
import { getToastConfig } from "../src/lib/integrations/toast/config";

interface PartnerRestaurant {
  restaurantGuid?: string;
  restaurantName?: string;
  locationName?: string;
  managementGroupGuid?: string;
  isoCurrency?: string;
  createdByEmailAddress?: string;
}

async function main() {
  const { hostname } = getToastConfig();
  const token = await getAccessToken();

  // Partner endpoint: restaurants that have connected this integration.
  const res = await fetch(`${hostname}/partners/v1/restaurants`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 500);
    console.log(`Partners lookup failed: ${res.status} ${res.statusText}`);
    console.log(body);
    if (res.status === 403 || res.status === 404) {
      console.log(
        "\nThis client may not have the partner scope, or no restaurant has " +
          "connected the integration yet. In that case, get the GUID from the " +
          "Toast Web URL (toasttab.com/restaurants/admin/…/<GUID>) or from your " +
          "Toast integrations contact.",
      );
    }
    process.exit(1);
  }

  const list = (await res.json()) as PartnerRestaurant[];
  if (!Array.isArray(list) || list.length === 0) {
    console.log("No connected restaurants returned for this client.");
    process.exit(0);
  }

  console.log(`Connected restaurant(s): ${list.length}\n`);
  for (const r of list) {
    console.log("  name :", r.restaurantName ?? r.locationName ?? "(unnamed)");
    console.log("  GUID :", r.restaurantGuid ?? "(none)");
    if (r.managementGroupGuid) console.log("  mgmt :", r.managementGroupGuid);
    console.log("");
  }
  console.log("→ Put the matching GUID in TOAST_RESTAURANT_GUID in .env.local.");
}

main().catch((err) => {
  console.error("Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
