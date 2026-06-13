/**
 * Toast Analytics (era) — does the per-day metrics row expose sales tax?
 *
 * Run: npx dotenv -e .env.local -o -- tsx scripts/toast-tax-probe.ts
 *
 * Walks back from today to the first business date WITH sales, then dumps the
 * full key set + any tax-shaped field. Answers whether the pre-allocation
 * sales-tax skim can source "tax collected" from era (enterprise-metrics:read)
 * or must wait on the Orders API (operational scopes / Track A).
 */
import { getMetricsForDay, toBusinessDate } from "../src/lib/integrations/toast/analytics";

const TAX_HINT = /tax/i;

async function main() {
  const today = new Date();
  for (let back = 1; back <= 21; back++) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    const bd = toBusinessDate(d);
    let rows;
    try {
      rows = await getMetricsForDay(bd);
    } catch (e) {
      console.log(`${bd}: ERROR ${e instanceof Error ? e.message : e}`);
      continue;
    }
    if (!rows.length) {
      console.log(`${bd}: no rows`);
      continue;
    }
    const row = rows[0];
    const net = Number(row.netSalesAmount ?? 0);
    if (net <= 0) {
      console.log(`${bd}: netSales=${net} — skip`);
      continue;
    }

    console.log(`\n=== ${bd} HAS DATA (netSales=${net}) ===\n`);
    const keys = Object.keys(row);
    console.log("ALL KEYS:\n  " + keys.join(", ") + "\n");
    const taxKeys = keys.filter((k) => TAX_HINT.test(k));
    console.log(
      "TAX-LIKE KEYS: " +
        (taxKeys.length ? taxKeys.map((k) => `${k}=${row[k]}`).join(", ") : "NONE"),
    );
    const gross = Number(row.grossSalesAmount ?? 0);
    console.log(`gross=${gross}  net=${net}  gross−net=${(gross - net).toFixed(2)}\n`);
    console.log("FULL ROW:\n" + JSON.stringify(row, null, 2));
    return;
  }
  console.log("No day with sales found in the last 21 days.");
}

main().catch((e) => {
  console.error("Unexpected error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
