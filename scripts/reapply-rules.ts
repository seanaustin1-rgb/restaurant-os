/**
 * Re-apply the CURRENT categorization rules to a tenant's existing bank-fed rows,
 * and keep the clean ledger in step. Rule edits never retro-move rows on their
 * own — run this after any rule change (it replaces the recategorize-transactions
 * script removed in #33, which also never touched the ledger).
 *
 * Dry run (default — writes nothing, not even default categories/rules):
 *   npx dotenv -e .env.local -o -- tsx scripts/reapply-rules.ts --tenant <slug>
 * Apply:
 *   npx dotenv -e .env.local -o -- tsx scripts/reapply-rules.ts --tenant <slug> --commit
 *
 * --tenant takes an exact slug, or a name substring that matches exactly one
 * business (Stone has an empty duplicate tenant, so an ambiguous name refuses).
 *
 * Scope: Transaction rows with a plaidConnectionId and isManualOverride=false —
 * hand-tagged and statement-import rows are untouched. Each moved row is updated
 * and re-mirrored to the ledger in one transaction, the same way the Plaid sync
 * writes it. Rows whose ledger event was already decided on the review page (or
 * by triage-exceptions.ts) are HELD and listed: neither spine moves, because a
 * re-mirror would wipe that decision. Decision logic: src/lib/categorization/reapply.ts.
 */
import { prisma } from "../src/lib/prisma";
import { categoryIdByName, categoryTapById, MISC_CATEGORY_NAME, revenueCategoryId } from "../src/lib/categorization/categories";
import { loadRules, type CategorizationContext } from "../src/lib/categorization/rules";
import { planReapply, summarizeMoves, type ReapplyChange } from "../src/lib/categorization/reapply";
import { mirrorBankTransactionToLedger } from "../src/lib/financial-ledger/bank-transactions";

const LEGACY_BATCH = 100;

function parseArgs(argv: string[]): { tenant: string | null; commit: boolean } {
  const i = argv.indexOf("--tenant");
  return { tenant: i >= 0 ? argv[i + 1] ?? null : null, commit: argv.includes("--commit") };
}

