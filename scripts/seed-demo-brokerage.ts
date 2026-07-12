/**
 * Seed a FICTITIOUS, fully-populated real-estate brokerage demo tenant
 * ("Cascade Realty Group") so the LIVE brokerage dashboard renders end-to-end —
 * without Plaid / a CRM / a transaction-management system connected. For
 * sales-demo rehearsal only. Everything seeded is invented.
 *
 * Mirrors scripts/seed-demo.ts conventions: a CLI that works against any
 * database, idempotent (clears its own prior seed on re-run), category-linked
 * transactions via the same ensureDefaultCategories / categoryIdByName /
 * legacyBucketToCategoryName path.
 *
 * Run (local):
 *   npx dotenv -e .env.local -o -- tsx scripts/seed-demo-brokerage.ts --user <clerkUserId>
 * Run (against a specific DB, e.g. production demo):
 *   DATABASE_URL=... DIRECT_URL=... npm run seed:brokerage -- --user <clerkUserId>
 *
 * Flags:
 *   --user <clerkUserId>   Attach an OPERATOR role so the tenant shows on that
 *                          login's /dashboard. Find it in the Clerk dashboard.
 *   --restaurant <id>      Seed into an existing brokerage tenant instead of creating one.
 *   --name <name>          Name for a newly created tenant (default "Cascade Realty Group";
 *                          can also use BROKERAGE_DEMO_NAME env).
 */
import type { PrismaClient, Prisma, TransactionBucket } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { industryTemplateFor } from "../src/lib/industry-templates";
import { commitBrokerageImport } from "../src/lib/brokerage/import-commit";
import {
  ensureDefaultCategories,
  categoryIdByName,
} from "../src/lib/categorization/categories";
import { ensureDefaultRules } from "../src/lib/categorization/rules";
import { buildBrokeragePayload, BROKERAGE_MARKETS } from "./generate-brokerage-pilot-payload";
import type { LeadSource, LeadStatus, TouchChannel } from "@prisma/client";
import { stampFirstTouch, deriveEscalation } from "../src/lib/realestate/response-clock";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const NOW = new Date();
const YEAR = NOW.getUTCFullYear();
const MONTH0 = NOW.getUTCMonth();
const DAYS = new Date(Date.UTC(YEAR, MONTH0 + 1, 0)).getUTCDate();

function dateOf(day: number): Date {
  return new Date(Date.UTC(YEAR, MONTH0, Math.min(day, DAYS)));
}

// ── Demo profile (populates REAL_ESTATE_BROKERAGE template question keys) ──────
const DEMO_PROFILE: Record<string, string | number | boolean> = {
  avgCommissionSplit: 70, // agent's %
  avgGci: 11_500,
  monthlyLeadSpend: 8_400,
  dealsPerYear: 96,
  capModel: true,
  // scaleAnchor.key for this business type is agentCount
  agentCount: 12,
  // market label the analytics module reads for the estimate / aura fallback
  market: BROKERAGE_MARKETS[0],
};

// Operator-entered cash balance anchor → drives Cash Runway tile.
const CASH_ANCHOR = 184_500;

// ── Brokerage bank transactions (one month) ────────────────────────────────────
// Each seeds a real Transaction with an explicit brokerage `category` (a
// BROKERAGE_CATEGORIES name) for the categoryId, plus the coarse legacy `bucket`
// (TransactionBucket) for the dual-write. The category names match the brokerage
// taxonomy this tenant is now seeded with, so the tiles read brokerage-native.
interface TxnSeed {
  vendor: string;
  amount: number;
  day: number;
  bucket: TransactionBucket;
  category: string; // BROKERAGE_CATEGORIES name → categoryId
  recurring?: boolean;
}

