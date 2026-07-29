/**
 * Import the 110 static Spirit Vault guest records into the #137 split schema
 * (SpiritDefinition / VenueSpirit / SpiritPour / SpiritPriceObservation).
 *
 * Run (DRY RUN — reads the vault, writes nothing):
 *   npx dotenv -e .env.local -o -- tsx scripts/import-spirit-vault.ts --restaurant=<restaurantId>
 *
 * Run (APPLY — writes to the DB DATABASE_URL points at; NON-PROD only):
 *   npx dotenv -e .env.local -o -- tsx scripts/import-spirit-vault.ts \
 *     --restaurant=<restaurantId> --apply --confirm-target=<supabase-project-ref>
 *
 * Guards (all must hold before a single row is written):
 *   • --apply is required to write; default is a dry run with ZERO writes.
 *   • --restaurant=<id> is required and must resolve to an existing Restaurant —
 *     the tenant is NEVER guessed.
 *   • --confirm-target must equal the project ref / host parsed from DATABASE_URL,
 *     so you cannot write to a database without consciously naming it (this is the
 *     non-production confirmation — the migration was applied to `outfront-demo`).
 *   • Refuses when NODE_ENV=production.
 *
 * Idempotent, transactional, seed-first price history — see src/lib/spirit-vault/
 * import-spirits.ts. Reuses the merged transform + validate + loader (#137).
 */
import { prisma } from "../src/lib/prisma";
import { loadGuestRecords } from "../src/lib/spirit-vault/load-guest-records";
import {
  planImport,
  executeImport,
  createPrismaSpiritStore,
  type ImportPlan,
  type ImportReport,
} from "../src/lib/spirit-vault/import-spirits";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf("=");
  return eq >= 0 ? hit.slice(eq + 1) : "";
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** Best-effort identity of the DB DATABASE_URL points at, for the confirm gate. */
function targetIdentity(dbUrl: string | undefined): { token: string; host: string } {
  if (!dbUrl) return { token: "", host: "" };
  let host = "";
  try {
    host = new URL(dbUrl).host;
  } catch {
    host = dbUrl;
  }
  // Supabase project ref appears as `postgres.<ref>` (pooler) or `db.<ref>.supabase.co`.
  const pooler = dbUrl.match(/postgres\.([a-z0-9]{16,})/i);
  const direct = host.match(/db\.([a-z0-9]{16,})\.supabase/i);
  const token = (pooler?.[1] || direct?.[1] || host).toLowerCase();
  return { token, host };
}

function printReport(report: ImportReport) {
  const { totals } = report;
  console.log("\n───────────── Spirit Vault import report ─────────────");
  console.log(`mode:        ${report.dryRun ? "DRY RUN (no writes)" : "APPLIED"}`);
  console.log(`restaurant:  ${report.restaurantId}`);
  console.log(`records:     ${totals.records}  (published ${totals.published}, writable ${totals.writable})`);
  const line = (label: string, c: { inserted: number; updated: number; skipped: number }) =>
    console.log(`  ${label.padEnd(16)} inserted ${c.inserted}  updated ${c.updated}  skipped ${c.skipped}`);
  line("definitions", report.definitions);
  line("venue listings", report.venueListings);
  line("offers", report.offers);
  console.log(
    `  ${"price obs".padEnd(16)} inserted ${report.priceObservations.inserted}  skipped ${report.priceObservations.skipped}`,
  );

  if (report.validationFailures.length) {
    console.log(`\n⚠ validation failures (${report.validationFailures.length}) — NOT written:`);
    for (const f of report.validationFailures) {
      console.log(`  • ${f.slug}: ${f.errors.map((e) => `${e.field} (${e.message})`).join("; ")}`);
    }
  } else {
    console.log("\n✓ validation failures: none");
  }

  if (report.duplicateKeys.length) {
    console.log(`\n⚠ duplicate canonical keys (${report.duplicateKeys.length}) — later occurrence dropped:`);
    for (const d of report.duplicateKeys) {
      console.log(`  • ${d.kind} "${d.key}" collides across ${d.slugs.join(" / ")}`);
    }
  } else {
    console.log("✓ unresolved identities / duplicate keys: none");
  }
  console.log("──────────────────────────────────────────────────────\n");
}

function assertPlanMatchesExpectation(plan: ImportPlan) {
  const problems: string[] = [];
  if (plan.totals.records !== 110) problems.push(`expected 110 records, got ${plan.totals.records}`);
  if (plan.totals.published !== 108) problems.push(`expected 108 published, got ${plan.totals.published}`);
  if (plan.validationFailures.length)
    problems.push(`expected 0 validation failures, got ${plan.validationFailures.length}`);
  if (plan.duplicateKeys.length)
    problems.push(`expected 0 duplicate keys, got ${plan.duplicateKeys.length}`);
  if (problems.length) {
    console.error("\n✗ Plan does not match the known-good baseline — refusing to apply:");
    for (const p of problems) console.error(`  • ${p}`);
    console.error(
      "\n(Dry-run only prints; --apply is blocked until the vault plans to 110/108 cleanly.)",
    );
    return false;
  }
  return true;
}

async function main() {
  const restaurantId = arg("restaurant");
  const apply = flag("apply");
  const confirmTarget = arg("confirm-target");

  if (!restaurantId) {
    console.error("Missing --restaurant=<restaurantId>. The tenant is never guessed.");
    process.exit(1);
  }

  // ── Pure planning stage (no DB) ──
  const records = loadGuestRecords();
  const plan = planImport(records);
  const planOk = assertPlanMatchesExpectation(plan);

  // ── DRY RUN (default): report the intended shape, touch nothing ──
  if (!apply) {
    // Store is constructed but never queried on the dry-run path.
    const report = await executeImport(createPrismaSpiritStore(prisma), plan, { restaurantId });
    printReport(report);
    console.log("DRY RUN complete — no database writes. Re-run with --apply to write.");
    await prisma.$disconnect();
    return;
  }

  // ── APPLY: every guard must pass ──
  if (!planOk) {
    await prisma.$disconnect();
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to apply with NODE_ENV=production.");
    await prisma.$disconnect();
    process.exit(1);
  }

  const target = targetIdentity(process.env.DATABASE_URL);
  if (!target.token) {
    console.error("Cannot determine the DATABASE_URL target — refusing to write to an unverifiable database.");
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`\nDATABASE_URL target host: ${target.host}`);
  console.log(`DATABASE_URL target ref:  ${target.token}`);
  if (confirmTarget == null || confirmTarget.toLowerCase() !== target.token) {
    console.error(
      `\nRefusing to apply: pass --confirm-target=${target.token} to confirm you intend to write to THIS database.`,
    );
    console.error("(The #137 migration was applied to the non-prod `outfront-demo` project — confirm you are pointed there.)");
    await prisma.$disconnect();
    process.exit(1);
  }

  // Tenant must exist — never guess or create it.
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true },
  });
  if (!restaurant) {
    console.error(`Restaurant ${restaurantId} does not exist in this database. Aborting.`);
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`Applying to restaurant: ${restaurant.name} (${restaurant.id})`);

  const report = await executeImport(createPrismaSpiritStore(prisma), plan, {
    restaurantId,
    apply: true,
  });
  printReport(report);
  console.log("APPLY complete.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\nImport failed — the transaction was rolled back; no partial rows were written.");
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
