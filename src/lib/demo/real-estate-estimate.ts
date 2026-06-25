import type { Health } from "./estimate";

const MONTHS_PER_YEAR = 12;

const PF_PROFIT_PCT = 5;
const PF_OWNER_PAY_PCT = 35;
const PF_TAX_PCT = 15;

export type RealEstateSoftware = "followupboss" | "boldtrail" | "sierra" | "lofty" | "brokermint" | "quickbooks" | "spreadsheet" | "other";

const SOFTWARE_LABELS: Record<RealEstateSoftware, string> = {
  followupboss: "Follow Up Boss",
  boldtrail: "BoldTrail / kvCORE",
  sierra: "Sierra Interactive",
  lofty: "Lofty (Chime)",
  brokermint: "Brokermint",
  quickbooks: "QuickBooks",
  spreadsheet: "Spreadsheet / none",
  other: "Other CRM / back office",
};

const SOFTWARE_NOTES: Record<RealEstateSoftware, string> = {
  followupboss: "Strong for pipeline and agent activity; pair with accounting + a back office for splits and Company Dollar.",
  boldtrail: "Lead-to-close pipeline and agent production; add back-office data for caps, splits, and fees.",
  sierra: "Good for lead gen and pipeline velocity; connect accounting for the money side.",
  lofty: "Pipeline, marketing, and agent activity; add a back office for commission disbursement detail.",
  brokermint: "Back-office source: commission disbursements, splits, caps, fees, and agent ledgers roll in cleanly.",
  quickbooks: "Accounting backbone — GCI, OpEx, and Company Dollar come straight from here.",
  spreadsheet: "Start with GCI, splits, fees, and OpEx; a back office later automates agent-level economics.",
  other: "Begin with closed GCI, splits, franchise/referral fees, and brokerage OpEx; most platforms export these.",
};

export interface RealEstateEstimateInputs {
  name: string;
  market: string;
  software: RealEstateSoftware;
  monthlyGci: number;
  agentSplitPct: number;
  franchiseFeePct: number;
  referralFeePct: number;
  monthlyOpex: number;
  currentCash: number;
  pendingDeals: number;
  avgSalePrice: number;
  avgCommissionPct: number;
  expectedCloseRatePct: number;
  avgBrokerageSharePct: number;
  daysToClose: number;
}

export interface RealEstatePfLine {
  key: string;
  label: string;
  pct: number;
  amount: number;
}

export interface RealEstateEstimateResult {
  monthlyGci: number;
  agentPayouts: number;
  franchiseFees: number;
  referralFees: number;
  passThrough: number;
  splitPressurePct: number;
  splitPressureHealth: Health;
  companyDollar: number;
  companyDollarPct: number;
  companyDollarHealth: Health;
  monthlyOpex: number;
  profitBeforeOwnerTax: number;
  breakEvenCompanyDollar: number;
  gciNeededToBreakEven: number | null;
  breakEvenCushion: number;
  breakEvenHealth: Health;
  currentCash: number;
  cashRunwayDays: number | null;
  cashRunwayHealth: Health;
  expectedPipelineGci: number;
  weightedPipelineGci: number;
  expectedPipelineCompanyDollar: number;
  pipelineMonths: number;
  pipelineHealth: Health;
  pf: RealEstatePfLine[];
  software: RealEstateSoftware;
  softwareLabel: string;
  softwareNote: string;
}

const clampPct = (value: number): number => Math.max(0, Math.min(100, value));
const nonNegative = (value: number): number => Math.max(0, Number.isFinite(value) ? value : 0);

function bandLower(value: number, green: number, yellow: number): Health {
  if (value <= green) return "green";
  if (value <= yellow) return "yellow";
  return "red";
}

function bandHigher(value: number, green: number, yellow: number): Health {
  if (value >= green) return "green";
  if (value >= yellow) return "yellow";
  return "red";
}

