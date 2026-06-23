import type { Health } from "@/lib/demo/estimate";

const WEEKS_PER_MONTH = 4.33;
const PF_PROFIT_PCT = 5;
const PF_OWNER_PAY_PCT = 10;
const PF_TAX_PCT = 8;

export interface ServiceEstimateInputs {
  name: string;
  market: string;
  weeklyRevenue: number;
  weeklyLabor: number;
  weeklyMaterials: number;
  weeklySubcontractors: number;
  monthlyFixedBills: number;
  avgJobValue?: number | null;
  jobsPerWeek?: number | null;
}

export interface ServicePfLine {
  key: string;
  label: string;
  pct: number;
  amount: number;
}

export interface ServiceEstimateResult {
  monthlyRevenue: number;
  weeklyRevenue: number;
  monthlyLabor: number;
  monthlyMaterials: number;
  monthlySubcontractors: number;
  monthlyFixedBills: number;
  deliveryCost: number;
  deliveryPressurePct: number;
  grossMarginPct: number;
  netProfit: number;
  netMarginPct: number;
  monthlyBreakEven: number;
  weeklyBreakEven: number;
  dollarsAboveBreakEven: number;
  marginOfSafetyPct: number;
  cashIn: number;
  cashOut: number;
  cashLeft: number;
  avgJobValue: number | null;
  jobsPerWeek: number | null;
  breakEvenJobsPerWeek: number | null;
  deliveryHealth: Health;
  marginHealth: Health;
  breakEvenHealth: Health;
  pf: ServicePfLine[];
}

const healthLower = (value: number, green: number, yellow: number): Health =>
  value <= green ? "green" : value <= yellow ? "yellow" : "red";

const healthHigher = (value: number, green: number, yellow: number): Health =>
  value >= green ? "green" : value >= yellow ? "yellow" : "red";

export function computeServiceEstimate(input: ServiceEstimateInputs): ServiceEstimateResult {
  const weeklyRevenue = Math.max(0, input.weeklyRevenue);
  const monthlyRevenue = weeklyRevenue * WEEKS_PER_MONTH;
  const monthlyLabor = Math.max(0, input.weeklyLabor) * WEEKS_PER_MONTH;
  const monthlyMaterials = Math.max(0, input.weeklyMaterials) * WEEKS_PER_MONTH;
  const monthlySubcontractors = Math.max(0, input.weeklySubcontractors) * WEEKS_PER_MONTH;
  const monthlyFixedBills = Math.max(0, input.monthlyFixedBills);

  const deliveryCost = monthlyLabor + monthlyMaterials + monthlySubcontractors;
  const deliveryPressurePct = monthlyRevenue > 0 ? (deliveryCost / monthlyRevenue) * 100 : 0;
  const grossMarginPct = monthlyRevenue > 0 ? ((monthlyRevenue - deliveryCost) / monthlyRevenue) * 100 : 0;
  const monthlyBreakEven = deliveryCost + monthlyFixedBills;
  const weeklyBreakEven = monthlyBreakEven / WEEKS_PER_MONTH;
  const dollarsAboveBreakEven = monthlyRevenue - monthlyBreakEven;
  const marginOfSafetyPct = monthlyRevenue > 0 ? (dollarsAboveBreakEven / monthlyRevenue) * 100 : -100;
  const netProfit = dollarsAboveBreakEven;
  const netMarginPct = monthlyRevenue > 0 ? (netProfit / monthlyRevenue) * 100 : 0;
  const cashIn = monthlyRevenue;
  const cashOut = monthlyBreakEven;
  const cashLeft = cashIn - cashOut;
  const avgJobValue = input.avgJobValue && input.avgJobValue > 0 ? input.avgJobValue : null;
  const jobsPerWeek = input.jobsPerWeek && input.jobsPerWeek > 0 ? input.jobsPerWeek : null;
  const breakEvenJobsPerWeek = avgJobValue ? weeklyBreakEven / avgJobValue : null;

  return {
    monthlyRevenue,
    weeklyRevenue,
    monthlyLabor,
    monthlyMaterials,
    monthlySubcontractors,
    monthlyFixedBills,
    deliveryCost,
    deliveryPressurePct,
    grossMarginPct,
    netProfit,
    netMarginPct,
    monthlyBreakEven,
    weeklyBreakEven,
    dollarsAboveBreakEven,
    marginOfSafetyPct,
    cashIn,
    cashOut,
    cashLeft,
    avgJobValue,
    jobsPerWeek,
    breakEvenJobsPerWeek,
    deliveryHealth: healthLower(deliveryPressurePct, 60, 70),
    marginHealth: healthHigher(netMarginPct, 12, 5),
    breakEvenHealth: healthHigher(marginOfSafetyPct, 20, 10),
    pf: [
      { key: "profit", label: "Profit", pct: PF_PROFIT_PCT, amount: (monthlyRevenue * PF_PROFIT_PCT) / 100 },
      { key: "owner", label: "Owner Pay", pct: PF_OWNER_PAY_PCT, amount: (monthlyRevenue * PF_OWNER_PAY_PCT) / 100 },
      { key: "tax", label: "Tax Reserve", pct: PF_TAX_PCT, amount: (monthlyRevenue * PF_TAX_PCT) / 100 },
    ],
  };
}
