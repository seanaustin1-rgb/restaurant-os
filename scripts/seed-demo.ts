/**
 * Seed a populated demo tenant so the LIVE dashboard renders with data —
 * without needing Plaid/Toast connected. Writes the current month of realistic
 * DailySales + categorized Transactions via the same seedDemoData() the dev
 * route uses, but as a CLI so it works against any database (incl. the deployed
 * one, where the dev HTTP route is disabled).
 *
 * Run (local):
 *   npx dotenv -e .env.local -o -- tsx scripts/seed-demo.ts --user <clerkUserId>
 * Run (against a specific DB, e.g. production demo):
 *   DATABASE_URL=... DIRECT_URL=... npm run seed:demo -- --user <clerkUserId>
 *
 * Flags:
 *   --user <clerkUserId>   Attach an OPERATOR role so the tenant shows on that
 *                          login's /dashboard. Find it in the Clerk dashboard.
 *                          (Without it, a standalone restaurant is created that
 *                          no login is linked to.)
 *   --restaurant <id>      Seed into an existing restaurant instead of creating one.
 *   --name <name>          Name for a newly created restaurant (default "Demo Bistro").
 *
 * Idempotent: re-running clears its own prior seed for that restaurant/month.
 */
import { prisma } from "../src/lib/prisma";
import { seedDemoData } from "../src/lib/dev/seed-demo";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const userId = arg("--user") ?? process.env.CLERK_USER_ID;
  let restaurantId = arg("--restaurant");
  const name = arg("--name") ?? "Demo Bistro";

  // Prefer an existing restaurant for the given user (mirrors the dev route).
  if (!restaurantId && userId) {
    const role = await prisma.userRestaurantRole.findFirst({
      where: { clerkUserId: userId },
      select: { restaurantId: true },
    });
    restaurantId = role?.restaurantId;
  }

  if (!restaurantId) {
    const suffix = Math.random().toString(36).slice(2, 7);
    const created = await prisma.restaurant.create({
      data: {
        name,
        slug: `${slugify(name)}-${suffix}`,
        seatCount: 120,
        tapSettings: { create: {} },
        ...(userId ? { userRoles: { create: { clerkUserId: userId, role: "OPERATOR" } } } : {}),
      },
      select: { id: true, name: true },
    });
    restaurantId = created.id;
    console.log(
      `Created restaurant "${created.name}" (${created.id})` +
        (userId ? ` with an OPERATOR role for Clerk user ${userId}.` : "."),
    );
    if (!userId) {
      console.log("⚠  No --user given — this restaurant is not linked to any login. Pass --user <clerkUserId> to see it on /dashboard.");
    }
  } else {
    console.log(`Seeding into existing restaurant ${restaurantId}.`);
  }

  const result = await seedDemoData(restaurantId);
  console.log(`Seeded ${result.dailySales} days of sales + ${result.transactions} categorized transactions (current month).`);
  console.log("Open /dashboard to see the populated tiles.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("seed:demo failed —", e instanceof Error ? e.message : e);
    process.exit(1);
  });
