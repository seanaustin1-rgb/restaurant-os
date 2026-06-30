/**
 * Frozen demo fixture for the Executive Cockpit (mock-first render target).
 * Illustrative brokerage numbers — replaced by Codex's real loader output once the
 * `BrokerageCockpitData` contract lands. Do NOT wire real math here.
 */
import type { AgentRow, BrokerageCockpitData } from "./types";

const topContributors: AgentRow[] = [
  {
    agentId: "agt_maria",
    name: "Maria Vance",
    email: "maria@keystone.example",
    companyDollar: 14200,
    retainedYield: 0.27,
    capRemaining: 2400,
    capProgressPct: 92,
    pipelineCompanyDollar: 9800,
    leadSpend: 3200,
    roi: 4.1,
    health: "green",
    sourceConfidence: "imported",
    note: "92% to cap — company dollar from her drops sharply next reset.",
  },
  {
    agentId: "agt_dre",
    name: "Andre Cole",
    email: "andre@keystone.example",
    companyDollar: 11750,
    retainedYield: 0.24,
    capRemaining: 9100,
    capProgressPct: 61,
    pipelineCompanyDollar: 7400,
    leadSpend: 2600,
    roi: 3.5,
    health: "green",
    sourceConfidence: "imported",
  },
  {
    agentId: "agt_jpark",
    name: "Jenny Park",
    email: "jenny@keystone.example",
    companyDollar: 9300,
    retainedYield: 0.22,
    capRemaining: 12800,
    capProgressPct: 43,
    pipelineCompanyDollar: 6100,
    leadSpend: 2100,
    roi: 3.1,
    health: "green",
    sourceConfidence: "mixed",
  },
];

const bottomContributors: AgentRow[] = [
  {
    agentId: "agt_tobe",
    name: "Tobias Reed",
    email: "tobias@keystone.example",
    companyDollar: 1850,
    retainedYield: 0.16,
    capRemaining: 21400,
    capProgressPct: 9,
    pipelineCompanyDollar: 1200,
    leadSpend: 2800,
    roi: 0.7, // lead spend > attributed return
    health: "red",
    sourceConfidence: "imported",
    note: "Lead spend exceeds attributed company dollar — negative lead ROI.",
  },
  {
    agentId: "agt_lin",
    name: "Sofia Lin",
    email: "sofia@keystone.example",
    companyDollar: 2600,
    retainedYield: 0.18,
    capRemaining: 19200,
    capProgressPct: 18,
    pipelineCompanyDollar: 2900,
    leadSpend: 1900,
    roi: 1.4,
    health: "yellow",
    sourceConfidence: "profile_assumption",
    note: "Split not in export — modeled from default plan.",
  },
  {
    agentId: "agt_omar",
    name: "Omar Diaz",
    email: null,
    companyDollar: 3100,
    retainedYield: 0.2,
    capRemaining: 16700,
    capProgressPct: 26,
    pipelineCompanyDollar: 3400,
    leadSpend: 1500,
    roi: 2.1,
    health: "yellow",
    sourceConfidence: "mixed",
  },
];

export const executiveCockpitFixture: BrokerageCockpitData = {
  restaurantId: "demo-brokerage",
  name: "Keystone Realty Partners",
  periodLabel: "June 2026",
  industryType: "REAL_ESTATE_BROKERAGE",

  dealHealth: {
    closedGci: 412000,
    pipelineGci: 690000,
    closedVolume: 41200000,
    sideCount: 86,
    trendPts: 3.2,
  },
  ledgerHealth: {
    companyDollar: 92700,
    companyDollarPct: 22.5,
    cashPosition: 318000,
    status: "yellow",
  },
  companyDollarRetention: {
    pct: 22.5,
    targetPct: 25,
    atRiskFromCaps: 18400,
    status: "yellow",
  },
  cashSafety: {
    currentCash: 318000,
    oxygenDays: 134,
    netCashChangePeriod: 22000,
    floorDaysTarget: 120,
    status: "green",
  },
  agentProduction: {
    activeAgents: 28,
    totalCompanyDollar: 92700,
    topContributors,
    bottomContributors,
  },
  marketAura: {
    market: {
      activeToPendingRatio: 1.8,
      medianDom: 31,
      newListings: 540,
      trendPts: -2,
    },
    aura: {
      overallRating: 4.6,
      totalReviews: 312,
      hasAnyData: true,
    },
  },
  topPressure: {
    metricKey: "company-dollar-retention",
    label: "Company-dollar retention",
    currentValue: 22.5,
    targetValue: 25,
    readout:
      "Company dollar is 22.5% vs 25% target — 3 agents within 10% of cap put $18.4k more at risk.",
  },
  sourceTrust: {
    connected: 2,
    required: 3,
    missing: ["MLS (RESO)"],
    status: "partial",
  },
};
