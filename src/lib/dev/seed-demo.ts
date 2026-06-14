import type { TransactionBucket } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { categorizeTransaction } from "@/lib/categorization/vendor-map";
import {
  ensureDefaultCategories,
  categoryIdByName,
  legacyBucketToCategoryName,
} from "@/lib/categorization/categories";

// Seeds a full month of realistic DailySales + categorized Transactions for one
// restaurant, so the live dashboard renders with data — including the Heartbeat
// cost ratios, which come from the categorized COGS/payroll transactions.
//
// Seeds the CURRENT calendar month, because the dashboard period follows the
// latest DailySales row: seeding the current month guarantees the period shown
// lines up with the seeded data (rather than a stale hardcoded month).

const NOW = new Date();
const YEAR = NOW.getUTCFullYear();
const MONTH0 = NOW.getUTCMonth(); // current month (0-indexed)
const DAYS = new Date(Date.UTC(YEAR, MONTH0 + 1, 0)).getUTCDate(); // days in this month

interface TxnSeed {
  vendor: string;
  amount: number;
  day: number;
  bucket?: TransactionBucket; // when the vendor map can't infer it (rent, etc.)
  recurring?: boolean;
}

const TXNS: TxnSeed[] = [
  // COGS — Food (~$53k)
  { vendor: "Sysco Foods", amount: 8200, day: 2 },
  { vendor: "Restaurant Depot", amount: 2900, day: 4 },
  { vendor: "US Foods", amount: 6100, day: 6 },
  { vendor: "Sysco Foods", amount: 7900, day: 9 },
  { vendor: "Restaurant Depot", amount: 3100, day: 18 },
  { vendor: "Sysco Foods", amount: 8600, day: 16 },
  { vendor: "US Foods", amount: 5800, day: 20 },
  { vendor: "Sysco Foods", amount: 8100, day: 23 },
  { vendor: "Restaurant Depot", amount: 2700, day: 27 },
  // COGS — Liquor (~$35k)
  { vendor: "PLCB Store 4421", amount: 9200, day: 5 },
  { vendor: "Breakthru Beverage", amount: 8600, day: 12 },
  { vendor: "PLCB Store 4421", amount: 8800, day: 19 },
  { vendor: "Breakthru Beverage", amount: 8400, day: 26 },
  // Labor (~$88k) — Toast Payroll weekly
  { vendor: "Toast Payroll", amount: 22000, day: 6 },
  { vendor: "Toast Payroll", amount: 21500, day: 13 },
  { vendor: "Toast Payroll", amount: 22500, day: 20 },
  { vendor: "Toast Payroll", amount: 22000, day: 27 },
  // OpEx
  { vendor: "Riverfront Property Mgmt — Rent", amount: 12000, day: 1, bucket: "OPEX_RENT", recurring: true },
  { vendor: "Hospitality Mutual Insurance", amount: 1850, day: 3, bucket: "OPEX_INSURANCE", recurring: true },
  { vendor: "PPL Electric", amount: 2450, day: 10 },
  { vendor: "Columbia Gas", amount: 1180, day: 10 },
  { vendor: "Cintas Corp", amount: 780, day: 8 },
  { vendor: "Ecolab Inc", amount: 610, day: 8 },
  { vendor: "Cintas Corp", amount: 760, day: 22 },
  { vendor: "Ecolab Inc", amount: 640, day: 22 },
  { vendor: "WebstaurantStore", amount: 1520, day: 15 },
  // Owner Pay
  { vendor: "Owner Draw", amount: 6000, day: 15, bucket: "OWNER_PAY" },
  { vendor: "Owner Draw", amount: 6000, day: 30, bucket: "OWNER_PAY" },
  // Sales tax (Davo) — excluded from TAPs but real outflow
  { vendor: "DAVO Sales Tax", amount: 1600, day: 7 },
  { vendor: "DAVO Sales Tax", amount: 1500, day: 14 },
  { vendor: "DAVO Sales Tax", amount: 1700, day: 21 },
  { vendor: "DAVO Sales Tax", amount: 1550, day: 28 },
];

function dateOf(day: number): Date {
  return new Date(Date.UTC(YEAR, MONTH0, day));
}

export interface SeedResult {
  restaurantId: string;
  dailySales: number;
  transactions: number;
}

export async function seedDemoData(restaurantId: string): Promise<SeedResult> {
  const start = dateOf(1);
  const end = new Date(Date.UTC(YEAR, MONTH0 + 1, 1));

  // The dashboard rolls costs up by Category.tapBucket via each transaction's
  // categoryId — so seeded transactions MUST be linked to a Category, or they
  // all fall into OpEx and the Heartbeat cost ratios stay 0. Ensure the default
  // categories exist, then map each legacy bucket → category → id.
  await ensureDefaultCategories(prisma, restaurantId);
  const catIdByName = await categoryIdByName(prisma, restaurantId);

  // Clear prior seed for idempotency.
  await prisma.dailySales.deleteMany({ where: { restaurantId, date: { gte: start, lt: end } } });
  await prisma.transaction.deleteMany({ where: { restaurantId, plaidTxnId: { startsWith: `seed-${restaurantId}-` } } });

  // Daily sales.
  const sales = [];
  for (let day = 1; day <= DAYS; day++) {
    const date = dateOf(day);
    const dow = date.getUTCDay();
    const weekend = dow === 5 || dow === 6;
    const net = 8200 + (weekend ? 3200 : 0) + Math.round((Math.random() - 0.5) * 1400);
    const covers = 250 + (weekend ? 130 : 0) + Math.round(Math.random() * 60);
    sales.push({
      restaurantId,
      date,
      grossSales: Math.round(net / 0.92),
      netSales: net,
      foodSales: Math.round(net * 0.63),
      liquorSales: Math.round(net * 0.32),
      beverageSales: Math.round(net * 0.05),
      covers,
      checkCount: Math.round(covers * 0.55),
      laborCost: Math.round(net * 0.3),
      hoursOpen: 13,
      source: "seed",
    });
  }
  await prisma.dailySales.createMany({ data: sales });

  // Categorized transactions.
  const txns = TXNS.map((t, i) => {
    const cat = t.bucket
      ? { bucket: t.bucket, isRecurring: t.recurring ?? false, confidence: 1 }
      : categorizeTransaction(t.vendor, t.vendor);
    return {
      restaurantId,
      plaidTxnId: `seed-${restaurantId}-${i}`,
      date: dateOf(Math.min(t.day, DAYS)), // clamp into the month (short months)
      amount: t.amount,
      merchantName: t.vendor,
      description: t.vendor,
      bucket: cat.bucket,
      // Link to the matching Category so the dashboard/modules roll it up.
      categoryId: catIdByName.get(legacyBucketToCategoryName(cat.bucket)) ?? null,
      isRecurring: cat.isRecurring,
      confidence: cat.confidence,
      isManualOverride: false,
    };
  });
  await prisma.transaction.createMany({ data: txns });

  return { restaurantId, dailySales: sales.length, transactions: txns.length };
}
