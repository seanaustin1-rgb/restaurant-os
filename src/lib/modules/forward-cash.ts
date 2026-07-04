import { loadCashRunway } from "@/lib/modules/cash-runway";
import { loadRecurring, type RecurringVendor } from "@/lib/modules/recurring";
import { getLedgerSnapshot } from "@/lib/profit-first/ledger";

// Forward Cash — a 30-day, EVENT-BASED cash projection. Unlike Cash Runway
// (a smooth trailing-burn line), this projects the operating balance forward by
// applying specific dated obligations on the days they land:
//   • recurring bills / subscriptions on their next cadence date,
//   • payroll on its inferred cadence (a recurring LABOR/payroll vendor),
//   • Profit First sweeps on the 10th & 25th (Profit + Owner's Pay leave the
//     operating account).
// The point is the LOW-POINT: the day the balance dips lowest once payroll, the
// big recurring bills, and a sweep stack up. Read-only, no writes. Starting cash
// comes from the operator's anchor (via Cash Runway); honest when unanchored.

export type ObligationKind = "recurring" | "payroll" | "sweep";

export interface ScheduledObligation {
  date: string; // YYYY-MM-DD
  label: string;
  amount: number; // positive = outflow (money leaving), negative = inflow
  kind: ObligationKind;
}

export interface ForwardCashDay {
  date: string; // YYYY-MM-DD
  balance: number; // projected end-of-day operating balance
  obligations: { label: string; amount: number; kind: ObligationKind }[];
}

export interface ForwardCashLowPoint {
  date: string;
  balance: number;
}