export function computeRealEstateEstimate(input: RealEstateEstimateInputs): RealEstateEstimateResult {
  const monthlyGci = nonNegative(input.monthlyGci);
  const agentSplitPct = clampPct(input.agentSplitPct);
  const franchiseFeePct = clampPct(input.franchiseFeePct);
  const referralFeePct = clampPct(input.referralFeePct);
  const monthlyOpex = nonNegative(input.monthlyOpex);
  const currentCash = nonNegative(input.currentCash);
  const pendingDeals = nonNegative(input.pendingDeals);
  const avgSalePrice = nonNegative(input.avgSalePrice);
  const avgCommissionPct = clampPct(input.avgCommissionPct);
  const expectedCloseRatePct = clampPct(input.expectedCloseRatePct);
  const avgBrokerageSharePct = clampPct(input.avgBrokerageSharePct);
  const daysToClose = Math.max(1, nonNegative(input.daysToClose) || 60);

  const agentPayouts = (monthlyGci * agentSplitPct) / 100;
  const franchiseFees = (monthlyGci * franchiseFeePct) / 100;
  const referralFees = (monthlyGci * referralFeePct) / 100;
  const passThrough = agentPayouts + franchiseFees + referralFees;
  const splitPressurePct = monthlyGci > 0 ? (passThrough / monthlyGci) * 100 : 0;
  const companyDollar = Math.max(0, monthlyGci - passThrough);
  const companyDollarPct = monthlyGci > 0 ? (companyDollar / monthlyGci) * 100 : 0;
  const profitBeforeOwnerTax = companyDollar - monthlyOpex;

  const retainedShare = companyDollarPct / 100;
  const breakEvenCompanyDollar = monthlyOpex;
  const gciNeededToBreakEven = retainedShare > 0 ? breakEvenCompanyDollar / retainedShare : null;
  const breakEvenCushion = companyDollar - breakEvenCompanyDollar;

  const dailyBurn = monthlyOpex / 30.44;
  const cashRunwayDays = dailyBurn > 0 ? currentCash / dailyBurn : null;

  const avgDealGci = avgSalePrice * (avgCommissionPct / 100);
  const expectedPipelineGci = pendingDeals * avgDealGci;
  const weightedPipelineGci = expectedPipelineGci * (expectedCloseRatePct / 100);
  const expectedPipelineCompanyDollar = weightedPipelineGci * (avgBrokerageSharePct / 100);
  const pipelineMonths = (daysToClose / 365) * MONTHS_PER_YEAR;
  const monthlyPipelineCompanyDollar = pipelineMonths > 0 ? expectedPipelineCompanyDollar / pipelineMonths : 0;

  const pfBasis = companyDollar;
  const pf: RealEstatePfLine[] = [
    { key: "profit", label: "Profit Reserve", pct: PF_PROFIT_PCT, amount: (pfBasis * PF_PROFIT_PCT) / 100 },
    { key: "owner", label: "Owner Pay", pct: PF_OWNER_PAY_PCT, amount: (pfBasis * PF_OWNER_PAY_PCT) / 100 },
    { key: "tax", label: "Tax Reserve", pct: PF_TAX_PCT, amount: (pfBasis * PF_TAX_PCT) / 100 },
  ];

  return {
    monthlyGci,
    agentPayouts,
    franchiseFees,
    referralFees,
    passThrough,
    splitPressurePct,
    splitPressureHealth: bandLower(splitPressurePct, 75, 82),
    companyDollar,
    companyDollarPct,
    companyDollarHealth: bandHigher(companyDollarPct, 25, 18),
    monthlyOpex,
    profitBeforeOwnerTax,
    breakEvenCompanyDollar,
    gciNeededToBreakEven,
    breakEvenCushion,
    breakEvenHealth: bandHigher(breakEvenCushion, monthlyOpex * 0.2, 0),
    currentCash,
    cashRunwayDays,
    cashRunwayHealth: cashRunwayDays == null ? "green" : bandHigher(cashRunwayDays, 60, 30),
    expectedPipelineGci,
    weightedPipelineGci,
    expectedPipelineCompanyDollar,
    pipelineMonths,
    pipelineHealth: bandHigher(monthlyPipelineCompanyDollar, monthlyOpex, monthlyOpex * 0.6),
    pf,
    software: input.software,
    softwareLabel: SOFTWARE_LABELS[input.software],
    softwareNote: SOFTWARE_NOTES[input.software],
  };
}
