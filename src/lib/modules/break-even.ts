import { prisma } from "@/lib/prisma";
import { getHealthStatus, type HealthStatus } from "@/lib/profit-first/calculator";

// Break-even module — the sales level at which contribution margin exactly
// covers fixed costs. Below it the restaurant loses money; above it every
// dollar of contribution margin is profit.
//
//   Contribution Margin Ratio (CM) = 1 − (variable cost ÷ net sales)
//   Break-even Sales               = Fixed Costs ÷ CM
//
// Cost split (kept deliberately simple and honest for v1):
//   • Variable = COGS (food + liquor + beer) + Labor — i.e. Prime Cost. These
//     scale with volume, so CM = 1 − PrimeCost%. (Salaried labor is partly
//     fixed in reality, so the true break-even is modestly *lower* than this —
//     surfaced in the footnote; we don't invent a labor split we can't see.)
//   • Fixed = Operating Expenses (OPEX tapBucket: rent, utilities, insurance,
//     supplies, etc.) + Debt Service. Under this app's Profit First model debt
//     service rolls into the PROFIT tapBucket (legacy bucket DEBT_SERVICE), so
//     it's isolated cleanly and counted as the fixed financing obligation it is.
//
// Data tiers mirror Prime Cost: Net Sales + Labor from DailySales (POS tier,
// Toast); COGS + fixed costs from categorized Transactions (bank tier, cash
// basis). Fixed costs are lumpy week-to-week (rent lands once a month), so the
// window total / per-day figures are the stable read and the weekly bars are
// directional — same caveat we make on Prime Cost.

export interface BreakEvenWeek {
  weekStart: string; // YYYY-MM-DD (Mon, UTC)
  netSales: number;
  variableCost: number; // cogs + labor
  fixedCost: number; // opex + debt service (lumpy)
  cmRatio: number; // (netSales − variableCost) / netSales, 0..1
  days: number; // days of sales data in the week
  partial: boolean; // fewer than 7 days
}

export interface FixedCostLine {
  name: string;
  amount: number;
  kind: "opex" | "debt";
}

export interface BreakEvenData {
  periodLabel: string;
  days: number; // operating days in the window
  weeks: BreakEvenWeek[]; // oldest → newest

  // Window totals (the stable headline).
  netSales: number;
  cogs: number;
  laborCost: number;
  variableCost: number; // cogs + labor
  fixedOpex: number;
  debtService: number;
  fixedCost: number; // fixedOpex + debtService

  cmRatio: number; // contribution margin ratio, 0..1
  primeCostPct: number; // variable as a share of sales (= (1 − cmRatio) × 100)
  cmPositive: boolean; // false when variable costs ≥ sales (no break-even exists)

  // Break-even, normalized three ways (null when cmRatio ≤ 0).
  breakEvenSales: number | null; // over the window
  breakEvenPerDay: number | null;
  breakEvenPerWeek: number | null; // = perDay × 7, the chart reference line
  monthlyBreakEven: number | null; // run-rate, perDay × 30.44
  monthlyNetSales: number; // actual run-rate, perDay × 30.44

  marginOfSafety: number; // (netSales − breakEven) ÷ netSales × 100 (can be negative)
  dollarsAboveBreakEven: number; // netSales − breakEven (negative = shortfall)

  fixedCostLines: FixedCostLine[]; // anatomy, largest first

  // "If you hit your TAP cost targets" reference.
  targetCmRatio: number;
  targetBreakEvenSales: number | null;

  health: HealthStatus;
  hasData: boolean;
}

// Margin-of-safety bands (whole-number percents) — higher is better, so this is
// its own lens, not the budget-usage getHealthStatus (lower-is-better). Named,
// not magic: comfortable cushion ≥20%, thin 10–20%, fragile/under <10%.
export const MOS_HEALTHY_PCT = 20;
export const MOS_CAUTION_PCT = 10;
export function bandMarginOfSafety(mosPct: number): HealthStatus {
  if (mosPct >= MOS_HEALTHY_PCT) return "green";
  if (mosPct >= MOS_CAUTION_PCT) return "yellow";
  return "red";
}

const DAYS_PER_MONTH = 30.44; // mean Gregorian month, for run-rate projection

// Pure break-even derivation, factored out of the loader so the formula is
// testable in isolation (the loader just feeds it window totals). Given the
// variable/fixed split and the contribution-margin identity
//   CM = 1 − variable/sales ;  break-even sales = fixed ÷ CM
// it returns every normalized figure the tile shows. When CM ≤ 0 (variable
// costs swallow all sales) no break-even exists and the dollar/percent reads
// fall back to honest "fully underwater" values.
export interface BreakEvenParts {
  netSales: number;
  variableCost: number; // cogs + labor
  fixedCost: number; // opex + debt service
  days: number; // operating days in the window
  targetCmRatio: number; // CM if TAP cost targets were hit
}

