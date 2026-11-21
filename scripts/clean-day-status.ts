/**
 * V1-gate status — how many consecutive clean reconciliation days a tenant has.
 *
 * Reads the stored per-day verdicts (ReconciliationDay, written nightly at 7:30am ET
 * by the Inngest clean-day check) and reports the current streak against the gate
 * bar (7). With --evaluate it also computes TODAY's verdict live from the database
 * and prints each rule's pass/fail — use that to see what is blocking a clean day
 * right now. Read-only unless --commit is given with --evaluate, which records
 * today's verdict (same upsert the nightly job does; idempotent).
 *
 * Run (slug or unambiguous name):
 *   npx dotenv -e .env.local -o -- tsx scripts/clean-day-status.ts stone
 *   npx dotenv -e .env.local -o -- tsx scripts/clean-day-status.ts stone --evaluate
 *   npx dotenv -e .env.local -o -- tsx scripts/clean-day-status.ts stone --evaluate --commit
 *
 * Needs the add_reconciliation_day migration applied (operator: `prisma migrate deploy`).
 */
import { prisma } from "../src/lib/prisma";
import { cleanStreak, localDayBounds, GATE_CLEAN_DAYS } from "../src/lib/financial-ledger/clean-day";
import {
  evaluateCleanDayForTenant,
  loadStoredDays,
  recordCleanDay,
} from "../src/lib/financial-ledger/clean-day-loader";

// Exact @unique slug wins; else an unambiguous name substring (same rule as the other tools).
async function resolveTenant(query: string) {
  const bySlug = await prisma.restaurant.findUnique({
    where: { slug: query },
    select: { id: true, name: true, slug: true, timezone: true },
  });
  if (bySlug) return bySlug;
  const byName = await prisma.restaurant.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    select: { id: true, name: true, slug: true, timezone: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  if (byName.length === 1) return byName[0];
  if (byName.length === 0) console.error(`No business found matching "${query}".`);
  else console.error(`"${query}" is ambiguous: ${byName.map((r) => `${r.name} (${r.slug})`).join(", ")}. Use an exact slug.`);
  process.exit(1);
}

const mark = (pass: boolean | null) => (pass === null ? "–" : pass ? "✓" : "✗");

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const query = args.find((a) => !a.startsWith("--"));
  if (!query) {
    console.error('Usage: clean-day-status.ts "<name or slug>" [--evaluate [--commit]]');
    process.exit(1);
  }
  if (flags.has("--commit") && !flags.has("--evaluate")) {
    console.error("--commit only applies together with --evaluate.");
    process.exit(1);
  }

  const tenant = await resolveTenant(query);
  const today = localDayBounds(new Date(), tenant.timezone ?? "America/New_York").date;

  console.log(`\n${"═".repeat(72)}`);
  console.log(`${tenant.name} (${tenant.slug}) — V1 gate: clean reconciliation days`);
  console.log("═".repeat(72));

  if (flags.has("--evaluate")) {
    const result = await evaluateCleanDayForTenant(prisma, tenant.id);
    console.log(`Today (${result.date}) — live evaluation: ${result.verdict.clean ? "CLEAN" : "NOT CLEAN"}`);
    for (const c of result.verdict.checks) {
      console.log(`  ${mark(c.pass)} ${c.key.padEnd(18)} ${c.detail}`);
    }
    console.log(`  · open exception backlog (informational): ${result.verdict.openBacklogCount}`);
    if (flags.has("--commit")) {
      await recordCleanDay(prisma, tenant.id, result);
      console.log(`  Recorded verdict for ${result.date}.`);
    } else {
      console.log("  Dry run — nothing written. Add --commit to record today's verdict.");
    }
    console.log("─".repeat(72));
  }

  const days = await loadStoredDays(prisma, tenant.id, 30);
  const status = cleanStreak(days, today);
  console.log("Stored verdicts (newest first):");
  if (days.length === 0) console.log("  (none yet — the nightly check records one per day)");
  for (const d of days.slice(0, 14)) console.log(`  ${d.clean ? "✓ clean" : "✗ dirty"}  ${d.date}`);
  console.log("─".repeat(72));
  console.log(
    status.gatePassed
      ? `✓ GATE PASSED — ${status.streak} consecutive clean days (through ${status.through}); bar is ${GATE_CLEAN_DAYS}.`
      : `✗ ${status.streak} of ${GATE_CLEAN_DAYS} consecutive clean days${status.through ? ` (through ${status.through})` : ""}.`,
  );
  console.log("\nA missing day breaks the streak. Compare-spines on a trailing month is a separate gate item.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
