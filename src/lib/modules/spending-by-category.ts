import type { LedgerAccount, PrismaClient, TapBucket } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assessLedgerCoverage,
  describeLedgerSource,
  type LedgerReadSource,
} from "@/lib/financial-ledger/ledger-coverage";

// Spending by Category module. Splits the period's outflows into high-level
// groups (for the pie) and detailed categories (for the table), and compares
// total spend against money in to show profit. Cash basis, consistent with the
// Cash Flow module's sign convention (inflows stored negative, outflows positive).
//
// Read ledger-first (Spec A.2): the clean ledger expresses spend as `debit` on
// its expense LedgerAccounts and revenue as positive `cashEffect`. The ledger's
// category vocabulary is the LedgerAccount enum — coarser than the operator's
// Category names — so we map each spend account onto Spending's groups through an
// EXPLICIT table (LEDGER_SPEND_ACCOUNTS). Anything neither a mapped spend account
// nor an explicitly non-spend account renders as "Unmapped" with a count, so
// drift is visible instead of silently coerced. Legacy Transaction → Category is
// the fallback when the ledger doesn't cover the period.
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
  /** Which spine served the figures (ledger / legacy fallback / none). */
  source: LedgerReadSource;
  /** Human caption for the source-trust affordance. */
  sourceLabel: string;
  /** Events in the window still PENDING_REVIEW — trust caveat when ledger-first. */
  pendingReviewCount: number;
  /** Ledger spend lines on an account with no explicit mapping (drift signal). */
  unmappedCount: number;
}

type Meta = { name: string; group: string; total: number };
type Aggregates = {
  revenue: number;
  totalSpend: number;
  catAgg: Map<string, Meta>;
  groupAgg: Map<string, number>;
  unmappedCount: number;
  hasRows: boolean;
};

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const GROUP_COGS = "Food & Beverage (COGS)";
const GROUP_LABOR = "Labor";
const GROUP_OPEX = "Operating Expenses";
const GROUP_OWNER = "Owner's Pay";
const GROUP_TAX = "Taxes";
const GROUP_OTHER = "Other / Uncategorized";

const GROUP_ORDER = [GROUP_COGS, GROUP_LABOR, GROUP_OPEX, GROUP_OWNER, GROUP_TAX, GROUP_OTHER];

function groupFor(tap: TapBucket | null): string {
  switch (tap) {
    case "COGS_FOOD":
    case "COGS_LIQUOR":
    case "COGS_BEVERAGE":
      return GROUP_COGS;
    case "LABOR":
      return GROUP_LABOR;
    case "OWNER_PAY":
      return GROUP_OWNER;
    case "OPEX":
      return GROUP_OPEX;
    case "TAX_SALES":
    case "TAX_PAYROLL":
      return GROUP_TAX;
    default:
      return GROUP_OTHER;
  }
}

/**
 * Explicit LedgerAccount → Spending group + display name for spend accounts.
 * Debt service mirrors legacy (PROFIT-bucket debt lands in "Other"), keeping the
 * two spines' groupings comparable. See LEDGER_NON_SPEND_ACCOUNTS for the
 * accounts deliberately excluded from spend; any account in neither table is
 * surfaced as "Unmapped".
 */
export const LEDGER_SPEND_ACCOUNTS: Partial<Record<LedgerAccount, { group: string; name: string }>> = {
  COGS: { group: GROUP_COGS, name: "Cost of Goods Sold" },
  LABOR: { group: GROUP_LABOR, name: "Labor" },
  OPEX: { group: GROUP_OPEX, name: "Operating Expenses" },
  FIXED_OPEX: { group: GROUP_OPEX, name: "Fixed Operating Expenses" },
  TAX_VAULT: { group: GROUP_TAX, name: "Taxes" },
  OWNER_PAY: { group: GROUP_OWNER, name: "Owner's Pay" },
  DEBT_SERVICE: { group: GROUP_OTHER, name: "Debt Service" },
};

/** Accounts that are never operating spend: the cash contra side, revenue,
 * pass-throughs, internal moves, and the profit allocation target. */
export const LEDGER_NON_SPEND_ACCOUNTS: readonly LedgerAccount[] = [
  "OPERATING_CASH",
  "REVENUE",
  "REAL_REVENUE",
  "PASS_THROUGH_PAYABLE",
  "AGENT_PAYABLE",
  "INTERNAL_TRANSFER",
  "PROFIT",
];

