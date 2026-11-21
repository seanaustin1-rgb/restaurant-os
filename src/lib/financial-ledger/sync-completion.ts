// Explicit sync-completion markers for the V1-gate clean-day check.
//
// Why not infer success from existing timestamps: PlaidConnection.lastSyncedAt is
// advanced inside every committed page, and DailySales.updatedAt on every upserted
// day — so a run that commits page 1 (or day 1) and then fails looks "synced". These
// markers are written by the Inngest workers only AFTER the whole run returns, and
// only on the scheduled path, so a manual sync can't make a day look hands-off.
import type { PrismaClient } from "@prisma/client";

export type SyncSource = "plaid" | "toast";

/** Toast is a single global integration per tenant today, so it uses one fixed key. */
export const TOAST_SYNC_KEY = "toast";

export async function recordSyncCompletion(
  db: PrismaClient,
  restaurantId: string,
  source: SyncSource,
  sourceKey: string,
  at: Date = new Date(),
): Promise<void> {
  await db.syncCompletion.upsert({
    where: { restaurantId_source_sourceKey: { restaurantId, source, sourceKey } },
    create: { restaurantId, source, sourceKey, completedAt: at },
    update: { completedAt: at },
  });
}
