import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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

/**
 * Cash-floor safety (B6): the operator sets a minimum operating balance they
 * want to keep. This assesses the 30-day projection against it — a plain
 * "does the low-point dip under the floor" breach, plus a pre-sweep warning
 * when a scheduled Profit First sweep is the specific event that tips the
 * balance below the floor (so the operator can hold or trim that sweep).
 */
export interface CashFloorAssessment {
  floor: number;
  state: "ok" | "breach";
  breachDate: string | null; // first projected day the balance is under the floor
  lowBalance: number; // the projected low-point balance over the window
  shortfall: number | null; // floor − lowBalance, when breached (else null)
  /** The scheduled sweep that tips the balance under the floor, when one does. */
  sweepAtRisk: { date: string; amount: number; balanceAfter: number } | null;
  readout: string;
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
  cashFloor: number | null; // operator-set minimum operating balance (B6)
  floor: CashFloorAssessment | null; // floor safety, when a floor is set + anchored
  payroll: PayrollInference | null; // inferred forward payroll accrual (B7)
  obligationCount: number;
  note: string;
}

/**
 * Inferred forward payroll accrual (B7) — no payroll API. Payroll is the largest
 * predictable outflow, but the legacy path only ever showed cleared pulls. Here
 * we detect the pay cadence from recent cleared payroll-cash pulls and size the
 * next runs at the average of the last (≤4) pulls, so Forward Cash stops
 * under-counting the biggest bill on the calendar. Payroll TAX is unaffected —
 * that stays cleared-pulls-only until a real payroll feed exists.
 */
export type PayrollCadence = "weekly" | "biweekly" | "monthly" | "irregular";