/**
 * Aggregate spend + revenue from clean-ledger lines. Pure so the account-mapping
 * table is unit-tested. Spend = `debit` on a mapped spend account; revenue =
 * positive `cashEffect`. A `debit` on an account that is neither mapped nor
 * explicitly non-spend is bucketed as "Unmapped" (visible drift, never silent).
 */
export function aggregateLedgerSpending(
  lines: ReadonlyArray<{ ledgerAccount: string; debit: unknown; cashEffect: unknown }>,
): Aggregates {
  const nonSpend = new Set<string>(LEDGER_NON_SPEND_ACCOUNTS);
  const catAgg = new Map<string, Meta>();
  const groupAgg = new Map<string, number>();
  let revenue = 0;
  let totalSpend = 0;
  let unmappedCount = 0;
  let hasRows = false;

  for (const l of lines) {
    hasRows = true;
    const eff = n(l.cashEffect);
    if (eff > 0) revenue += eff;

    const debit = n(l.debit);
    if (debit <= 0) continue;
    if (nonSpend.has(l.ledgerAccount)) continue; // e.g. OPERATING_CASH debit = a cash inflow, not spend

    const mapped = (LEDGER_SPEND_ACCOUNTS as Record<string, { group: string; name: string } | undefined>)[
      l.ledgerAccount
    ];
    const name = mapped?.name ?? "Unmapped";
    const group = mapped?.group ?? GROUP_OTHER;
    if (!mapped) unmappedCount += 1;

    totalSpend += debit;
    const c = catAgg.get(name) ?? { name, group, total: 0 };
    c.total += debit;
    catAgg.set(name, c);
    groupAgg.set(group, (groupAgg.get(group) ?? 0) + debit);
  }

  return { revenue, totalSpend, catAgg, groupAgg, unmappedCount, hasRows };
}

/** Aggregate spend + revenue from legacy Transactions (fallback path). */
export function aggregateLegacySpending(
  txns: ReadonlyArray<{ amount: unknown; categoryId: string | null }>,
  catMeta: ReadonlyMap<string, { name: string; tap: TapBucket }>,
): Aggregates {
  const catAgg = new Map<string, Meta>();
  const groupAgg = new Map<string, number>();
  let revenue = 0;
  let totalSpend = 0;
  let hasRows = false;

  for (const t of txns) {
    hasRows = true;
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

  return { revenue, totalSpend, catAgg, groupAgg, unmappedCount: 0, hasRows };
}

export async function loadSpendingByCategory(
  restaurantId: string,
  db: PrismaClient = prisma,
): Promise<SpendingByCategoryData> {
  // Period = month of the most recent activity across either spine.
  const [latestTxn, latestLedger] = await Promise.all([
    db.transaction.findFirst({ where: { restaurantId }, orderBy: { date: "desc" }, select: { date: true } }),
    db.ledgerEntry.findFirst({ where: { restaurantId }, orderBy: { ledgerDate: "desc" }, select: { ledgerDate: true } }),
  ]);
  const refDates = [latestTxn?.date, latestLedger?.ledgerDate].filter((x): x is Date => x != null);
  const ref = refDates.length > 0 ? new Date(Math.max(...refDates.map((x) => x.getTime()))) : new Date();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  const periodLabel = `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`;

  const asOf = new Date(end.getTime() - DAY_MS);
  const windowDays = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const coverage = await assessLedgerCoverage(db, restaurantId, { asOf, windowDays });

  let agg: Aggregates;
  if (coverage.source === "ledger") {
    const lines = await db.ledgerEntry.findMany({
      where: { restaurantId, ledgerDate: { gte: start, lt: end } },
      select: { ledgerAccount: true, debit: true, cashEffect: true },
    });
    agg = aggregateLedgerSpending(lines);
  } else {
    const [txns, cats] = await Promise.all([
      db.transaction.findMany({
        where: { restaurantId, date: { gte: start, lt: end } },
        select: { amount: true, categoryId: true },
      }),
      db.category.findMany({ where: { restaurantId }, select: { id: true, name: true, tapBucket: true } }),
    ]);
    const catMeta = new Map(cats.map((c) => [c.id, { name: c.name, tap: c.tapBucket }]));
    agg = aggregateLegacySpending(txns, catMeta);
  }

  const { revenue, totalSpend, catAgg, groupAgg, unmappedCount, hasRows } = agg;

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
    hasData: hasRows,
    source: coverage.source,
    sourceLabel: describeLedgerSource(coverage.source),
    pendingReviewCount: coverage.pendingReviewCount,
    unmappedCount,
  };
}
