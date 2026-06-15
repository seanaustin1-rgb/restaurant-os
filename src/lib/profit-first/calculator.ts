// Profit First calculation core for OutFront Data.
// All money values are plain numbers (dollars). Percentages are whole numbers (5 = 5%).
// "Real Revenue" is the Profit First basis for every allocation: Total Sales − COGS.

// The shared health vocabulary used across the app. There are two intentional
// LENSES that both emit this status (they measure different things — don't merge):
//   1. Budget-usage lens (gauges, getHealthStatus below): how much of a TAP target
//      a bucket's spend has consumed — green ≤90% used, yellow ≤100%, red over.
//   2. Variance lens (allocation.ts computeVariance): the set-aside-vs-owed gap on
//      the rolling window — green ≥+5%, yellow −5..+5%, red <−5%.
// Defined here (the foundational module); allocation.ts re-exports it.
export type HealthStatus = "green" | "yellow" | "red";

// Budget-usage thresholds (whole-number percents) — named, not magic numbers.
export const USAGE_GREEN_MAX_PCT = 90; // ≤ this → green (comfortably within budget)
export const USAGE_YELLOW_MAX_PCT = 100; // ≤ this → yellow (approaching limit); over → red

// TAP (Target Allocation Percentage) set. Mirrors TapSettings in the Prisma schema.
// `spillPct` is optional/structure-only for now: held at 0 until the operator
// confirms the 27/20/13 redistribution (see docs/specs/allocation-variance-engine.md
// §C2.1). When absent it contributes 0, so the six live TAPs still sum to 100%.
export interface Taps {
  profitPct: number;
  ownerPayPct: number;
  cogsFoodPct: number;
  cogsLiquorPct: number;
  laborPct: number;
  opexPct: number;
  spillPct?: number;
}

export interface Targets {
  profit: number;
  ownerPay: number;
  cogsFood: number;
  cogsLiquor: number;
  labor: number;
  opex: number;
  spill: number;
}

/**
 * Real Revenue = Total Sales − COGS (food + liquor).
 * This is the Profit First basis all TAP targets are calculated from.
 */
export function calculateRealRevenue(
  totalRevenue: number,
  foodCogs: number,
  liquorCogs: number,
): number {
  return totalRevenue - foodCogs - liquorCogs;
}

/**
 * Allocate the TAP base across the six TAP buckets. Each target = base × (pct/100).
 * In this model the base is Total Sales (the TAPs include COGS and sum to 100%),
 * not Real Revenue — Real Revenue is kept as a separate reported metric.
 */
export function calculateTargets(base: number, taps: Taps): Targets {
  const alloc = (pct: number) => base * (pct / 100);
  return {
    profit: alloc(taps.profitPct),
    ownerPay: alloc(taps.ownerPayPct),
    cogsFood: alloc(taps.cogsFoodPct),
    cogsLiquor: alloc(taps.cogsLiquorPct),
    labor: alloc(taps.laborPct),
    opex: alloc(taps.opexPct),
    spill: alloc(taps.spillPct ?? 0),
  };
}

/**
 * Percentage of a target consumed by actual spend.
 * Returns 0 when there is no target to measure against.
 */
export function calculateUsagePct(spent: number, target: number): number {
  if (target <= 0) return 0;
  return (spent / target) * 100;
}

/**
 * Budget health for a spending bucket based on how much of its target is used.
 * green  ≤ 90%  — comfortably within budget
 * yellow ≤ 100% — approaching the limit
 * red    > 100% — over budget
 */
export function getHealthStatus(usagePct: number): HealthStatus {
  if (usagePct <= USAGE_GREEN_MAX_PCT) return "green";
  if (usagePct <= USAGE_YELLOW_MAX_PCT) return "yellow";
  return "red";
}

/**
 * Prime Cost as a percentage of revenue: (COGS + beverage + labor) / revenue × 100.
 * The single most-watched restaurant operating metric.
 */
export function calculatePrimeCost(
  foodCogs: number,
  beverageCogs: number,
  laborCost: number,
  revenue: number,
): number {
  if (revenue <= 0) return 0;
  return ((foodCogs + beverageCogs + laborCost) / revenue) * 100;
}

/**
 * RevPASH — Revenue Per Available Seat Hour: revenue / (seats × hours open).
 * Measures how efficiently seating capacity converts to revenue.
 */
export function calculateRevPASH(
  revenue: number,
  seatCount: number,
  hoursOpen: number,
): number {
  const capacity = seatCount * hoursOpen;
  if (capacity <= 0) return 0;
  return revenue / capacity;
}