export interface PayrollInference {
  cadence: PayrollCadence;
  intervalDays: number | null; // median days between pay runs
  amount: number; // avg of the last (≤4) pay-run totals — the projected per-run outflow
  pullsUsed: number; // how many pay runs the amount averaged
  runsSeen: number; // distinct pay runs detected in the lookback
  lastDate: string | null; // most recent pay-run date (YYYY-MM-DD)
  confident: boolean; // steady cadence + enough runs to project forward
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

const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthDay(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${MONTHS_SHORT[(m ?? 1) - 1]} ${d}`;
}

/**
 * Assess the projected window against the operator's cash floor. Pure — walks
 * the already-projected days (each carries its end-of-day balance + that day's
 * obligations). Returns null when no floor is set or there's nothing to project
 * (honest degradation — no floor, no alarm). A sweep is "at risk" when the day
 * ends below the floor but WOULD have stayed above it without that day's sweep
 * outflow — i.e. holding the sweep is the fix.
 */
export function assessCashFloor(
  floor: number | null,
  days: readonly ForwardCashDay[],
  lowPoint: ForwardCashLowPoint | null,
): CashFloorAssessment | null {
  if (floor == null || floor < 0 || days.length === 0 || lowPoint == null) return null;

  let breachDate: string | null = null;
  let sweepAtRisk: CashFloorAssessment["sweepAtRisk"] = null;
  for (const day of days) {
    if (breachDate == null && day.balance < floor) breachDate = day.date;
    if (sweepAtRisk == null) {
      const sweepOut = day.obligations
        .filter((o) => o.kind === "sweep" && o.amount > 0)
        .reduce((sum, o) => sum + o.amount, 0);
      // The sweep tips it under: below the floor now, but above it if the sweep were held.
      if (sweepOut > 0 && day.balance < floor && day.balance + sweepOut >= floor) {
        sweepAtRisk = { date: day.date, amount: r2(sweepOut), balanceAfter: day.balance };
      }
    }
  }

  const breached = lowPoint.balance < floor;
  if (!breached) {
    return {
      floor,
      state: "ok",
      breachDate: null,
      lowBalance: lowPoint.balance,
      shortfall: null,
      sweepAtRisk: null,
      readout: `Projected cash holds above your ${usd(floor)} floor over the next ${days.length} days (low-point ${usd(lowPoint.balance)}).`,
    };
  }

  const shortfall = r2(floor - lowPoint.balance);
  const readout = sweepAtRisk
    ? `The ${monthDay(sweepAtRisk.date)} Profit + Owner's Pay sweep (~${usd(sweepAtRisk.amount)}) drops projected cash to ${usd(sweepAtRisk.balanceAfter)}, below your ${usd(floor)} floor. Hold or trim it.`
    : `Projected cash bottoms at ${usd(lowPoint.balance)} on ${monthDay(lowPoint.date)} — ${usd(shortfall)} below your ${usd(floor)} floor. Move a bill or top up before then.`;

  return {
    floor,
    state: "breach",
    breachDate,
    lowBalance: lowPoint.balance,
    shortfall,
    sweepAtRisk,
    readout,
  };
}

const PAYROLL_RUN_MERGE_DAYS = 3; // DD + trailing paper checks within a few days = one run
const PAYROLL_AVG_RUNS = 4; // "avg of the last 4 pulls"

function medianOf(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function payrollCadence(intervalDays: number): PayrollCadence {
  if (intervalDays <= 9) return "weekly";
  if (intervalDays <= 18) return "biweekly"; // folds semi-monthly (~15d) in — close enough for a 30-day window
  if (intervalDays <= 35) return "monthly";
  return "irregular";
}

/**
 * Collapse raw payroll-cash outflows into pay-run events: sum same-day pulls,
 * then merge runs within a few days of each other (a Thursday direct deposit and
 * the paper checks that trail it are ONE pay run, not three). Returns one
 * {date, amount} per run, ascending, anchored at the earliest date in the run.
 * Pure.
 */
export function aggregatePayrollPulls(
  raw: readonly { date: string; amount: number }[],
  mergeDays = PAYROLL_RUN_MERGE_DAYS,
): { date: string; amount: number }[] {
  const byDate = new Map<string, number>();
  for (const r of raw) {
    if (!(r.amount > 0)) continue;
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.amount);
  }
  const dates = [...byDate.keys()].sort();
  const runs: { date: string; amount: number }[] = [];
  for (const date of dates) {
    const amount = byDate.get(date)!;
    const prev = runs[runs.length - 1];
    if (prev && (parseISO(date).getTime() - parseISO(prev.date).getTime()) / DAY_MS <= mergeDays) {
      prev.amount = r2(prev.amount + amount); // merge into the earlier-anchored run
    } else {
      runs.push({ date, amount: r2(amount) });
    }
  }
  return runs;
}

/**
 * Infer the forward payroll accrual from aggregated pay runs (ascending). Cadence
 * = the median interval between runs; the projected per-run amount = the average
 * of the last {@link PAYROLL_AVG_RUNS} runs (smooths one atypical run). Confident
 * only with a steady cadence over enough runs — otherwise degrade honestly and
 * let Forward Cash fall back to its recurring-vendor payroll path. Pure.
 */
export function inferPayroll(pulls: readonly { date: string; amount: number }[]): PayrollInference | null {
  if (pulls.length === 0) return null;

  const recent = pulls.slice(-PAYROLL_AVG_RUNS);
  const amount = r2(recent.reduce((s, p) => s + p.amount, 0) / recent.length);
  const lastDate = pulls[pulls.length - 1].date;

  if (pulls.length < 3) {
    // Not enough runs to trust a cadence — expose what we saw, but don't project.
    return { cadence: "irregular", intervalDays: null, amount, pullsUsed: recent.length, runsSeen: pulls.length, lastDate, confident: false };
  }

  const intervals: number[] = [];
  for (let i = 1; i < pulls.length; i++) {
    intervals.push((parseISO(pulls[i].date).getTime() - parseISO(pulls[i - 1].date).getTime()) / DAY_MS);
  }
  const intervalDays = Math.round(medianOf(intervals));
  const cadence = payrollCadence(intervalDays);

  return {
    cadence,
    intervalDays,
    amount,
    pullsUsed: recent.length,
    runsSeen: pulls.length,
    lastDate,
    confident: cadence !== "irregular" && amount > 0,
  };
}

/**
 * Project the inferred payroll forward into the window at its cadence, stepping
 * from the last run. Mirrors {@link projectRecurringObligations}' guarded stepping.
 * Empty (no obligations) when the inference isn't confident. Pure.
 */
export function projectPayrollObligations(
  inf: PayrollInference | null,
  startDate: Date,
  windowDays: number,
): ScheduledObligation[] {
  if (!inf || !inf.confident || inf.intervalDays == null || inf.intervalDays <= 0 || inf.lastDate == null || inf.amount <= 0) {
    return [];
  }
  const interval = inf.intervalDays;
  const end = new Date(startDate.getTime() + windowDays * DAY_MS);
  const out: ScheduledObligation[] = [];
  let next = new Date(parseISO(inf.lastDate).getTime() + interval * DAY_MS);
  let guard = 0;
  while (next.getTime() <= startDate.getTime() && guard < 400) {
    next = new Date(next.getTime() + interval * DAY_MS);
    guard += 1;
  }
  guard = 0;
  while (next.getTime() <= end.getTime() && guard < 400) {
    out.push({ date: iso(next), label: "Payroll (inferred)", amount: inf.amount, kind: "payroll" });
    next = new Date(next.getTime() + interval * DAY_MS);
    guard += 1;
  }
  return out;
}

/**
 * Read recent payroll-CASH pulls (LABOR-bucket categories named "payroll" — so
 * "Payroll — Direct Deposit/Paper Checks", "Staff Payroll", but never the
 * TAX_PAYROLL "Payroll Tax"), aggregated into pay runs. Also returns the payroll
 * category names so the caller can drop them from the recurring path (no
 * double-count). Outflows are stored positive.
 */
async function loadPayrollPulls(
  restaurantId: string,
  db: PrismaClient = prisma,
): Promise<{ pulls: { date: string; amount: number }[]; payrollCategoryNames: Set<string> }> {
  const cats = await db.category.findMany({
    where: { restaurantId },
    select: { id: true, name: true, tapBucket: true },
  });
  const payrollCats = cats.filter((c) => String(c.tapBucket) === "LABOR" && /payroll/i.test(c.name));
  const payrollCategoryNames = new Set(payrollCats.map((c) => c.name));
  if (payrollCats.length === 0) return { pulls: [], payrollCategoryNames };

  const txns = await db.transaction.findMany({
    where: { restaurantId, amount: { gt: 0 }, categoryId: { in: payrollCats.map((c) => c.id) } },
    orderBy: { date: "desc" },
    take: 120, // enough raw rows to span several pay runs even for check-heavy payrolls
    select: { date: true, amount: true },
  });
  const raw = txns.map((t) => ({ date: t.date.toISOString().slice(0, 10), amount: n(t.amount) }));
  return { pulls: aggregatePayrollPulls(raw), payrollCategoryNames };
}

export async function loadForwardCash(restaurantId: string, db: PrismaClient = prisma): Promise<ForwardCashData> {
  // Starting cash + as-of date come from Cash Runway (anchor + net flow since).
  // `db` threads through every sub-loader (Cash Runway / Recurring / ledger
  // snapshot / payroll pulls) so the demo path stays on demoPrisma and never
  // touches production. Correctness lives in the pure functions above, which ARE
  // unit-tested; this is thin assembly over already-tested loaders.
  const [runway, restaurant] = await Promise.all([
    loadCashRunway(restaurantId, db),
    db.restaurant.findUnique({ where: { id: restaurantId }, select: { cashFloor: true } }),
  ]);
  const cashFloor = restaurant?.cashFloor != null ? n(restaurant.cashFloor) : null;

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
    cashFloor,
    floor: null,
    payroll: null,
    obligationCount: 0,
    note: "",
  };