// Exact @unique slug wins; else a name substring that matches exactly one
// business. Mirrors triage-exceptions.ts — this scopes every write, so it must
// never guess.
async function resolveTenant(query: string) {
  const bySlug = await prisma.restaurant.findUnique({
    where: { slug: query },
    select: { id: true, name: true, slug: true },
  });
  if (bySlug) return bySlug;
  const byName = await prisma.restaurant.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  if (byName.length === 1) return byName[0];
  if (byName.length === 0) console.error(`No business found matching "${query}" (tried exact slug and name).`);
  else
    console.error(
      `"${query}" is ambiguous — matched ${byName.map((r) => `${r.name} (${r.slug})`).join(", ")}. Re-run with an exact --tenant <slug>.`,
    );
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.tenant) {
    console.error('A tenant is required: --tenant <slug> (or a name that matches exactly one business).');
    process.exit(1);
  }
  const tenant = await resolveTenant(args.tenant);
  console.log(`Tenant: ${tenant.name} (${tenant.slug}, ${tenant.id})`);
  console.log(args.commit ? "MODE: COMMIT (writing changes)\n" : "MODE: DRY RUN (no writes — pass --commit to apply)\n");

  // Read-only context build: no ensureDefault* here, so a dry run truly writes nothing.
  const nameToId = await categoryIdByName(prisma, tenant.id);
  const tapById = await categoryTapById(prisma, tenant.id);
  const ctx: CategorizationContext = {
    rules: await loadRules(prisma, tenant.id),
    tapById,
    revenueId: nameToId.get("Sales Deposits") ?? revenueCategoryId(tapById),
    miscId: nameToId.get(MISC_CATEGORY_NAME) ?? null,
  };
  const nameById = new Map([...nameToId.entries()].map(([name, id]) => [id, name]));
  const categoryName = (id: string | null) => (id ? nameById.get(id) ?? "?" : "none");

  const rows = await prisma.transaction.findMany({
    where: { restaurantId: tenant.id, plaidConnectionId: { not: null }, isManualOverride: false },
    select: {
      id: true,
      plaidTxnId: true,
      date: true,
      merchantName: true,
      description: true,
      amount: true,
      categoryId: true,
      bucket: true,
    },
  });

  // Ledger events a person (or the triage script) already decided: approvedBy set,
  // or EXCLUDED. Auto-approval in the mirror never sets approvedBy.
  const decided = await prisma.normalizedFinancialEvent.findMany({
    where: {
      restaurantId: tenant.id,
      OR: [{ approvedBy: { not: null } }, { mappingStatus: "EXCLUDED" }],
      rawSourceEvent: { is: { sourceSystem: "plaid", sourceObjectType: "bank_transaction" } },
    },
    select: { rawSourceEvent: { select: { sourceObjectId: true } } },
  });
  const humanDecided = new Set(
    decided.flatMap((d) => (d.rawSourceEvent ? [d.rawSourceEvent.sourceObjectId] : [])),
  );

  const plan = planReapply(
    ctx,
    rows.map((r) => ({ ...r, amount: Number(r.amount) })),
    humanDecided,
  );
  console.log(`Scanned ${plan.scanned} bank-fed, non-override rows.`);
  console.log(`Would move ${plan.changes.length}; holding ${plan.held.length} already reviewed on the ledger.\n`);
  for (const { move, count } of summarizeMoves(plan.changes, categoryName)) {
    console.log(`  ${String(count).padStart(4)}  ${move}`);
  }
  if (plan.held.length > 0) {
    console.log("\nHELD — re-decide these on /settings/sources/review if the new rule should win:");
    for (const { move, count } of summarizeMoves(plan.held, categoryName)) {
      console.log(`  ${String(count).padStart(4)}  ${move}`);
    }
  }

  if (!args.commit || plan.changes.length === 0) {
    console.log(args.commit ? "\nNothing to change." : "\nDRY RUN — re-run with --commit to apply.");
    return;
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  const mirrored = plan.changes.filter((c) => c.plaidTxnId);
  const legacyOnly = plan.changes.filter((c) => !c.plaidTxnId);

  // Rows with a Plaid id: legacy update + ledger re-mirror atomically, as the sync does.
  let done = 0;
  for (const c of mirrored) {
    const r = byId.get(c.id)!;
    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: c.id },
        data: { categoryId: c.categoryId, bucket: c.bucket, confidence: c.confidence },
      });
      await mirrorBankTransactionToLedger(tx, {
        restaurantId: tenant.id,
        sourceSystem: "plaid",
        sourceObjectId: c.plaidTxnId!,
        payload: {
          transaction_id: c.plaidTxnId!,
          date: r.date.toISOString().slice(0, 10),
          amount: Number(r.amount),
          name: r.description,
          merchant_name: r.merchantName,
        },
        date: r.date,
        amount: Number(r.amount),
        merchantName: r.merchantName,
        description: r.description,
        categoryId: c.categoryId,
        bucket: c.bucket,
        confidence: c.confidence,
      });
    });
    done++;
    if (done % 25 === 0 || done === mirrored.length) console.log(`  ledger-mirrored ${done}/${mirrored.length}`);
  }

  // Bank-fed rows without a Plaid id have no ledger event to re-mirror.
  for (let i = 0; i < legacyOnly.length; i += LEGACY_BATCH) {
    const slice: ReapplyChange[] = legacyOnly.slice(i, i + LEGACY_BATCH);
    await prisma.$transaction(
      slice.map((c) =>
        prisma.transaction.update({
          where: { id: c.id },
          data: { categoryId: c.categoryId, bucket: c.bucket, confidence: c.confidence },
        }),
      ),
    );
  }
  if (legacyOnly.length > 0) console.log(`  legacy-only updated ${legacyOnly.length}`);

  console.log(`\nDone. Re-run scripts/summarize-sync-exceptions.ts ${tenant.slug} — moved rows below 0.8 confidence reopen for review.`);
}

main()
  .catch((e) => {
    console.error("FAILED:", e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
