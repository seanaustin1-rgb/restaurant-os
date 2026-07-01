/**
 * Investor-login check against the SEPARATE demo database.
 *
 * Grants INVESTOR access on the seeded "Demo Bistro" to a Clerk user, then runs
 * the SAME query + dashboard load that src/app/investor/page.tsx renders, and
 * prints the resulting Investor Matrix. This exercises the investor data path
 * end-to-end on demo data — only Clerk's auth() wrapper (userId lookup) is left
 * to a real browser sign-in.
 *
 * SAFETY: refuses to run unless DATABASE_URL is pointed at the demo DB
 * (DATABASE_URL === DEMO_DATABASE_URL), so it can never grant access to or read
 * from production. Run it with the demo URL injected:
 *
 *   npx dotenv -e .env.local -o -- bash -c \
 *     'DATABASE_URL="$DEMO_DATABASE_URL" DIRECT_URL="$DEMO_DIRECT_URL" \
 *      tsx scripts/demo-investor-check.ts [clerkUserId]'
 *
 * clerkUserId defaults to "demo-investor-local" (a synthetic id for the data-path
 * test). Pass a real Clerk user id to provision a browser sign-in login.
 */
import { prisma } from "../src/lib/prisma";
import { loadDashboardData } from "../src/lib/dashboard/data";
import { money, pct } from "../src/lib/format";

const DEMO_SLUG = "demo-bistro";

async function main() {
  const dbUrl = process.env.DATABASE_URL?.trim();
  const demoUrl = process.env.DEMO_DATABASE_URL?.trim();
  if (!demoUrl) throw new Error("DEMO_DATABASE_URL is not set.");
  if (!dbUrl || dbUrl !== demoUrl) {
    throw new Error(
      "Refusing to run: DATABASE_URL must equal DEMO_DATABASE_URL. " +
        "Launch with DATABASE_URL=\"$DEMO_DATABASE_URL\" so this only ever touches the demo DB.",
    );
  }

  const clerkUserId = process.argv[2]?.trim() || "demo-investor-local";

  const restaurant = await prisma.restaurant.findFirst({
    where: { slug: DEMO_SLUG },
    select: { id: true, name: true },
  });
  if (!restaurant) {
    throw new Error(`Demo Bistro (slug "${DEMO_SLUG}") not found — seed it first (scripts/seed-demo-tour.ts).`);
  }

  await prisma.userRestaurantRole.upsert({
    where: { clerkUserId_restaurantId: { clerkUserId, restaurantId: restaurant.id } },
    create: { clerkUserId, restaurantId: restaurant.id, role: "INVESTOR" },
    update: { role: "INVESTOR" },
  });
  console.log(`Granted INVESTOR on "${restaurant.name}" (${restaurant.id}) to clerkUserId="${clerkUserId}".`);

  // Replicate src/app/investor/page.tsx exactly.
  const roles = await prisma.userRestaurantRole.findMany({
    where: { clerkUserId, role: "INVESTOR" },
    select: { restaurantId: true },
    distinct: ["restaurantId"],
  });

  if (roles.length === 0) {
    console.log("No INVESTOR roles resolved — /investor would show the empty state.");
    return;
  }

  for (const role of roles) {
    const data = await loadDashboardData(role.restaurantId);
    const readinessChecks = data.goLiveCoach.checks;
    const readiness = readinessChecks.length
      ? (readinessChecks.filter((c) => c.ready).length / readinessChecks.length) * 100
      : 0;
    console.log("\n────────── Investor Matrix (as /investor would render) ──────────");
    console.log(`Business:            ${data.name}`);
    console.log(`Period:              ${data.periodLabel}`);
    console.log(`Go-live readiness:   ${pct(readiness, 0)}`);
    console.log(`Revenue (MTD):       ${money(data.revenue.revenueMTD)}`);
    console.log(`Real revenue:        ${money(data.realRevenue)}`);
    console.log(`Prime cost:          ${pct(data.heartbeat.primeCostPct, 1)}`);
    console.log(
      `Cash oxygen:         ${
        data.goLiveCoach.cashSafety.hasAnchor
          ? money(data.goLiveCoach.cashSafety.minimumOperatingCash ?? 0)
          : "Anchor needed"
      }`,
    );
    console.log(
      `Source freshness:    ${data.sourceSetup.connectedCount}/${data.sourceSetup.requiredCount} required connected`,
    );
    console.log("─────────────────────────────────────────────────────────────────");
  }

  console.log("\n✓ Investor data path renders on demo data. Auth (Clerk userId) is the only piece left for a browser login.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("demo-investor-check failed —", e instanceof Error ? e.message : e);
    process.exit(1);
  });
