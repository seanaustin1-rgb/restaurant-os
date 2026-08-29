/**
 * Import the 110 static Spirit Vault guest records into the #137 split schema
 * (SpiritDefinition / VenueSpirit / SpiritPour / SpiritPriceObservation).
 *
 * Run (DRY RUN — projects the DB effect, writes nothing):
 *   npx dotenv -e .env.local -o -- node scripts/demo-db.cjs "npx tsx scripts/import-spirit-vault.ts --restaurant=<restaurantId> --require-db"
 *   (reads existing rows to show would-insert/would-update; falls back to PLANNED
 *    counts with existence unverified if the DB is unreachable)
 *
 * Run (APPLY to a NON-PROD database — the everyday path):
 *   SPIRIT_VAULT_ALLOWED_TARGETS=<outfront-demo-ref> \
 *   npx dotenv -e .env.local -o -- node scripts/demo-db.cjs \
 *     "npx tsx scripts/import-spirit-vault.ts --restaurant=<restaurantId> --apply \
 *      --confirm-target=<outfront-demo-ref> --expect-records=<N> --expect-published=<N>"
 *
 * Run (SEED AN EMPTY PRODUCTION TENANT — one-shot, see --production-seed below):
 *   SPIRIT_VAULT_PROD_TARGET=<prod-ref> \
 *   npx dotenv -e .env.production.local -o -- \
 *     npx tsx scripts/import-spirit-vault.ts --restaurant=<restaurantId> --apply \
 *       --production-seed --confirm-target=<prod-ref> --expect-records=<N> --expect-published=<N>
 *
 * Guards (all must hold before a single row is written):
 *   • --apply is required to write; default is a dry run with ZERO writes.
 *   • --restaurant=<id> is required and must resolve to an existing Restaurant —
 *     the tenant is NEVER guessed.
 *   • --expect-records / --expect-published state the baseline you believe you are
 *     importing, and the plan must match exactly. Required for every --apply, so a
 *     record set nobody looked at can never be written. (These replaced a hardcoded
 *     110/109, which wedged --apply on every content change.)
 *   • The approving value is always sourced INDEPENDENTLY of DATABASE_URL, so a
 *     database can never authorize itself by echoing its own ref:
 *       – default mode: SPIRIT_VAULT_ALLOWED_TARGETS, the approved NON-PROD allowlist.
 *       – --production-seed: SPIRIT_VAULT_PROD_TARGET, a deliberately DIFFERENT
 *         variable naming exactly ONE database, so a production ref pasted onto the
 *         everyday allowlist grants nothing.
 *   • --confirm-target must ALSO equal that ref (a conscious, typed acknowledgement).
 *   • Default mode refuses when NODE_ENV=production. --production-seed does not consult
 *     NODE_ENV — it describes the process, never the database, and a seed is legitimately
 *     run from an operator machine — and instead requires the tenant to hold ZERO
 *     VenueSpirit rows. It can therefore only ever seed an empty vault, never overwrite
 *     curated production data. After the seed, production content is edited in the admin
 *     (/admin/spirit-vault), not re-imported.
 *
 * The guard decisions themselves are pure and unit-tested in
 * src/lib/spirit-vault/import-guards.ts — this script only reads env and the DB.
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
import {
  checkApplyGuards,
  checkPlanBaseline,
  requiresEmptyTenant,
  type ApplyMode,
} from "../src/lib/spirit-vault/import-guards";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf("=");
  return eq >= 0 ? hit.slice(eq + 1) : "";
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
/** Numeric flag value; undefined when absent, NaN when present but not a number. */
function numArg(name: string): number | undefined {
  const raw = arg(name);
  if (raw === undefined) return undefined;
  // `--expect-records` with no value must not read as 0.
  return raw.trim() === "" ? Number.NaN : Number(raw);
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

/** The baseline flags this plan would satisfy — an --apply is refused without them. */
function printExpectHint(plan: ImportPlan) {
  console.log(
    `\nTo apply this exact plan, state its baseline:\n` +
      `  --expect-records=${plan.totals.records} --expect-published=${plan.totals.published}`,
  );
}

function reportBaseline(plan: ImportPlan, expected: { records?: number; published?: number }): boolean {
  const verdict = checkPlanBaseline(plan, expected);
  if (!verdict.ok) {
    console.error(`\n\u2717 ${verdict.reason}`);
    return false;
  }
  return true;
}

async function main() {
  const restaurantId = arg("restaurant");
  const apply = flag("apply");
  const requireDb = flag("require-db");
  const confirmTarget = arg("confirm-target");
  const productionSeed = flag("production-seed");
  const mode: ApplyMode = productionSeed ? "production-seed" : "non-prod";
  const expected = { records: numArg("expect-records"), published: numArg("expect-published") };

  if (!restaurantId) {
    console.error("Missing --restaurant=<restaurantId>. The tenant is never guessed.");
    process.exit(1);
  }
  for (const [flagName, value] of [
    ["expect-records", expected.records],
    ["expect-published", expected.published],
  ] as const) {
    if (value !== undefined && !Number.isInteger(value)) {
      console.error(`--${flagName} must be a whole number.`);
      process.exit(1);
    }
  }

  // ── Pure planning stage (no DB) ──
  const records = loadGuestRecords();
  const plan = planImport(records);

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
        printExpectHint(plan);
      }
    } catch (dbErr) {
      // DB-free fallback: the database was unreachable (e.g. tables not migrated
      // here). Report PLANNED totals and state clearly that nothing was verified.
      console.warn(`\n⚠ Could not read the database (${(dbErr as Error).message}).`);
      console.warn("Falling back to PLANNED counts — tenant/target existence NOT verified.\n");
      printPlannedFallback(plan, restaurantId);
      printExpectHint(plan);
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
  if (!reportBaseline(plan, expected)) {
    await prisma.$disconnect();
    process.exit(1);
  }

  const target = targetIdentity(process.env.DATABASE_URL);
  console.log(`\nmode:                     ${mode === "production-seed" ? "PRODUCTION SEED (empty tenant only)" : "non-prod apply"}`);
  console.log(`DATABASE_URL target host: ${target.host}`);
  console.log(`DATABASE_URL target ref:  ${target.token}`);

  const guard = checkApplyGuards({
    mode,
    targetToken: target.token,
    confirmTarget: confirmTarget ?? null,
    nodeEnv: process.env.NODE_ENV,
    allowedTargets: process.env.SPIRIT_VAULT_ALLOWED_TARGETS,
    prodTarget: process.env.SPIRIT_VAULT_PROD_TARGET,
  });
  if (!guard.ok) {
    console.error(`\n${guard.reason}`);
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

  // A production seed may only ever SEED. If the tenant already holds listings, the
  // vault is live and its records are curated in the admin — importing over them
  // would silently revert operator edits, so refuse rather than merge.
  if (requiresEmptyTenant(mode)) {
    const existing = await prisma.venueSpirit.count({ where: { restaurantId } });
    if (existing > 0) {
      console.error(
        `\nRefusing to seed: restaurant ${restaurant.name} already has ${existing} VenueSpirit ` +
          `row${existing === 1 ? "" : "s"}.\n` +
          "--production-seed is a one-shot seed of an EMPTY tenant and will not overwrite curated\n" +
          "records. Edit published content in the admin (/admin/spirit-vault) instead.",
      );
      await prisma.$disconnect();
      process.exit(1);
    }
    console.log("Tenant holds 0 VenueSpirit rows \u2014 seed precondition satisfied.");
  }

  const report = await executeImport(createPrismaSpiritStore(prisma), plan, {
    restaurantId,
    apply: true,
  });
  printReport(report);
  console.log(mode === "production-seed" ? "PRODUCTION SEED complete." : "APPLY complete.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\nImport failed — the transaction was rolled back; no partial rows were written.");
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
