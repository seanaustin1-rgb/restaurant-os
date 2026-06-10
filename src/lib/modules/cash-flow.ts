import { prisma } from "@/lib/prisma";

// Cash Flow module data. Built from categorized bank transactions: in this model
// deposits/credits are stored as negative amounts (inflow) and expenses/debits as
// positive (outflow) — see /api/import/commit. Period = the month of the most
// recent transaction.
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
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function loadCashFlow(restaurantId: string): Promise<CashFlowData> {
  const latest = await prisma.transaction.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const ref = latest?.date ?? new Date();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  const periodLabel = `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`;

  const txns = await prisma.transaction.findMany({
    where: { restaurantId, date: { gte: start, lt: end } },
    select: { date: true, amount: true },
  });

  const byDay = new Map<string, { inflow: number; outflow: number }>();
  for (const t of txns) {
    const key = t.date.toISOString().slice(0, 10);
    const amt = n(t.amount);
    const g = byDay.get(key) ?? { inflow: 0, outflow: 0 };
    if (amt < 0) g.inflow += -amt;
    else g.outflow += amt;
    byDay.set(key, g);
  }

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

  return { periodLabel, totalIn, totalOut, net: totalIn - totalOut, days, hasData: days.length > 0 };
}
