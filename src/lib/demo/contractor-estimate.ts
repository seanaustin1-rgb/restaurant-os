// Contractor / field-service Instant-Estimate compute core (public demo).
//
// Pure + client-safe. A contractor doesn't live in a restaurant P&L — they live
// in JOB MARGIN, whether work is BOOKED (backlog), and when they GET PAID (cash
// gap). So the read leads with those, not a generic break-even, and names the
// single biggest lever to pull.
//
// Honesty contract: per-job profitability, change-order leakage, and WIP/over-
// under billing need job-level data and stay LOCKED (see CONTRACTOR_LOCKED_TILES).

import type { Health } from "@/lib/demo/estimate";

const WEEKS_PER_MONTH = 4.33;
const PF_PROFIT_PCT = 5;
const PF_OWNER_PAY_PCT = 10;
const PF_TAX_PCT = 8;
const PF_RESERVE_PCT = 5; // equipment / warranty reserve — trucks, tools, callbacks

export type ContractorSoftware = "jobber" | "servicetitan" | "buildertrend" | "housecall" | "quickbooks" | "spreadsheet" | "other";

export interface ContractorEstimateInputs {
  name: string;
  market: string;
  software: ContractorSoftware;
  // Core job economics (revenue + the three job-cost levers)
  monthlyRevenue: number;
  materials: number;
  fieldLabor: number;
  subcontractors?: number | null;
  // Overhead (recovered before profit)
  monthlyOverhead?: number | null; // office, trucks, equipment, insurance, admin, software
  // Backlog (powers "weeks of work booked")
  backlog?: number | null; // signed/awarded backlog $
  monthlyCapacity?: number | null; // $ of work the crews can produce / month
  // Receivables (powers the cash gap)
  openReceivables?: number | null;
  receivablesOver30?: number | null;
}

export interface ContractorPfLine {
  key: string;
  label: string;
  pct: number;
  amount: number;
}

export interface ContractorBenchRow {
  key: string;
  label: string;
  value: number;
  typicalLow: number;
  typicalHigh: number;
  status: Health;
  note: string;
  scaleMax: number;
  lowerIsBetter: boolean;
  greenEdge: number;
  yellowEdge: number;
}

export interface BiggestLever {
  title: string;
  detail: string;
  tone: Health;
}

export interface ContractorEstimateResult {
  monthlyRevenue: number;
  materials: number;
  fieldLabor: number;
  subcontractors: number;
  jobCost: number;
  overhead: number;
  // Margin
  jobMarginPct: number;
  jobCostPct: number;
  materialsPct: number;
  laborPct: number;
  subsPct: number;
  netProfit: number;
  netMarginPct: number;
  jobMarginHealth: Health;
  // Overhead recovery / break-even
  monthlyBreakEven: number | null;
  marginOfSafetyPct: number;
  breakEvenHealth: Health;
  // Backlog coverage
  hasBacklog: boolean;
  backlogWeeks: number | null;
  backlogHealth: Health;
  // Cash gap
  hasReceivables: boolean;
  openReceivables: number;
  receivablesOver30: number;
  daysToCash: number | null;
  cashGapHealth: Health;
  // The single biggest lever
  biggestLever: BiggestLever;
  // Profit First + cash flow
  pf: ContractorPfLine[];
  cashIn: number;
  cashOut: number;
  cashLeft: number;
  // Benchmarks
  bench: ContractorBenchRow[];
  benchOverall: Health;
  benchGreenCount: number;
  // Source pipe
  software: ContractorSoftware;
  softwareLabel: string;
  softwareNote: string;
}

const SOFTWARE_LABELS: Record<ContractorSoftware, string> = {
  jobber: "Jobber",
  servicetitan: "ServiceTitan",
  buildertrend: "Buildertrend",
  housecall: "Housecall Pro",
  quickbooks: "QuickBooks",
  spreadsheet: "Spreadsheet / none",
  other: "Other field software",
};

