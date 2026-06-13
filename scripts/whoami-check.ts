/** Who has access to which restaurant — to find the right login account.
 * Run: npx dotenv -e .env.local -o -- tsx scripts/whoami-check.ts
 * Note: emails live in Clerk, not our DB — this shows the clerkUserId + role to
 * cross-reference against the Clerk Dashboard → Users list. */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { transactions: true, dailySales: true } },
      userRoles: { select: { clerkUserId: true, role: true, createdAt: true } },
    },
  });
  for (const r of restaurants) {
    console.log(`\n${r.name}  (${r.id})`);
    console.log(`  data: ${r._count.transactions} txns, ${r._count.dailySales} sales days`);
    if (!r.userRoles.length) console.log("  ⚠ no user roles — no one can see this in the UI");
    for (const u of r.userRoles) {
      console.log(`  • ${u.role}  clerkUserId=${u.clerkUserId}  (added ${u.createdAt.toISOString().slice(0, 10)})`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
