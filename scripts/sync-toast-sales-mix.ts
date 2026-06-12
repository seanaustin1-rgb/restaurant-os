/**
 * Backfill DailySales.mixByRevenueCenter from the Toast Analytics (era) API.
 *
 * Run:  npx dotenv -e .env.local -- tsx scripts/sync-toast-sales-mix.ts [days]
 *   days = recent closed days to pull (default 21).
 *
 * Idempotent: upserts the revenue-center slice array onto each daily row.
 */

import { prisma } from "../src/lib/prisma";
import { syncToastSalesMix, resolveToastRestaurantId } from "../src/lib/integrations/toast/sync";
import { isToastConfigured } from "../src/lib/integrations/toast/config";

async function main() {
  if (!isToastConfigured()) {
    console.error("Toast not configured — set TOAST_* in .env.local.");
    process.exit(1);
  }
  const days = Number(process.argv[2] ?? "21");
  const restaurantId = await resolveToastRestaurantId();
  if (!restaurantId) {
    console.error("Could not resolve a restaurant for the configured Toast GUID.");
    process.exit(1);
  }

  console.log(`Syncing ${days} days of revenue-center sales mix (restaurant ${restaurantId})…`);
  const result = await syncToastSalesMix(restaurantId, days);
  console.log("Done:", JSON.stringify(result, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
