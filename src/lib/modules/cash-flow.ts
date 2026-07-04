import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assessLedgerCoverage,
  describeLedgerSource,
  type LedgerReadSource,
} from "@/lib/financial-ledger/ledger-coverage";

// Cash Flow module data. Read ledger-first (Spec A.2): the clean ledger carries
// each event's cash movement in `LedgerEntry.cashEffect` (+ inflow / − outflow),
// so cash flow is the per-day sum of cashEffect. When the ledger doesn't cover
// the period we fall back to legacy bank Transactions — same coverage heuristic,
// same fallback, same source-trust indicator as Tax Vault (A.1), via the shared
// `assessLedgerCoverage`. In the legacy model deposits/credits are stored as
// negative amounts (inflow) and expenses/debits as positive (outflow) — see
// /api/import/commit. Period = the month of the most recent activity.
export interface CashFlowDay {
  date: string; // YYYY-MM-DD
  inflow: number;
  outflow: number;
  net: number;
  running: number; // cumulative net change across the period
}

export interface CashFlowData {
  periodLabel: string;
  totalIn: number;
  totalOut: number;
  net: number;
  days: CashFlowDay[];
  hasData: boolean;
  /** Which spine served the figures (ledger / legacy fallback / none). */
  source: LedgerReadSource;
  /** Human caption for the source-trust affordance. */
  sourceLabel: string;
  /** Events in the window still PENDING_REVIEW — trust caveat when ledger-first. */
  pendingReviewCount: number;
}

type DayTotals = { inflow: number; outflow: number };

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Clean-ledger cash by day: `cashEffect` is + on inflow, − on outflow; zero-cash
 * lines (the non-cash leg, internal transfers, exclusions) contribute nothing. */
export function accumulateLedgerCash(
  lines: ReadonlyArray<{ ledgerDate: Date; cashEffect: unknown }>,
): Map<string, DayTotals> {
  const byDay = new Map<string, DayTotals>();
  for (const l of lines) {
    const eff = n(l.cashEffect);
    if (eff === 0) continue;
    const key = l.ledgerDate.toISOString().slice(0, 10);
    const g = byDay.get(key) ?? { inflow: 0, outflow: 0 };
    if (eff > 0) g.inflow += eff;
    else g.outflow += -eff;
    byDay.set(key, g);
  }
  return byDay;
}

/** Legacy bank cash by day: inflows are stored negative, outflows positive. */
export function accumulateLegacyCash(
  txns: ReadonlyArray<{ date: Date; amount: unknown }>,
): Map<string, DayTotals> {
  const byDay = new Map<string, DayTotals>();
  for (const t of txns) {
    const amt = n(t.amount);
    if (amt === 0) continue;
    const key = t.date.toISOString().slice(0, 10);
    const g = byDay.get(key) ?? { inflow: 0, outflow: 0 };
    if (amt < 0) g.inflow += -amt;
    else g.outflow += amt;
    byDay.set(key, g);
  }
  return byDay;
}

/** Turn per-day totals into the sorted day series with a running cumulative net. */
export function buildCashFlowDays(byDay: Map<string, DayTotals>): {
  days: CashFlowDay[];
  totalIn: number;
  totalOut: number;
} {
  let running = 0;
  let totalIn = 0;
  let totalOut = 0;
  const days: CashFlowDay[] = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, g]) => {
      const net = g.inflow - g.outflow;
      running += net;
      totalIn += g.inflow;
      totalOut += g.outflow;
      return { date, inflow: g.inflow, outflow: g.outflow, net, running };
    });
  return { days, totalIn, totalOut };
}

export async function loadCashFlow(
  restaurantId: string,
  db: PrismaClient = prisma,
): Promise<CashFlowData> {
  // Period = month of the most recent activity across either spine.
  const [latestTxn, latestLedger] = await Promise.all([
    db.transaction.findFirst({ where: { restaurantId }, orderBy: { date: "desc" }, select: { date: true } }),
    db.ledgerEntry.findFirst({ where: { restaurantId }, orderBy: { ledgerDate: "desc" }, select: { ledgerDate: true } }),
  ]);
  const refDates = [latestTxn?.date, latestLedger?.ledgerDate].filter((d): d is Date => d != null);
  const ref = refDates.length > 0 ? new Date(Math.max(...refDates.map((d) => d.getTime()))) : new Date();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  const periodLabel = `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`;

  // Ledger-first vs. legacy fallback for this period (any account = "has the
  // ledger any coverage here").
  const asOf = new Date(end.getTime() - DAY_MS);
  const windowDays = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const coverage = await assessLedgerCoverage(db, restaurantId, { asOf, windowDays });

  let byDay: Map<string, DayTotals>;
  if (coverage.source === "ledger") {
    const lines = await db.ledgerEntry.findMany({
      where: { restaurantId, ledgerDate: { gte: start, lt: end } },
      select: { ledgerDate: true, cashEffect: true },
    });
    byDay = accumulateLedgerCash(lines);
  } else {
    const txns = await db.transaction.findMany({
      where: { restaurantId, date: { gte: start, lt: end } },
      select: { date: true, amount: true },
    });
    byDay = accumulateLegacyCash(txns);
  }

  const { days, totalIn, totalOut } = buildCashFlowDays(byDay);

  return {
    periodLabel,
    totalIn,
    totalOut,
    net: totalIn - totalOut,
    days,
    hasData: days.length > 0,
    source: coverage.source,
    sourceLabel: describeLedgerSource(coverage.source),
    pendingReviewCount: coverage.pendingReviewCount,
  };
}