const TXNS: TxnSeed[] = [
  // Lead generation / marketing
  { vendor: "Zillow Premier Agent", amount: 3850, day: 3, bucket: "OPEX_SUPPLIES", category: "Lead Generation", recurring: true },
  { vendor: "Realtor.com Connections", amount: 2300, day: 5, bucket: "OPEX_SUPPLIES", category: "Lead Generation", recurring: true },
  { vendor: "Google Ads", amount: 1750, day: 8, bucket: "OPEX_SUPPLIES", category: "Lead Generation", recurring: true },
  { vendor: "Meta Ads (Facebook)", amount: 900, day: 12, bucket: "OPEX_SUPPLIES", category: "Lead Generation", recurring: true },

  // Agent commission payouts (people the brokerage pays → LABOR)
  { vendor: "Agent Commission Payout — Whitaker", amount: 7400, day: 6, bucket: "LABOR", category: "Agent Commission Split" },
  { vendor: "Agent Commission Payout — DeLuca", amount: 6100, day: 6, bucket: "LABOR", category: "Agent Commission Split" },
  { vendor: "Agent Commission Payout — Reyes", amount: 5200, day: 14, bucket: "LABOR", category: "Agent Commission Split" },
  { vendor: "Agent Commission Payout — Brooks", amount: 4800, day: 14, bucket: "LABOR", category: "Agent Commission Split" },
  { vendor: "Agent Commission Payout — Vasquez", amount: 5600, day: 22, bucket: "LABOR", category: "Agent Commission Split" },

  // Office rent
  { vendor: "Crossroads Office Park — Rent", amount: 6800, day: 1, bucket: "OPEX_RENT", category: "Office Rent", recurring: true },

  // MLS / board / association dues
  { vendor: "Intermountain MLS Dues", amount: 540, day: 4, bucket: "OPEX_SUPPLIES", category: "MLS & Board Dues", recurring: true },
  { vendor: "Boise Regional REALTORS Board Dues", amount: 420, day: 4, bucket: "OPEX_SUPPLIES", category: "Association Dues", recurring: true },

  // E&O insurance
  { vendor: "Pearl E&O Insurance", amount: 1150, day: 9, bucket: "OPEX_INSURANCE", category: "E&O Insurance", recurring: true },

  // Staff / admin payroll
  { vendor: "Gusto Payroll — Admin Staff", amount: 9200, day: 15, bucket: "LABOR", category: "Staff Payroll", recurring: true },
  { vendor: "Gusto Payroll — Admin Staff", amount: 9200, day: 30, bucket: "LABOR", category: "Staff Payroll", recurring: true },

  // Office utilities / software
  { vendor: "Idaho Power", amount: 410, day: 10, bucket: "OPEX_UTILITIES", category: "Utilities", recurring: true },
  { vendor: "Follow Up Boss CRM", amount: 760, day: 11, bucket: "OPEX_SUPPLIES", category: "Technology / Software", recurring: true },
  { vendor: "Dotloop Transaction Mgmt", amount: 320, day: 11, bucket: "OPEX_SUPPLIES", category: "Technology / Software", recurring: true },

  // Tax reserve set-aside
  { vendor: "Estimated Tax Reserve Transfer", amount: 4200, day: 17, bucket: "TAX_PAYROLL", category: "Payroll Tax", recurring: true },

  // Owner draw
  { vendor: "Owner Draw", amount: 7500, day: 15, bucket: "OWNER_PAY", category: "Owner Pay / Draw" },
  { vendor: "Owner Draw", amount: 7500, day: 30, bucket: "OWNER_PAY", category: "Owner Pay / Draw" },
];

interface SeedSummary {
  restaurantId: string;
  agents: number;
  deals: number;
  leadSpend: number;
  marketMetrics: number;
  sourceConfigs: number;
  transactions: number;
  leads: number;
  calls: number;
  messages: number;
}

