import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { runPlaidSync } from "@/lib/plaid/sync";
import { isToastConfigured } from "@/lib/integrations/toast/config";
import { resolveToastRestaurantId, syncToastDailyMetrics } from "@/lib/integrations/toast/sync";

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

/**
 * Toast daily-metrics scheduler — runs each morning and, if Toast is configured,
 * dispatches a metrics-sync event for the resolved restaurant. Single-tenant for
 * now (one global Toast client); when per-restaurant Toast creds land on
 * PosConnection this becomes a fan-out like the Plaid scheduler. Scheduled a bit
 * before the Plaid sync so Toast EARNED data is fresh for the dashboard.
 */
export const dailyToastSyncScheduler = inngest.createFunction(
  { id: "daily-toast-sync-scheduler" },
  { cron: "TZ=America/New_York 30 5 * * *" }, // 5:30am ET daily
  async ({ step }) => {
    if (!isToastConfigured()) return { dispatched: 0, reason: "toast-not-configured" };

    const restaurantId = await step.run("resolve-toast-restaurant", () =>
      resolveToastRestaurantId(),
    );
    if (!restaurantId) return { dispatched: 0, reason: "no-restaurant" };

    await step.sendEvent("dispatch-toast-sync", {
      name: "toast/metrics.sync.requested",
      data: { restaurantId },
    });
    return { dispatched: 1, restaurantId };
  },
);

/**
 * Toast metrics worker — pulls recent days from the Analytics (era) API into
 * DailySales. Default 3-day lookback to self-heal late-posting business days;
 * upserts are idempotent so retries are safe.
 */
export const syncToastMetrics = inngest.createFunction(
  { id: "sync-toast-metrics", retries: 3 },
  { event: "toast/metrics.sync.requested" },
  async ({ event, step }) => {
    const restaurantId = event.data.restaurantId as string;
    const days = (event.data.days as number | undefined) ?? 3;
    return step.run("sync", () => syncToastDailyMetrics(restaurantId, days));
  },
);

export const functions = [
  dailyPlaidSyncScheduler,
  syncPlaidConnection,
  dailyToastSyncScheduler,
  syncToastMetrics,
];
