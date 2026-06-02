// Read-only: show stored transaction buckets per restaurant.
import { prisma } from "../src/lib/prisma";

async function main() {
  const restaurants = await prisma.restaurant.findMany({ select: { id: true, name: true } });
  for (const r of restaurants) {
    const g = await prisma.transaction.groupBy({
      by: ["bucket"],
      where: { restaurantId: r.id },
      _count: true,
      _sum: { amount: true },
    });
    const total = g.reduce((a, x) => a + (x._count as number), 0);
    if (total === 0) continue;
    console.log(`\n${r.name} (${r.id}) — ${total} txns:`);
    for (const row of g.sort((a, b) => (b._count as number) - (a._count as number))) {
      console.log(`  ${String(row.bucket).padEnd(16)} ${String(row._count).padStart(4)} rows   $${Number(row._sum.amount ?? 0).toFixed(2)}`);
    }
    const sales = await prisma.dailySales.count({ where: { restaurantId: r.id } });
    console.log(`  (DailySales rows: ${sales})`);
  }
}

main().catch((e) => { console.error(e?.message || e); process.exit(1); }).finally(() => prisma.$disconnect());
