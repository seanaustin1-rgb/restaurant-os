// Seed DailySales for "Stone Grille and Tap House" for May 2026, derived from the
// Toast deposits in the imported statement (the "TOAST/DEP May XX" label is the
// sales date; the deposit amount ~ that day's net sales). Covers/checks synthesized
// at ~$40/cover so the dashboard's RevPASH / check-average have realistic inputs.
//   Dry run:  npx dotenv -e .env.local -- tsx scripts/seed-sales.ts
//   Apply:    npx dotenv -e .env.local -- tsx scripts/seed-sales.ts --commit
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

interface LlmTxn { date: string; description: string; amount: number; direction: "debit" | "credit"; }

const COMMIT = process.argv.includes("--commit");
const cache = JSON.parse(readFileSync("scripts/.cache-txns.json", "utf8")) as LlmTxn[];

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { name: "Stone Grille and Tap House" } });
  if (!r) { console.log("Restaurant 'Stone Grille and Tap House' not found."); return; }
  console.log(`Target: ${r.name} (${r.id}), seats=${r.seatCount}`);

  const byDate = new Map<string, number>();
  for (const t of cache) {
    if (t.direction !== "credit") continue;
    const m = t.description.match(/TOAST\/DEP\s+May\s+(\d{1,2})/i);
    if (!m) continue;
    const date = `2026-05-${m[1].padStart(2, "0")}`;
    byDate.set(date, (byDate.get(date) ?? 0) + Math.abs(t.amount));
  }

  const rows = [...byDate.entries()].sort().map(([date, net]) => {
    const covers = Math.round(net / 40);
    const checkCount = Math.max(1, Math.round(covers / 2));
    return {
      restaurantId: r.id,
      date: new Date(date),
      grossSales: Number((net * 1.03).toFixed(2)),
      netSales: Number(net.toFixed(2)),
      covers,
      checkCount,
      hoursOpen: 11,
      source: "seed:toast-deposits",
    };
  });

  const totalNet = rows.reduce((a, x) => a + x.netSales, 0);
  const totalCovers = rows.reduce((a, x) => a + x.covers, 0);
  console.log(`\n${rows.length} sales days, total netSales $${totalNet.toFixed(2)}, total covers ${totalCovers}`);
  for (const x of rows) {
    console.log(`  ${x.date.toISOString().slice(0, 10)}  net $${x.netSales.toFixed(2).padStart(10)}  covers ${x.covers}`);
  }

  if (!COMMIT) { console.log("\nDRY RUN — nothing written. Re-run with --commit."); return; }
  const res = await prisma.dailySales.createMany({ data: rows, skipDuplicates: true });
  console.log(`\nInserted ${res.count} DailySales rows (skipDuplicates dropped ${rows.length - res.count}).`);
}

main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); }).finally(() => prisma.$disconnect());