export interface BreakEvenDerived {
  cmRatio: number;
  cmPositive: boolean;
  primeCostPct: number;
  breakEvenSales: number | null;
  breakEvenPerDay: number | null;
  breakEvenPerWeek: number | null;
  monthlyBreakEven: number | null;
  monthlyNetSales: number;
  marginOfSafety: number;
  dollarsAboveBreakEven: number;
  targetBreakEvenSales: number | null;
  health: HealthStatus;
}

export function computeBreakEven({ netSales, variableCost, fixedCost, days, targetCmRatio }: BreakEvenParts): BreakEvenDerived {
  const cmRatio = netSales > 0 ? (netSales - variableCost) / netSales : 0;
  const cmPositive = cmRatio > 0;

  const breakEvenSales = cmPositive ? fixedCost / cmRatio : null;
  const breakEvenPerDay = breakEvenSales != null && days > 0 ? breakEvenSales / days : null;
  const breakEvenPerWeek = breakEvenPerDay != null ? breakEvenPerDay * 7 : null;
  const monthlyBreakEven = breakEvenPerDay != null ? breakEvenPerDay * DAYS_PER_MONTH : null;
  const monthlyNetSales = days > 0 ? (netSales / days) * DAYS_PER_MONTH : 0;

  const dollarsAboveBreakEven = breakEvenSales != null ? netSales - breakEvenSales : -fixedCost;
  const marginOfSafety = breakEvenSales != null && netSales > 0 ? ((netSales - breakEvenSales) / netSales) * 100 : -100;

  const targetBreakEvenSales = targetCmRatio > 0 ? fixedCost / targetCmRatio : null;

  return {
    cmRatio,
    cmPositive,
    primeCostPct: netSales > 0 ? (variableCost / netSales) * 100 : 0,
    breakEvenSales,
    breakEvenPerDay,
    breakEvenPerWeek,
    monthlyBreakEven,
    monthlyNetSales,
    marginOfSafety,
    dollarsAboveBreakEven,
    targetBreakEvenSales,
    // Health on the cushion between actual sales and break-even.
    health: cmPositive ? bandMarginOfSafety(marginOfSafety) : "red",
  };
}

// Defaults mirror DEFAULT_TAPS / TapSettings defaults.
const DEFAULT_COGS_FOOD_PCT = 18;
const DEFAULT_COGS_LIQUOR_PCT = 12;
const DEFAULT_LABOR_PCT = 32;

const COGS_BUCKETS = new Set(["COGS_FOOD", "COGS_LIQUOR", "COGS_BEVERAGE"]);

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Monday (UTC) of the week containing `d`. */
function weekStartUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

const empty = (periodLabel = ""): BreakEvenData => ({
  periodLabel,
  days: 0,
  weeks: [],
  netSales: 0,
  cogs: 0,
  laborCost: 0,
  variableCost: 0,
  fixedOpex: 0,
  debtService: 0,
  fixedCost: 0,
  cmRatio: 0,
  primeCostPct: 0,
  cmPositive: false,
  breakEvenSales: null,
  breakEvenPerDay: null,
  breakEvenPerWeek: null,
  monthlyBreakEven: null,
  monthlyNetSales: 0,
  marginOfSafety: 0,
  dollarsAboveBreakEven: 0,
  fixedCostLines: [],
  targetCmRatio: 0,
  targetBreakEvenSales: null,
  health: "red",
  hasData: false,
});

