// Profit First — Allocation & Variance engine (pure core).
//
// Spec: docs/specs/allocation-variance-engine.md. This module is the calculation
// heart: tax skim → daily allocation → draw-down balances → rolling-7-day
// variance → Tax Reserve OK/SHORT → sweep schedule. It is intentionally
// DB-free and side-effect-free — Prisma models + Inngest jobs (Phase 2) call
// these functions; nothing here reads the database. All money values are plain
// dollars; percentages are whole numbers (5 = 5%).
//
// Simulation mode only — no real money moves (Dwolla "Go Live" is out of scope).

import type { Taps, HealthStatus } from "./calculator";

// One shared health vocabulary (defined in calculator.ts). Re-exported so existing
// importers of HealthStatus from this module keep working. The variance thresholds
// below are this module's LENS on that vocabulary — see calculator.ts for the
// budget-usage lens; the two are intentionally distinct.
export type { HealthStatus };

// ─────────────────────────────────────────────────────────────
// Buckets
// ─────────────────────────────────────────────────────────────

// Buckets that accrue from allocation AND draw down as real payments clear.
// COGS is tracked 3-way (Food / Wine&Spirits / Beer) per the operator's locked
// decision; beer has no TAP % of its own yet (held with the 27/20/13 split), so
// it accrues $0 from allocation but still draws down against beer invoices —
// surfacing the unbudgeted beer spend as a red variance until a % is set.
// NOTE: beer's bucket key is "COGS_BEVERAGE" — the canonical Prisma TapBucket
// enum value used everywhere (categorizer, DB, dashboard); keep this in sync.
export type DrawDownBucket = "COGS_FOOD" | "COGS_LIQUOR" | "COGS_BEVERAGE" | "LABOR" | "OPEX";

// Accrue-only buckets: no obligations, just a running balance toward a sweep.
export type AccrueBucket = "PROFIT" | "OWNER_PAY" | "SPILL";

export type TaxLedger = "SALES" | "PAYROLL";

// ─────────────────────────────────────────────────────────────
// Variance thresholds (configurable constants — spec "THE VARIANCE LINE")
// ─────────────────────────────────────────────────────────────

export const VARIANCE_GREEN_PCT = 5; // dollar gap ≥ +5% of obligations → green
export const VARIANCE_RED_PCT = -5; // dollar gap < −5% of obligations → red
export const VARIANCE_WINDOW_DAYS = 7; // rolling window — "weekly variance truth"

// Default rolling COGS rate when no live MarginEdge invoices exist yet: the COGS
// TAP target (Food% + Liquor%). Used to derive Real Revenue at daily cadence,
// then trued-up when actual invoices land (spec "COGS derivation").
export function defaultCogsRate(taps: Taps): number {
  return taps.cogsFoodPct + taps.cogsLiquorPct;
}

// ─────────────────────────────────────────────────────────────
// Pre-allocation tax skim + daily allocation
// ─────────────────────────────────────────────────────────────

export interface AllocationInput {
  /** Bankable settlement that landed (gross card settlement / event check). */
  grossDeposit: number;
  /**
   * Sales tax collected for the period, skimmed off the top. Source = Toast's
   * reported figure (the same number Davo pulls); 0 when not yet wired, in which
   * case it falls back to no skim (the Davo Plaid-pull match handles it later).
   */
  salesTaxCollected: number;
  /** Payroll tax accrued for the day (employer + withholdings), skimmed to reserve. */
  payrollTaxAccrued: number;
  /** TAP percentages in effect (held at 32/28, spill 0 — see calculator.ts). */
  taps: Taps;
}

