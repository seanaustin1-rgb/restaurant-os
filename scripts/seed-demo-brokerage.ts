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
  legacyBucketToCategoryName,
} from "../src/lib/categorization/categories";
import { buildBrokeragePayload, BROKERAGE_MARKETS } from "./generate-brokerage-pilot-payload";

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
// The vendor map is restaurant-tuned, so we assign explicit buckets that roll up
// into the brokerage TAP accounts (Agent Splits, Lead Gen/Marketing, Staff
// Payroll, OpEx, Owner Pay, Tax Reserve). Legacy TransactionBucket → Category →
// TapBucket via legacyBucketToCategoryName, exactly like seedDemoData.
interface TxnSeed {
  vendor: string;
  amount: number;
  day: number;
  bucket: TransactionBucket;
  recurring?: boolean;
}

const TXNS: TxnSeed[] = [
  // Lead generation / marketing → OPEX_SUPPLIES (Marketing/Tech rolls into OpEx TAP)
  { vendor: "Zillow Premier Agent", amount: 3850, day: 3, bucket: "OPEX_SUPPLIES", recurring: true },
  { vendor: "Realtor.com Connections", amount: 2300, day: 5, bucket: "OPEX_SUPPLIES", recurring: true },
  { vendor: "Google Ads", amount: 1750, day: 8, bucket: "OPEX_SUPPLIES", recurring: true },
  { vendor: "Meta Ads (Facebook)", amount: 900, day: 12, bucket: "OPEX_SUPPLIES", recurring: true },

  // Agent commission payouts → LABOR (Agent Commission Splits / payroll-style outflow)
  { vendor: "Agent Commission Payout — Whitaker", amount: 7400, day: 6, bucket: "LABOR" },
  { vendor: "Agent Commission Payout — DeLuca", amount: 6100, day: 6, bucket: "LABOR" },
  { vendor: "Agent Commission Payout — Reyes", amount: 5200, day: 14, bucket: "LABOR" },
  { vendor: "Agent Commission Payout — Brooks", amount: 4800, day: 14, bucket: "LABOR" },
  { vendor: "Agent Commission Payout — Vasquez", amount: 5600, day: 22, bucket: "LABOR" },

  // Office rent → OPEX_RENT
  { vendor: "Crossroads Office Park — Rent", amount: 6800, day: 1, bucket: "OPEX_RENT", recurring: true },

  // MLS / board / association dues → OPEX_SUPPLIES (OpEx)
  { vendor: "Intermountain MLS Dues", amount: 540, day: 4, bucket: "OPEX_SUPPLIES", recurring: true },
  { vendor: "Boise Regional REALTORS Board Dues", amount: 420, day: 4, bucket: "OPEX_SUPPLIES", recurring: true },

  // E&O insurance → OPEX_INSURANCE
  { vendor: "Pearl E&O Insurance", amount: 1150, day: 9, bucket: "OPEX_INSURANCE", recurring: true },

  // Staff / admin payroll → LABOR
  { vendor: "Gusto Payroll — Admin Staff", amount: 9200, day: 15, bucket: "LABOR", recurring: true },
  { vendor: "Gusto Payroll — Admin Staff", amount: 9200, day: 30, bucket: "LABOR", recurring: true },

  // Office utilities / software → OPEX_UTILITIES / OPEX_SUPPLIES
  { vendor: "Idaho Power", amount: 410, day: 10, bucket: "OPEX_UTILITIES", recurring: true },
  { vendor: "Follow Up Boss CRM", amount: 760, day: 11, bucket: "OPEX_SUPPLIES", recurring: true },
  { vendor: "Dotloop Transaction Mgmt", amount: 320, day: 11, bucket: "OPEX_SUPPLIES", recurring: true },

  // Tax reserve set-aside → TAX_PAYROLL (reserve outflow)
  { vendor: "Estimated Tax Reserve Transfer", amount: 4200, day: 17, bucket: "TAX_PAYROLL", recurring: true },

  // Owner draw → OWNER_PAY
  { vendor: "Owner Draw", amount: 7500, day: 15, bucket: "OWNER_PAY" },
  { vendor: "Owner Draw", amount: 7500, day: 30, bucket: "OWNER_PAY" },
];

interface SeedSummary {
  restaurantId: string;
  agents: number;
  deals: number;
  leadSpend: number;
  marketMetrics: number;
  sourceConfigs: number;
  transactions: number;
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
    categoryId: catIdByName.get(legacyBucketToCategoryName(t.bucket)) ?? null,
    isRecurring: t.recurring ?? false,
    confidence: 1,
    isManualOverride: false,
  }));
  await db.transaction.createMany({ data: txns });
  return txns.length;
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

  const summary: SeedSummary = {
    restaurantId,
    agents: commit.summary.agents,
    deals: commit.summary.deals,
    leadSpend: commit.summary.leadSpend,
    marketMetrics,
    sourceConfigs,
    transactions,
  };

  console.log("Seeded Cascade Realty Group demo:");
  console.log(`  tenant:         ${summary.restaurantId}`);
  console.log(`  agents:         ${summary.agents}`);
  console.log(`  deals:          ${summary.deals}`);
  console.log(`  lead-spend:     ${summary.leadSpend} rows`);
  console.log(`  market metrics: ${summary.marketMetrics} rows`);
  console.log(`  source configs: ${summary.sourceConfigs} demo-connected providers, no live tokens stored`);
  console.log(`  transactions:   ${summary.transactions} (current month, category-linked)`);
  if (commit.rejected.length > 0) {
    console.log(`  ⚠ rejected import rows: ${commit.rejected.length}`);
  }
  console.log("Open /dashboard to see the populated brokerage tiles.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("seed:brokerage failed —", e instanceof Error ? e.message : e);
    process.exit(1);
  });
