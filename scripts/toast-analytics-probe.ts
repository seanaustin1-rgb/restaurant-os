/**
 * Toast Analytics (era) API probe — exercises the reusable era client.
 *
 * Run:  npx dotenv -e .env.local -- tsx scripts/toast-analytics-probe.ts
 *
 * Calls getMetricsForDay() (from src/lib/integrations/toast/analytics.ts) for a
 * recent closed day and prints the fields returned — confirming what
 * enterprise-metrics:read exposes. This is your own reporting data, not secrets.
 */

import { getMetricsForDay, toBusinessDate } from "../src/lib/integrations/toast/analytics";

async function main() {
  const day = new Date();
  day.setDate(day.getDate() - 1); // yesterday (closed day)
  const bd = toBusinessDate(day);

  console.log(`— Toast Analytics probe via era client — businessDate=${bd}\n`);

  const rows = await getMetricsForDay(bd);
  if (rows.length === 0) {
    console.log("No rows returned (restaurant may have had no activity that day).");
    return;
  }

  const row = rows[0];
  console.log("Fields:", Object.keys(row).join(", "), "\n");
  console.log("Row:", JSON.stringify(row, null, 2).slice(0, 1200));
}

main().catch((err) => {
  console.error("Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