const SOFTWARE_NOTES: Record<ContractorSoftware, string> = {
  jobber: "Good for jobs, quotes, invoices, and scheduling; pair with accounting for true job costing.",
  servicetitan: "Deep field source: jobs, dispatch, invoices, memberships, and payroll roll in richly.",
  buildertrend: "Strong for project builders: budgets, change orders, POs, and selections export well.",
  housecall: "Useful for service jobs, estimates, and payments; add accounting for the cost side.",
  quickbooks: "Bank + accounting backbone — job costing, AR aging, and overhead come straight from here.",
  spreadsheet: "Start with revenue, job costs, and an AR list; field software later automates job-level detail.",
  other: "Begin with jobs, costs, invoices, and receivables; most field platforms export these.",
};

export const CONTRACTOR_LOCKED_TILES: { key: string; label: string; needs: string }[] = [
  { key: "per-job", label: "Per-Job Profitability", needs: "job-level cost + revenue" },
  { key: "change-orders", label: "Change-Order Leakage", needs: "approved vs. billed COs" },
  { key: "wip", label: "WIP / Over-Under Billing", needs: "percent-complete data" },
  { key: "labor-hours", label: "Labor Hours & Utilization", needs: "time-clock / shift data" },
  { key: "ar-aging", label: "AR Aging by Customer", needs: "invoice-level aging" },
  { key: "equipment", label: "Equipment Cost Recovery", needs: "asset + usage data" },
];

const bandHigher = (v: number, green: number, yellow: number): Health => (v >= green ? "green" : v >= yellow ? "yellow" : "red");
const bandLower = (v: number, green: number, yellow: number): Health => (v <= green ? "green" : v <= yellow ? "yellow" : "red");
const rank: Record<Health, number> = { green: 0, yellow: 1, red: 2 };

const money0 = (n: number) => `$${Math.round(n).toLocaleString()}`;

function marginNote(value: number, status: Health): string {
  if (status === "green") return "healthy job margin vs. peers";
  if (status === "yellow") return "thin — margin is getting squeezed";
  return value < 0 ? "jobs are losing money" : "low margin — costs are eating jobs";
}
function lowerNote(value: number, typicalHigh: number, status: Health): string {
  if (status === "green") return "within typical range";
  if (status === "yellow") return `${(value - typicalHigh).toFixed(1)} pts above typical`;
  return `${(value - typicalHigh).toFixed(1)} pts over — high vs. peers`;
}

// The single most actionable pressure, named with the number and the fix.
function pickBiggestLever(r: {
  materialsPct: number; laborPct: number; jobMarginPct: number;
  daysToCash: number | null; openReceivables: number; receivablesOver30: number;
  backlogWeeks: number | null;
}): BiggestLever {
  const issues: { sev: number; lever: BiggestLever }[] = [];
  if (r.daysToCash != null && r.daysToCash > 45) {
    issues.push({ sev: 3, lever: { title: "Cash is stuck in receivables", tone: "red", detail: `${money0(r.openReceivables)} outstanding (~${Math.round(r.daysToCash)} days to cash${r.receivablesOver30 > 0 ? `, ${money0(r.receivablesOver30)} past 30` : ""}). Tighten billing and collections — that's your cash crunch.` } });
  }
  if (r.jobMarginPct < 20) {
    issues.push({ sev: 3, lever: { title: "Job margin is too thin", tone: "red", detail: `Jobs clear only ${r.jobMarginPct.toFixed(0)}% after materials, labor, and subs. Re-price or tighten estimates before overhead even gets covered.` } });
  }
  if (r.materialsPct > 35) {
    issues.push({ sev: 2, lever: { title: "Materials are heavy", tone: r.materialsPct > 42 ? "red" : "yellow", detail: `Materials run ${r.materialsPct.toFixed(0)}% of revenue (typically ≤30%). Markups or buying are where the margin is leaking.` } });
  }
  if (r.laborPct > 35) {
    issues.push({ sev: 2, lever: { title: "Field labor is heavy", tone: r.laborPct > 42 ? "red" : "yellow", detail: `Labor runs ${r.laborPct.toFixed(0)}% of revenue (typically ≤30%). Crew productivity or rates are compressing the job.` } });
  }
  if (r.backlogWeeks != null && r.backlogWeeks < 4) {
    issues.push({ sev: 2, lever: { title: "Backlog is thin", tone: r.backlogWeeks < 2 ? "red" : "yellow", detail: `Only ${r.backlogWeeks.toFixed(1)} weeks of work booked. The pipeline needs attention before crews idle.` } });
  }
  if (!issues.length) {
    return { title: "Margins and cash look balanced", tone: "green", detail: "Nothing is screaming. Protect the backlog and watch for materials creep on the next few bids." };
  }
  issues.sort((a, b) => b.sev - a.sev);
  return issues[0].lever;
}

