import { prisma } from "@/lib/prisma";
import {
  rollingVariance,
  nextSweepDate,
  daysUntilNextSweep,
  taxReserveStatus,
  VARIANCE_WINDOW_DAYS,
  type LedgerEntry,
  type HealthStatus,
  type TaxReserveStatus,
} from "@/lib/profit-first/allocation";

// Allocation & Variance module — the Profit First flagship view.
//
// Reads the EARNED basis (DailySales net sales, from Toast) and the BANKABLE
// obligations (categorized Transactions) and runs them through the engine core
// (src/lib/profit-first/allocation.ts). Each operating bucket gets a rolling-7d
// variance: what Profit First says to set aside (net sales × TAP%) vs. what
// actually cleared. Accrue-only buckets (Profit / Owner's Pay / Spill) show the
// period accrual + the next sweep date.
//
// This is the computed view — no persisted bucket ledger yet (that's the
// migration-gated production phase). It needs no new tables and reads live data.

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtDay = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;

// Draw-down operating buckets (accrue from allocation, draw down as spend clears).
// Beer carries no TAP % yet (held with the 27/20/13 split), so it allocates $0 —
// real beer spend then reads red, surfacing the unbudgeted beverage program.
const DRAWDOWN: { key: string; label: string; tap: keyof TapPctMap; bucket: string }[] = [
  { key: "food", label: "Food", tap: "cogsFoodPct", bucket: "COGS_FOOD" },
  { key: "wineSpirits", label: "Wine & Spirits", tap: "cogsLiquorPct", bucket: "COGS_LIQUOR" },
  { key: "beer", label: "Beer", tap: "beerPct", bucket: "COGS_BEVERAGE" },
  { key: "labor", label: "Labor", tap: "laborPct", bucket: "LABOR" },
  { key: "opex", label: "OpEx", tap: "opexPct", bucket: "OPEX" },
];

interface TapPctMap {
  profitPct: number;
  ownerPayPct: number;
  cogsFoodPct: number;
  cogsLiquorPct: number;
  beerPct: number; // no column yet — 0 until a % is set
  laborPct: number;
  opexPct: number;
  spillPct: number;
}

export interface VarianceLine {
  key: string;
  label: string;
  tapPct: number;
  allocated: number;
  obligations: number;
  dollarGap: number;
  pctDiff: number | null;
  signal: HealthStatus;
  /** True when the bucket has no TAP % (beer) — the gap is "unbudgeted", not a miss. */
  unbudgeted: boolean;
}

export interface AccrueLine {
  key: string;
  label: string;
  tapPct: number;
  accrued: number; // period-to-date set-aside (net sales × TAP%)
}

export interface AllocationData {
  periodLabel: string;
  windowLabel: string;
  asOf: string;
  windowDays: number;
  variance: VarianceLine[];
  accrue: AccrueLine[];
  nextSweep: string;
  daysToSweep: number;
  tax: {
    /** Collected sales tax for the period (Toast Orders API) — the set-aside target. */
    salesCollected: number;
    /** Sales tax that actually cleared the bank (Davo pulls). */
    salesCleared: number;
    /** salesCollected − salesCleared (reserve still held for upcoming pulls). */
    salesReserve: number;
    /** Binary reserve health: OK when collected ≥ pulled, else SHORT. */
    salesStatus: TaxReserveStatus;
    /** Payroll tax that cleared the bank this period. */
    payrollCleared: number;
    note: string;
    /** True when Toast collected-tax is wired (orders:read); false → honest fallback note. */
    salesSourced: boolean;
  };
  hasData: boolean;
}

