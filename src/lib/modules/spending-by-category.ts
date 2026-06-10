import { prisma } from "@/lib/prisma";
import type { TapBucket } from "@prisma/client";

// Spending by Category module. Splits the period's outflows into high-level
// groups (for the pie) and detailed categories (for the table), and compares
// total spend against money in to show profit. Cash basis, consistent with the
// Cash Flow module's sign convention (inflows stored negative, outflows positive).
export interface CategoryRow {
  name: string;
  group: string;
  total: number;
  share: number; // % of money in (or of spend if no revenue)
}

export interface SpendGroup {
  group: string;
  total: number;
  share: number;
}

export interface SpendingByCategoryData {
  periodLabel: string;
  revenue: number; // money in
  totalSpend: number; // money out
  profit: number; // revenue - totalSpend
  profitMargin: number; // profit / revenue * 100
  groups: SpendGroup[]; // for the pie, ordered
  categories: CategoryRow[]; // detailed table, largest first
  hasData: boolean;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const GROUP_ORDER = [
  "Food & Beverage (COGS)",
  "Labor",
  "Operating Expenses",
  "Owner's Pay",
  "Taxes",
  "Other / Uncategorized",
];

function groupFor(tap: TapBucket | null): string {
  switch (tap) {
    case "COGS_FOOD":
    case "COGS_LIQUOR":
    case "COGS_BEVERAGE":
      return "Food & Beverage (COGS)";
    case "LABOR":
      return "Labor";
    case "OWNER_PAY":
      return "Owner's Pay";
    case "OPEX":
      return "Operating Expenses";
    case "TAX_SALES":
    case "TAX_PAYROLL":
      return "Taxes";
    default:
      return "Other / Uncategorized";
  }
}

export async function loadSpendingByCategory(restaurantId: string): Promise<SpendingByCategoryData> {
  const latest = await prisma.transaction.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const ref = latest?.date ?? new Date();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  const periodLabel = `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`;

  const [txns, cats] = await Promise.all([
    prisma.transaction.findMany({
      where: { restaurantId, date: { gte: start, lt: end } },
      select: { amount: true, categoryId: true },
    }),
    prisma.category.findMany({ where: { restaurantId }, select: { id: true, name: true, tapBucket: true } }),
  ]);
  const catMeta = new Map(cats.map((c) => [c.id, { name: c.name, tap: c.tapBucket }]));

  let revenue = 0;
  let totalSpend = 0;
  const catAgg = new Map<string, { name: string; group: string; total: number }>();
  const groupAgg = new Map<string, number>();

  for (const t of txns) {
    const amt = n(t.amount);
    if (amt < 0) {
      revenue += -amt;
      continue;
    }
    if (amt === 0) continue;
    totalSpend += amt;
    const meta = t.categoryId ? catMeta.get(t.categoryId) ?? null : null;
    const name = meta?.name ?? "Uncategorized";
    const group = groupFor(meta?.tap ?? null);
    const c = catAgg.get(name) ?? { name, group, total: 0 };
    c.total += amt;
    catAgg.set(name, c);
    groupAgg.set(group, (groupAgg.get(group) ?? 0) + amt);
  }

  // Share base: money in if we have it (so spend groups + profit = 100%),
  // otherwise fall back to total spend so the breakdown still sums sensibly.
  const base = revenue > 0 ? revenue : totalSpend;
  const share = (v: number) => (base > 0 ? (v / base) * 100 : 0);

  const categories = [...catAgg.values()]
    .map((c) => ({ ...c, share: share(c.total) }))
    .sort((a, b) => b.total - a.total);

  const groups = [...groupAgg.entries()]
    .map(([group, total]) => ({ group, total, share: share(total) }))
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));

  const profit = revenue - totalSpend;
  const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return {
    periodLabel,
    revenue,
    totalSpend,
    profit,
    profitMargin,
    groups,
    categories,
    hasData: txns.length > 0,
  };
}