export async function loadBreakEven(restaurantId: string, weeks = 8): Promise<BreakEvenData> {
  // TAP cost targets → the "if you hit plan" contribution-margin reference.
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { tapSettings: { select: { cogsFoodPct: true, cogsLiquorPct: true, laborPct: true } } },
  });
  const targetVariablePct = restaurant?.tapSettings
    ? n(restaurant.tapSettings.cogsFoodPct) + n(restaurant.tapSettings.cogsLiquorPct) + n(restaurant.tapSettings.laborPct)
    : DEFAULT_COGS_FOOD_PCT + DEFAULT_COGS_LIQUOR_PCT + DEFAULT_LABOR_PCT;
  const targetCmRatio = Math.max(0, 1 - targetVariablePct / 100);

  // Window anchors on the latest day with sales data.
  const latestRow = await prisma.dailySales.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latestRow) return empty();

  const end = latestRow.date;
  const currentWeekStart = weekStartUTC(end);
  const windowStart = new Date(currentWeekStart);
  windowStart.setUTCDate(windowStart.getUTCDate() - 7 * (weeks - 1));

  const salesRows = await prisma.dailySales.findMany({
    where: { restaurantId, date: { gte: windowStart, lte: end } },
    orderBy: { date: "asc" },
    select: { date: true, netSales: true, laborCost: true },
  });

  // Categorized transactions → COGS (variable), OPEX + debt service (fixed).
  // Canonical signal is Category.tapBucket (consistent with Prime Cost / Spending).
  const cats = await prisma.category.findMany({
    where: { restaurantId },
    select: { id: true, name: true, tapBucket: true },
  });
  const catMeta = new Map(cats.map((c) => [c.id, { name: c.name, tap: c.tapBucket as string }]));
  const txns = await prisma.transaction.findMany({
    where: { restaurantId, date: { gte: windowStart, lte: end } },
    select: { date: true, categoryId: true, amount: true },
  });

  interface Bucket {
    netSales: number;
    laborCost: number;
    cogs: number;
    fixed: number;
    days: number;
  }
  const mk = (): Bucket => ({ netSales: 0, laborCost: 0, cogs: 0, fixed: 0, days: 0 });
  const buckets = new Map<string, Bucket>();
  const keyOf = (d: Date) => weekStartUTC(d).toISOString().slice(0, 10);

  for (const r of salesRows) {
    const k = keyOf(r.date);
    const b = buckets.get(k) ?? mk();
    b.netSales += n(r.netSales);
    b.laborCost += n(r.laborCost);
    b.days += 1;
    buckets.set(k, b);
  }

  // Fixed-cost anatomy by category name, plus window totals.
  const fixedAgg = new Map<string, { amount: number; kind: "opex" | "debt" }>();
  let fixedOpex = 0;
  let debtService = 0;

  for (const t of txns) {
    const tap = t.categoryId ? catMeta.get(t.categoryId)?.tap : undefined;
    if (!tap) continue;
    const amt = n(t.amount);
    // Outflows are stored positive; ignore the occasional refund/credit (amt < 0)
    // so a return doesn't read as negative fixed cost.
    if (amt <= 0) continue;
    const k = keyOf(t.date);

    if (COGS_BUCKETS.has(tap)) {
      const b = buckets.get(k) ?? mk();
      b.cogs += amt;
      buckets.set(k, b);
    } else if (tap === "OPEX" || tap === "PROFIT") {
      const b = buckets.get(k) ?? mk();
      b.fixed += amt;
      buckets.set(k, b);
      const isDebt = tap === "PROFIT";
      const name = isDebt ? "Debt Service" : catMeta.get(t.categoryId!)?.name ?? "Other Operating";
      const line = fixedAgg.get(name) ?? { amount: 0, kind: isDebt ? "debt" : "opex" };
      line.amount += amt;
      fixedAgg.set(name, line);
      if (isDebt) debtService += amt;
      else fixedOpex += amt;
    }
  }

  const days = salesRows.length;
  const weekList: BreakEvenWeek[] = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekStart, b]) => {
      const variableCost = b.cogs + b.laborCost;
      return {
        weekStart,
        netSales: b.netSales,
        variableCost,
        fixedCost: b.fixed,
        cmRatio: b.netSales > 0 ? (b.netSales - variableCost) / b.netSales : 0,
        days: b.days,
        partial: b.days < 7,
      };
    });

  // Window totals.
  const totals = [...buckets.values()].reduce(
    (acc, b) => {
      acc.netSales += b.netSales;
      acc.laborCost += b.laborCost;
      acc.cogs += b.cogs;
      return acc;
    },
    { netSales: 0, laborCost: 0, cogs: 0 },
  );
  const netSales = totals.netSales;
  const variableCost = totals.cogs + totals.laborCost;
  const fixedCost = fixedOpex + debtService;

  const derived = computeBreakEven({ netSales, variableCost, fixedCost, days, targetCmRatio });

  const fixedCostLines = [...fixedAgg.entries()]
    .map(([name, v]) => ({ name, amount: v.amount, kind: v.kind }))
    .sort((a, b) => b.amount - a.amount);

  return {
    periodLabel: `${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`,
    days,
    weeks: weekList,
    netSales,
    cogs: totals.cogs,
    laborCost: totals.laborCost,
    variableCost,
    fixedOpex,
    debtService,
    fixedCost,
    cmRatio: derived.cmRatio,
    primeCostPct: derived.primeCostPct,
    cmPositive: derived.cmPositive,
    breakEvenSales: derived.breakEvenSales,
    breakEvenPerDay: derived.breakEvenPerDay,
    breakEvenPerWeek: derived.breakEvenPerWeek,
    monthlyBreakEven: derived.monthlyBreakEven,
    monthlyNetSales: derived.monthlyNetSales,
    marginOfSafety: derived.marginOfSafety,
    dollarsAboveBreakEven: derived.dollarsAboveBreakEven,
    fixedCostLines,
    targetCmRatio,
    targetBreakEvenSales: derived.targetBreakEvenSales,
    health: derived.health,
    hasData: netSales > 0,
  };
}
