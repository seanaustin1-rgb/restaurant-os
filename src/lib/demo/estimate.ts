// Instant-Estimate compute core (public demo, Mode 2).
//
// Pure + client-safe: takes the handful of numbers a prospect types in (Tier A
// identity + Tier B core economics, with optional Tier C refinements) and
// derives every "lit" tile the demo shows — WITHOUT a database, auth, or any
// network call. It reuses the real Profit First calculator and mirrors the
// break-even / benchmark formulas used elsewhere in the app, so the demo's math
// is the same math the live dashboard runs.
//
// Honesty contract: this estimates the tiles a few averages can legitimately
// drive. Everything that needs transaction-, bank-, or POS-level data is NOT
// faked here — it stays "locked" in the UI. See LOCKED_TILES below.

import { calculatePrimeCost } from "@/lib/profit-first/calculator";

export type Health = "green" | "yellow" | "red";

// Mean Gregorian month, matching break-even.ts run-rate projection.
const DAYS_PER_MONTH = 30.44;

// Profit First "starting targets" — the first dollars Profit First carves out
// before the business spends anything. Illustrative defaults, clearly labelled
// in the UI as starting points (not a prescription).
const PF_PROFIT_PCT = 5;
const PF_OWNER_PAY_PCT = 10;
const PF_TAX_PCT = 8;

// ---- Inputs ----------------------------------------------------------------

export interface EstimateInputs {
  // Tier A — identity (drives the Aura tile; no finances)
  name: string;
  city: string;
  // Tier B — core economics
  monthlySales: number;
  foodPct: number; // COGS (food + beverage) as % of sales
  laborPct: number; // labor as % of sales
  fixedCosts: number; // rent + other fixed monthly costs, $
  // Tier C — optional refinements
  bevSharePct?: number | null; // bar/beverage as % of sales → Sales Mix
  avgCheck?: number | null; // $ → Covers Flow
  seats?: number | null;
  daysOpenPerWeek?: number | null;
}

// ---- Output ----------------------------------------------------------------

export interface BenchRow {
  key: string;
  label: string;
  value: number; // the operator's %, in this metric
  typicalLow: number;
  typicalHigh: number;
  status: Health;
  note: string;
  scaleMax: number;
  lowerIsBetter: boolean;
  greenEdge: number; // axis value where green ends (lower) / starts (higher)
  yellowEdge: number; // axis value where yellow ends (lower) / starts (higher)
}

export interface PfLine {
  key: string;
  label: string;
  pct: number;
  amount: number;
}

export interface EstimateResult {
  // Headline ratios
  foodPct: number;
  laborPct: number;
  primeCostPct: number;
  netMarginPct: number;
  primeHealth: Health;

  // Dollars (monthly)
  monthlySales: number;
  cogs: number;
  labor: number;
  fixedCosts: number;
  estProfit: number; // sales − cogs − labor − fixed (pre-tax, pre-owner)
  realRevenue: number; // sales − cogs (Profit First basis)

  // Benchmarks (you vs. industry)
  bench: BenchRow[];
  benchOverall: Health;
  benchGreenCount: number;

  // Break-even: the sales needed to cover the expense dollars entered in the
  // public demo. Unlike a contribution-margin model, this should not move just
  // because the operator changes sales while leaving spend unchanged.
  cmRatio: number;
  monthlyBreakEven: number | null;
  breakEvenPerDay: number | null;
  marginOfSafety: number; // %
  dollarsAboveBreakEven: number;
  breakEvenHealth: Health;
  daysPerMonth: number;

  // Profit First starting set-asides
  pf: PfLine[];

  // Cash flow (rough monthly)
  cashIn: number;
  cashOut: number;
  cashLeft: number;

  // Optional Tier C tiles (null when the input wasn't provided)
  salesMix: { foodPct: number; bevPct: number; otherPct: number } | null;
  covers: { avgCheck: number; perDay: number; perMonth: number } | null;
}

