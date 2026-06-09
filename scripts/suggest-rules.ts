// Preview the rule suggestions Restaurant OS would offer an operator, based on
// their repeated manual overrides (Phase 3 / P2). Read-only — never writes.
//   npx dotenv -e .env.local -- tsx scripts/suggest-rules.ts <restaurantId>
import { prisma } from "../src/lib/prisma";
import { getRuleSuggestionsForRestaurant } from "../src/lib/categorization/suggestions";

async function main() {
  const restaurantId = process.argv[2];
  if (!restaurantId) {
    console.error("Usage: tsx scripts/suggest-rules.ts <restaurantId>");
    process.exit(1);
  }

  const suggestions = await getRuleSuggestionsForRestaurant(prisma, restaurantId);
  if (suggestions.length === 0) {
    console.log("No rule suggestions — not enough consistent manual overrides yet.");
    return;
  }

  console.log(`Suggested rules (${suggestions.length}):\n`);
  for (const s of suggestions) {
    console.log(`  ${s.pattern.padEnd(28)} -> ${s.categoryName.padEnd(26)} (${s.count}x by hand)`);
    if (s.samples.length) console.log(`    e.g. ${s.samples.join(" | ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
