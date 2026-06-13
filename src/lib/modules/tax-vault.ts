import { prisma } from "@/lib/prisma";
import { taxReserveStatus, type TaxReserveStatus } from "@/lib/profit-first/allocation";

// Tax Vault module — sales & payroll tax set-aside vs. what actually got pulled.
//
// Sales tax COLLECTED comes from Toast (Orders API per-check taxAmount, synced to
// DailySales.salesTaxCollected) — the same figure Davo uses, available same-day.
// Davo's actual ACH pulls show up in the bank feed as TAX_SALES transactions.
// Reserve = collected − pulled; binary OK (collected ≥ pulled) / SHORT.
// Payroll tax: we can show what cleared (TAX_PAYROLL), but the forward accrual
// (per-pay-run withholdings) needs a payroll feed — stated honestly, not faked.

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface TaxDayRow {
  date: string; // ISO yyyy-mm-dd
  label: string; // "Jun 12"
  collected: number;
}

export interface TaxVaultData {
  periodLabel: string;
  hasData: boolean;
  /** True once Toast collected-tax is synced; false → honest "run the sync" note. */
  sourced: boolean;
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

export async function loadTaxVault(restaurantId: string): Promise<TaxVaultData> {
  // Period = month of the latest DailySales row.
  const latest = await prisma.dailySales.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const ref = latest?.date ?? new Date();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  const periodLabel = `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`;

  const sales = await prisma.dailySales.findMany({
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

  // Tax pulls that cleared the bank this period (Davo = TAX_SALES, payroll = TAX_PAYROLL).
  const cats = await prisma.category.findMany({
    where: { restaurantId },
    select: { id: true, tapBucket: true },
  });
  const tapByCat = new Map(cats.map((c) => [c.id, c.tapBucket as string]));
  const txns = await prisma.transaction.findMany({
    where: { restaurantId, date: { gte: start, lt: end } },
    select: { amount: true, categoryId: true },
  });
  let salesPulled = 0;
  let payrollPulled = 0;
  for (const t of txns) {
    const amt = n(t.amount);
    if (amt <= 0) continue; // outflows are positive
    const bucket = t.categoryId ? tapByCat.get(t.categoryId) : undefined;
    if (bucket === "TAX_SALES") salesPulled += amt;
    else if (bucket === "TAX_PAYROLL") payrollPulled += amt;
  }

  const sourced = collected > 0;
  const reserve = collected - salesPulled;

  return {
    periodLabel,
    hasData: sales.length > 0,
    sourced,
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
