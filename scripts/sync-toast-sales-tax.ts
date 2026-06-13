/**
 * Backfill DailySales.salesTaxCollected from the Toast Orders API.
 *
 * Run:  npx dotenv -e .env.local -o -- tsx scripts/sync-toast-sales-tax.ts [days]
 *   days = how many recent closed days to pull (default 21).
 *
 * Sums per-check taxAmount per business day (needs orders:read). Idempotent:
 * upserts salesTaxCollected onto the existing (restaurantId, date) row. This is
 * the pre-allocation Sales-Tax skim source (spec §C3.3); the daily Inngest worker
 * runs syncToastSalesTax() the same way.
 */

import { prisma } from "../src/lib/prisma";
import { syncToastSalesTax, resolveToastRestaurantId } from "../src/lib/integrations/toast/sync";
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

  console.log(`Syncing ${days} days of Toast sales tax into DailySales (restaurant ${restaurantId})…`);
  const result = await syncToastSalesTax(restaurantId, days);
  console.log("Done:", JSON.stringify(result, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
