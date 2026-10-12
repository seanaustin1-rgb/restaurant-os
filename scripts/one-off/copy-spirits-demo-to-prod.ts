/**
 * One-time, operator-run copy. NEVER load .env.local or use DATABASE_URL here.
 * Set SOURCE_URL (outfront-demo) and TARGET_URL (production) in the shell, then:
 *   npx.cmd tsx scripts/one-off/copy-spirits-demo-to-prod.ts --source-restaurant=<id> --target-restaurant=<id> --dry-run
 * Writes require --apply instead. See docs/spirit-vault/COPY-DEMO-TO-PROD.md.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import {
  COPY_TABLES, parseCopyArgs, validateCopyUrls, planSpiritCopy, finishSpiritCopy,
  type CopyPlan,
} from "../../src/lib/spirit-vault/copy-spirits";
import { publicTables, readSnapshot, referenceExists, skippedTables, upsertRow, lockCopyTables, targetTriggerGaps } from "./copy-spirits-store";

function report(plan: CopyPlan, skipped: { table: string; skipped: number }[], apply: boolean) {
  console.log(apply ? "APPLY preflight (counts projected until COMMITTED)" : "DRY RUN (read-only; no writes)");
  console.table(plan.tables.map(({ table, inserted, updated, skipped }) => ({ table, inserted, updated, skipped })));
  console.log("Excluded tables (never copied; source counts only):");
  console.table(skipped.map((row) => ({ ...row, inserted: 0, updated: 0 })));
  console.log("All other non-allowlisted tables, including Restaurant and UserRestaurantRole, are skipped.");
  console.log(`Foreign-key/schema gaps: ${plan.gaps.length}`);
  for (const gap of plan.gaps) console.log(`  GAP: ${gap}`);
  console.log(`Identity/unique-key conflicts: ${plan.conflicts.length}`);
  for (const conflict of plan.conflicts) console.log(`  CONFLICT: ${conflict}`);
}

async function main(args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  const options = parseCopyArgs(args);
  const urls = validateCopyUrls(env.SOURCE_URL, env.TARGET_URL);
  // Dedicated clients; no import of the application's prod/demo singleton.
  const source = new PrismaClient({ datasources: { db: { url: urls.source } }, errorFormat: "minimal" });
  const target = new PrismaClient({ datasources: { db: { url: urls.target } }, errorFormat: "minimal" });
  try {
    const snapshot = await source.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      // Error rather than silently reading a policy-filtered subset. This does
      // not grant RLS bypass privileges or change any database policy.
      await tx.$executeRawUnsafe("SET LOCAL row_security = off");
      if (!await referenceExists(tx, { table: "Restaurant", columns: ["id"], referencedColumns: ["id"] }, { id: options.sourceRestaurant })) {
        throw new Error("Source restaurant does not exist.");
      }
      const tables = await publicTables(tx);
      return { data: await readSnapshot(tx, tables, options.sourceRestaurant), skipped: await skippedTables(tx, tables) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000 });

    await target.$transaction(async (tx) => {
      if (!options.apply) await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL row_security = off");
      const tables = await publicTables(tx);
      if (options.apply) await lockCopyTables(tx, tables);
      const data = await readSnapshot(tx, tables);
      const plan = await planSpiritCopy(snapshot.data, data, options, (fk, values) => referenceExists(tx, fk, values));
      plan.gaps.push(...await targetTriggerGaps(tx, tables));
      if (!await referenceExists(tx, { table: "Restaurant", columns: ["id"], referencedColumns: ["id"] }, { id: options.targetRestaurant })) {
        plan.gaps.push("Target restaurant does not exist; Restaurant rows are never copied.");
      }
      // Make the optional table status explicit even when it has zero rows.
      for (const table of COPY_TABLES) {
        if (!snapshot.data[table]) console.log(`${table}: source table absent${table === "CustomFlightTemplate" ? " (optional; skipped)" : ""}.`);
        else if (!data[table]) console.log(`${table}: target table absent.`);
      }
      report(plan, snapshot.skipped, options.apply);
      await finishSpiritCopy(plan, { upsert: (table, columns, row) => upsertRow(tx, table, columns, row) }, options.apply);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000, maxWait: 10_000 });
    console.log(options.apply ? "COMMITTED: all planned writes succeeded in one transaction." : "Dry-run complete. No rows were written.");
  } catch (error) {
    // Driver messages can contain credentials, connection URLs or row contents.
    // Emit our own preflight errors, but never print Prisma/driver diagnostics.
    const own = error instanceof Error && !error.name.startsWith("Prisma")
      && /^(Source restaurant|Preflight failed|Copy refused|Unsupported database|\w+: (expression|cross-schema))/.test(error.message);
    throw new Error(own ? error.message : "Copy aborted. Database/schema/constraint operation failed; any target writes were rolled back. No driver details are logged.");
  } finally {
    await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
  }
}

// This file is a CLI entry point, never imported by tests or application code.
// Offline tests import only the planner and store modules (neither opens clients).
main(process.argv.slice(2), process.env).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Copy aborted.");
  process.exitCode = 1;
});