// ---- Banding (mirrors benchmarks.ts thresholds) ----------------------------

const bandLower = (v: number, green: number, yellow: number): Health =>
  v <= green ? "green" : v <= yellow ? "yellow" : "red";
const bandHigher = (v: number, green: number, yellow: number): Health =>
  v >= green ? "green" : v >= yellow ? "yellow" : "red";

function costNote(value: number, typicalHigh: number, status: Health): string {
  if (status === "green") return value < typicalHigh ? "within typical range" : "right at the line";
  if (status === "yellow") return `${(value - typicalHigh).toFixed(1)} pts above typical`;
  return `${(value - typicalHigh).toFixed(1)} pts over — high vs. peers`;
}
function marginNote(value: number, status: Health): string {
  if (status === "green") return "healthy vs. peers";
  if (status === "yellow") return "thin — below the healthy band";
  return value < 0 ? "operating at a loss" : "under the healthy band";
}

// Margin-of-safety bands, matching break-even.ts.
const bandMos = (mos: number): Health => (mos >= 20 ? "green" : mos >= 10 ? "yellow" : "red");

// ---- The tiles a prospect's averages CANNOT honestly drive ------------------
// Rendered locked in the UI ("connect your bank + POS to unlock").

export const LOCKED_TILES: { key: string; label: string; needs: string }[] = [
  { key: "vendor-spend", label: "Vendor Spend", needs: "per-vendor transactions" },
  { key: "recurring", label: "Recurring Vendors", needs: "transaction history" },
  { key: "payment-watch", label: "Payment Watch", needs: "transaction-level detection" },
  { key: "processing-fees", label: "Processing Fees", needs: "payment-processor data" },
  { key: "category-trends", label: "Category Trends", needs: "multi-month history" },
  { key: "cash-runway", label: "Cash Runway", needs: "live bank balances" },
  { key: "tax-vault", label: "Tax Vault", needs: "daily sales-tax accrual" },
  { key: "menu-engineering", label: "Menu Engineering", needs: "item-level POS data" },
  { key: "labor-hours", label: "Labor Hours", needs: "shift / hours data" },
];

const rank: Record<Health, number> = { green: 0, yellow: 1, red: 2 };