// ── Tenant creation (replicates createRestaurant for REAL_ESTATE_BROKERAGE) ─────
async function ensureTenant(
  db: PrismaClient,
  opts: { restaurantId?: string; userId?: string; name: string },
): Promise<string> {
  if (opts.restaurantId) {
    console.log(`Seeding into existing restaurant ${opts.restaurantId}.`);
    return opts.restaurantId;
  }

  const template = industryTemplateFor("REAL_ESTATE_BROKERAGE");
  const suffix = Math.random().toString(36).slice(2, 7);

  const created = await db.restaurant.create({
    data: {
      name: opts.name,
      slug: `${slugify(opts.name)}-${suffix}`,
      businessType: "REAL_ESTATE_BROKERAGE",
      seatCount: null,
      profile: DEMO_PROFILE as Prisma.InputJsonValue,
      cashBalanceAnchor: CASH_ANCHOR,
      cashBalanceAnchorDate: dateOf(1),
      tapSettings: { create: {} },
      targetSettings: {
        create: {
          targetPrimeCost: template.defaultTargets.targetPrimeCost ?? null,
          targetFoodCost: template.defaultTargets.targetFoodCost ?? null,
          targetLiquorCost: template.defaultTargets.targetLiquorCost ?? null,
          targetLaborCost: template.defaultTargets.targetLaborCost ?? null,
          targetLiquorPourPct: template.defaultTargets.targetLiquorPourPct ?? null,
          targetBeveragePourPct: template.defaultTargets.targetBeveragePourPct ?? null,
        },
      },
      moduleConfigs: {
        create: template.defaultModuleKeys.map((moduleKey, i) => ({ moduleKey, position: i })),
      },
      virtualAccounts: {
        create: template.seedAccounts.map((account) => ({
          key: account.key,
          name: account.name,
          targetPct: account.targetPct,
        })),
      },
      ...(opts.userId ? { userRoles: { create: { clerkUserId: opts.userId, role: "OPERATOR" } } } : {}),
    },
    select: { id: true, name: true },
  });

  console.log(
    `Created brokerage tenant "${created.name}" (${created.id})` +
      (opts.userId ? ` with an OPERATOR role for Clerk user ${opts.userId}.` : "."),
  );
  if (!opts.userId) {
    console.log("⚠  No --user given — this tenant is not linked to any login. Pass --user <clerkUserId> to see it on /dashboard.");
  }
  return created.id;
}

// ── Market metrics (~6 months, per market) ─────────────────────────────────────
async function seedMarketMetrics(db: PrismaClient, restaurantId: string): Promise<number> {
  // Idempotent clear of this tenant's metrics.
  await db.brokerageMarketMetric.deleteMany({ where: { restaurantId } });

  const rows: Prisma.BrokerageMarketMetricCreateManyInput[] = [];
  for (const market of BROKERAGE_MARKETS) {
    for (let monthsBack = 5; monthsBack >= 0; monthsBack--) {
      const ref = new Date(Date.UTC(YEAR, MONTH0 - monthsBack, 1));
      const y = ref.getUTCFullYear();
      const m = ref.getUTCMonth();
      const rnd = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
      rows.push({
        restaurantId,
        market,
        date: new Date(Date.UTC(y, m, 1)),
        newListings: rnd(48, 92),
        pendings: rnd(36, 70),
        closedSales: rnd(30, 64),
        avgDom: Math.round((28 + Math.random() * 24) * 100) / 100,
        priceReductions: rnd(8, 24),
        showingAppointments: rnd(70, 130),
        mortgageRatePct: Math.round((6.4 + Math.random() * 0.9) * 100) / 100,
        googleIntentTrendPct: Math.round((Math.random() * 12 - 2) * 100) / 100,
        rawPayload: { source: "altos+google-trends", market, period: `${y}-${String(m + 1).padStart(2, "0")}` },
      });
    }
  }
  await db.brokerageMarketMetric.createMany({ data: rows });
  return rows.length;
}

