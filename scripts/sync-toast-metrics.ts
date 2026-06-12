/**
 * Backfill DailySales from the Toast Analytics (era) API.
 *
 * Run:  npx dotenv -e .env.local -- tsx scripts/sync-toast-metrics.ts [days]
 *   days = how many recent closed days to pull (default 21).
 *
 * Targets the restaurant whose Toast GUID is configured in TOAST_RESTAURANT_GUID.
 * Idempotent: upserts by (restaurantId, date), source="toast". (An Inngest
 * daily job can call syncToastDailyMetrics() the same way later.)
 */

import { prisma } from "../src/lib/prisma";
import { syncToastDailyMetrics } from "../src/lib/integrations/toast/sync";
import { isToastConfigured, getToastConfig } from "../src/lib/integrations/toast/config";

async function main() {
  if (!isToastConfigured()) {
    console.error("Toast not configured — set TOAST_* in .env.local.");
    process.exit(1);
  }
  const days = Number(process.argv[2] ?? "21");
  const { restaurantGuid } = getToastConfig();

  // Map the Toast GUID to a DB restaurant. Single-tenant for now: prefer an
  // exact PosConnection match, else fall back to the configured Customer Zero.
  const conn = await prisma.posConnection.findFirst({
    where: { externalId: restaurantGuid },
    select: { restaurantId: true },
  });
  let restaurantId = conn?.restaurantId;
  if (!restaurantId) {
    const sg = await prisma.restaurant.findFirst({
      where: { name: { contains: "Stone Grille and Tap" } },
      select: { id: true, name: true },
    });
    restaurantId = sg?.id;
    console.log(`No PosConnection for GUID; using restaurant "${sg?.name}" (${restaurantId}).`);
  }
  if (!restaurantId) {
    console.error("Could not resolve a restaurant for the configured Toast GUID.");
    process.exit(1);
  }

  console.log(`Syncing ${days} days of Toast metrics into DailySales…`);
  const result = await syncToastDailyMetrics(restaurantId, days);
  console.log("Done:", JSON.stringify(result, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
