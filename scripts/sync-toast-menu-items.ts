/**
 * Backfill MenuItemSales from the Toast Analytics menu report.
 *
 * Run:  npx dotenv -e .env.local -- tsx scripts/sync-toast-menu-items.ts [weeks]
 *   weeks = recent whole weeks to pull, ending yesterday (default 4).
 *
 * One weekly era report per week (groupBy MENU_ITEM); idempotent upserts by
 * (restaurantId, date, menuItemGuid).
 */

import { prisma } from "../src/lib/prisma";
import { syncToastMenuItemSales, resolveToastRestaurantId } from "../src/lib/integrations/toast/sync";
import { isToastConfigured } from "../src/lib/integrations/toast/config";

async function main() {
  if (!isToastConfigured()) {
    console.error("Toast not configured — set TOAST_* in .env.local.");
    process.exit(1);
  }
  const weeks = Number(process.argv[2] ?? "4");
  const restaurantId = await resolveToastRestaurantId();
  if (!restaurantId) {
    console.error("Could not resolve a restaurant for the configured Toast GUID.");
    process.exit(1);
  }

  console.log(`Syncing ${weeks} weeks of menu-item sales (restaurant ${restaurantId})…`);
  const result = await syncToastMenuItemSales(restaurantId, weeks);
  console.log("Done:", JSON.stringify(result, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