export interface AllocationResult {
  grossDeposit: number;
  salesTaxSkimmed: number;
  payrollTaxSkimmed: number;
  /** Gross deposit minus both tax skims — the amount the TAPs split. */
  allocableRemainder: number;
  /** COGS rate applied (Food% + Liquor%); the rolling-rate estimate. */
  cogsRateUsed: number;
  /** allocable − COGS allocation. Reported metric, not a bucket. */
  derivedRealRevenue: number;
  /** Per-bucket allocation (dollars). Keys mirror the TAP buckets. */
  byBucket: {
    profit: number;
    ownerPay: number;
    cogsFood: number;
    cogsLiquor: number;
    labor: number;
    opex: number;
    spill: number;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Run one allocation event: skim taxes off the top, then split the allocable
 * remainder across the TAP buckets by percentage. This is the daily-cadence
 * waterfall — call it per settled deposit (the Monday lump batches the weekend,
 * which is why variance is read on a rolling window, not per day).
 */
export function runAllocation(input: AllocationInput): AllocationResult {
  const { grossDeposit, salesTaxCollected, payrollTaxAccrued, taps } = input;

  const salesTaxSkimmed = Math.max(0, salesTaxCollected);
  const payrollTaxSkimmed = Math.max(0, payrollTaxAccrued);
  const allocable = Math.max(0, grossDeposit - salesTaxSkimmed - payrollTaxSkimmed);

  const pctOf = (pct: number) => round2(allocable * (pct / 100));
  const byBucket = {
    profit: pctOf(taps.profitPct),
    ownerPay: pctOf(taps.ownerPayPct),
    cogsFood: pctOf(taps.cogsFoodPct),
    cogsLiquor: pctOf(taps.cogsLiquorPct),
    labor: pctOf(taps.laborPct),
    opex: pctOf(taps.opexPct),
    spill: pctOf(taps.spillPct ?? 0),
  };

  const cogsRateUsed = defaultCogsRate(taps);
  const derivedRealRevenue = round2(allocable - byBucket.cogsFood - byBucket.cogsLiquor);

  return {
    grossDeposit: round2(grossDeposit),
    salesTaxSkimmed: round2(salesTaxSkimmed),
    payrollTaxSkimmed: round2(payrollTaxSkimmed),
    allocableRemainder: round2(allocable),
    cogsRateUsed,
    derivedRealRevenue,
    byBucket,
  };
}

// ─────────────────────────────────────────────────────────────
// Draw-down balance
// ─────────────────────────────────────────────────────────────

/**
 * Running balance for a draw-down bucket: what's been allocated to it minus what
 * real payments have cleared against it. Positive = funded ahead; negative =
 * underwater (more has cleared than was set aside).
 */
export function drawDownBalance(allocatedToDate: number, clearedToDate: number): number {
  return round2(allocatedToDate - clearedToDate);
}

// ─────────────────────────────────────────────────────────────
// Rolling variance (the actionable signal)
// ─────────────────────────────────────────────────────────────

export interface VarianceResult {
  /** Allocated to the bucket over the window. */
  allocated: number;
  /** What the bucket actually owes over the window (obligations). */
  obligations: number;
  /** Primary read: allocated − obligations. Positive = ahead. */
  dollarGap: number;
  /** Secondary read: gap as a % of obligations. Null when nothing is owed. */
  pctDiff: number | null;
  signal: HealthStatus;
}

/**
 * Variance for one draw-down bucket over its rolling window. Pass the already
 * windowed sums (the caller selects the trailing VARIANCE_WINDOW_DAYS). Signal:
 * green ≥ +5%, yellow −5%..+5%, red < −5%. With nothing owed yet, green.
 */
export function computeVariance(allocated: number, obligations: number): VarianceResult {
  const dollarGap = round2(allocated - obligations);
  const pctDiff = obligations > 0 ? round2((dollarGap / obligations) * 100) : null;

  let signal: HealthStatus = "green";
  if (pctDiff !== null) {
    if (pctDiff < VARIANCE_RED_PCT) signal = "red";
    else if (pctDiff < VARIANCE_GREEN_PCT) signal = "yellow";
  }

  return { allocated: round2(allocated), obligations: round2(obligations), dollarGap, pctDiff, signal };
}

/** A dated ledger row for windowing (allocation vs obligation on a given day). */
export interface LedgerEntry {
  date: Date;
  allocated: number;
  obligation: number;
}

/**
 * Sum the trailing-window allocations & obligations as of `asOf`, then compute
 * variance. Window is inclusive of the last `windowDays` days ending at asOf.
 */
export function rollingVariance(
  entries: LedgerEntry[],
  asOf: Date,
  windowDays: number = VARIANCE_WINDOW_DAYS,
): VarianceResult {
  const end = asOf.getTime();
  const start = end - (windowDays - 1) * 24 * 60 * 60 * 1000;
  let allocated = 0;
  let obligations = 0;
  for (const e of entries) {
    const t = e.date.getTime();
    if (t >= start && t <= end) {
      allocated += e.allocated;
      obligations += e.obligation;
    }
  }
  return computeVariance(allocated, obligations);
}

// ─────────────────────────────────────────────────────────────
// Tax Reserve — binary OK / SHORT (top-priority alert)
// ─────────────────────────────────────────────────────────────

export type TaxReserveStatus = "OK" | "SHORT";

/**
 * Tax Reserve variance is binary, not green/yellow/red: OK when the reserve
 * covers the upcoming pull, SHORT (five-alarm) when it doesn't. Evaluate per
 * sub-ledger (Sales, Payroll) so a healthy one can't mask a short one.
 */
export function taxReserveStatus(reserveBalance: number, upcomingPull: number): TaxReserveStatus {
  return reserveBalance + 1e-9 >= upcomingPull ? "OK" : "SHORT";
}

// ─────────────────────────────────────────────────────────────
// Sweep schedule — Profit + Owner's Pay on the 10th & 25th
// ─────────────────────────────────────────────────────────────

/**
 * The next sweep date on or after `from` (10th or 25th of the month; rolls to
 * the 10th of next month after the 25th). Pure date math, computed in UTC — the
 * allocation basis dates are Prisma `@db.Date` values (midnight UTC), so UTC
 * getters keep this consistent with the rest of the engine regardless of the
 * server/host timezone.
 */
export function nextSweepDate(from: Date): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  if (d <= 10) return new Date(Date.UTC(y, m, 10));
  if (d <= 25) return new Date(Date.UTC(y, m, 25));
  return new Date(Date.UTC(y, m + 1, 10));
}

/** Days remaining until the next sweep (>= 0). UTC, to match nextSweepDate. */
export function daysUntilNextSweep(from: Date): number {
  const next = nextSweepDate(from);
  const floor = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const ms = next.getTime() - floor;
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * The most recent sweep date (10th or 25th) on or before `asOf`. Rolls back to
 * the 25th of the previous month before the 10th. UTC, matching nextSweepDate.
 */
export function prevSweepDate(asOf: Date): Date {
  const y = asOf.getUTCFullYear();
  const m = asOf.getUTCMonth();
  const d = asOf.getUTCDate();
  if (d >= 25) return new Date(Date.UTC(y, m, 25));
  if (d >= 10) return new Date(Date.UTC(y, m, 10));
  return new Date(Date.UTC(y, m - 1, 25));
}

/**
 * Is a Profit/Owner's-Pay sweep due as of `asOf`? True when the most recent
 * scheduled sweep date hasn't been swept yet (lastSweptAt is null or predates
 * it). Drives the persisted-ledger sweep job — idempotent: once lastSweptAt is
 * set to/after the sweep date, it won't fire again that period.
 */
export function isSweepDue(asOf: Date, lastSweptAt: Date | null): boolean {
  const prev = prevSweepDate(asOf);
  return !lastSweptAt || lastSweptAt.getTime() < prev.getTime();
}