export function computeContractorEstimate(input: ContractorEstimateInputs): ContractorEstimateResult {
  const monthlyRevenue = Math.max(0, input.monthlyRevenue);
  const materials = Math.max(0, input.materials);
  const fieldLabor = Math.max(0, input.fieldLabor);
  const subcontractors = Math.max(0, input.subcontractors ?? 0);
  const overhead = Math.max(0, input.monthlyOverhead ?? 0);
  const jobCost = materials + fieldLabor + subcontractors;

  const jobMarginPct = monthlyRevenue > 0 ? ((monthlyRevenue - jobCost) / monthlyRevenue) * 100 : 0;
  const jobCostPct = monthlyRevenue > 0 ? (jobCost / monthlyRevenue) * 100 : 0;
  const materialsPct = monthlyRevenue > 0 ? (materials / monthlyRevenue) * 100 : 0;
  const laborPct = monthlyRevenue > 0 ? (fieldLabor / monthlyRevenue) * 100 : 0;
  const subsPct = monthlyRevenue > 0 ? (subcontractors / monthlyRevenue) * 100 : 0;
  const netProfit = monthlyRevenue - jobCost - overhead;
  const netMarginPct = monthlyRevenue > 0 ? (netProfit / monthlyRevenue) * 100 : 0;

  // Overhead recovery: revenue needed for job margin to cover overhead.
  const marginRatio = monthlyRevenue > 0 ? (monthlyRevenue - jobCost) / monthlyRevenue : 0;
  const monthlyBreakEven = marginRatio > 0 ? overhead / marginRatio : null;
  const marginOfSafetyPct = monthlyRevenue > 0 && monthlyBreakEven != null ? ((monthlyRevenue - monthlyBreakEven) / monthlyRevenue) * 100 : -100;

  // Backlog coverage.
  const weeklyCapacity = (input.monthlyCapacity && input.monthlyCapacity > 0 ? input.monthlyCapacity : monthlyRevenue) / WEEKS_PER_MONTH;
  const hasBacklog = input.backlog != null && input.backlog > 0;
  const backlogWeeks = hasBacklog && weeklyCapacity > 0 ? input.backlog! / weeklyCapacity : null;
  const backlogHealth: Health = backlogWeeks == null ? "yellow" : backlogWeeks >= 8 ? "green" : backlogWeeks >= 4 ? "yellow" : "red";

  // Cash gap (days sales outstanding from AR).
  const hasReceivables = input.openReceivables != null && input.openReceivables > 0;
  const openReceivables = Math.max(0, input.openReceivables ?? 0);
  const receivablesOver30 = Math.max(0, input.receivablesOver30 ?? 0);
  const daysToCash = hasReceivables && monthlyRevenue > 0 ? (openReceivables / monthlyRevenue) * 30.44 : null;
  const cashGapHealth: Health = daysToCash == null ? "yellow" : daysToCash <= 30 ? "green" : daysToCash <= 45 ? "yellow" : "red";

  const jobMarginHealth = bandHigher(jobMarginPct, 35, 25);
  const breakEvenHealth = bandHigher(marginOfSafetyPct, 20, 10);

  const biggestLever = pickBiggestLever({ materialsPct, laborPct, jobMarginPct, daysToCash, openReceivables, receivablesOver30, backlogWeeks });

  const pf: ContractorPfLine[] = [
    { key: "profit", label: "Profit", pct: PF_PROFIT_PCT, amount: (monthlyRevenue * PF_PROFIT_PCT) / 100 },
    { key: "owner", label: "Owner Pay", pct: PF_OWNER_PAY_PCT, amount: (monthlyRevenue * PF_OWNER_PAY_PCT) / 100 },
    { key: "tax", label: "Tax Reserve", pct: PF_TAX_PCT, amount: (monthlyRevenue * PF_TAX_PCT) / 100 },
    { key: "reserve", label: "Equipment / Warranty Reserve", pct: PF_RESERVE_PCT, amount: (monthlyRevenue * PF_RESERVE_PCT) / 100 },
  ];

  const cashIn = monthlyRevenue;
  const cashOut = jobCost + overhead;
  const cashLeft = cashIn - cashOut;

  const bench: ContractorBenchRow[] = [
    {
      key: "margin", label: "Job Margin", value: jobMarginPct,
      typicalLow: 30, typicalHigh: 45, status: bandHigher(jobMarginPct, 35, 25),
      scaleMax: 60, lowerIsBetter: false, greenEdge: 35, yellowEdge: 25,
      note: marginNote(jobMarginPct, bandHigher(jobMarginPct, 35, 25)),
    },
    {
      key: "materials", label: "Materials", value: materialsPct,
      typicalLow: 20, typicalHigh: 30, status: bandLower(materialsPct, 30, 38),
      scaleMax: 60, lowerIsBetter: true, greenEdge: 30, yellowEdge: 38,
      note: lowerNote(materialsPct, 30, bandLower(materialsPct, 30, 38)),
    },
    {
      key: "labor", label: "Field Labor", value: laborPct,
      typicalLow: 22, typicalHigh: 30, status: bandLower(laborPct, 30, 38),
      scaleMax: 60, lowerIsBetter: true, greenEdge: 30, yellowEdge: 38,
      note: lowerNote(laborPct, 30, bandLower(laborPct, 30, 38)),
    },
    {
      key: "net", label: "Net Margin", value: netMarginPct,
      typicalLow: 5, typicalHigh: 12, status: bandHigher(netMarginPct, 10, 5),
      scaleMax: 25, lowerIsBetter: false, greenEdge: 10, yellowEdge: 5,
      note: netMarginPct >= 10 ? "healthy vs. peers" : netMarginPct >= 5 ? "thin — below the healthy band" : netMarginPct < 0 ? "operating at a loss" : "under the healthy band",
    },
  ];
  const benchOverall = bench.reduce<Health>((w, row) => (rank[row.status] > rank[w] ? row.status : w), "green");
  const benchGreenCount = bench.filter((row) => row.status === "green").length;

  return {
    monthlyRevenue, materials, fieldLabor, subcontractors, jobCost, overhead,
    jobMarginPct, jobCostPct, materialsPct, laborPct, subsPct, netProfit, netMarginPct, jobMarginHealth,
    monthlyBreakEven, marginOfSafetyPct, breakEvenHealth,
    hasBacklog, backlogWeeks, backlogHealth,
    hasReceivables, openReceivables, receivablesOver30, daysToCash, cashGapHealth,
    biggestLever,
    pf, cashIn, cashOut, cashLeft,
    bench, benchOverall, benchGreenCount,
    software: input.software, softwareLabel: SOFTWARE_LABELS[input.software], softwareNote: SOFTWARE_NOTES[input.software],
  };
}
