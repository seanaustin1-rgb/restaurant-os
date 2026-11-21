// "Clean day" — the deterministic, per-tenant daily reconciliation verdict behind
// the V1 gate ("Stone reconciles clean for 7 consecutive days with no manual
// intervention"). Pure + DB-free: the loader (clean-day-loader.ts) gathers the
// inputs, this module decides, so the rule is unit-tested and "7 clean days" is a
// query over stored verdicts rather than a judgment call.
//
// A day is clean only when ALL of these hold (each is recorded in the verdict so
// a failed day says exactly why):
//   NO_NEW_EXCEPTIONS  no WARNING/BLOCKING SyncException was created today
//                      (counted whether or not someone has since resolved it —
//                      resolving by hand is the manual intervention the gate forbids)
//   NO_OPEN_BLOCKING   no BLOCKING exception is open
//   PLAID_SYNCED       every active Plaid connection committed a sync today
//   TOAST_SYNCED       Toast data was refreshed today (skipped if the tenant has no Toast)
//   SPINES_CONVERGED   legacy and clean-ledger spines agree (spine-compare tolerance)
import { spinesConverged, type SpineDelta } from "./spine-compare";

/** The V1 gate bar: consecutive clean days required. */
export const GATE_CLEAN_DAYS = 7;

export type CleanDayCheckKey =
  | "NO_NEW_EXCEPTIONS"
  | "NO_OPEN_BLOCKING"
  | "PLAID_SYNCED"
  | "TOAST_SYNCED"
  | "SPINES_CONVERGED";

export interface CleanDayCheck {
  key: CleanDayCheckKey;
  /** null = not applicable for this tenant (does not gate). */
  pass: boolean | null;
  detail: string;
}

export interface CleanDayInput {
  /** WARNING/BLOCKING exceptions created inside today's window. */
  newExceptionCount: number;
  /** Unresolved BLOCKING exceptions, any age. */
  openBlockingCount: number;
  /** Unresolved exceptions of any severity — informational, never gates. */
  openBacklogCount: number;
  plaid: { activeConnections: number; staleConnections: number };
  toast: { applicable: boolean; syncedToday: boolean };
  spineDeltas: SpineDelta[];
  /** Tolerance passed straight to spinesConverged (defaults match the CLI: 1% / $1). */
  tolerancePct?: number;
  absFloor?: number;
}

export interface CleanDayVerdict {
  clean: boolean;
  checks: CleanDayCheck[];
  openBacklogCount: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function evaluateCleanDay(input: CleanDayInput): CleanDayVerdict {
  const noNew = input.newExceptionCount === 0;
  const noBlocking = input.openBlockingCount === 0;
  const plaidOk = input.plaid.activeConnections > 0 && input.plaid.staleConnections === 0;
  const converged = spinesConverged(
    input.spineDeltas,
    input.tolerancePct ?? 1,
    input.absFloor ?? 1,
  );
  const diverging = input.spineDeltas.filter(
    (d) => !spinesConverged([d], input.tolerancePct ?? 1, input.absFloor ?? 1),
  );

  const checks: CleanDayCheck[] = [
    {
      key: "NO_NEW_EXCEPTIONS",
      pass: noNew,
      detail: noNew
        ? "No new sync exceptions today."
        : `${plural(input.newExceptionCount, "new sync exception")} created today.`,
    },
    {
      key: "NO_OPEN_BLOCKING",
      pass: noBlocking,
      detail: noBlocking
        ? "No blocking exceptions open."
        : `${plural(input.openBlockingCount, "blocking exception")} open.`,
    },
    {
      key: "PLAID_SYNCED",
      pass: plaidOk,
      detail:
        input.plaid.activeConnections === 0
          ? "No active Plaid connection to sync."
          : plaidOk
            ? `${plural(input.plaid.activeConnections, "Plaid connection")} synced today.`
            : `${input.plaid.staleConnections} of ${plural(input.plaid.activeConnections, "Plaid connection")} did not sync today.`,
    },
    input.toast.applicable
      ? {
          key: "TOAST_SYNCED",
          pass: input.toast.syncedToday,
          detail: input.toast.syncedToday ? "Toast data refreshed today." : "Toast data was not refreshed today.",
        }
      : { key: "TOAST_SYNCED", pass: null, detail: "No Toast data for this tenant — not applicable." },
    {
      key: "SPINES_CONVERGED",
      pass: converged,
      detail: converged
        ? "Legacy and ledger spines within tolerance."
        : `Spines diverge in ${diverging.map((d) => d.bucket).join(", ")}.`,
    },
  ];

  return {
    clean: checks.every((c) => c.pass !== false),
    checks,
    openBacklogCount: input.openBacklogCount,
  };
}

// ── Streak ──────────────────────────────────────────────────

export interface StoredDay {
  /** Tenant-local calendar date, YYYY-MM-DD. */
  date: string;
  clean: boolean;
}

/** Previous calendar day for a YYYY-MM-DD string (pure UTC date arithmetic). */
export function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export interface StreakStatus {
  /** Consecutive clean days, counted back from `through`. */
  streak: number;
  /** Last day counted (today if today has a verdict, else yesterday), or null if none. */
  through: string | null;
  gatePassed: boolean;
  needed: number;
}

/**
 * Consecutive clean days ending today — or ending yesterday when today's check
 * hasn't run yet (so the streak doesn't read 0 every morning before the job).
 * A missing day or a dirty day breaks the run: a gap is not a pass.
 */
export function cleanStreak(
  days: StoredDay[],
  todayLocal: string,
  needed: number = GATE_CLEAN_DAYS,
): StreakStatus {
  const byDate = new Map(days.map((d) => [d.date, d.clean]));
  const start = byDate.has(todayLocal) ? todayLocal : previousDay(todayLocal);
  if (!byDate.has(start)) return { streak: 0, through: null, gatePassed: false, needed };

  let streak = 0;
  let cursor = start;
  while (byDate.get(cursor) === true) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return { streak, through: start, gatePassed: streak >= needed, needed };
}

// ── Tenant-local day bounds ─────────────────────────────────

/** Offset (ms) of `tz` from UTC at the given instant. */
function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

export interface LocalDayBounds {
  /** Tenant-local calendar date, YYYY-MM-DD. */
  date: string;
  /** Instant of local midnight starting the day. */
  start: Date;
  /** `now` — the verdict only judges what has happened so far today. */
  end: Date;
}

/** Local calendar date for `now` in `tz`, plus the instant that day began. DST-safe. */
export function localDayBounds(now: Date, tz: string): LocalDayBounds {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
  const [y, m, d] = ymd.split("-").map(Number);
  const midnightAsUtc = Date.UTC(y, m - 1, d);
  // Offset can differ between 00:00 and `now` on a DST-change day; resolve it at
  // the guess, then re-resolve at the corrected instant.
  let start = new Date(midnightAsUtc - tzOffsetMs(new Date(midnightAsUtc), tz));
  start = new Date(midnightAsUtc - tzOffsetMs(start, tz));
  return { date: ymd, start, end: now };
}