  if (!runway.hasAnchor || runway.currentCash == null || runway.asOfDate == null) {
    return {
      ...base,
      note: "Set a bank-balance anchor on Cash Runway (a balance and its date from any statement) to project cash forward against upcoming bills, payroll, and sweeps.",
    };
  }

  const [recurring, snapshot, payrollData] = await Promise.all([
    loadRecurring(restaurantId, db),
    getLedgerSnapshot(restaurantId, db),
    loadPayrollPulls(restaurantId, db),
  ]);
  const start = parseISO(runway.asOfDate);

  // B7: prefer the dedicated payroll accrual (cadence + avg last 4 pulls). When
  // it's confident, drop payroll vendors from the recurring path so payroll
  // isn't counted twice; otherwise keep the old recurring-vendor payroll behavior.
  const payroll = inferPayroll(payrollData.pulls);
  const usePayrollInference = payroll?.confident === true;
  const recurringVendors = usePayrollInference
    ? recurring.vendors.filter((v) => !(v.categoryName != null && payrollData.payrollCategoryNames.has(v.categoryName)))
    : recurring.vendors;

  const recurringObligations = projectRecurringObligations(recurringVendors, start, WINDOW_DAYS);
  const payrollObligations = usePayrollInference ? projectPayrollObligations(payroll, start, WINDOW_DAYS) : [];
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

  const obligations = [...recurringObligations, ...payrollObligations, ...sweepObligations];
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
    floor: assessCashFloor(cashFloor, projection.days, projection.lowPoint),
    payroll,
    obligationCount: obligations.length,
    note,
  };
}