// ── Data-source readiness (honest, coherent demo story) ────────────────────────
// loadBrokerageAnalytics builds the brokerage sourceReadiness lines by matching
// `${category}:${providerName}` against these rows (see brokerage-analytics.ts
// stateFor()). We seed only what the demo can honestly claim:
//   - cash/Plaid                              CONNECTED  (bank truth — runway/spending)
//   - pipeline transaction-mgmt (Brokermint…) CONNECTED  (we imported its data)
//   - accounting/QuickBooks Online            PLANNED    (no live connector yet)
//   - aura/Google Business Profile            PLANNED    (no live feed yet)
// The CRM pipeline line (Follow Up Boss / Lofty / kvCORE) is intentionally left
// unseeded so it honestly renders "missing" — we did not connect a live CRM.
// Category + providerName strings MUST match the stateFor() lookups exactly
// (and source-map.ts), or the readiness lines stay "missing".
interface SourceSeed {
  category: string;
  providerName: string;
  status: "PLANNED" | "CONNECTED" | "NOT_NEEDED" | "BLOCKED";
  notes: string;
}

const SOURCE_CONFIGS: SourceSeed[] = [
  {
    category: "cash",
    providerName: "Plaid",
    status: "CONNECTED",
    notes: "Demo: First Harbor Bank transaction export seeded. No live bank token is stored.",
  },
  {
    category: "pipeline",
    providerName: "Brokermint / Dotloop / SkySlope",
    status: "CONNECTED",
    notes: "Demo: Harbor Pipeline export imported (agents, deals, splits, caps).",
  },
  {
    category: "accounting",
    providerName: "QuickBooks Online",
    status: "CONNECTED",
    notes: "Demo: LedgerPoint Accounting fixed-expense export seeded. No live QBO token is stored.",
  },
  {
    category: "aura",
    providerName: "Google Business Profile",
    status: "CONNECTED",
    notes: "Demo: local market intent and reputation signals simulated for investor walkthroughs.",
  },
];

async function seedDataSourceConfigs(db: PrismaClient, restaurantId: string): Promise<number> {
  for (const source of SOURCE_CONFIGS) {
    await db.dataSourceConfig.upsert({
      where: {
        restaurantId_category_providerName: {
          restaurantId,
          category: source.category,
          providerName: source.providerName,
        },
      },
      create: {
        restaurantId,
        category: source.category,
        providerName: source.providerName,
        status: source.status,
        notes: source.notes,
        updatedBy: "seed:brokerage",
      },
      update: {
        status: source.status,
        notes: source.notes,
        updatedBy: "seed:brokerage",
      },
    });
  }
  return SOURCE_CONFIGS.length;
}

// ── Bank transactions (category-linked) ────────────────────────────────────────
async function seedBrokerageTransactions(db: PrismaClient, restaurantId: string): Promise<number> {
  await ensureDefaultCategories(db, restaurantId);
  // Seed the brokerage vendor rules so this tenant self-categorizes future imports
  // (and the review flow can suggest them). No-op if system rules already exist.
  await ensureDefaultRules(db, restaurantId);
  const catIdByName = await categoryIdByName(db, restaurantId);

  const start = dateOf(1);
  const end = new Date(Date.UTC(YEAR, MONTH0 + 1, 1));

  // Idempotent clear of this script's own prior seed (prefix-scoped).
  await db.transaction.deleteMany({
    where: { restaurantId, plaidTxnId: { startsWith: `seedbrk-${restaurantId}-` } },
  });
  // Also clear any leftover transactions in the seeded month to keep tiles clean.
  await db.transaction.deleteMany({
    where: { restaurantId, date: { gte: start, lt: end }, plaidTxnId: { startsWith: `seedbrk-` } },
  });

  const txns = TXNS.map((t, i) => ({
    restaurantId,
    plaidTxnId: `seedbrk-${restaurantId}-${i}`,
    date: dateOf(t.day),
    amount: t.amount,
    merchantName: t.vendor,
    description: t.vendor,
    bucket: t.bucket,
    categoryId: catIdByName.get(t.category) ?? null,
    isRecurring: t.recurring ?? false,
    confidence: 1,
    isManualOverride: false,
  }));
  await db.transaction.createMany({ data: txns });
  return txns.length;
}

