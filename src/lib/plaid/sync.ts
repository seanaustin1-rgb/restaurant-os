import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { plaidClient } from "@/lib/plaid";
import { decrypt } from "@/lib/crypto";
import { ensureDefaultCategories, categoryTapById, MISC_CATEGORY_NAME, categoryIdByName } from "@/lib/categorization/categories";
import { ensureDefaultRules, loadRules, categorize, type CategorizationContext } from "@/lib/categorization/rules";

// Minimal shape of the Plaid transaction fields we consume.
interface PlaidTxn {
  transaction_id: string;
  date: string;
  amount: number;
  name: string | null;
  merchant_name: string | null;
}

export type PlaidSyncResult =
  | { skipped: string; hasMore: false }
  | { added: number; modified: number; removed: number; hasMore: boolean };

interface SyncOptions {
  // Stop starting new Plaid pages once this much wall-clock has elapsed, so the
  // call finishes within a serverless time limit. The cursor is committed after
  // every page, so a follow-up call resumes exactly where this one stopped.
  // Defaults to no limit (used by the background cron, which has no tight cap).
  timeBudgetMs?: number;
}

/**
 * Sync one Plaid connection's transactions into Postgres.
 *
 * Incremental + resumable: each `transactionsSync` page is persisted in its own
 * DB transaction together with the advanced cursor, so progress is never lost
 * and the cursor only moves after that page commits. When `timeBudgetMs` is set
 * the loop stops between pages once the budget is spent and reports `hasMore:
 * true` — the caller (or the user clicking "Sync now" again) resumes from the
 * saved cursor. Manual category overrides are preserved on update.
 */
export async function runPlaidSync(
  plaidConnectionId: string,
  opts: SyncOptions = {},
): Promise<PlaidSyncResult> {
  const connection = await prisma.plaidConnection.findUnique({ where: { id: plaidConnectionId } });
  if (!connection) return { skipped: "connection not found", hasMore: false };
  if (!connection.isActive) return { skipped: "connection inactive", hasMore: false };

  const accessToken = decrypt(connection.accessToken);

  // Load the per-restaurant categorization context once up front — it doesn't
  // change mid-sync, so there's no need to re-fetch it per page.
  await ensureDefaultCategories(prisma, connection.restaurantId);
  await ensureDefaultRules(prisma, connection.restaurantId);
  const nameToId = await categoryIdByName(prisma, connection.restaurantId);
  const tapById = await categoryTapById(prisma, connection.restaurantId);
  const rules = await loadRules(prisma, connection.restaurantId);
  const catCtx: CategorizationContext = {
    rules,
    tapById,
    revenueId: nameToId.get("Sales Deposits") ?? null,
    miscId: nameToId.get(MISC_CATEGORY_NAME) ?? null,
  };

  const started = Date.now();
  const budget = opts.timeBudgetMs ?? Infinity;

  let cursor = connection.cursor ?? undefined;
  let hasMore = true;
  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;

  // Process one Plaid page per iteration, committing it before moving on.
  while (hasMore) {
    const resp = await plaidClient.transactionsSync({ access_token: accessToken, cursor });
    const data = resp.data;

    const added = data.added as PlaidTxn[];
    const modified = data.modified as PlaidTxn[];
    const removedIds = data.removed
      .map((r) => r.transaction_id)
      .filter((id): id is string => !!id);

    const upserts = [...added, ...modified];
    const ids = upserts.map((t) => t.transaction_id);

    // Which of this page's rows are manual overrides we must not clobber.
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

    const ops: Prisma.PrismaPromise<unknown>[] = upserts.map((t) => {
      const common = {
        restaurantId: connection.restaurantId,
        plaidConnectionId: connection.id,
        date: new Date(t.date),
        amount: t.amount,
        merchantName: t.merchant_name ?? null,
        description: t.name ?? null,
      };
      // Inflows (amount < 0) are REVENUE by sign; outflows go through the rules.
      const categorization = categorize(catCtx, t.merchant_name, t.name, t.amount);

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

    // Advance the cursor in the SAME transaction as this page's writes, so the
    // cursor never gets ahead of the data that's actually persisted.
    ops.push(
      prisma.plaidConnection.update({
        where: { id: connection.id },
        data: { cursor: data.next_cursor, lastSyncedAt: new Date() },
      }),
    );

    await prisma.$transaction(ops);

    totalAdded += added.length;
    totalModified += modified.length;
    totalRemoved += removedIds.length;
    cursor = data.next_cursor;
    hasMore = data.has_more;

    // Stop between pages if we're out of time; the next call resumes from the
    // cursor we just committed.
    if (hasMore && Date.now() - started > budget) {
      return { added: totalAdded, modified: totalModified, removed: totalRemoved, hasMore: true };
    }
  }

  return { added: totalAdded, modified: totalModified, removed: totalRemoved, hasMore: false };
}
