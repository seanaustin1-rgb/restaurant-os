/**
 * Seed the public Mode-1 tour's "Demo Bistro" tenant (stable slug "demo-bistro")
 * that /demo/tour reads. DELIBERATE, operator-run write — the public route never
 * writes. Run once (and again after a month rollover) to make /demo/tour live.
 *
 * Writes go ONLY to DEMO_DATABASE_URL (the separate demo database); it refuses to
 * run if that isn't set, so it can never touch production. Set DEMO_DATABASE_URL
 * in .env.local (the demo DB's pooled connection string) first, then:
 *   npx dotenv -e .env.local -o -- tsx scripts/seed-demo-tour.ts
 *
 * Idempotent: re-running refreshes the current month's data for the Demo Bistro.
 */
import { seedDemoBistro } from "../src/lib/demo/demo-tenant";

seedDemoBistro()
  .then((id) => {
    console.log(`Seeded Demo Bistro (${id}) — /demo/tour is now live.`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("seed-demo-tour failed —", e instanceof Error ? e.message : e);
    process.exit(1);
  });