// ── Lead pipeline (speed-to-lead) ──────────────────────────────────────────────
// Seeds Lead / CallEvent / MessageEvent with a realistic response-time spread so
// the broker roster renders worst-first (leakage → slow → fast) and the agent
// Live tab has real leads. Uses the response-clock engine (stampFirstTouch /
// deriveEscalation) so the seeded numbers are internally consistent. Assigns to
// the BrokerageAgents already committed for this tenant. Idempotent (seedlead-
// scoped). All fictitious.
interface LeadSeed {
  name: string;
  origin: LeadSource;
  agentIdx: number; // into the tenant's agents (clamped)
  agedMin: number; // minutes since the lead arrived
  responseSeconds: number | null; // null = still untouched (drives escalation)
  channel: TouchChannel; // channel of first touch (when touched)
  status: LeadStatus;
}

const LEAD_SEEDS: LeadSeed[] = [
  // Agent 2 — leaky (untouched, climbed the ladder) → sorts to top of the roster
  { name: "Sam Ortega", origin: "REFERRAL", agentIdx: 2, agedMin: 41, responseSeconds: null, channel: "CALL", status: "NEW" },
  { name: "The Whitfields", origin: "ZILLOW", agentIdx: 2, agedMin: 22, responseSeconds: null, channel: "SMS", status: "NEW" },
  // Agent 1 — slow (breaches the 2-min SLA)
  { name: "Jordan Blake", origin: "IDX_WEBSITE", agentIdx: 1, agedMin: 200, responseSeconds: 280, channel: "EMAIL", status: "CONTACTED" },
  { name: "Elena Ruiz", origin: "FACEBOOK", agentIdx: 1, agedMin: 320, responseSeconds: 520, channel: "CALL", status: "CONTACTED" },
  // Agent 0 — fast/best (well within SLA)
  { name: "Dana Whitfield", origin: "FACEBOOK", agentIdx: 0, agedMin: 120, responseSeconds: 62, channel: "CALL", status: "CONTACTED" },
  { name: "Osei Family", origin: "REFERRAL", agentIdx: 0, agedMin: 90, responseSeconds: 78, channel: "CALL", status: "ENGAGED" },
  { name: "Priya Nair", origin: "ZILLOW", agentIdx: 0, agedMin: 60, responseSeconds: 95, channel: "SMS", status: "CONTACTED" },
  // Agent 3 — mixed (one fast, one still in the 5-min reminder window)
  { name: "Tom Becker", origin: "REFERRAL", agentIdx: 3, agedMin: 30, responseSeconds: 55, channel: "CALL", status: "CONTACTED" },
  { name: "Marcus Lindqvist", origin: "IDX_WEBSITE", agentIdx: 3, agedMin: 8, responseSeconds: null, channel: "EMAIL", status: "NEW" },
  // Agent 4 — a fresh untouched lead just crossing into BACKUP
  { name: "The Ahmeds", origin: "ZILLOW", agentIdx: 4, agedMin: 16, responseSeconds: null, channel: "SMS", status: "NEW" },
];

