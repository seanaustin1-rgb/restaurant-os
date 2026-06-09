import { Prisma } from "@prisma/client";
import type { TransactionBucket } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { plaidClient } from "@/lib/plaid";
import { decrypt } from "@/lib/crypto";
import { ensureDefaultCategories, categoryTapById, MISC_CATEGORY_NAME, categoryIdByName } from "@/lib/categorization/categories";
import { ensureDefaultRules, loadRules, applyRules, TAP_BUCKET_TO_LEGACY } from "@/lib/categorization/rules";

// Minimal shape of the Plaid transaction fields we consume.
interface PlaidTxn {
  transaction_id: string;
  date: string;
  amount: number;
  name: string | null;
  merchant_name: string | null;
}

export type PlaidSyncResult =
  | { skipped: string }
  | { added: number; modified: number; removed: number };

/**
 * Sync one Plaid connection's transactions into Postgres.
 *
 * Idempotent + atomic: fetches all pages from the saved cursor, then persists
 * everything and advances the cursor in a single DB transaction. The cursor
 * only moves after commit, so a failure safely re-fetches from the prior point.
 * Manual category overrides are preserved on update.
 */
export async function runPlaidSync(plaidConnectionId: string): Promise<PlaidSyncResult> {
  const connection = await prisma.plaidConnection.findUnique({ where: { id: plaidConnectionId } });
  if (!connection) return { skipped: "connection not found" };
  if (!connection.isActive) return { skipped: "connection inactive" };

  const accessToken = decrypt(connection.accessToken);

  // 1. Pull all pages from the saved cursor.
  const added: PlaidTxn[] = [];
  const modified: PlaidTxn[] = [];
  const removedIds: string[] = [];
  let cursor = connection.cursor ?? undefined;
  let hasMore = true;

  while (hasMore) {
    const resp = await plaidClient.transactionsSync({ access_token: accessToken, cursor });
    const data = resp.data;
    added.push(...(data.added as PlaidTxn[]));
    modified.push(...(data.modified as PlaidTxn[]));
    removedIds.push(...data.removed.map((r) => r.transaction_id).filter((id): id is string => !!id));
    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  // 2. Persist everything + advance the cursor.
  // Bulk-fetch which existing rows are manual overrides (one query, not one per
  // transaction), then run all writes as a *batched* array transaction. This is
  // safe over the PgBouncer transaction pooler and avoids the interactive-
  // transaction timeout that per-row round-trips would hit.
  const upserts = [...added, ...modified];
  const ids = upserts.map((t) => t.transaction_id);

  const overridden = new Set(
    ids.length > 0
      ? (
          await prisma.transaction.findMany({
            where: { plaidTxnId: { in: ids }, isManualOverride: true },
            select: { plaidTxnId: true },
          })
        ).map((t) => t.plaidTxnId)
      : [],
  );

  // Per-restaurant categorization: ensure defaults exist, then resolve via rules.
  await ensureDefaultCategories(prisma, connection.restaurantId);
  await ensureDefaultRules(prisma, connection.restaurantId);
  const nameToId = await categoryIdByName(prisma, connection.restaurantId);
  const tapById = await categoryTapById(prisma, connection.restaurantId);
  const rules = await loadRules(prisma, connection.restaurantId);
  const miscId = nameToId.get(MISC_CATEGORY_NAME) ?? null;

  const ops: Prisma.PrismaPromise<unknown>[] = upserts.map((t) => {
    const common = {
      restaurantId: connection.restaurantId,
      plaidConnectionId: connection.id,
      date: new Date(t.date),
      amount: t.amount,
      merchantName: t.merchant_name ?? null,
      description: t.name ?? null,
    };
    const match = applyRules(rules, t.merchant_name, t.name);
    let categorization: { categoryId: string | null; bucket: TransactionBucket; confidence: number };
    if (match) {
      const tap = tapById.get(match.categoryId);
      categorization = {
        categoryId: match.categoryId,
        bucket: tap ? TAP_BUCKET_TO_LEGACY[tap] : "UNCATEGORIZED",
        confidence: match.confidence,
      };
    } else {
      categorization = { categoryId: miscId, bucket: "UNCATEGORIZED", confidence: 0 };
    }

    return prisma.transaction.upsert({
      where: { plaidTxnId: t.transaction_id },
      create: { ...common, plaidTxnId: t.transaction_id, ...categorization },
      // Don't clobber a human's manual recategorization.
      update: overridden.has(t.transaction_id) ? common : { ...common, ...categorization },
    });
  });

  if (removedIds.length > 0) {
    ops.push(prisma.transaction.deleteMany({ where: { plaidTxnId: { in: removedIds } } }));
  }

  ops.push(
    prisma.plaidConnection.update({
      where: { id: connection.id },
      data: { cursor: cursor ?? null, lastSyncedAt: new Date() },
    }),
  );

  await prisma.$transaction(ops);

  return { added: added.length, modified: modified.length, removed: removedIds.length };
}
