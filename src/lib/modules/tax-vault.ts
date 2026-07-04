import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { taxReserveStatus, type TaxReserveStatus } from "@/lib/profit-first/allocation";
import {
  assessLedgerCoverage,
  describeLedgerSource,
  type LedgerReadSource,
} from "@/lib/financial-ledger/ledger-coverage";

// Tax Vault module — sales & payroll tax set-aside vs. what actually got pulled.
//
// Sales tax COLLECTED comes from Toast (Orders API per-check taxAmount, synced to
// DailySales.salesTaxCollected) — the same figure Davo uses, available same-day.
//
// Tax pulls that CLEARED are read ledger-first (Spec A.1): the clean ledger holds
// them as LedgerEntry rows on the TAX_VAULT account (debit = amount pulled,
// allocationBucket carrying the TapBucket so sales vs payroll stays separable).
// When the ledger doesn't yet cover the period we fall back to the legacy
// Transaction → Category path — the exact ledger-first/fallback shape Cash Oxygen
// established, now via the shared `assessLedgerCoverage` heuristic so Cash Flow /
// Spending (A.2) inherit it. Reserve = collected − pulled; binary OK / SHORT.
// Payroll tax: we can show what cleared (TAX_PAYROLL), but the forward accrual
// (per-pay-run withholdings) needs a payroll feed — stated honestly, not faked.

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface TaxDayRow {
  date: string; // ISO yyyy-mm-dd
  label: string; // "Jun 12"
  collected: number;
}

export interface TaxPulls {
  salesPulled: number;
  payrollPulled: number;
}

export interface TaxVaultData {
  periodLabel: string;
  hasData: boolean;
  /** True once Toast collected-tax is synced; false → honest "run the sync" note. */
  sourced: boolean;
  /** Which spine served the cleared-pull figures (ledger / legacy fallback / none). */
  source: LedgerReadSource;
  /** Human caption for the source-trust affordance (Spec A.1 Feature 4). */
  sourceLabel: string;
  /** Tax events in the window still PENDING_REVIEW — the trust caveat even when
   * reading ledger-first. */
  pendingReviewCount: number;
  sales: {
    collected: number;
    pulled: number;
    reserve: number;
    status: TaxReserveStatus;
    /** collected / netSales as a %, for sanity (PA: <6% — alcohol is exempt). */
    effectiveRatePct: number | null;
  };
  payroll: { pulled: number };
  netSales: number;
  daily: TaxDayRow[];
  note: string;
}

/**
 * Split cleared tax pulls out of clean-ledger TAX_VAULT lines. Pure so the
 * spine's aggregation is unit-tested without a database. Payroll is the
 * `TAX_PAYROLL` allocationBucket; everything else on the TAX_VAULT account
 * (TAX_SALES or an unlabelled tax line) is sales tax.
 */
export function splitLedgerTaxPulls(
  lines: ReadonlyArray<{ allocationBucket: string | null; debit: unknown }>,
): TaxPulls {
  let salesPulled = 0;
  let payrollPulled = 0;
  for (const l of lines) {
    const amt = n(l.debit);
    if (amt <= 0) continue;
    if (l.allocationBucket === "TAX_PAYROLL") payrollPulled += amt;
    else salesPulled += amt;
  }
  return { salesPulled, payrollPulled };
}

/**
 * Split cleared tax pulls out of legacy Transactions (fallback path). Outflows
 * are stored positive; the category's TapBucket says sales vs payroll.
 */
export function splitLegacyTaxPulls(
  txns: ReadonlyArray<{ amount: unknown; categoryId: string | null }>,
  tapByCat: ReadonlyMap<string, string>,
): TaxPulls {
  let salesPulled = 0;
  let payrollPulled = 0;
  for (const t of txns) {
    const amt = n(t.amount);
    if (amt <= 0) continue; // outflows are positive
    const bucket = t.categoryId ? tapByCat.get(t.categoryId) : undefined;
    if (bucket === "TAX_SALES") salesPulled += amt;
    else if (bucket === "TAX_PAYROLL") payrollPulled += amt;
  }
  return { salesPulled, payrollPulled };
}

export async function loadTaxVault(
  restaurantId: string,
  db: PrismaClient = prisma,
): Promise<TaxVaultData> {
  // Period = month of the latest DailySales row.
  const latest = await db.dailySales.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const ref = latest?.date ?? new Date();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  const periodLabel = `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`;

  const sales = await db.dailySales.findMany({
    where: { restaurantId, date: { gte: start, lt: end } },
    select: { date: true, netSales: true, salesTaxCollected: true },
    orderBy: { date: "asc" },
  });

  let collected = 0;
  let netSales = 0;
  const daily: TaxDayRow[] = [];
  for (const s of sales) {
    const c = n(s.salesTaxCollected);
    collected += c;
    netSales += n(s.netSales);
    if (c > 0) daily.push({ date: iso(s.date), label: `${MONTHS[s.date.getUTCMonth()]} ${s.date.getUTCDate()}`, collected: r2(c) });
  }

  // Cleared tax pulls — ledger-first (TAX_VAULT lines), legacy fallback (Davo =
  // TAX_SALES, payroll = TAX_PAYROLL). `assessLedgerCoverage` decides which spine
  // covers this period on the TAX_VAULT account.
  const asOf = new Date(end.getTime() - DAY_MS); // inclusive last day of the period
  const windowDays = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const coverage = await assessLedgerCoverage(db, restaurantId, {
    accounts: ["TAX_VAULT"],
    asOf,
    windowDays,
  });

  let pulls: TaxPulls;
  if (coverage.source === "ledger") {
    const lines = await db.ledgerEntry.findMany({
      where: { restaurantId, ledgerAccount: "TAX_VAULT", ledgerDate: { gte: start, lt: end } },
      select: { allocationBucket: true, debit: true },
    });
    pulls = splitLedgerTaxPulls(lines);
  } else {
    const cats = await db.category.findMany({
      where: { restaurantId },
      select: { id: true, tapBucket: true },
    });
    const tapByCat = new Map(cats.map((c) => [c.id, c.tapBucket as string]));
    const txns = await db.transaction.findMany({
      where: { restaurantId, date: { gte: start, lt: end } },
      select: { amount: true, categoryId: true },
    });
    pulls = splitLegacyTaxPulls(txns, tapByCat);
  }
  const { salesPulled, payrollPulled } = pulls;

  const sourced = collected > 0;
  const reserve = collected - salesPulled;

  return {
    periodLabel,
    hasData: sales.length > 0,
    sourced,
    source: coverage.source,
    sourceLabel: describeLedgerSource(coverage.source),
    pendingReviewCount: coverage.pendingReviewCount,
    sales: {
      collected: r2(collected),
      pulled: r2(salesPulled),
      reserve: r2(reserve),
      status: taxReserveStatus(collected, salesPulled),
      effectiveRatePct: netSales > 0 && sourced ? r2((collected / netSales) * 100) : null,
    },
    payroll: { pulled: r2(payrollPulled) },
    netSales: r2(netSales),
    daily,
    note: sourced
      ? "Collected sales tax is read from Toast (Orders API, per-check tax) — the same number Davo pulls, available same-day before the ACH lands. Reserve OK = collected ≥ pulled. Payroll tax shows pulls that cleared; the forward accrual per pay run needs a payroll feed."
      : "Collected sales tax isn't synced yet — run scripts/sync-toast-sales-tax.ts (needs orders:read). Until then this shows only the tax pulls that cleared the bank.",
  };
}
