/**
 * Backfill existing bank/statement transactions into the clean financial ledger.
 *
 * Run:
 *   npx dotenv -e .env.local -- tsx scripts/backfill-bank-transactions-ledger.ts [restaurantId]
 *
 * If restaurantId is omitted, every restaurant with transactions is processed.
 * The mirror is idempotent: existing raw/normalized/ledger rows for the same
 * source object are replaced with the current transaction categorization.
 */
import { prisma } from "../src/lib/prisma";
import { mirrorBankTransactionToLedger } from "../src/lib/financial-ledger/bank-transactions";

const BATCH_SIZE = 20;

async function restaurantIdsToBackfill(arg?: string): Promise<string[]> {
  if (arg) return [arg];

  const rows = await prisma.transaction.findMany({
    distinct: ["restaurantId"],
    select: { restaurantId: true },
    orderBy: { restaurantId: "asc" },
  });
  return rows.map((row) => row.restaurantId);
}

async function backfillRestaurant(restaurantId: string): Promise<number> {
  let cursor: string | undefined;
  let mirrored = 0;

  for (;;) {
    const txns = await prisma.transaction.findMany({
      where: { restaurantId, plaidTxnId: { not: null } },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
        plaidConnectionId: true,
      },
    });

    if (txns.length === 0) break;

    const existingRaw = await prisma.rawSourceEvent.findMany({
      where: {
        restaurantId,
        sourceObjectType: "bank_transaction",
        sourceObjectId: { in: txns.map((txn) => txn.plaidTxnId).filter((id): id is string => !!id) },
      },
      select: { sourceObjectId: true },
    });
    const existingIds = new Set(existingRaw.map((row) => row.sourceObjectId));
    const toMirror = txns.filter((txn) => txn.plaidTxnId && !existingIds.has(txn.plaidTxnId));

    await prisma.$transaction(
      async (tx) => {
        for (const txn of toMirror) {
          if (!txn.plaidTxnId) continue;
          const sourceSystem = txn.plaidTxnId.startsWith("stmt-") || !txn.plaidConnectionId ? "statement" : "plaid";
          await mirrorBankTransactionToLedger(tx, {
            restaurantId,
            sourceSystem,
            sourceObjectId: txn.plaidTxnId,
            payload: {
              transaction_id: txn.plaidTxnId,
              date: txn.date.toISOString().slice(0, 10),
              amount: Number(txn.amount),
              merchant_name: txn.merchantName,
              description: txn.description,
              backfill: true,
            },
            date: txn.date,
            amount: Number(txn.amount),
            merchantName: txn.merchantName,
            description: txn.description,
            categoryId: txn.categoryId,
            bucket: txn.bucket,
            confidence: txn.confidence,
          });
        }
      },
      { timeout: 60_000 },
    );

    mirrored += toMirror.length;
    cursor = txns[txns.length - 1]?.id;
    console.log(`  mirrored ${mirrored} new transaction(s) for ${restaurantId}`);
  }

  return mirrored;
}

async function main() {
  const ids = await restaurantIdsToBackfill(process.argv[2]);
  if (ids.length === 0) {
    console.log("No restaurants with transactions found.");
    return;
  }

  let total = 0;
  for (const restaurantId of ids) {
    console.log(`Backfilling ${restaurantId}`);
    total += await backfillRestaurant(restaurantId);
  }

  console.log(`Done. Mirrored ${total} transaction(s) into the clean financial ledger.`);
}

main()
  .catch((error) => {
    console.error("FAILED:", error?.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
