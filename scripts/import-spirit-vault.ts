/**
 * Import the 110 static Spirit Vault guest records into the #137 split schema
 * (SpiritDefinition / VenueSpirit / SpiritPour / SpiritPriceObservation).
 *
 * Run (DRY RUN — projects the DB effect, writes nothing):
 *   npx dotenv -e .env.local -o -- node scripts/demo-db.cjs "npx tsx scripts/import-spirit-vault.ts --restaurant=<restaurantId> --require-db"
 *   (reads existing rows to show would-insert/would-update; falls back to PLANNED
 *    counts with existence unverified if the DB is unreachable)
 *
 * Run (APPLY — writes to the DB DATABASE_URL points at; NON-PROD only):
 *   SPIRIT_VAULT_ALLOWED_TARGETS=<outfront-demo-ref> \
 *   npx dotenv -e .env.local -o -- node scripts/demo-db.cjs \
 *     "npx tsx scripts/import-spirit-vault.ts --restaurant=<restaurantId> --apply --confirm-target=<outfront-demo-ref>"
 *
 * Guards (all must hold before a single row is written):
 *   • --apply is required to write; default is a dry run with ZERO writes.
 *   • --restaurant=<id> is required and must resolve to an existing Restaurant —
 *     the tenant is NEVER guessed.
 *   • SPIRIT_VAULT_ALLOWED_TARGETS (env) is the approved non-prod allowlist,
 *     sourced INDEPENDENTLY of DATABASE_URL. The DATABASE_URL-derived ref must be
 *     on it, so a production URL cannot authorize itself by echoing its own ref.
 *   • --confirm-target must ALSO equal that ref (a conscious, typed acknowledgement).
 *   • Refuses when NODE_ENV=production (belt-and-suspenders; not the primary guard).
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
  if (report.dryRun) console.log("             counts below are PROJECTED (would-insert / would-update).");
  console.log(`restaurant:  ${report.restaurantId}`);
  console.log(
    `tenant:      ${report.tenantVerified ? "EXISTS ✓" : "NOT FOUND ✗ — projection is NOT executable (--apply would abort)"}`,
  );
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

/** DB-free preview: the most the importer WOULD do, with existence unverified. */
function printPlannedFallback(plan: ImportPlan, restaurantId: string) {
  const { totals } = plan;
  console.log("───────── Spirit Vault import — PLANNED (DB-free) ─────────");
  console.log(`restaurant:  ${restaurantId}  (existence NOT verified)`);
  console.log(`records:     ${totals.records}  (published ${totals.published}, writable ${totals.writable})`);
  console.log(`  would create OR update up to ${totals.writable} definitions / venue listings / offers`);
  console.log(`  would seed up to ${totals.writable} initial price observations (priced offers only)`);
  console.log(`  validation failures: ${plan.validationFailures.length}`);
  console.log(`  duplicate records dropped: ${plan.duplicateRecords} (${plan.duplicateKeys.length} key diagnostics)`);
  console.log("(insert-vs-update split needs a reachable DB; point at the demo target to project it.)");
  console.log("──────────────────────────────────────────────────────────\n");
}

function assertPlanMatchesExpectation(plan: ImportPlan) {
  const problems: string[] = [];
  if (plan.totals.records !== 110) problems.push(`expected 110 records, got ${plan.totals.records}`);
  if (plan.totals.published !== 109) problems.push(`expected 109 published, got ${plan.totals.published}`);
  if (plan.validationFailures.length)
    problems.push(`expected 0 validation failures, got ${plan.validationFailures.length}`);
  if (plan.duplicateKeys.length)
    problems.push(`expected 0 duplicate keys, got ${plan.duplicateKeys.length}`);
  if (problems.length) {
    console.error("\n✗ Plan does not match the known-good baseline — refusing to apply:");
    for (const p of problems) console.error(`  • ${p}`);
    console.error(
      "\n(Dry-run only prints; --apply is blocked until the vault plans to 110/109 cleanly.)",
    );
    return false;
  }
  return true;
}

async function main() {
  const restaurantId = arg("restaurant");
  const apply = flag("apply");
  const requireDb = flag("require-db");
  const confirmTarget = arg("confirm-target");

  if (!restaurantId) {
    console.error("Missing --restaurant=<restaurantId>. The tenant is never guessed.");
    process.exit(1);
  }

  // ── Pure planning stage (no DB) ──
  const records = loadGuestRecords();
  const plan = planImport(records);
  const planOk = assertPlanMatchesExpectation(plan);

  // ── DRY RUN (default): project the planned DB effect, write nothing ──
  if (!apply) {
    try {
      // Read-only projection against the selected tenant: reports would-insert
      // vs would-update by reading existing rows. Never writes.
      const report = await executeImport(createPrismaSpiritStore(prisma), plan, { restaurantId });
      printReport(report);
      if (!report.tenantVerified) {
        console.log(
          "DRY RUN complete — no writes. ⚠ The restaurant does not exist in this DB, so the\n" +
            "projection above is NOT executable: --apply would abort. Fix --restaurant, then re-run.",
        );
        if (requireDb) {
          await prisma.$disconnect();
          process.exit(1);
        }
      } else {
        console.log(
          "DRY RUN complete — no database writes. Counts are the projected effect against this DB.\n" +
            "Re-run with --apply (and the target guards) to write.",
        );
      }
    } catch (dbErr) {
      // DB-free fallback: the database was unreachable (e.g. tables not migrated
      // here). Report PLANNED totals and state clearly that nothing was verified.
      console.warn(`\n⚠ Could not read the database (${(dbErr as Error).message}).`);
      console.warn("Falling back to PLANNED counts — tenant/target existence NOT verified.\n");
      printPlannedFallback(plan, restaurantId);
      if (requireDb) {
        console.error("--require-db was passed, so this dry-run is not acceptable for operator apply.");
        await prisma.$disconnect();
        process.exit(1);
      }
    }
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

  // The non-production allowlist is the authority — sourced INDEPENDENTLY of
  // DATABASE_URL (env SPIRIT_VAULT_ALLOWED_TARGETS), so a production URL cannot
  // authorize itself just by echoing its own ref. NODE_ENV describes the process,
  // never the database, so it is not trusted for this.
  const allowlist = (process.env.SPIRIT_VAULT_ALLOWED_TARGETS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  console.log(`\nDATABASE_URL target host: ${target.host}`);
  console.log(`DATABASE_URL target ref:  ${target.token}`);

  if (allowlist.length === 0) {
    console.error(
      "\nRefusing to apply: no approved non-production targets configured.\n" +
        "Set SPIRIT_VAULT_ALLOWED_TARGETS to the approved non-prod project ref(s) — the #137\n" +
        "migration was applied to `outfront-demo`, so set it to that project's ref (comma-separated\n" +
        "for multiple). This allowlist is deliberately NOT derived from DATABASE_URL.",
    );
    await prisma.$disconnect();
    process.exit(1);
  }
  if (!allowlist.includes(target.token)) {
    console.error(
      `\nRefusing to apply: DATABASE_URL target "${target.token}" is NOT in the approved\n` +
        `non-production allowlist [${allowlist.join(", ")}]. Point at an approved DB or fix the allowlist.`,
    );
    await prisma.$disconnect();
    process.exit(1);
  }
  // Second, conscious acknowledgement: the operator must type the ref too.
  if (confirmTarget == null || confirmTarget.toLowerCase() !== target.token) {
    console.error(
      `\nRefusing to apply: also pass --confirm-target=${target.token} to acknowledge THIS database.`,
    );
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