export interface ForwardCashData {
  hasAnchor: boolean;
  hasData: boolean;
  startDate: string | null; // the last-known cash date the projection starts from
  startBalance: number | null;
  windowDays: number;
  staleDays: number | null; // age of the starting balance — honesty signal
  days: ForwardCashDay[];
  lowPoint: ForwardCashLowPoint | null;
  endBalance: number | null;
  totalScheduledOut: number;
  breachesZero: boolean;
  obligationCount: number;
  note: string;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parseISO = (s: string) => new Date(`${s}T00:00:00.000Z`);

/**
 * Profit First sweep dates (10th & 25th, UTC) strictly after `startDate` and
 * within the window. Pure — no clock.
 */
export function sweepDatesInWindow(startDate: Date, windowDays: number): Date[] {
  const end = new Date(startDate.getTime() + windowDays * DAY_MS);
  const dates: Date[] = [];
  let y = startDate.getUTCFullYear();
  let m = startDate.getUTCMonth();
  // The window is <= ~1 month, so at most a couple of calendar months are spanned.
  for (let i = 0; i < 3; i++) {
    for (const day of [10, 25]) {
      const dt = new Date(Date.UTC(y, m, day));
      if (dt.getTime() > startDate.getTime() && dt.getTime() <= end.getTime()) dates.push(dt);
    }
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Project each recurring vendor's next occurrences into the window, from its last
 * seen date at its median cadence interval. Amount = the last charge. Payroll is
 * a recurring vendor whose category names payroll. Pure. Vendors with no steady
 * cadence (`medianIntervalDays == null`) can't be scheduled and are skipped.
 */
export function projectRecurringObligations(
  vendors: readonly RecurringVendor[],
  startDate: Date,
  windowDays: number,
): ScheduledObligation[] {
  const end = new Date(startDate.getTime() + windowDays * DAY_MS);
  const out: ScheduledObligation[] = [];
  for (const v of vendors) {
    const interval = v.medianIntervalDays;
    if (interval == null || interval <= 0) continue;
    const kind: ObligationKind = /payroll/i.test(v.categoryName ?? "") ? "payroll" : "recurring";
    const amount = r2(v.lastAmount);
    if (amount <= 0) continue;
    let next = new Date(parseISO(v.lastDate).getTime() + interval * DAY_MS);
    let guard = 0;
    // Advance to the first occurrence strictly after the start.
    while (next.getTime() <= startDate.getTime() && guard < 400) {
      next = new Date(next.getTime() + interval * DAY_MS);
      guard += 1;
    }
    guard = 0;
    while (next.getTime() <= end.getTime() && guard < 400) {
      out.push({ date: iso(next), label: v.vendor, amount, kind });
      next = new Date(next.getTime() + interval * DAY_MS);
      guard += 1;
    }
  }
  return out;
}

/**
 * The pure projection core: walk `windowDays` forward from `startDate`, applying
 * obligations on their dates, and track the running balance + the low-point.
 * Positive obligation amounts reduce the balance (outflows). No DB, no clock.
 */
export function projectForwardCash(input: {
  startDate: string; // balance is as of the END of this day
  startBalance: number;
  windowDays: number;
  obligations: readonly ScheduledObligation[];
}): {
  days: ForwardCashDay[];
  lowPoint: ForwardCashLowPoint | null;
  endBalance: number;
  totalScheduledOut: number;
  breachesZero: boolean;
} {
  const start = parseISO(input.startDate);
  const byDate = new Map<string, { label: string; amount: number; kind: ObligationKind }[]>();
  for (const o of input.obligations) {
    const list = byDate.get(o.date) ?? [];
    list.push({ label: o.label, amount: o.amount, kind: o.kind });
    byDate.set(o.date, list);
  }

  let balance = input.startBalance;
  let totalScheduledOut = 0;
  let lowPoint: ForwardCashLowPoint | null = null;
  const days: ForwardCashDay[] = [];

  for (let d = 1; d <= input.windowDays; d++) {
    const key = iso(new Date(start.getTime() + d * DAY_MS));
    const obs = byDate.get(key) ?? [];
    for (const o of obs) {
      balance -= o.amount;
      if (o.amount > 0) totalScheduledOut += o.amount;
    }
    const rounded = r2(balance);
    days.push({ date: key, balance: rounded, obligations: obs });
    if (lowPoint == null || rounded < lowPoint.balance) lowPoint = { date: key, balance: rounded };
  }

  const endBalance = days.length > 0 ? days[days.length - 1].balance : r2(input.startBalance);
  const breachesZero = lowPoint != null && lowPoint.balance < 0;
  return { days, lowPoint, endBalance, totalScheduledOut: r2(totalScheduledOut), breachesZero };
}

/** Estimate the operating cash a scheduled sweep removes = mean recent Profit
 * sweep + mean recent Owner's Pay sweep. 0 when there's no sweep history. */
export function estimateSweepOutflow(
  recentSweeps: readonly { key: string; amount: number }[],
): number {
  const mean = (key: string) => {
    const xs = recentSweeps.filter((s) => s.key === key).map((s) => n(s.amount));
    return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  };
  return r2(mean("profit") + mean("owner_pay"));
}

export async function loadForwardCash(restaurantId: string): Promise<ForwardCashData> {
  // Starting cash + as-of date come from Cash Runway (anchor + net flow since).
  // Not db-injectable: the sub-loaders (Cash Runway / Recurring / ledger snapshot)
  // read the prisma singleton directly. Correctness lives in the pure functions
  // above, which ARE unit-tested; this is thin assembly over already-tested loaders.
  const runway = await loadCashRunway(restaurantId);

  const base: ForwardCashData = {
    hasAnchor: runway.hasAnchor,
    hasData: runway.hasData,
    startDate: runway.asOfDate,
    startBalance: runway.currentCash,
    windowDays: WINDOW_DAYS,
    staleDays: runway.staleDays,
    days: [],
    lowPoint: null,
    endBalance: runway.currentCash,
    totalScheduledOut: 0,
    breachesZero: false,
    obligationCount: 0,
    note: "",
  };

  if (!runway.hasAnchor || runway.currentCash == null || runway.asOfDate == null) {
    return {
      ...base,
      note: "Set a bank-balance anchor on Cash Runway (a balance and its date from any statement) to project cash forward against upcoming bills, payroll, and sweeps.",
    };
  }

  const [recurring, snapshot] = await Promise.all([loadRecurring(restaurantId), getLedgerSnapshot(restaurantId)]);
  const start = parseISO(runway.asOfDate);

  const recurringObligations = projectRecurringObligations(recurring.vendors, start, WINDOW_DAYS);
  const sweepOutflow = estimateSweepOutflow(snapshot.recentSweeps);
  const sweepObligations: ScheduledObligation[] =
    sweepOutflow > 0
      ? sweepDatesInWindow(start, WINDOW_DAYS).map((d) => ({
          date: iso(d),
          label: "Profit + Owner's Pay sweep",
          amount: sweepOutflow,
          kind: "sweep" as const,
        }))
      : [];

  const obligations = [...recurringObligations, ...sweepObligations];
  const projection = projectForwardCash({
    startDate: runway.asOfDate,
    startBalance: runway.currentCash,
    windowDays: WINDOW_DAYS,
    obligations,
  });

  const note = projection.breachesZero
    ? "Projected from your last-known balance against upcoming recurring bills, inferred payroll, and the 10th/25th sweeps. The balance goes negative at the low-point below — move a sweep or a bill, or top up before then."
    : "Projected from your last-known balance against upcoming recurring bills, inferred payroll, and the 10th/25th Profit First sweeps. Estimated timing — cadence is inferred from history.";

  return {
    ...base,
    days: projection.days,
    lowPoint: projection.lowPoint,
    endBalance: projection.endBalance,
    totalScheduledOut: projection.totalScheduledOut,
    breachesZero: projection.breachesZero,
    obligationCount: obligations.length,
    note,
  };
}
