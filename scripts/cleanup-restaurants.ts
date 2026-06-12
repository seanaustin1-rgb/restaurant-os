// Maintenance: list restaurants with their data counts, and safely delete an
// empty duplicate (e.g. the twin created by onboarding twice). Dry-run by
// default; deletion requires an explicit id AND --commit, and refuses a
// non-empty restaurant unless --force.
//
//   List:          npx dotenv -e .env.local -- tsx scripts/cleanup-restaurants.ts
//   Delete (dry):  npx dotenv -e .env.local -- tsx scripts/cleanup-restaurants.ts --delete <id>
//   Delete (real): npx dotenv -e .env.local -- tsx scripts/cleanup-restaurants.ts --delete <id> --commit
//
// Deleting a Restaurant cascades to its transactions, sales, rules, categories,
// connections, etc. (onDelete: Cascade in the schema) — so only do this for a
// throwaway/empty twin.
import { prisma } from "../src/lib/prisma";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const DELETE_ID = arg("--delete");
const COMMIT = process.argv.includes("--commit");
const FORCE = process.argv.includes("--force");

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { transactions: true, dailySales: true, plaidConnections: true, userRoles: true } },
    },
  });

  console.log(`\n${restaurants.length} restaurant(s):\n`);
  for (const r of restaurants) {
    const c = r._count;
    const empty = c.transactions === 0 && c.dailySales === 0 && c.plaidConnections === 0;
    console.log(
      `  ${empty ? "·" : "●"} ${r.id}  ${r.name}\n` +
        `      txns=${c.transactions} sales=${c.dailySales} banks=${c.plaidConnections} users=${c.userRoles}` +
        `  created ${r.createdAt.toISOString().slice(0, 10)}${empty ? "   [EMPTY]" : ""}`,
    );
  }

  if (!DELETE_ID) {
    console.log(`\nTo remove one:  ...cleanup-restaurants.ts --delete <id> --commit\n`);
    return;
  }

  const target = restaurants.find((r) => r.id === DELETE_ID);
  if (!target) {
    console.log(`\n✗ No restaurant with id ${DELETE_ID}.\n`);
    return;
  }
  const c = target._count;
  const empty = c.transactions === 0 && c.dailySales === 0 && c.plaidConnections === 0;
  if (!empty && !FORCE) {
    console.log(
      `\n✗ Refusing to delete "${target.name}" — it has data ` +
        `(txns=${c.transactions} sales=${c.dailySales} banks=${c.plaidConnections}). ` +
        `Re-run with --force if you really mean it.\n`,
    );
    return;
  }

  if (!COMMIT) {
    console.log(`\nDRY RUN — would delete "${target.name}" (${target.id})${empty ? " [EMPTY]" : " [FORCED]"}. Add --commit to apply.\n`);
    return;
  }

  await prisma.restaurant.delete({ where: { id: target.id } });
  console.log(`\n✓ Deleted "${target.name}" (${target.id}) and all its cascaded data.\n`);
}

main()
  .catch((e) => {
    console.error("FAILED:", e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
