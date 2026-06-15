/**
 * Re-run categorization over a restaurant's Plaid-fed transactions using the
 * CURRENT rules, via the shared categorize() decision (inflows → REVENUE by
 * sign; outflows → vendor rules). Fixes data that was categorized before a rule
 * change — e.g. after disabling an over-broad keyword rule.
 *
 *   DRY RUN:  npx dotenv -e .env.local -o -- tsx scripts/recategorize-transactions.ts
 *   APPLY:    npx dotenv -e .env.local -o -- tsx scripts/recategorize-transactions.ts --commit
 *
 * Scope: transactions with a plaidConnectionId (bank-fed) that are NOT manual
 * overrides — so hand-tagged rows and statement-import rows are left untouched.
 * Idempotent. Uses batched array $transaction (never interactive) — required for
 * Supabase's PgBouncer transaction pooler.
 */
import { prisma } from "../src/lib/prisma";
import {
  ensureDefaultCategories,
  categoryIdByName,
  categoryTapById,
  MISC_CATEGORY_NAME,
} from "../src/lib/categorization/categories";
import {
  ensureDefaultRules,
  loadRules,
  categorize,
  type CategorizationContext,
} from "../src/lib/categorization/rules";

const COMMIT = process.argv.includes("--commit");
const BATCH = 100;

async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: "Stone Grille" } },
    select: { id: true, name: true },
  });
  if (!r) throw new Error("restaurant not found");
  console.log(`Restaurant: ${r.name} (${r.id})`);
  console.log(COMMIT ? "MODE: COMMIT (writing changes)\n" : "MODE: DRY RUN (no writes — pass --commit to apply)\n");

  await ensureDefaultCategories(prisma, r.id);
  await ensureDefaultRules(prisma, r.id);
  const nameToId = await categoryIdByName(prisma, r.id);
  const tapById = await categoryTapById(prisma, r.id);
  const ctx: CategorizationContext = {
    rules: await loadRules(prisma, r.id),
    tapById,
    revenueId: nameToId.get("Sales Deposits") ?? null,
    miscId: nameToId.get(MISC_CATEGORY_NAME) ?? null,
  };
  const nameByCatId = new Map([...nameToId.entries()].map(([name, id]) => [id, name]));
  const tapName = (catId: string | null) => (catId ? `${nameByCatId.get(catId) ?? "?"}` : "Misc");

  // Only bank-fed, non-overridden rows — the set that went through the sync path.
  const txns = await prisma.transaction.findMany({
    where: { restaurantId: r.id, plaidConnectionId: { not: null }, isManualOverride: false },
    select: { id: true, merchantName: true, description: true, amount: true, categoryId: true, bucket: true },
  });
  console.log(`Scanning ${txns.length} bank-fed, non-override transactions…`);

  const changes: { id: string; categoryId: string | null; bucket: any; confidence: number; from: string; to: string }[] = [];
  for (const t of txns) {
    const next = categorize(ctx, t.merchantName, t.description, Number(t.amount));
    if (next.categoryId !== t.categoryId || next.bucket !== t.bucket) {
      changes.push({
        id: t.id,
        categoryId: next.categoryId,
        bucket: next.bucket,
        confidence: next.confidence,
        from: `${tapName(t.categoryId)}[${t.bucket}]`,
        to: `${tapName(next.categoryId)}[${next.bucket}]`,
      });
    }
  }

  console.log(`\nWould change ${changes.length} of ${txns.length} rows.`);
  // Summarize the moves.
  const moves: Record<string, number> = {};
  for (const c of changes) moves[`${c.from} -> ${c.to}`] = (moves[`${c.from} -> ${c.to}`] ?? 0) + 1;
  for (const [k, v] of Object.entries(moves).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);

  if (!COMMIT || changes.length === 0) {
    console.log(COMMIT ? "\nNothing to change." : "\nDRY RUN — re-run with --commit to apply.");
    return;
  }

  console.log(`\nApplying ${changes.length} updates in batches of ${BATCH}…`);
  let done = 0;
  for (let i = 0; i < changes.length; i += BATCH) {
    const slice = changes.slice(i, i + BATCH);
    await prisma.$transaction(
      slice.map((c) =>
        prisma.transaction.update({
          where: { id: c.id },
          data: { categoryId: c.categoryId, bucket: c.bucket, confidence: c.confidence },
        }),
      ),
    );
    done += slice.length;
    console.log(`  ${done}/${changes.length}`);
  }
  console.log("Done.");
}

main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); }).finally(() => prisma.$disconnect());
