// Two-level categorization (see docs/specs/transaction-categorization-v2.md):
// operator-extensible Categories roll up into the fixed TapBucket set. This file
// holds the default seed set + the legacy-bucket → category mapping used to
// backfill existing transactions. Pure data + helpers (the seed/lookup functions
// take a Prisma client so this module stays import-safe everywhere).
import type { PrismaClient, TapBucket } from "@prisma/client";

export const MISC_CATEGORY_NAME = "Misc";

// TapBucket display labels (the fixed Profit First rollup targets a Category maps to).
export const TAP_BUCKETS: { value: TapBucket; label: string }[] = [
  { value: "REVENUE", label: "Revenue" },
  { value: "COGS_FOOD", label: "COGS — Food" },
  // PA: wine + spirits share one vendor (PLCB state store) → COGS_LIQUOR; beer has
  // its own distributors → COGS_BEVERAGE. Labels reflect the operator's mental model.
  { value: "COGS_LIQUOR", label: "COGS — Wine & Spirits" },
  { value: "COGS_BEVERAGE", label: "COGS — Beer" },
  { value: "LABOR", label: "Labor" },
  { value: "PROFIT", label: "Profit (debt service)" },
  { value: "OWNER_PAY", label: "Owner Pay" },
  { value: "OPEX", label: "OpEx" },
  { value: "TAX_SALES", label: "Tax — Sales" },
  { value: "TAX_PAYROLL", label: "Tax — Payroll" },
  { value: "EXCLUDED", label: "Excluded (not a TAP)" },
];

export const TAP_BUCKET_LABEL: Record<string, string> = Object.fromEntries(
  TAP_BUCKETS.map((b) => [b.value, b.label]),
);

export interface DefaultCategory {
  name: string;
  tapBucket: TapBucket;
  sortOrder: number;
}

// Seeded for every restaurant. Operators can add/rename/remap on top of these.
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Sales Deposits", tapBucket: "REVENUE", sortOrder: 1 },

  { name: "Food — Distributor", tapBucket: "COGS_FOOD", sortOrder: 10 },
  { name: "Food — Grocery", tapBucket: "COGS_FOOD", sortOrder: 11 },
  { name: "Liquor (State Store)", tapBucket: "COGS_LIQUOR", sortOrder: 20 },
  { name: "Beer / Beverage Distributor", tapBucket: "COGS_BEVERAGE", sortOrder: 30 },

  { name: "Payroll — Direct Deposit", tapBucket: "LABOR", sortOrder: 40 },
  { name: "Payroll — Paper Checks", tapBucket: "LABOR", sortOrder: 41 },
  { name: "Owner Pay / Draw", tapBucket: "OWNER_PAY", sortOrder: 50 },

  { name: "Rent", tapBucket: "OPEX", sortOrder: 60 },
  { name: "Utilities", tapBucket: "OPEX", sortOrder: 61 },
  { name: "Telecom / Internet", tapBucket: "OPEX", sortOrder: 62 },
  { name: "Insurance", tapBucket: "OPEX", sortOrder: 63 },
  { name: "Waste / Trash", tapBucket: "OPEX", sortOrder: 64 },
  { name: "Smallwares / Supplies", tapBucket: "OPEX", sortOrder: 65 },
  { name: "Marketing", tapBucket: "OPEX", sortOrder: 66 },
  { name: "Maintenance & Repair", tapBucket: "OPEX", sortOrder: 67 },
  { name: "Cleaning / Services", tapBucket: "OPEX", sortOrder: 68 },
  { name: "Professional Services", tapBucket: "OPEX", sortOrder: 69 },
  { name: "Technology / Software", tapBucket: "OPEX", sortOrder: 70 },
  { name: "Merchant / Bank Fees", tapBucket: "OPEX", sortOrder: 71 },
  // Profit First: debt is serviced from Profit distributions, not OpEx.
  { name: "Debt Service", tapBucket: "PROFIT", sortOrder: 72 },

  { name: "Sales Tax", tapBucket: "TAX_SALES", sortOrder: 80 },
  { name: "Payroll Tax", tapBucket: "TAX_PAYROLL", sortOrder: 81 },

  { name: "Bank / Register Cash", tapBucket: "EXCLUDED", sortOrder: 90 },
  { name: "Tips / Tip-Outs", tapBucket: "EXCLUDED", sortOrder: 91 },
  { name: "Internal Transfers", tapBucket: "EXCLUDED", sortOrder: 92 },

  // Catch-all so every dollar lands somewhere. Rolls into OpEx until the operator
  // reassigns it (operator decision 2026-06-01).
  { name: MISC_CATEGORY_NAME, tapBucket: "OPEX", sortOrder: 999 },
];

// Legacy flat TransactionBucket -> default category name. Used to backfill the
// existing `Transaction.bucket` values (incl. manual overrides, which already
// live in the bucket) onto categories with no data loss.
export const LEGACY_BUCKET_TO_CATEGORY: Record<string, string> = {
  REVENUE: "Sales Deposits",
  COGS_FOOD: "Food — Distributor",
  COGS_LIQUOR: "Liquor (State Store)",
  COGS_BEVERAGE: "Beer / Beverage Distributor",
  LABOR: "Payroll — Direct Deposit",
  PAYROLL_CHECK: "Payroll — Paper Checks",
  OPEX_RENT: "Rent",
  OPEX_UTILITIES: "Utilities",
  OPEX_INSURANCE: "Insurance",
  OPEX_SUPPLIES: "Smallwares / Supplies",
  DEBT_SERVICE: "Debt Service",
  OWNER_PAY: "Owner Pay / Draw",
  TAX_SALES: "Sales Tax",
  TAX_PAYROLL: "Payroll Tax",
  UNCATEGORIZED: MISC_CATEGORY_NAME,
};

export function legacyBucketToCategoryName(bucket: string | null | undefined): string {
  return (bucket && LEGACY_BUCKET_TO_CATEGORY[bucket]) || MISC_CATEGORY_NAME;
}

/** Idempotently seed the default categories for a restaurant (system rows). */
export async function ensureDefaultCategories(prisma: PrismaClient, restaurantId: string): Promise<void> {
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({
      restaurantId,
      name: c.name,
      tapBucket: c.tapBucket,
      isSystem: true,
      sortOrder: c.sortOrder,
    })),
    skipDuplicates: true, // unique (restaurantId, name)
  });
}

/** name -> categoryId map for a restaurant (after seeding). */
export async function categoryIdByName(prisma: PrismaClient, restaurantId: string): Promise<Map<string, string>> {
  const cats = await prisma.category.findMany({
    where: { restaurantId },
    select: { id: true, name: true },
  });
  return new Map(cats.map((c) => [c.name, c.id]));
}

/** categoryId -> tapBucket map for a restaurant (used for the legacy bucket dual-write). */
export async function categoryTapById(prisma: PrismaClient, restaurantId: string): Promise<Map<string, TapBucket>> {
  const cats = await prisma.category.findMany({
    where: { restaurantId },
    select: { id: true, tapBucket: true },
  });
  return new Map(cats.map((c) => [c.id, c.tapBucket]));
}
