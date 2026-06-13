/**
 * Run the persisted Profit First allocation ledger for the Toast restaurant.
 *
 * Run:  npx dotenv -e .env.local -o -- tsx scripts/run-allocation-ledger.ts [asOf yyyy-mm-dd]
 *
 * Allocates every DailySales day (idempotent), recomputes bucket balances, and
 * sweeps Profit + Owner's Pay if the 10th/25th has passed. Prints the resulting
 * ledger snapshot. The daily Inngest worker calls runLedger() the same way.
 */
import { prisma } from "../src/lib/prisma";
import { runLedger, getLedgerSnapshot } from "../src/lib/profit-first/ledger";
import { resolveToastRestaurantId } from "../src/lib/integrations/toast/sync";

async function main() {
  const asOfArg = process.argv[2];
  const asOf = asOfArg ? new Date(asOfArg + "T00:00:00.000Z") : new Date();

  const restaurantId = await resolveToastRestaurantId();
  if (!restaurantId) {
    console.error("Could not resolve a restaurant (Toast GUID / Customer-Zero fallback).");
    process.exit(1);
  }

  console.log(`Running allocation ledger for ${restaurantId} (asOf ${asOf.toISOString().slice(0, 10)})…\n`);
  const result = await runLedger(restaurantId, asOf);
  console.log(`Allocated ${result.allocated} new day(s).`);
  if (result.swept.length) {
    for (const s of result.swept) console.log(`  Swept ${s.key}: $${s.amount.toFixed(2)} (${s.sweptAt})`);
  } else {
    console.log("No sweep due.");
  }

  const snap = await getLedgerSnapshot(restaurantId);
  console.log(`\nLedger: ${snap.allocationDays} allocation day(s), last ${snap.lastAllocatedAt}`);
  console.log("Bucket balances:");
  for (const b of snap.balances) {
    console.log(`  ${b.name.padEnd(22)} $${b.balance.toFixed(2).padStart(12)}  [${b.kind}]${b.lastSweptAt ? `  swept ${b.lastSweptAt}` : ""}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
