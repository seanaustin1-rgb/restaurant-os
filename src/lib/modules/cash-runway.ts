import { prisma } from "@/lib/prisma";
import { loadCashOxygenFloor, type CashOxygenFloor } from "@/lib/modules/cash-oxygen";

// Cash Runway module — days of cash at the current burn rate, with an early
// warning. There is no live balance feed (statement import skips balance lines,
// and no Plaid balance is stored), so the operator anchors the math once:
// "balance X on date Y" from any statement. From there:
//   estimated cash = anchor + net transaction flow since the anchor date
//   burn rate      = average daily net over the trailing window (28 days)
//   runway         = estimated cash / daily burn (only when burning)
// Sign convention: inflows are stored NEGATIVE, outflows POSITIVE — so net cash
// change over a set of transactions = −(sum of amounts).
export interface RunwayDay {
  date: string; // YYYY-MM-DD
  balance: number; // estimated end-of-day balance
  projected: boolean;
}

export interface CashRunwayData {
  hasAnchor: boolean;
  anchorBalance: number | null;
  anchorDate: string | null;
  asOfDate: string | null; // last transaction date used
  currentCash: number | null;
  avgDailyNet: number | null; // negative = burning
  burnWindowDays: number;
  runwayDays: number | null; // null when not burning (cash growing/flat)
  runwayOutDate: string | null; // projected zero-cash date
  status: "green" | "yellow" | "red" | "unknown";
  series: RunwayDay[]; // history since anchor + 8-week projection
  staleDays: number | null; // days between asOf and today — honesty signal
  hasData: boolean; // any transactions at all
  cashOxygen: CashOxygenFloor;
  minCashFloor: number | null; // operator-set minimum cash floor (B6); null = not configured
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const DAY_MS = 86_400_000;
const BURN_WINDOW = 28;
const PROJECT_DAYS = 56; // 8 weeks

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function loadCashRunway(restaurantId: string): Promise<CashRunwayData> {
  const cashOxygen = await loadCashOxygenFloor(restaurantId);
  const [restaurant, txns] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { cashBalanceAnchor: true, cashBalanceAnchorDate: true, minCashFloor: true },
    }),
    prisma.transaction.findMany({
      where: { restaurantId },
      orderBy: { date: "asc" },
      select: { date: true, amount: true },
    }),
  ]);

  const minCashFloor = restaurant?.minCashFloor != null ? n(restaurant.minCashFloor) : null;

  const empty: CashRunwayData = {
    hasAnchor: false,
    anchorBalance: null,
    anchorDate: null,
    asOfDate: null,
    currentCash: null,
    avgDailyNet: null,
    burnWindowDays: BURN_WINDOW,
    runwayDays: null,
    runwayOutDate: null,
    status: "unknown",
    series: [],
    staleDays: null,
    hasData: txns.length > 0,
    cashOxygen,
    minCashFloor,
  };

  if (!restaurant?.cashBalanceAnchor || !restaurant.cashBalanceAnchorDate) {
    return empty;
  }

  const anchorBalance = n(restaurant.cashBalanceAnchor);
  const anchorDate = restaurant.cashBalanceAnchorDate;

  // Net flow per day AFTER the anchor date (the anchor balance already reflects
  // everything through that date). Inflows negative → flip the sign.
  const byDay = new Map<string, number>();
  let lastTxnDate: Date | null = null;
  for (const t of txns) {
    if (t.date <= anchorDate) continue;
    const key = iso(t.date);
    byDay.set(key, (byDay.get(key) ?? 0) + -n(t.amount));
    lastTxnDate = t.date;
  }

  const asOf = lastTxnDate ?? anchorDate;

  // History series: walk day by day from the anchor to asOf.
  const series: RunwayDay[] = [{ date: iso(anchorDate), balance: anchorBalance, projected: false }];
  let balance = anchorBalance;
  for (let t = anchorDate.getTime() + DAY_MS; t <= asOf.getTime(); t += DAY_MS) {
    const key = iso(new Date(t));
    balance += byDay.get(key) ?? 0;
    series.push({ date: key, balance, projected: false });
  }
  const currentCash = balance;

  // Burn rate: average daily net over the trailing window ending at asOf —
  // computed from ALL transactions in that window (independent of the anchor).
  const windowStart = new Date(asOf.getTime() - (BURN_WINDOW - 1) * DAY_MS);
  let windowNet = 0;
  for (const t of txns) {
    if (t.date >= windowStart && t.date <= asOf) windowNet += -n(t.amount);
  }
  const avgDailyNet = windowNet / BURN_WINDOW;

  // Runway + projection.
  let runwayDays: number | null = null;
  let runwayOutDate: string | null = null;
  if (avgDailyNet < 0 && currentCash > 0) {
    runwayDays = Math.floor(currentCash / -avgDailyNet);
    runwayOutDate = iso(new Date(asOf.getTime() + runwayDays * DAY_MS));
  }

  let projBalance = currentCash;
  for (let d = 1; d <= PROJECT_DAYS; d++) {
    projBalance += avgDailyNet;
    series.push({
      date: iso(new Date(asOf.getTime() + d * DAY_MS)),
      balance: projBalance,
      projected: true,
    });
    if (projBalance <= 0) break; // stop the line at zero-cash
  }

  const status: CashRunwayData["status"] =
    runwayDays == null ? "green" : runwayDays > 90 ? "green" : runwayDays >= 30 ? "yellow" : "red";

  const staleDays = Math.max(0, Math.round((Date.now() - asOf.getTime()) / DAY_MS));

  return {
    hasAnchor: true,
    anchorBalance,
    anchorDate: iso(anchorDate),
    asOfDate: iso(asOf),
    currentCash,
    avgDailyNet,
    burnWindowDays: BURN_WINDOW,
    runwayDays,
    runwayOutDate,
    status,
    series,
    staleDays,
    hasData: txns.length > 0,
    cashOxygen,
    minCashFloor,
  };
}
