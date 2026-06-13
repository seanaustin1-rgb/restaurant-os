import { prisma } from "@/lib/prisma";

// Category Trends & Budgets module — per-category spend over the last 6 months
// (month-over-month), plus an optional monthly budget with budget-vs-actual for
// the current month. Cash basis (outflows = positive amounts), consistent with
// Spending by Category. Revenue/Excluded categories are not spend, so skipped.

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface MonthCell {
  ym: string; // "2026-06"
  label: string; // "Jun"
  total: number;
}

export interface CategoryTrendRow {
  categoryId: string;
  name: string;
  tapBucket: string;
  budget: number | null;
  months: MonthCell[]; // oldest → newest
  current: number;
  prior: number;
  momPct: number | null; // null when prior is 0
  /** current spend as % of budget; null when no budget set. */
  budgetUsedPct: number | null;
}

export interface CategoryTrendsData {
  monthsLabels: { ym: string; label: string }[];
  currentLabel: string;
  rows: CategoryTrendRow[];
  hasData: boolean;
}

const NON_SPEND = new Set(["REVENUE", "EXCLUDED"]);

export async function loadCategoryTrends(restaurantId: string, monthsBack = 6): Promise<CategoryTrendsData> {
  const latest = await prisma.transaction.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const ref = latest?.date ?? new Date();

  // Build the month buckets (oldest → newest), ending at the latest txn month.
  const monthKeys: { ym: string; label: string; start: Date; end: Date }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    monthKeys.push({
      ym: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      label: MONTHS[start.getUTCMonth()],
      start,
      end,
    });
  }
  const windowStart = monthKeys[0].start;
  const windowEnd = monthKeys[monthKeys.length - 1].end;

  const [cats, txns] = await Promise.all([
    prisma.category.findMany({
      where: { restaurantId },
      select: { id: true, name: true, tapBucket: true, monthlyBudget: true },
    }),
    prisma.transaction.findMany({
      where: { restaurantId, date: { gte: windowStart, lt: windowEnd } },
      select: { date: true, amount: true, categoryId: true },
    }),
  ]);
  const catMeta = new Map(cats.map((c) => [c.id, c]));

  const ymOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  // agg[categoryId][ym] = total spend
  const agg = new Map<string, Map<string, number>>();
  for (const t of txns) {
    const amt = n(t.amount);
    if (amt <= 0) continue; // outflows only
    const meta = t.categoryId ? catMeta.get(t.categoryId) : undefined;
    if (!meta || NON_SPEND.has(meta.tapBucket)) continue;
    const m = agg.get(meta.id) ?? new Map<string, number>();
    const ym = ymOf(t.date);
    m.set(ym, (m.get(ym) ?? 0) + amt);
    agg.set(meta.id, m);
  }

  const currentYm = monthKeys[monthKeys.length - 1].ym;
  const priorYm = monthKeys.length > 1 ? monthKeys[monthKeys.length - 2].ym : null;

  const rows: CategoryTrendRow[] = [];
  for (const [categoryId, byMonth] of agg) {
    const meta = catMeta.get(categoryId)!;
    const months = monthKeys.map((mk) => ({ ym: mk.ym, label: mk.label, total: r2(byMonth.get(mk.ym) ?? 0) }));
    const current = r2(byMonth.get(currentYm) ?? 0);
    const prior = r2(priorYm ? byMonth.get(priorYm) ?? 0 : 0);
    const budget = meta.monthlyBudget == null ? null : n(meta.monthlyBudget);
    rows.push({
      categoryId,
      name: meta.name,
      tapBucket: meta.tapBucket,
      budget,
      months,
      current,
      prior,
      momPct: prior > 0 ? r2(((current - prior) / prior) * 100) : null,
      budgetUsedPct: budget && budget > 0 ? r2((current / budget) * 100) : null,
    });
  }

  // Largest current spend first; categories with a budget bubble up within ties.
  rows.sort((a, b) => b.current - a.current || (b.budget ?? 0) - (a.budget ?? 0));

  return {
    monthsLabels: monthKeys.map((m) => ({ ym: m.ym, label: m.label })),
    currentLabel: `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`,
    rows,
    hasData: txns.length > 0,
  };
}
