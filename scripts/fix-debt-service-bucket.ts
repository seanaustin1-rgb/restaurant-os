/** Profit First: Debt Service is paid from Profit distributions, not OpEx.
 * PR #18 added the PROFIT TapBucket and flipped the "Debt Service" DEFAULT
 * category seed to PROFIT. Existing per-restaurant "Debt Service" Category rows
 * were seeded earlier with tapBucket=OPEX, so flip them to PROFIT here.
 *
 * Dry run:  npx dotenv -e .env.local -o -- tsx scripts/fix-debt-service-bucket.ts
 * Apply:    npx dotenv -e .env.local -o -- tsx scripts/fix-debt-service-bucket.ts --commit
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const NAME = "Debt Service";
const TARGET = "PROFIT" as const;

async function main() {
  const commit = process.argv.includes("--commit");
  const restaurants = await prisma.restaurant.findMany({ select: { id: true, name: true } });

  for (const r of restaurants) {
    const cat = await prisma.category.findUnique({
      where: { restaurantId_name: { restaurantId: r.id, name: NAME } },
      select: { id: true, tapBucket: true },
    });
    if (!cat) {
      console.log(`${r.name}: no "${NAME}" category — skip`);
      continue;
    }
    const txnCount = await prisma.transaction.count({ where: { categoryId: cat.id } });
    if (cat.tapBucket === TARGET) {
      console.log(`${r.name}: already PROFIT (${txnCount} txn) — no change`);
      continue;
    }
    console.log(`${r.name}: ${cat.tapBucket} → ${TARGET} (${txnCount} txn)`);
    if (commit) {
      await prisma.category.update({ where: { id: cat.id }, data: { tapBucket: TARGET } });
    }
  }
  console.log(commit ? "\n✓ committed" : "\n(dry run — add --commit to apply)");
}

main().finally(() => prisma.$disconnect());
