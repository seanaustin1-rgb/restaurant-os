import { prisma } from "../src/lib/prisma";
import { categoryIdByName, categoryTapById, ensureDefaultCategories, legacyBucketToCategoryName, MISC_CATEGORY_NAME } from "../src/lib/categorization/categories";
import { categorize, loadRules, type CategorizationContext } from "../src/lib/categorization/rules";
import { isWeakSignature } from "../src/lib/categorization/suggestions";
import { VENDOR_PATTERNS } from "../src/lib/categorization/vendor-map";
import { mirrorBankTransactionToLedger } from "../src/lib/financial-ledger/bank-transactions";

const restaurantQuery = process.argv[2] ?? "Stone Grille";
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const restaurant = await prisma.restaurant.findFirst({
    where: { name: { contains: restaurantQuery } },
    select: { id: true, name: true },
  });
  if (!restaurant) throw new Error(`No restaurant matched "${restaurantQuery}"`);

  await ensureDefaultCategories(prisma, restaurant.id);
  const nameToId = await categoryIdByName(prisma, restaurant.id);
  const tapById = await categoryTapById(prisma, restaurant.id);

  let disabledWeakRules = 0;
  const weakRules = await prisma.rule.findMany({
    where: { restaurantId: restaurant.id, matchType: "KEYWORD", isSystem: false, enabled: true },
    select: { id: true, pattern: true },
  });
  const weakRuleIds = weakRules.filter((rule) => isWeakSignature(rule.pattern)).map((rule) => rule.id);
  if (weakRuleIds.length > 0 && !DRY_RUN) {
    const result = await prisma.rule.updateMany({
      where: { restaurantId: restaurant.id, id: { in: weakRuleIds } },
      data: { enabled: false },
    });
    disabledWeakRules = result.count;
  } else {
    disabledWeakRules = weakRuleIds.length;
  }

  const existingSystemRules = await prisma.rule.findMany({
    where: { restaurantId: restaurant.id, isSystem: true },
    select: { matchType: true, pattern: true },
  });
  const existingRuleKeys = new Set(existingSystemRules.map((rule) => `${rule.matchType}::${rule.pattern}`));
  let seededRules = 0;

  for (const [index, pattern] of VENDOR_PATTERNS.entries()) {
    const key = `REGEX::${pattern.pattern.source}`;
    if (existingRuleKeys.has(key)) continue;
    const categoryName = pattern.category ?? legacyBucketToCategoryName(pattern.bucket);
    const categoryId = nameToId.get(categoryName);
    if (!categoryId) continue;
    seededRules++;
    if (!DRY_RUN) {
      await prisma.rule.create({
        data: {
          restaurantId: restaurant.id,
          categoryId,
          matchType: "REGEX",
          pattern: pattern.pattern.source,
          priority: 10 + index,
          confidence: pattern.confidence,
          isSystem: true,
          enabled: true,
        },
      });
    }
  }

  const rules = await loadRules(prisma, restaurant.id);
  const ctx: CategorizationContext = {
    rules,
    tapById,
    revenueId: nameToId.get("Sales Deposits") ?? null,
    miscId: nameToId.get(MISC_CATEGORY_NAME) ?? null,
  };

  const transactions = await prisma.transaction.findMany({
    where: {
      restaurantId: restaurant.id,
      isManualOverride: false,
      OR: [{ confidence: { lte: 0 } }, { bucket: "UNCATEGORIZED" }],
    },
    select: {
      id: true,
      plaidTxnId: true,
      date: true,
      amount: true,
      merchantName: true,
      description: true,
      categoryId: true,
      bucket: true,
      confidence: true,
    },
  });

  let recategorized = 0;
  let remirrored = 0;
  for (const transaction of transactions) {
    const next = categorize(ctx, transaction.merchantName, transaction.description, Number(transaction.amount));
    if (!next.categoryId || next.confidence <= 0) continue;
    if (
      next.categoryId === transaction.categoryId &&
      next.bucket === transaction.bucket &&
      next.confidence === transaction.confidence
    ) {
      continue;
    }

    recategorized++;
    if (DRY_RUN) continue;

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          categoryId: next.categoryId,
          bucket: next.bucket,
          confidence: next.confidence,
        },
      });

      if (transaction.plaidTxnId) {
        await mirrorBankTransactionToLedger(tx, {
          restaurantId: restaurant.id,
          sourceSystem: "plaid",
          sourceObjectId: transaction.plaidTxnId,
          payload: {
            transaction_id: transaction.plaidTxnId,
            date: transaction.date.toISOString().slice(0, 10),
            amount: Number(transaction.amount),
            name: transaction.description,
            merchant_name: transaction.merchantName,
          },
          date: transaction.date,
          amount: Number(transaction.amount),
          merchantName: transaction.merchantName,
          description: transaction.description,
          categoryId: next.categoryId,
          bucket: next.bucket,
          confidence: next.confidence,
        });
        remirrored++;
      }
    });
  }

  console.log(
    JSON.stringify(
      {
        restaurant,
        dryRun: DRY_RUN,
        disabledWeakRules,
        seededRules,
        checkedTransactions: transactions.length,
        recategorized,
        remirrored,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
