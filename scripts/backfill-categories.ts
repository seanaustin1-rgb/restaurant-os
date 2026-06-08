// Backfill: seed default categories per restaurant, then set Transaction.categoryId
// from the legacy `bucket` (manual overrides already live in `bucket`, so they're
// preserved). Idempotent — only fills rows where categoryId is still null.
//   Dry run:  npx dotenv -e .env.local -- tsx scripts/backfill-categories.ts
//   Apply:    npx dotenv -e .env.local -- tsx scripts/backfill-categories.ts --commit
import { prisma } from "../src/lib/prisma";
import { ensureDefaultCategories, categoryIdByName, legacyBucketToCategoryName } from "../src/lib/categorization/categories";

const COMMIT = process.argv.includes("--commit");

async function main() {
  const restaurants = await prisma.restaurant.findMany({ select: { id: true, name: true } });

  for (const r of restaurants) {
    const groups = await prisma.transaction.groupBy({
      by: ["bucket"],
      where: { restaurantId: r.id },
      _count: true,
    });
    if (groups.length === 0) { console.log(`\n${r.name}: no transactions — skipping`); continue; }

    if (COMMIT) await ensureDefaultCategories(prisma, r.id);
    const idMap = COMMIT ? await categoryIdByName(prisma, r.id) : new Map<string, string>();

    console.log(`\n${r.name} (${r.id}):`);
    for (const g of groups) {
      const catName = legacyBucketToCategoryName(g.bucket);
      console.log(`  ${String(g.bucket).padEnd(16)} ${String(g._count).padStart(4)} txns -> "${catName}"`);
      if (!COMMIT) continue;

      const catId = idMap.get(catName);
      if (!catId) { console.log(`    !! missing category "${catName}" — skipped`); continue; }
      const res = await prisma.transaction.updateMany({
        where: { restaurantId: r.id, bucket: g.bucket, categoryId: null },
        data: { categoryId: catId },
      });
      console.log(`    set categoryId on ${res.count}`);
    }
  }
}

main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); }).finally(() => prisma.$disconnect());
