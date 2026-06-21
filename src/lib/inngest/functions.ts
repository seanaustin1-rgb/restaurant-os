import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { runPlaidSync } from "@/lib/plaid/sync";
import { isToastConfigured } from "@/lib/integrations/toast/config";
import {
  resolveToastRestaurantId,
  syncToastDailyMetrics,
  syncToastSalesMix,
  syncToastSalesTax,
  syncToastMenuItemSales,
} from "@/lib/integrations/toast/sync";
import { runLedger } from "@/lib/profit-first/ledger";
import { seedDemoBistro } from "@/lib/demo/demo-tenant";
import { demoPrisma } from "@/lib/demo/demo-prisma";
import { snapshotReputation } from "@/lib/modules/reputation-trend";

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
    const metrics = await step.run("sync-metrics", () =>
      syncToastDailyMetrics(restaurantId, days),
    );
    const salesMix = await step.run("sync-sales-mix", () =>
      syncToastSalesMix(restaurantId, days),
    );
    // Collected sales tax (Orders API) — the pre-allocation skim source.
    const salesTax = await step.run("sync-sales-tax", () =>
      syncToastSalesTax(restaurantId, days),
    );
    // One weekly menu report refreshes the current week's per-item rows.
    const menuItems = await step.run("sync-menu-items", () =>
      syncToastMenuItemSales(restaurantId, 1),
    );
    // Persisted Profit First ledger: allocate the freshly-synced days, recompute
    // balances, sweep Profit/Owner's Pay if the 10th/25th has passed. Idempotent.
    const ledger = await step.run("run-allocation-ledger", () => runLedger(restaurantId));
    return { metrics, salesMix, salesTax, menuItems, ledger };
  },
);

/**
 * Monthly demo re-seed — keeps the public /demo/tour "Demo Bistro" current.
 * seedDemoData seeds the CURRENT calendar month, so refreshing on the 1st keeps
 * the tour from going stale at month rollover. Writes ONLY to the separate demo
 * database (DEMO_DATABASE_URL); no-ops cleanly when that isn't configured, so it
 * can never touch production data.
 */
export const monthlyDemoReseed = inngest.createFunction(
  { id: "monthly-demo-reseed", retries: 2 },
  { cron: "TZ=America/New_York 0 6 1 * *" }, // 6:00am ET on the 1st of each month
  async ({ step }) => {
    if (!demoPrisma) return { seeded: false, reason: "demo-db-not-configured" };
    const restaurantId = await step.run("reseed-demo-bistro", () => seedDemoBistro());
    return { seeded: true, restaurantId };
  },
);

/**
 * Weekly reputation snapshot — records the current rating + review count for each
 * live Aura source (plus a count-weighted "overall" row) so the Aura tile can show
 * a 4–8-week trend. Google/Yelp expose only the current aggregate, so this stored
 * series is the only way to know whether reputation is moving. No-ops when no
 * source is configured.
 */
export const weeklyReputationSnapshot = inngest.createFunction(
  { id: "weekly-reputation-snapshot", retries: 2 },
  { cron: "TZ=America/New_York 0 7 * * 1" }, // Mondays 7:00am ET
  async ({ step }) => {
    const snapshotted = await step.run("snapshot-reputation", () => snapshotReputation());
    return { snapshotted };
  },
);

export const functions = [
  dailyPlaidSyncScheduler,
  syncPlaidConnection,
  dailyToastSyncScheduler,
  syncToastMetrics,
  monthlyDemoReseed,
  weeklyReputationSnapshot,
];
