import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeAgentPerformanceList } from "@/lib/demo/real-estate-agent-performance";
import { computeMarketAura } from "@/lib/demo/market-aura";
import { computeRealEstateEstimate } from "@/lib/demo/real-estate-estimate";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const n = (value: unknown): number => (value == null ? 0 : Number(value));

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
