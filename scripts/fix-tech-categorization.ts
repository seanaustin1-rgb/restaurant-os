/** Move software vendors (MarginEdge, Intuit/QuickBooks, Toast fees) from
 * "Smallwares / Supplies" → "Technology / Software" on existing data, to match
 * the vendor-map `category` overrides. Both are OPEX so gauges don't move — this
 * fixes the category drill-down only.
 *
 * Dry run:  npx dotenv -e .env.local -o -- tsx scripts/fix-tech-categorization.ts
 * Apply:    npx dotenv -e .env.local -o -- tsx scripts/fix-tech-categorization.ts --commit
 */
import { PrismaClient } from "@prisma/client";
import { VENDOR_PATTERNS } from "../src/lib/categorization/vendor-map";
import { categoryIdByName } from "../src/lib/categorization/categories";

const prisma = new PrismaClient();
const TARGET = "Technology / Software";
const SOURCE_CAT = "Smallwares / Supplies";

async function main() {
  const commit = process.argv.includes("--commit");
  const techVendors = VENDOR_PATTERNS.filter((v) => v.category === TARGET);
  const sources = new Set(techVendors.map((v) => v.pattern.source));
  const regexes = techVendors.map((v) => new RegExp(v.pattern.source, "i"));
  console.log(`Tech vendors: ${techVendors.map((v) => v.label).join(", ")}\n`);

  const restaurants = await prisma.restaurant.findMany({ select: { id: true, name: true } });
  for (const r of restaurants) {
    const idByName = await categoryIdByName(prisma, r.id);
    const techId = idByName.get(TARGET);
    const smallId = idByName.get(SOURCE_CAT);
    if (!techId) {
      console.log(`${r.name}: no "${TARGET}" category — skip`);
      continue;
    }

    const rules = await prisma.rule.findMany({
      where: { restaurantId: r.id },
      select: { id: true, pattern: true, categoryId: true },
    });
    const rulesToFix = rules.filter((rr) => sources.has(rr.pattern) && rr.categoryId !== techId);

    const txns = await prisma.transaction.findMany({
      where: { restaurantId: r.id },
      select: { id: true, merchantName: true, description: true, categoryId: true },
    });
    const txnsToFix = txns.filter((t) => {
      const hay = `${t.merchantName ?? ""} ${t.description ?? ""}`;
      const matches = regexes.some((re) => re.test(hay));
      // Only move ones sitting in the wrong default (Smallwares) or uncategorized,
      // so a deliberate manual placement elsewhere is preserved.
      return matches && t.categoryId !== techId && (t.categoryId === smallId || t.categoryId == null);
    });

    console.log(`${r.name}: ${rulesToFix.length} rule(s), ${txnsToFix.length} txn(s) → Technology`);
    if (commit) {
      for (const rr of rulesToFix) await prisma.rule.update({ where: { id: rr.id }, data: { categoryId: techId } });
      if (txnsToFix.length)
        await prisma.transaction.updateMany({ where: { id: { in: txnsToFix.map((t) => t.id) } }, data: { categoryId: techId } });
    }
  }
  console.log(commit ? "\n✓ committed" : "\n(dry run — add --commit to apply)");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
