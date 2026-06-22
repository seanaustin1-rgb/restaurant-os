import type { Health } from "./estimate";

export interface AgentPerformanceInput {
  name: string;
  closedGci: number;
  agentSplitPct: number;
  capRemaining: number;
  pendingDeals: number;
  avgDealGci: number;
  expectedCloseRatePct: number;
  leadSpend: number;
}

export interface AgentPerformanceResult {
  name: string;
  closedGci: number;
  agentSplitPct: number;
  companyDollar: number;
  companyDollarYieldPct: number;
  capRemaining: number;
  capPressureHealth: Health;
  pipelineGci: number;
  weightedPipelineGci: number;
  expectedPipelineCompanyDollar: number;
  leadSpend: number;
  leadRoi: number | null;
  overallHealth: Health;
  note: string;
}

const rank: Record<Health, number> = { green: 0, yellow: 1, red: 2 };

function nonNegative(value: number): number {
  return Math.max(0, Number.isFinite(value) ? value : 0);
}

function pct(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function bandHigher(value: number, green: number, yellow: number): Health {
  if (value >= green) return "green";
  if (value >= yellow) return "yellow";
  return "red";
}

function bandCapPressure(capRemaining: number): Health {
  if (capRemaining <= 0) return "red";
  if (capRemaining <= 5_000) return "yellow";
  return "green";
}

function worst(...values: Health[]): Health {
  return values.reduce<Health>((current, next) => (rank[next] > rank[current] ? next : current), "green");
}

function noteFor(result: Omit<AgentPerformanceResult, "note">): string {
  if (result.capPressureHealth === "red") return "At or past cap; future deals may retain very little Company Dollar.";
  if (result.companyDollarYieldPct < 18) return "High split pressure; watch contribution after tools, leads, and support costs.";
  if (result.weightedPipelineGci <= 0) return "No weighted pipeline entered; production may be hard to forecast.";
  if (result.leadRoi != null && result.leadRoi < 2) return "Lead spend is not yet producing much retained Company Dollar.";
  return "Profitable and forecastable based on the entered numbers.";
}

export function computeAgentPerformance(input: AgentPerformanceInput): AgentPerformanceResult {
  const closedGci = nonNegative(input.closedGci);
  const agentSplitPct = pct(input.agentSplitPct);
  const companyDollarYieldPct = Math.max(0, 100 - agentSplitPct);
  const companyDollar = (closedGci * companyDollarYieldPct) / 100;
  const capRemaining = nonNegative(input.capRemaining);
  const pendingDeals = nonNegative(input.pendingDeals);
  const avgDealGci = nonNegative(input.avgDealGci);
  const expectedCloseRatePct = pct(input.expectedCloseRatePct);
  const leadSpend = nonNegative(input.leadSpend);
  const pipelineGci = pendingDeals * avgDealGci;
  const weightedPipelineGci = pipelineGci * (expectedCloseRatePct / 100);
  const expectedPipelineCompanyDollar = weightedPipelineGci * (companyDollarYieldPct / 100);
  const yieldHealth = bandHigher(companyDollarYieldPct, 25, 18);
  const capPressureHealth = bandCapPressure(capRemaining);
  const pipelineHealth = bandHigher(expectedPipelineCompanyDollar, Math.max(5_000, companyDollar * 0.5), Math.max(2_500, companyDollar * 0.25));
  const leadRoi = leadSpend > 0 ? expectedPipelineCompanyDollar / leadSpend : null;
  const leadHealth: Health = leadRoi == null ? "green" : bandHigher(leadRoi, 3, 1.5);
  const overallHealth = worst(yieldHealth, capPressureHealth, pipelineHealth, leadHealth);

  const withoutNote = {
    name: input.name.trim() || "Agent",
    closedGci,
    agentSplitPct,
    companyDollar,
    companyDollarYieldPct,
    capRemaining,
    capPressureHealth,
    pipelineGci,
    weightedPipelineGci,
    expectedPipelineCompanyDollar,
    leadSpend,
    leadRoi,
    overallHealth,
  };

  return { ...withoutNote, note: noteFor(withoutNote) };
}

export function computeAgentPerformanceList(inputs: AgentPerformanceInput[]): AgentPerformanceResult[] {
  return inputs
    .map(computeAgentPerformance)
    .sort((a, b) => b.expectedPipelineCompanyDollar + b.companyDollar - (a.expectedPipelineCompanyDollar + a.companyDollar));
}
