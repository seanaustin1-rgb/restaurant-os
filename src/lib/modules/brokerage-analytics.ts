import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadAura } from "@/lib/modules/aura";
import { loadCashOxygenFloor } from "@/lib/modules/cash-oxygen";
import type { DashboardAuraSummary, DashboardCashSafety } from "@/lib/dashboard/data";
import { computeAgentPerformanceList } from "@/lib/demo/real-estate-agent-performance";
import { computeMarketAura } from "@/lib/demo/market-aura";
import { computeRealEstateEstimate } from "@/lib/demo/real-estate-estimate";
import type { HealthStatus } from "@/lib/profit-first/calculator";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const n = (value: unknown): number => (value == null ? 0 : Number(value));
const r2 = (value: number): number => Math.round(value * 100) / 100;

function profileNumber(profile: unknown, key: string): number | null {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
  const value = (profile as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function profileString(profile: unknown, key: string): string {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return "";
  const value = (profile as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function monthBounds(ref: Date): { start: Date; end: Date; label: string } {
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  return { start, end, label: `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()} - MTD` };
}

export type BrokerageSourceState = "connected" | "planned" | "missing";

export interface BrokerageSourceReadinessLine {
  label: string;
  state: BrokerageSourceState;
  detail: string;
}

export interface BrokerageAnalyticsData {
  restaurantId: string;
  name: string;
  periodLabel: string;
  hasImportedBrokerageData: boolean;
  estimate: ReturnType<typeof computeRealEstateEstimate>;
  agents: ReturnType<typeof computeAgentPerformanceList>;
  market: ReturnType<typeof computeMarketAura>;
  sourceReadiness: BrokerageSourceReadinessLine[];
  counts: {
    agents: number;
    closedDeals: number;
    pipelineDeals: number;
    leadSpendRows: number;
    marketMetricRows: number;
  };
}

export type BrokerageCockpitHealth = HealthStatus | "unknown";
export type BrokerageAgentSourceConfidence = "imported" | "profile_assumption" | "mixed";

export interface BrokerageCockpitAgentRow {
  agentId: string;
  name: string;
  email: string | null;
  companyDollar: number;
  retainedYield: number;
  capRemaining: number | null;
  capProgressPct: number | null;
  pipelineCompanyDollar: number;
  leadSpend: number;
  roi: number | null;
  health: HealthStatus;
  sourceConfidence: BrokerageAgentSourceConfidence;
  note?: string;
}

export interface BrokerageCockpitData {
  restaurantId: string;
  name: string;
  periodLabel: string;
  industryType: "REAL_ESTATE_BROKERAGE";
  dealHealth: {
    closedGci: number;
    pipelineGci: number;
    closedVolume: number;
    sideCount: number;
    trendPts: number | null;
  };
  ledgerHealth: {
    companyDollar: number;
    companyDollarPct: number | null;
    cashPosition: number | null;
    status: BrokerageCockpitHealth;
  };
  companyDollarRetention: {
    pct: number | null;
    targetPct: number;
    atRiskFromCaps: number;
    status: BrokerageCockpitHealth;
  };
  cashSafety: DashboardCashSafety & { floorDaysTarget: number };
  agentProduction: {
    activeAgents: number;
    totalCompanyDollar: number;
    topContributors: BrokerageCockpitAgentRow[];
    bottomContributors: BrokerageCockpitAgentRow[];
  };
  marketAura: {
    market: {
      activeToPendingRatio: number | null;
      medianDom: number | null;
      newListings: number | null;
      trendPts: number | null;
    } | null;
    aura: DashboardAuraSummary;
  };
  topPressure: {
    metricKey: string;
    label: string;
    currentValue: number;
    targetValue: number;
    readout: string;
  } | null;
  sourceTrust: { connected: number; required: number; missing: string[]; status: "healthy" | "partial" };
}

function sourceConfidence(hasImportedAgent: boolean, usesFallbackMath: boolean): BrokerageAgentSourceConfidence {
  if (!hasImportedAgent) return "profile_assumption";
  return usesFallbackMath ? "mixed" : "imported";
}

function companyDollarStatus(pct: number | null, targetPct: number): BrokerageCockpitHealth {
  if (pct == null) return "unknown";
  if (pct >= targetPct) return "green";
  if (pct >= targetPct - 7) return "yellow";
  return "red";
}

export function deriveBrokerageTopPressure(data: Omit<BrokerageCockpitData, "topPressure">): BrokerageCockpitData["topPressure"] {
  const pressures: NonNullable<BrokerageCockpitData["topPressure"]>[] = [];

  if (data.companyDollarRetention.status === "red" && data.companyDollarRetention.pct != null) {
    pressures.push({
      metricKey: "brokerage-company-dollar-retention",
      label: "Company-Dollar Retention",
      currentValue: r2(data.companyDollarRetention.pct),
      targetValue: data.companyDollarRetention.targetPct,
      readout: `${r2(data.companyDollarRetention.pct)}% retained vs ${data.companyDollarRetention.targetPct}% target.`,
    });
  }

  if (data.cashSafety.status === "red" && data.cashSafety.oxygenDays != null) {
    pressures.push({
      metricKey: "brokerage-cash-oxygen",
      label: "Cash Oxygen",
      currentValue: Math.floor(data.cashSafety.oxygenDays),
      targetValue: data.cashSafety.floorDaysTarget,
      readout: `${Math.floor(data.cashSafety.oxygenDays)} days of oxygen vs ${data.cashSafety.floorDaysTarget}-day planning target.`,
    });
  }

  if (data.companyDollarRetention.atRiskFromCaps > 0) {
    pressures.push({
      metricKey: "brokerage-cap-cliff",
      label: "Cap-Cliff Risk",
      currentValue: r2(data.companyDollarRetention.atRiskFromCaps),
      targetValue: 0,
      readout: `${r2(data.companyDollarRetention.atRiskFromCaps).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} of pipeline Company Dollar is at risk from caps.`,
    });
  }

  return pressures[0] ?? null;
}

function auraSummary(aura: Awaited<ReturnType<typeof loadAura>>): DashboardAuraSummary {
  return {
    configuredCount: aura.configuredCount,
    liveCount: aura.sources.filter((source) => source.state === "live").length,
    overallRating: aura.overallRating,
    totalReviews: aura.totalReviews,
    health: aura.health,
    hasAnyData: aura.hasAnyData,
    intentMetrics: aura.intentMetrics,
  };
}

async function safeAuraSummary(restaurantId: string): Promise<DashboardAuraSummary> {
  try {
    return auraSummary(await loadAura(restaurantId));
  } catch {
    return {
      configuredCount: 0,
      liveCount: 0,
      overallRating: null,
      totalReviews: 0,
      health: "yellow",
      hasAnyData: false,
      intentMetrics: [],
    };
  }
}

export async function loadBrokerageAnalytics(
  restaurantId: string,
  db: PrismaClient = prisma,
): Promise<BrokerageAnalyticsData | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, businessType: true, profile: true, cashBalanceAnchor: true },
  });
  if (!restaurant) return null;

  const latestClosed = await db.brokerageDeal.findFirst({
    where: { restaurantId, closedDate: { not: null } },
    orderBy: { closedDate: "desc" },
    select: { closedDate: true },
  });
  const { start, end, label } = monthBounds(latestClosed?.closedDate ?? new Date());

  const [closedDeals, pipelineDeals, agents, leadSpendRows, marketMetricRows, sourceConfigs] = await Promise.all([
    db.brokerageDeal.findMany({
      where: { restaurantId, stage: "CLOSED", closedDate: { gte: start, lt: end } },
      include: { agent: true },
    }),
    db.brokerageDeal.findMany({
      where: { restaurantId, stage: { in: ["ACTIVE", "PENDING"] } },
      include: { agent: true },
    }),
    db.brokerageAgent.findMany({ where: { restaurantId }, orderBy: { name: "asc" } }),
    db.brokerageLeadSpend.findMany({
      where: { restaurantId, periodStart: { lt: end }, periodEnd: { gte: start } },
      include: { agent: true },
    }),
    db.brokerageMarketMetric.findMany({
      where: { restaurantId, date: { gte: start, lt: end } },
      orderBy: { date: "desc" },
    }),
    db.dataSourceConfig.findMany({ where: { restaurantId } }),
  ]);

  const profile = restaurant.profile;
  const avgSplit = profileNumber(profile, "avgCommissionSplit") ?? 70;
  const avgGci = profileNumber(profile, "avgGci") ?? 9_000;
  const dealsPerYear = profileNumber(profile, "dealsPerYear") ?? 84;
  const leadSpendProfile = profileNumber(profile, "monthlyLeadSpend") ?? 0;
  const agentCountProfile = profileNumber(profile, "agentCount") ?? agents.length;
  const marketName = profileString(profile, "market") || "Local market";

  const closedGci = closedDeals.reduce((sum, deal) => sum + n(deal.gci), 0);
  const closedCompanyDollar = closedDeals.reduce((sum, deal) => sum + n(deal.companyDollar), 0);
  const monthlyGci = closedGci > 0 ? closedGci : (avgGci * dealsPerYear) / 12;
  const companyDollarPct = closedGci > 0 && closedCompanyDollar > 0 ? (closedCompanyDollar / closedGci) * 100 : Math.max(0, 100 - avgSplit);
  const monthlyOpex = Math.max(12_000, monthlyGci * 0.18);
  const pendingDeals = pipelineDeals.length > 0 ? pipelineDeals.length : Math.max(1, Math.round(dealsPerYear / 8));
  const weightedPipelineGci = pipelineDeals.reduce((sum, deal) => sum + n(deal.gci) * ((n(deal.probabilityPct) || 70) / 100), 0);
  const avgPipelineGci = pipelineDeals.length > 0 ? weightedPipelineGci / pipelineDeals.length : avgGci;

  const estimate = computeRealEstateEstimate({
    name: restaurant.name,
    market: marketName,
    software: "quickbooks",
    monthlyGci,
    agentSplitPct: 100 - companyDollarPct,
    franchiseFeePct: 0,
    referralFeePct: 0,
    monthlyOpex,
    currentCash: n(restaurant.cashBalanceAnchor),
    pendingDeals,
    avgSalePrice: avgPipelineGci / 0.025,
    avgCommissionPct: 2.5,
    expectedCloseRatePct: 70,
    avgBrokerageSharePct: companyDollarPct,
    daysToClose: 60,
  });

  const agentInputs = (agents.length > 0 ? agents : Array.from({ length: Math.max(1, Math.min(3, agentCountProfile || 3)) }, (_, i) => ({
    id: `profile-${i}`,
    name: i === 0 ? "Top producer" : i === 1 ? "Core agent" : "Growth agent",
    defaultSplitPct: avgSplit,
    annualCap: null,
    capPaid: 0,
  }))).map((agent, index) => {
    const agentClosed = closedDeals.filter((deal) => deal.agentId === agent.id);
    const agentPipeline = pipelineDeals.filter((deal) => deal.agentId === agent.id);
    const agentLeadSpend = leadSpendRows.filter((row) => row.agentId === agent.id).reduce((sum, row) => sum + n(row.spend), 0);
    return {
      name: agent.name,
      closedGci: agentClosed.reduce((sum, deal) => sum + n(deal.gci), 0) || monthlyGci / Math.max(1, agentCountProfile || agents.length || 1),
      agentSplitPct: n(agent.defaultSplitPct) || avgSplit,
      capRemaining: Math.max(0, n(agent.annualCap) - n(agent.capPaid)) || (index === 0 ? 4_500 : 18_000),
      pendingDeals: agentPipeline.length || Math.max(0, Math.round(pendingDeals / Math.max(1, agentCountProfile || agents.length || 1))),
      avgDealGci: avgGci,
      expectedCloseRatePct: 70,
      leadSpend: agentLeadSpend || (index === 0 ? Math.max(leadSpendProfile * 0.45, 0) : index === 1 ? Math.max(leadSpendProfile * 0.3, 0) : Math.max(leadSpendProfile * 0.25, 0)),
    };
  });

  const latestMarket = marketMetricRows[0];
  const market = computeMarketAura({
    market: latestMarket?.market ?? marketName,
    newListings7d: latestMarket?.newListings ?? 64,
    pendings7d: latestMarket?.pendings ?? 48,
    avgDom: n(latestMarket?.avgDom) || 42,
    domTrendPct: 4,
    priceDrops7d: latestMarket?.priceReductions ?? 14,
    showingAppointments7d: latestMarket?.showingAppointments ?? 96,
    showingTrendPct: 3,
    mortgageRatePct: n(latestMarket?.mortgageRatePct) || 6.85,
    mortgageRateChangeBps7d: 12,
    googleIntentTrendPct: n(latestMarket?.googleIntentTrendPct) || 5,
  });

  const connected = new Set(sourceConfigs.filter((source) => source.status === "CONNECTED").map((source) => `${source.category}:${source.providerName}`));
  const planned = new Set(sourceConfigs.filter((source) => source.status === "PLANNED").map((source) => `${source.category}:${source.providerName}`));
  const stateFor = (category: string, providers: string[]): BrokerageSourceState => {
    if (providers.some((provider) => connected.has(`${category}:${provider}`))) return "connected";
    if (providers.some((provider) => planned.has(`${category}:${provider}`))) return "planned";
    return "missing";
  };

  return {
    restaurantId,
    name: restaurant.name,
    periodLabel: label,
    hasImportedBrokerageData: closedDeals.length > 0 || pipelineDeals.length > 0 || agents.length > 0 || leadSpendRows.length > 0 || marketMetricRows.length > 0,
    estimate,
    agents: computeAgentPerformanceList(agentInputs),
    market,
    sourceReadiness: [
      { label: "Accounting", state: stateFor("accounting", ["QuickBooks Online", "Xero"]), detail: "Company Dollar checks, fixed OpEx, tax reserve, and advisor review." },
      { label: "CRM pipeline", state: stateFor("pipeline", ["Follow Up Boss / Lofty / kvCORE"]), detail: "Pending deals, source attribution, expected close date, and close probability." },
      { label: "Transaction management", state: stateFor("pipeline", ["Brokermint / Dotloop / SkySlope"]), detail: "Splits, caps, referral fees, franchise fees, and agent ledgers." },
      { label: "Market Aura", state: stateFor("aura", ["Google Business Profile", "Zillow / Realtor.com"]), detail: "Search intent, profile actions, reviews, portal activity, and local demand." },
    ],
    counts: {
      agents: agents.length,
      closedDeals: closedDeals.length,
      pipelineDeals: pipelineDeals.length,
      leadSpendRows: leadSpendRows.length,
      marketMetricRows: marketMetricRows.length,
    },
  };
}