export async function loadAllocation(restaurantId: string): Promise<AllocationData> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { tapSettings: true },
  });

  // TAP %s in effect (held defaults if no row). Beer has no column → 0.
  const ts = restaurant?.tapSettings;
  const taps: TapPctMap = {
    profitPct: ts ? n(ts.profitPct) : 5,
    ownerPayPct: ts ? n(ts.ownerPayPct) : 5,
    cogsFoodPct: ts ? n(ts.cogsFoodPct) : 18,
    cogsLiquorPct: ts ? n(ts.cogsLiquorPct) : 12,
    beerPct: 0,
    laborPct: ts ? n(ts.laborPct) : 32,
    opexPct: ts ? n(ts.opexPct) : 28,
    spillPct: 0,
  };

  // Period = month of the latest DailySales (the earned/allocation basis).
  const latest = await prisma.dailySales.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const ref = latest?.date ?? new Date();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  const periodLabel = `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`;

  // Earned basis: net sales per day.
  const sales = await prisma.dailySales.findMany({
    where: { restaurantId, date: { gte: start, lt: end } },
    select: { date: true, netSales: true, salesTaxCollected: true },
  });
  const salesByDay = new Map<string, number>();
  let salesTaxCollectedTotal = 0;
  for (const s of sales) {
    salesByDay.set(iso(s.date), n(s.netSales));
    salesTaxCollectedTotal += n(s.salesTaxCollected);
  }

  // Obligations: categorized spend (outflows = positive amounts) by tapBucket.
  const cats = await prisma.category.findMany({
    where: { restaurantId },
    select: { id: true, tapBucket: true },
  });
  const tapByCat = new Map(cats.map((c) => [c.id, c.tapBucket as string]));

  const txns = await prisma.transaction.findMany({
    where: { restaurantId, date: { gte: start, lt: end } },
    select: { date: true, amount: true, categoryId: true },
  });
  // obligations[bucket] -> Map<dayISO, amount>
  const obligations: Record<string, Map<string, number>> = {};
  let salesTaxCleared = 0;
  let payrollTaxCleared = 0;
  for (const t of txns) {
    const amt = n(t.amount);
    const bucket = (t.categoryId && tapByCat.get(t.categoryId)) || "OPEX";
    if (bucket === "TAX_SALES") {
      if (amt > 0) salesTaxCleared += amt;
      continue;
    }
    if (bucket === "TAX_PAYROLL") {
      if (amt > 0) payrollTaxCleared += amt;
      continue;
    }
    if (amt <= 0) continue; // inflows/deposits aren't obligations
    const m = (obligations[bucket] ??= new Map());
    const key = iso(t.date);
    m.set(key, (m.get(key) ?? 0) + amt);
  }

  // Build each draw-down bucket's daily ledger (allocated vs obligation) across
  // the period, then take the rolling-7d variance as of the latest day.
  const allDays = [...new Set([...salesByDay.keys(), ...Object.values(obligations).flatMap((m) => [...m.keys()])])];

  // Window ends at the latest ACTIVITY day (sales OR a cleared obligation), not
  // just the latest sales day — otherwise an invoice that posts after the last
  // synced sales day falls outside the window and the bucket reads falsely
  // funded. Midnight-UTC, matching the per-day ledger entries.
  const asOfKey = allDays.length ? allDays.reduce((a, b) => (a > b ? a : b)) : iso(ref);
  const asOf = new Date(asOfKey + "T00:00:00.000Z");

  // Precompute each day's Date + (floored) net sales once, then per bucket only
  // attach allocated/obligation — avoids rebuilding the date set per bucket.
  // Negative net-sales days (voids/corrections) floor to 0 so a data anomaly
  // can't inject negative "set-aside" and flip a funded bucket red.
  const dayRows = allDays.map((dayKey) => ({
    dayKey,
    date: new Date(dayKey + "T00:00:00.000Z"),
    netSales: Math.max(0, salesByDay.get(dayKey) ?? 0),
  }));

  const variance: VarianceLine[] = DRAWDOWN.map(({ key, label, tap, bucket }) => {
    const pct = taps[tap];
    const oblMap = obligations[bucket] ?? new Map<string, number>();
    const entries: LedgerEntry[] = dayRows.map((d) => ({
      date: d.date,
      allocated: d.netSales * (pct / 100),
      obligation: oblMap.get(d.dayKey) ?? 0,
    }));
    const v = rollingVariance(entries, asOf, VARIANCE_WINDOW_DAYS);
    return {
      key,
      label,
      tapPct: pct,
      allocated: v.allocated,
      obligations: v.obligations,
      dollarGap: v.dollarGap,
      pctDiff: v.pctDiff,
      signal: v.signal,
      unbudgeted: pct === 0,
    };
  });

  // Accrue-only buckets: period-to-date set-aside (net sales × TAP%).
  const totalNetSales = [...salesByDay.values()].reduce((s, v) => s + Math.max(0, v), 0);
  const accrue: AccrueLine[] = [
    { key: "profit", label: "Profit", tapPct: taps.profitPct },
    { key: "ownerPay", label: "Owner's Pay", tapPct: taps.ownerPayPct },
    { key: "spill", label: "Spill / Vault", tapPct: taps.spillPct },
  ].map((a) => ({ ...a, accrued: Math.round(totalNetSales * (a.tapPct / 100) * 100) / 100 }));

  const sweep = nextSweepDate(asOf);

  return {
    periodLabel,
    windowLabel: `rolling ${VARIANCE_WINDOW_DAYS} days ending ${fmtDay(asOf)}`,
    asOf: iso(asOf),
    windowDays: VARIANCE_WINDOW_DAYS,
    variance,
    accrue,
    nextSweep: `${MONTHS[sweep.getUTCMonth()]} ${sweep.getUTCDate()}`,
    daysToSweep: daysUntilNextSweep(asOf),
    tax: {
      salesCollected: Math.round(salesTaxCollectedTotal * 100) / 100,
      salesCleared: Math.round(salesTaxCleared * 100) / 100,
      salesReserve: Math.round((salesTaxCollectedTotal - salesTaxCleared) * 100) / 100,
      salesStatus: taxReserveStatus(salesTaxCollectedTotal, salesTaxCleared),
      payrollCleared: Math.round(payrollTaxCleared * 100) / 100,
      salesSourced: salesTaxCollectedTotal > 0,
      note:
        salesTaxCollectedTotal > 0
          ? "Sales tax COLLECTED is read from Toast (Orders API, per-check tax) and skimmed off the top before the TAP split. Davo's actual pulls draw it back down. OK = collected ≥ pulled. Payroll tax shows pulls that cleared (forward accrual needs a payroll feed)."
          : "Pre-allocation skim needs Toast collected-tax — run the sales-tax sync (orders:read). Shown here: tax pulls that actually cleared this period.",
    },
    hasData: sales.length > 0,
  };
}