export function computeEstimate(input: EstimateInputs): EstimateResult {
  const monthlySales = Math.max(0, input.monthlySales);
  const foodPct = Math.max(0, input.foodPct);
  const laborPct = Math.max(0, input.laborPct);
  const fixedCosts = Math.max(0, input.fixedCosts);

  const cogs = (monthlySales * foodPct) / 100;
  const labor = (monthlySales * laborPct) / 100;
  const primeCostPct = calculatePrimeCost(cogs, 0, labor, monthlySales); // = foodPct + laborPct
  const realRevenue = monthlySales - cogs;
  const estProfit = monthlySales - cogs - labor - fixedCosts;
  const netMarginPct = monthlySales > 0 ? (estProfit / monthlySales) * 100 : 0;

  // Benchmarks — same reference ranges as benchmarks.ts.
  const bench: BenchRow[] = [
    {
      key: "prime", label: "Prime Cost", value: primeCostPct,
      typicalLow: 55, typicalHigh: 60, status: bandLower(primeCostPct, 60, 65),
      scaleMax: 85, lowerIsBetter: true, greenEdge: 60, yellowEdge: 65,
      note: costNote(primeCostPct, 60, bandLower(primeCostPct, 60, 65)),
    },
    {
      key: "cogs", label: "Food + bev COGS", value: foodPct,
      typicalLow: 28, typicalHigh: 32, status: bandLower(foodPct, 32, 35),
      scaleMax: 50, lowerIsBetter: true, greenEdge: 32, yellowEdge: 35,
      note: costNote(foodPct, 32, bandLower(foodPct, 32, 35)),
    },
    {
      key: "labor", label: "Labor", value: laborPct,
      typicalLow: 28, typicalHigh: 34, status: bandLower(laborPct, 34, 36),
      scaleMax: 50, lowerIsBetter: true, greenEdge: 34, yellowEdge: 36,
      note: costNote(laborPct, 34, bandLower(laborPct, 34, 36)),
    },
    {
      key: "margin", label: "Net Margin", value: netMarginPct,
      typicalLow: 3, typicalHigh: 9, status: bandHigher(netMarginPct, 6, 3),
      scaleMax: 20, lowerIsBetter: false, greenEdge: 6, yellowEdge: 3,
      note: marginNote(netMarginPct, bandHigher(netMarginPct, 6, 3)),
    },
  ];
  const benchOverall = bench.reduce<Health>((w, r) => (rank[r.status] > rank[w] ? r.status : w), "green");
  const benchGreenCount = bench.filter((r) => r.status === "green").length;

  // Break-even (monthly basis). The public demo accepts rough spend as dollars,
  // so the useful "profit starts here" number is total entered expenses:
  // food/bev + labor + fixed bills. The contribution margin ratio is still kept
  // as "left after prime cost" context, but it should not drive this threshold.
  const daysPerWeek = input.daysOpenPerWeek && input.daysOpenPerWeek > 0 ? input.daysOpenPerWeek : 7;
  const daysPerMonth = (daysPerWeek / 7) * DAYS_PER_MONTH;
  const variableCost = cogs + labor;
  const cmRatio = monthlySales > 0 ? (monthlySales - variableCost) / monthlySales : 0;
  const monthlyBreakEven = variableCost + fixedCosts;
  const breakEvenPerDay = daysPerMonth > 0 ? monthlyBreakEven / daysPerMonth : null;
  const dollarsAboveBreakEven = monthlySales - monthlyBreakEven;
  const marginOfSafety =
    monthlySales > 0 ? ((monthlySales - monthlyBreakEven) / monthlySales) * 100 : -100;
  const breakEvenHealth: Health = bandMos(marginOfSafety);

  // Profit First starting set-asides (off total sales).
  const pf: PfLine[] = [
    { key: "profit", label: "Profit", pct: PF_PROFIT_PCT, amount: (monthlySales * PF_PROFIT_PCT) / 100 },
    { key: "owner", label: "Owner Pay", pct: PF_OWNER_PAY_PCT, amount: (monthlySales * PF_OWNER_PAY_PCT) / 100 },
    { key: "tax", label: "Tax Reserve", pct: PF_TAX_PCT, amount: (monthlySales * PF_TAX_PCT) / 100 },
  ];

  // Cash flow (rough monthly): everything in vs. everything out.
  const cashIn = monthlySales;
  const cashOut = cogs + labor + fixedCosts;
  const cashLeft = cashIn - cashOut;

  // Optional Tier C.
  const salesMix =
    input.bevSharePct != null && input.bevSharePct >= 0
      ? (() => {
          const bevPct = Math.min(100, input.bevSharePct!);
          return { foodPct: Math.max(0, 100 - bevPct), bevPct, otherPct: 0 };
        })()
      : null;

  const covers =
    input.avgCheck != null && input.avgCheck > 0
      ? (() => {
          const perMonth = monthlySales / input.avgCheck!;
          return { avgCheck: input.avgCheck!, perMonth, perDay: perMonth / daysPerMonth };
        })()
      : null;

  return {
    foodPct, laborPct, primeCostPct, netMarginPct, primeHealth: bandLower(primeCostPct, 60, 65),
    monthlySales, cogs, labor, fixedCosts, estProfit, realRevenue,
    bench, benchOverall, benchGreenCount,
    cmRatio, monthlyBreakEven, breakEvenPerDay, marginOfSafety, dollarsAboveBreakEven, breakEvenHealth, daysPerMonth,
    pf,
    cashIn, cashOut, cashLeft,
    salesMix, covers,
  };
}
