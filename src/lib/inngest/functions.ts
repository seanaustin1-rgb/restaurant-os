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
import { syncAuraIntentSnapshots } from "@/lib/modules/aura-intent";
import { loadDashboardData } from "@/lib/dashboard/data";
import { loadForwardCash } from "@/lib/modules/forward-cash";
import { buildDailyDigest } from "@/lib/modules/daily-digest";
import { sendDailyDigestEmail } from "@/lib/email/daily-digest";
import { digestRecipientEmails } from "@/lib/email/digest-recipients";
import { sendLeadAlert } from "@/lib/realestate/notify";

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

/**
 * Daily Aura intent snapshot — imports Google Business Profile performance
 * actions (calls, directions, website clicks, profile impressions) so Aura can
 * show current market intent without calling Google on every dashboard render.
 */
export const dailyAuraIntentSnapshot = inngest.createFunction(
  { id: "daily-aura-intent-snapshot", retries: 2 },
  { cron: "TZ=America/New_York 20 7 * * *" }, // 7:20am ET daily
  async ({ step }) => {
    const synced = await step.run("sync-aura-intent", () => syncAuraIntentSnapshots());
    return synced;
  },
);

/** Human date for a digest, e.g. "Saturday, Jul 4", in the operator's timezone. */
function digestDateLabel(): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(new Date());
}

/**
 * Daily Digest scheduler — fans out one send event per restaurant that has an
 * OPERATOR (the digest's recipient). Kept thin like the Plaid scheduler so one
 * tenant's failure can't block the others. GATED on an explicit opt-in: this is
 * the only cron that sends mail OUT to operators, so it no-ops unless
 * DAILY_DIGEST_ENABLED is "true" AND a Resend key is present — a fresh/preview env
 * can never blast real inboxes. Read-only; no DB writes, so it's demo-safe.
 */
export const dailyDigestScheduler = inngest.createFunction(
  { id: "daily-digest-scheduler" },
  { cron: "TZ=America/New_York 45 7 * * *" }, // 7:45am ET daily — after the morning syncs
  async ({ step }) => {
    if (process.env.DAILY_DIGEST_ENABLED !== "true") return { dispatched: 0, reason: "digest-disabled" };
    if (!process.env.RESEND_API_KEY?.trim()) return { dispatched: 0, reason: "resend-not-configured" };

    const restaurants = await step.run("load-digest-restaurants", async () => {
      return prisma.userRestaurantRole.findMany({
        where: { role: "OPERATOR" },
        select: { restaurantId: true },
        distinct: ["restaurantId"],
      });
    });

    if (restaurants.length > 0) {
      await step.sendEvent(
        "dispatch-digests",
        restaurants.map((r) => ({
          name: "digest/send.requested",
          data: { restaurantId: r.restaurantId },
        })),
      );
    }

    return { dispatched: restaurants.length };
  },
);

/**
 * Per-restaurant digest worker — resolves recipients, builds the deterministic
 * digest from the shared dashboard signals + Forward Cash low-point, and sends it.
 * Skips cleanly when a restaurant has no resolvable recipient. Idempotent-enough
 * for retries: a resend just re-delivers the same morning read.
 */
export const sendDailyDigest = inngest.createFunction(
  { id: "send-daily-digest", retries: 2 },
  { event: "digest/send.requested" },
  async ({ event, step }) => {
    const restaurantId = event.data.restaurantId as string;

    const recipients = await step.run("resolve-recipients", () => digestRecipientEmails(restaurantId));
    if (recipients.length === 0) return { sent: false, reason: "no-recipients" };

    const digest = await step.run("build-digest", async () => {
      const [dashboard, forwardCash] = await Promise.all([
        loadDashboardData(restaurantId),
        loadForwardCash(restaurantId),
      ]);
      return buildDailyDigest({
        restaurantName: dashboard.name,
        dateLabel: digestDateLabel(),
        dashboard,
        forwardCash,
      });
    });

    return step.run("send-email", () => sendDailyDigestEmail({ to: recipients, digest }));
  },
);

/**
 * Speed-to-lead alert + escalation ladder. Fires on a genuinely new lead
 * (enqueued by the BoldTrail webhook). Alerts the primary agent immediately,
 * re-pings at 5 min, then escalates to BACKUP at 15 min and BROKER at 30 min —
 * cancelling the moment the lead is touched (firstTouchAt set). Escalation
 * writes Lead.escalation, which the broker roster reads as leakage. Thresholds
 * mirror response-clock.ts. Notifications go through the gated adapter (logs
 * until OneSignal/Twilio are configured).
 */
export const leadReceivedAlert = inngest.createFunction(
  { id: "realestate-lead-received", retries: 3 },
  { event: "realestate/lead.received" },
  async ({ event, step }) => {
    const restaurantId = event.data.restaurantId as string;
    const leadId = event.data.leadId as string;

    const loadLead = () =>
      prisma.lead.findUnique({
        where: { id: leadId },
        select: { firstTouchAt: true, agentId: true, fullName: true },
      });

    // Immediate alert to the primary agent.
    const initial = await step.run("alert-primary", async () => {
      const lead = await loadLead();
      if (!lead) return { gone: true, touched: true };
      await sendLeadAlert({ restaurantId, leadId, agentId: lead.agentId, leadName: lead.fullName, level: "new" });
      return { gone: false, touched: !!lead.firstTouchAt };
    });
    if (initial.touched) return { stopped: "touched-before-5m" };

    // 5-min reminder (still PRIMARY).
    await step.sleep("wait-5m", "5m");
    const remind = await step.run("remind", async () => {
      const lead = await loadLead();
      if (!lead || lead.firstTouchAt) return { touched: true };
      await sendLeadAlert({ restaurantId, leadId, agentId: lead.agentId, leadName: lead.fullName, level: "reminder" });
      return { touched: false };
    });
    if (remind.touched) return { stopped: "touched-by-5m" };

    // 15 min → escalate to BACKUP.
    await step.sleep("wait-to-15m", "10m");
    const backup = await step.run("escalate-backup", async () => {
      const lead = await loadLead();
      if (!lead || lead.firstTouchAt) return { touched: true };
      await prisma.lead.update({ where: { id: leadId }, data: { escalation: "BACKUP", escalatedAt: new Date() } });
      await sendLeadAlert({ restaurantId, leadId, agentId: lead.agentId, leadName: lead.fullName, level: "backup" });
      return { touched: false };
    });
    if (backup.touched) return { stopped: "touched-by-15m" };

    // 30 min → escalate to BROKER.
    await step.sleep("wait-to-30m", "15m");
    return step.run("escalate-broker", async () => {
      const lead = await loadLead();
      if (!lead || lead.firstTouchAt) return { stopped: "touched-by-30m" };
      await prisma.lead.update({ where: { id: leadId }, data: { escalation: "BROKER", escalatedAt: new Date() } });
      await sendLeadAlert({ restaurantId, leadId, agentId: lead.agentId, leadName: lead.fullName, level: "broker" });
      return { escalated: "broker" };
    });
  },
);

export const functions = [
  dailyPlaidSyncScheduler,
  syncPlaidConnection,
  dailyToastSyncScheduler,
  syncToastMetrics,
  monthlyDemoReseed,
  weeklyReputationSnapshot,
  dailyAuraIntentSnapshot,
  dailyDigestScheduler,
  sendDailyDigest,
  leadReceivedAlert,
];