export async function loadBrokerageCockpit(
  restaurantId: string,
  db: PrismaClient = prisma,
): Promise<BrokerageCockpitData | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, businessType: true, profile: true, cashBalanceAnchor: true },
  });
  if (!restaurant || restaurant.businessType !== "REAL_ESTATE_BROKERAGE") return null;

  const latestClosed = await db.brokerageDeal.findFirst({
    where: { restaurantId, closedDate: { not: null } },
    orderBy: { closedDate: "desc" },
    select: { closedDate: true },
  });
  const { start, end, label } = monthBounds(latestClosed?.closedDate ?? new Date());

  const [closedDeals, pipelineDeals, agents, leadSpendRows, marketMetricRows, sourceConfigs, cashOxygen, aura] =
    await Promise.all([
      db.brokerageDeal.findMany({
        where: { restaurantId, stage: "CLOSED", closedDate: { gte: start, lt: end } },
        include: { agent: true },
      }),
      db.brokerageDeal.findMany({
        where: { restaurantId, stage: { in: ["ACTIVE", "PENDING"] } },
        include: { agent: true },
      }),
      db.brokerageAgent.findMany({ where: { restaurantId }, orderBy: { name: "asc" } }),
      db.brokerageLeadSpend.findMany({
        where: { restaurantId, periodStart: { lt: end }, periodEnd: { gte: start } },
        include: { agent: true },
      }),
      db.brokerageMarketMetric.findMany({
        where: { restaurantId, date: { gte: start, lt: end } },
        orderBy: { date: "desc" },
      }),
      db.dataSourceConfig.findMany({ where: { restaurantId } }),
      loadCashOxygenFloor(restaurantId, db),
      safeAuraSummary(restaurantId),
    ]);

  const profile = restaurant.profile;
  const avgSplit = profileNumber(profile, "avgCommissionSplit") ?? 70;
  const avgGci = profileNumber(profile, "avgGci") ?? 9_000;
  const dealsPerYear = profileNumber(profile, "dealsPerYear") ?? 84;
  const leadSpendProfile = profileNumber(profile, "monthlyLeadSpend") ?? 0;
  const agentCountProfile = profileNumber(profile, "agentCount") ?? agents.length;
  const targetCompanyDollarPct = profileNumber(profile, "targetCompanyDollarPct") ?? 25;

  const closedGci = closedDeals.reduce((sum, deal) => sum + n(deal.gci), 0);
  const closedCompanyDollar = closedDeals.reduce((sum, deal) => sum + n(deal.companyDollar), 0);
  const closedVolume = closedDeals.reduce((sum, deal) => sum + n(deal.salePrice), 0);
  const monthlyGci = closedGci > 0 ? closedGci : (avgGci * dealsPerYear) / 12;
  const companyDollar = closedCompanyDollar > 0 ? closedCompanyDollar : monthlyGci * (Math.max(0, 100 - avgSplit) / 100);
  const companyDollarPct = monthlyGci > 0 ? (companyDollar / monthlyGci) * 100 : null;
  const weightedPipelineGci = pipelineDeals.reduce((sum, deal) => sum + n(deal.gci) * ((n(deal.probabilityPct) || 70) / 100), 0);
  const unweightedPipelineGci = pipelineDeals.reduce((sum, deal) => sum + n(deal.gci), 0);
  const activeAgents = agents.filter((agent) => (agent.status ?? "active").toLowerCase() !== "inactive").length || agentCountProfile || agents.length;

  const agentInputs = (agents.length > 0 ? agents : Array.from({ length: Math.max(1, Math.min(3, agentCountProfile || 3)) }, (_, i) => ({
    id: `profile-${i}`,
    name: i === 0 ? "Top producer" : i === 1 ? "Core agent" : "Growth agent",
    email: null,
    defaultSplitPct: avgSplit,
    annualCap: null,
    capPaid: 0,
  }))).map((agent, index) => {
    const agentClosed = closedDeals.filter((deal) => deal.agentId === agent.id);
    const agentPipeline = pipelineDeals.filter((deal) => deal.agentId === agent.id);
    const agentLeadSpend = leadSpendRows.filter((row) => row.agentId === agent.id).reduce((sum, row) => sum + n(row.spend), 0);
    const usesFallbackMath = agentClosed.length === 0 && closedDeals.length === 0;
    const fallbackClosedGci = monthlyGci / Math.max(1, agentCountProfile || agents.length || 1);
    return {
      agent,
      input: {
        name: agent.name,
        closedGci: agentClosed.reduce((sum, deal) => sum + n(deal.gci), 0) || fallbackClosedGci,
        agentSplitPct: n(agent.defaultSplitPct) || avgSplit,
        capRemaining: Math.max(0, n(agent.annualCap) - n(agent.capPaid)) || (index === 0 ? 4_500 : 18_000),
        pendingDeals: agentPipeline.length || Math.max(0, Math.round((pipelineDeals.length || Math.max(1, Math.round(dealsPerYear / 8))) / Math.max(1, agentCountProfile || agents.length || 1))),
        avgDealGci: avgGci,
        expectedCloseRatePct: 70,
        leadSpend: agentLeadSpend || (index === 0 ? Math.max(leadSpendProfile * 0.45, 0) : index === 1 ? Math.max(leadSpendProfile * 0.3, 0) : Math.max(leadSpendProfile * 0.25, 0)),
      },
      sourceConfidence: sourceConfidence(agents.length > 0, usesFallbackMath),
    };
  });
  const performance = computeAgentPerformanceList(agentInputs.map((row) => row.input));
  const agentRows: BrokerageCockpitAgentRow[] = performance.map((perf) => {
    const source = agentInputs.find((row) => row.input.name === perf.name) ?? agentInputs[0];
    const annualCap = source?.agent ? n(source.agent.annualCap) : 0;
    const capPaid = source?.agent ? n(source.agent.capPaid) : 0;
    return {
      agentId: source?.agent.id ?? `profile-${perf.name.toLowerCase().replace(/\s+/g, "-")}`,
      name: perf.name,
      email: source?.agent.email ?? null,
      companyDollar: r2(perf.companyDollar),
      retainedYield: r2(perf.companyDollarYieldPct),
      capRemaining: source?.agent.annualCap == null ? null : r2(Math.max(0, n(source.agent.annualCap) - n(source.agent.capPaid))),
      capProgressPct: annualCap > 0 ? r2((capPaid / annualCap) * 100) : null,
      pipelineCompanyDollar: r2(perf.expectedPipelineCompanyDollar),
      leadSpend: r2(perf.leadSpend),
      roi: perf.leadRoi == null ? null : r2(perf.leadRoi),
      health: perf.overallHealth,
      sourceConfidence: source?.sourceConfidence ?? "profile_assumption",
      note: perf.note,
    };
  });

  const capAtRisk = agentRows.reduce((sum, agent) => {
    if (agent.capRemaining == null) return sum;
    return sum + Math.max(0, agent.pipelineCompanyDollar - agent.capRemaining);
  }, 0);
  const latestMarket = marketMetricRows[0] ?? null;
  const connectedCount = sourceConfigs.filter((source) => source.status === "CONNECTED").length;
  const requiredSources = [
    { category: "accounting", providerName: "QuickBooks Online" },
    { category: "pipeline", providerName: "Follow Up Boss / Lofty / kvCORE" },
    { category: "aura", providerName: "Google Business Profile" },
  ];
  const connectedKeys = new Set(sourceConfigs.filter((source) => source.status === "CONNECTED").map((source) => `${source.category}:${source.providerName}`));
  const missing = requiredSources
    .filter((source) => !connectedKeys.has(`${source.category}:${source.providerName}`))
    .map((source) => source.providerName);

  const cashSafety: BrokerageCockpitData["cashSafety"] = {
    currentCash: cashOxygen.currentCash,
    oxygenDays: cashOxygen.oxygenDays,
    avgDailyFixedBurn: cashOxygen.avgDailyFixedBurn,
    netCashChangePeriod: null,
    pendingReviewCount: cashOxygen.pendingFixedEventCount,
    source: cashOxygen.source,
    asOfDate: cashOxygen.asOfDate,
    status: cashOxygen.status,
    floorDaysTarget: 120,
  };

  const withoutTopPressure: Omit<BrokerageCockpitData, "topPressure"> = {
    restaurantId,
    name: restaurant.name,
    periodLabel: label,
    industryType: "REAL_ESTATE_BROKERAGE",
    dealHealth: {
      closedGci: r2(closedGci || monthlyGci),
      pipelineGci: r2(unweightedPipelineGci || weightedPipelineGci),
      closedVolume: r2(closedVolume),
      sideCount: closedDeals.length,
      trendPts: null,
    },
    ledgerHealth: {
      companyDollar: r2(companyDollar),
      companyDollarPct: companyDollarPct == null ? null : r2(companyDollarPct),
      cashPosition: cashOxygen.currentCash,
      status: companyDollarStatus(companyDollarPct, targetCompanyDollarPct),
    },
    companyDollarRetention: {
      pct: companyDollarPct == null ? null : r2(companyDollarPct),
      targetPct: targetCompanyDollarPct,
      atRiskFromCaps: r2(capAtRisk),
      status: companyDollarStatus(companyDollarPct, targetCompanyDollarPct),
    },
    cashSafety,
    agentProduction: {
      activeAgents,
      totalCompanyDollar: r2(agentRows.reduce((sum, agent) => sum + agent.companyDollar, 0)),
      topContributors: agentRows.slice(0, 3),
      bottomContributors: [...agentRows].sort((a, b) => a.companyDollar - b.companyDollar).slice(0, 3),
    },
    marketAura: {
      market: latestMarket
        ? {
            activeToPendingRatio: latestMarket.newListings > 0 ? r2(latestMarket.pendings / latestMarket.newListings) : null,
            medianDom: latestMarket.avgDom == null ? null : r2(n(latestMarket.avgDom)),
            newListings: latestMarket.newListings,
            trendPts: latestMarket.googleIntentTrendPct == null ? null : r2(n(latestMarket.googleIntentTrendPct)),
          }
        : null,
      aura,
    },
    sourceTrust: {
      connected: connectedCount,
      required: requiredSources.length,
      missing,
      status: missing.length === 0 ? "healthy" : "partial",
    },
  };

  return { ...withoutTopPressure, topPressure: deriveBrokerageTopPressure(withoutTopPressure) };
}
