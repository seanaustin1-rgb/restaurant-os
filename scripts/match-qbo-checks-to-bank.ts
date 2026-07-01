import { prisma } from "../src/lib/prisma";
import { categoryIdByName } from "../src/lib/categorization/categories";
import { mirrorBankTransactionToLedger } from "../src/lib/financial-ledger/bank-transactions";
import {
  bestQboCheckMatch,
  isBankCheckDescription,
  qboCheckCandidateFromRaw,
  type BankCheckCandidate,
} from "../src/lib/financial-ledger/qbo-check-match";

const restaurantQuery = process.argv[2] ?? "Stone Grille";
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const restaurant = await prisma.restaurant.findFirst({
    where: { name: { contains: restaurantQuery } },
    select: { id: true, name: true },
  });
  if (!restaurant) throw new Error(`No restaurant matched "${restaurantQuery}"`);

  const categoryByName = await categoryIdByName(prisma, restaurant.id);
  const matchedCategoryId = categoryByName.get("Internal Transfers") ?? categoryByName.get("Bank / Register Cash") ?? null;
  if (!matchedCategoryId) throw new Error("Missing an excluded category for QBO-matched bank checks.");

  const qboRawEvents = await prisma.rawSourceEvent.findMany({
    where: {
      restaurantId: restaurant.id,
      sourceSystem: { in: ["qbo", "quickbooks", "quickbooks_online"] },
    },
    select: { id: true, sourceObjectType: true, sourceObjectId: true, payload: true },
  });
  const qboCandidates = qboRawEvents
    .map((event) =>
      qboCheckCandidateFromRaw({
        id: event.id,
        sourceObjectType: event.sourceObjectType,
        sourceObjectId: event.sourceObjectId,
        payload: event.payload,
      }),
    )
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

  const bankTransactions = await prisma.transaction.findMany({
    where: {
      restaurantId: restaurant.id,
      isManualOverride: false,
      plaidTxnId: { not: null },
      OR: [{ bucket: "UNCATEGORIZED" }, { confidence: { lte: 0 } }],
    },
    select: {
      id: true,
      plaidTxnId: true,
      date: true,
      amount: true,
      merchantName: true,
      description: true,
    },
  });

  let matched = 0;
  let remirrored = 0;
  const usedQboIds = new Set<string>();

  for (const transaction of bankTransactions) {
    if (!isBankCheckDescription(transaction.description)) continue;
    const bank: BankCheckCandidate = {
      id: transaction.id,
      date: transaction.date,
      amount: Number(transaction.amount),
      description: transaction.description,
      sourceObjectId: transaction.plaidTxnId,
    };
    const match = bestQboCheckMatch(
      bank,
      qboCandidates.filter((candidate) => !usedQboIds.has(candidate.id)),
    );
    if (!match) continue;

    usedQboIds.add(match.qbo.id);
    matched++;
    if (DRY_RUN) continue;

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          categoryId: matchedCategoryId,
          bucket: "UNCATEGORIZED",
          confidence: 0.95,
          isManualOverride: true,
        },
      });

      await mirrorBankTransactionToLedger(tx, {
        restaurantId: restaurant.id,
        sourceSystem: "plaid",
        sourceObjectId: transaction.plaidTxnId!,
        payload: {
          transaction_id: transaction.plaidTxnId,
          date: transaction.date.toISOString().slice(0, 10),
          amount: Number(transaction.amount),
          name: transaction.description,
          merchant_name: transaction.merchantName,
          matched_qbo_raw_source_event_id: match.qbo.id,
          matched_qbo_source_object_id: match.qbo.sourceObjectId,
          matched_qbo_score: match.score,
          matched_qbo_reasons: match.reasons,
        },
        date: transaction.date,
        amount: Number(transaction.amount),
        merchantName: transaction.merchantName,
        description: `Matched to QBO: ${match.qbo.payee ?? match.qbo.memo ?? match.qbo.sourceObjectId}`,
        categoryId: matchedCategoryId,
        bucket: "UNCATEGORIZED",
        confidence: 0.95,
      });
      remirrored++;
    });
  }

  console.log(
    JSON.stringify(
      {
        restaurant,
        dryRun: DRY_RUN,
        qboCandidates: qboCandidates.length,
        bankChecksChecked: bankTransactions.filter((transaction) => isBankCheckDescription(transaction.description)).length,
        matched,
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
