// Read-only: mirror the dashboard's category -> tapBucket rollup for Stone Grille
// (May 2026) so we can confirm the gauges before restarting the dev server.
import { prisma } from "../src/lib/prisma";

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { name: "Stone Grille and Tap House" } });
  if (!r) return console.log("restaurant not found");
  const start = new Date(Date.UTC(2026, 4, 1));
  const end = new Date(Date.UTC(2026, 5, 1));

  const cats = await prisma.category.findMany({ where: { restaurantId: r.id }, select: { id: true, name: true, tapBucket: true } });
  const tapByCat = new Map(cats.map((c) => [c.id, c.tapBucket as string]));
  const nameByCat = new Map(cats.map((c) => [c.id, c.name]));

  const byCat = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { restaurantId: r.id, date: { gte: start, lt: end } },
    _sum: { amount: true },
    _count: true,
  });

  const tapSum: Record<string, number> = {};
  const rows: { name: string; tap: string; n: number; amt: number }[] = [];
  for (const row of byCat) {
    const tap = (row.categoryId && tapByCat.get(row.categoryId)) || "OPEX";
    const amt = Number(row._sum.amount ?? 0);
    tapSum[tap] = (tapSum[tap] ?? 0) + amt;
    rows.push({ name: row.categoryId ? nameByCat.get(row.categoryId) ?? "?" : "(null)", tap, n: row._count, amt });
  }

  console.log("By category (May 2026):");
  rows.sort((a, b) => Math.abs(b.amt) - Math.abs(a.amt)).forEach((c) =>
    console.log(`  ${c.name.padEnd(28)} [${c.tap.padEnd(12)}] ${String(c.n).padStart(3)}  $${c.amt.toFixed(2)}`));

  console.log("\nTAP rollup → gauges:");
  for (const [t, s] of Object.entries(tapSum).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))) {
    const gauged = ["COGS_FOOD", "COGS_LIQUOR", "COGS_BEVERAGE", "LABOR", "OPEX", "OWNER_PAY"].includes(t);
    console.log(`  ${t.padEnd(14)} $${s.toFixed(2)}${gauged ? "" : "   (not gauged)"}`);
  }
}

main().catch((e) => { console.error(e?.message || e); process.exit(1); }).finally(() => prisma.$disconnect());
