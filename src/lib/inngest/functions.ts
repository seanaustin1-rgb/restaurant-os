import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { runPlaidSync } from "@/lib/plaid/sync";

/**
 * Scheduler — runs once a day and fans out one sync event per active Plaid
 * connection. Keeping the scheduler thin and the per-connection work in its own
 * function means one restaurant's failure can't block the others, and each gets
 * its own retries.
 */
export const dailyPlaidSyncScheduler = inngest.createFunction(
  { id: "daily-plaid-sync-scheduler" },
  { cron: "TZ=America/New_York 0 6 * * *" }, // 6:00am ET daily
  async ({ step }) => {
    const connections = await step.run("load-active-connections", async () => {
      return prisma.plaidConnection.findMany({
        where: { isActive: true },
        select: { id: true, restaurantId: true },
      });
    });

    if (connections.length > 0) {
      await step.sendEvent(
        "dispatch-syncs",
        connections.map((c) => ({
          name: "plaid/connection.sync.requested",
          data: { plaidConnectionId: c.id, restaurantId: c.restaurantId },
        })),
      );
    }

    return { dispatched: connections.length };
  },
);

/**
 * Per-connection worker — delegates to the shared runPlaidSync core. Running it
 * inside a single step keeps retries atomic and idempotent (the cursor only
 * advances after the DB commit succeeds).
 */
export const syncPlaidConnection = inngest.createFunction(
  { id: "sync-plaid-connection", retries: 4 },
  { event: "plaid/connection.sync.requested" },
  async ({ event, step }) => {
    const plaidConnectionId = event.data.plaidConnectionId as string;
    return step.run("sync", () => runPlaidSync(plaidConnectionId));
  },
);

export const functions = [dailyPlaidSyncScheduler, syncPlaidConnection];