async function seedLeadPipeline(
  db: PrismaClient,
  restaurantId: string,
): Promise<{ leads: number; calls: number; messages: number }> {
  const agents = await db.brokerageAgent.findMany({
    where: { restaurantId },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  if (agents.length === 0) return { leads: 0, calls: 0, messages: 0 };
  const agentAt = (i: number) => agents[Math.min(i, agents.length - 1)].id;

  // Idempotent clear (children first — leadId is SET NULL on delete, not cascade).
  const seededLead = { restaurantId, lead: { externalId: { startsWith: "seedlead-" } } };
  await db.messageEvent.deleteMany({ where: seededLead });
  await db.callEvent.deleteMany({ where: seededLead });
  await db.lead.deleteMany({ where: { restaurantId, externalId: { startsWith: "seedlead-" } } });

  const created: { id: string; touched: boolean }[] = [];
  let n = 0;
  for (const s of LEAD_SEEDS) {
    const receivedAt = new Date(NOW.getTime() - s.agedMin * 60_000);
    let touch: Partial<{ firstTouchAt: Date; firstTouchChannel: TouchChannel; responseSeconds: number }> = {};
    let escalation;
    if (s.responseSeconds != null) {
      const firstTouchAt = new Date(receivedAt.getTime() + s.responseSeconds * 1000);
      touch = stampFirstTouch(receivedAt, firstTouchAt, s.channel);
      escalation = deriveEscalation(s.responseSeconds);
    } else {
      const elapsed = Math.round((NOW.getTime() - receivedAt.getTime()) / 1000);
      escalation = deriveEscalation(elapsed);
    }
    const lead = await db.lead.create({
      data: {
        restaurantId,
        sourceSystem: "BOLDTRAIL",
        externalId: `seedlead-${restaurantId}-${n}`,
        origin: s.origin,
        fullName: s.name,
        email: `${s.name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        phone: `+1208555${String(2000 + n).slice(-4)}`,
        receivedAt,
        agentId: agentAt(s.agentIdx),
        assignedAt: receivedAt,
        escalation,
        status: s.status,
        ...touch,
      },
      select: { id: true },
    });
    created.push({ id: lead.id, touched: s.responseSeconds != null });
    n++;
  }

  let calls = 0;
  let messages = 0;

  // A completed cell-bridge call on the first touched lead (metadata only, no recording).
  const callLead = created.find((c) => c.touched);
  if (callLead) {
    await db.callEvent.create({
      data: {
        restaurantId,
        leadId: callLead.id,
        agentId: agentAt(0),
        direction: "OUTBOUND",
        agentNumber: "+12085550100",
        leadNumber: "+12085552004",
        conferenceSid: `seedconf-${restaurantId}-1`,
        agentCallSid: `seedleg-agent-${restaurantId}-1`,
        leadCallSid: `seedleg-lead-${restaurantId}-1`,
        status: "COMPLETED",
        initiatedAt: NOW,
        agentAnsweredAt: NOW,
        leadConnectedAt: NOW,
        endedAt: NOW,
        durationSec: 214,
        connected: true,
      },
    });
    calls++;
  }

  // One sent AI-drafted email, and one pending DRAFT (the approve-and-send demo).
  if (created[4]) {
    await db.messageEvent.create({
      data: {
        restaurantId,
        leadId: created[4].id,
        agentId: agentAt(0),
        channel: "EMAIL",
        direction: "OUTBOUND",
        aiDrafted: true,
        aiModel: "claude-sonnet-5",
        approvedAt: NOW,
        subject: "Great to connect",
        body: "Hi Dana — great to connect. Two new Ridgeline listings match your saved search; want me to send them over?",
        status: "SENT",
        sentAt: NOW,
      },
    });
    messages++;
  }
  const draftLead = created.find((c) => !c.touched);
  if (draftLead) {
    await db.messageEvent.create({
      data: {
        restaurantId,
        leadId: draftLead.id,
        agentId: agentAt(2),
        channel: "EMAIL",
        direction: "OUTBOUND",
        aiDrafted: true,
        aiModel: "claude-sonnet-5",
        subject: "Following up on your search",
        body: "Hi — following up on the homes you were looking at. Happy to set up a few showings this week if you're ready.",
        status: "DRAFT",
      },
    });
    messages++;
  }

  return { leads: created.length, calls, messages };
}

async function main() {
  const userId = arg("--user") ?? process.env.CLERK_USER_ID;
  let restaurantId = arg("--restaurant");
  const name = arg("--name") ?? process.env.BROKERAGE_DEMO_NAME ?? "Cascade Realty Group";

  // Prefer an existing tenant for the given user (mirrors seed-demo.ts).
  if (!restaurantId && userId) {
    const role = await prisma.userRestaurantRole.findFirst({
      where: {
        clerkUserId: userId,
        restaurant: { businessType: "REAL_ESTATE_BROKERAGE" },
      },
      select: { restaurantId: true },
    });
    restaurantId = role?.restaurantId;
  }

  if (restaurantId) {
    const target = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { businessType: true, name: true },
    });
    if (!target) {
      throw new Error(`No business found for --restaurant ${restaurantId}.`);
    }
    if (target.businessType !== "REAL_ESTATE_BROKERAGE") {
      throw new Error(
        `Refusing to seed brokerage demo data into "${target.name}" (${target.businessType}). Pass a real-estate brokerage tenant or omit --restaurant to create one.`,
      );
    }
  }

  restaurantId = await ensureTenant(prisma, { restaurantId, userId, name });

  // Generate the fictitious payload and commit agents/deals/lead-spend.
  const { payload } = buildBrokeragePayload();
  const commit = await commitBrokerageImport(prisma, { restaurantId, payload });

  const marketMetrics = await seedMarketMetrics(prisma, restaurantId);
  const sourceConfigs = await seedDataSourceConfigs(prisma, restaurantId);
  const transactions = await seedBrokerageTransactions(prisma, restaurantId);
  const leadPipeline = await seedLeadPipeline(prisma, restaurantId);

  // Link the seed user to the first agent so /realestate/agent renders for them
  // (they see the broker roster via OPERATOR and the agent app via this link).
  let linkedAgentName: string | null = null;
  if (userId) {
    const first = await prisma.brokerageAgent.findFirst({
      where: { restaurantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    if (first) {
      await prisma.brokerageAgent.update({
        where: { id: first.id },
        data: { clerkUserId: userId, phone: "+12085550100" },
      });
      linkedAgentName = first.name;
    }
  }

  const summary: SeedSummary = {
    restaurantId,
    agents: commit.summary.agents,
    deals: commit.summary.deals,
    leadSpend: commit.summary.leadSpend,
    marketMetrics,
    sourceConfigs,
    transactions,
    leads: leadPipeline.leads,
    calls: leadPipeline.calls,
    messages: leadPipeline.messages,
  };

  console.log("Seeded Cascade Realty Group demo:");
  console.log(`  tenant:         ${summary.restaurantId}`);
  console.log(`  agents:         ${summary.agents}`);
  console.log(`  deals:          ${summary.deals}`);
  console.log(`  lead-spend:     ${summary.leadSpend} rows`);
  console.log(`  market metrics: ${summary.marketMetrics} rows`);
  console.log(`  source configs: ${summary.sourceConfigs} demo-connected providers, no live tokens stored`);
  console.log(`  transactions:   ${summary.transactions} (current month, category-linked)`);
  console.log(`  leads:          ${summary.leads} (response-clock spread: leaked / slow / fast)`);
  console.log(`  calls:          ${summary.calls} · messages: ${summary.messages} (1 sent + 1 draft)`);
  if (commit.rejected.length > 0) {
    console.log(`  ⚠ rejected import rows: ${commit.rejected.length}`);
  }
  if (linkedAgentName) {
    console.log(`  agent link:     ${linkedAgentName} → your login`);
  }
  console.log("Open /dashboard for brokerage tiles, /realestate/broker for the speed-to-lead roster,");
  console.log(linkedAgentName ? "and /realestate/agent for the agent app (Today + Live)." : "and pass --user to also link the agent app.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("seed:brokerage failed —", e instanceof Error ? e.message : e);
    process.exit(1);
  });
