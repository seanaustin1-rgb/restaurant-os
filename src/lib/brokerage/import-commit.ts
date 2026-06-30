import { Prisma, type PrismaClient } from "@prisma/client";
import { normalizeBrokerageImport, type BrokerageImportPayload, type BrokerageImportSummary } from "./normalized-import";

export interface CommitBrokerageImportInput {
  restaurantId: string;
  payload: BrokerageImportPayload;
}

export interface CommitBrokerageImportResult {
  summary: BrokerageImportSummary;
  rejected: string[];
}

function json(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function decimal(value: number | null): Prisma.Decimal | null {
  return value == null ? null : new Prisma.Decimal(value);
}

function date(value: string | Date | null): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function commitBrokerageImport(
  db: PrismaClient,
  input: CommitBrokerageImportInput,
): Promise<CommitBrokerageImportResult> {
  const { restaurantId } = input;
  const normalized = normalizeBrokerageImport({ restaurantId }, input.payload);

  // 1) Agents first, so deals/lead-spend can resolve their foreign keys.
  const agentIdByExternal = new Map<string, string>();
  for (const agent of normalized.agents) {
    const row = await db.brokerageAgent.upsert({
      where: { restaurantId_externalAgentId: { restaurantId, externalAgentId: agent.externalAgentId } },
      create: {
        restaurantId,
        externalAgentId: agent.externalAgentId,
        name: agent.name,
        email: agent.email,
        status: agent.status,
        defaultSplitPct: decimal(agent.defaultSplitPct),
        annualCap: decimal(agent.annualCap),
        capPaid: new Prisma.Decimal(agent.capPaid),
        capResetDate: date(agent.capResetDate),
        rawPayload: json(agent.rawPayload),
      },
      update: {
        name: agent.name,
        email: agent.email,
        status: agent.status,
        defaultSplitPct: decimal(agent.defaultSplitPct),
        annualCap: decimal(agent.annualCap),
        capPaid: new Prisma.Decimal(agent.capPaid),
        capResetDate: date(agent.capResetDate),
        rawPayload: json(agent.rawPayload),
      },
      select: { id: true },
    });
    agentIdByExternal.set(agent.externalAgentId, row.id);
  }

  // Resolve any pre-existing agents referenced by deals/lead-spend but not in this batch.
  const unresolved = new Set<string>();
  for (const deal of normalized.deals) {
    if (deal.agentExternalId && !agentIdByExternal.has(deal.agentExternalId)) unresolved.add(deal.agentExternalId);
  }
  for (const row of normalized.leadSpend) {
    if (row.agentExternalId && !agentIdByExternal.has(row.agentExternalId)) unresolved.add(row.agentExternalId);
  }
  if (unresolved.size > 0) {
    const existing = await db.brokerageAgent.findMany({
      where: { restaurantId, externalAgentId: { in: Array.from(unresolved) } },
      select: { id: true, externalAgentId: true },
    });
    for (const a of existing) agentIdByExternal.set(a.externalAgentId, a.id);
  }

  const resolveAgent = (externalAgentId: string | null): string | null =>
    externalAgentId ? agentIdByExternal.get(externalAgentId) ?? null : null;

  // 2) Deals.
  for (const deal of normalized.deals) {
    const data = {
      agentId: resolveAgent(deal.agentExternalId),
      label: deal.label,
      market: deal.market,
      stage: deal.stage,
      expectedCloseDate: date(deal.expectedCloseDate),
      closedDate: date(deal.closedDate),
      salePrice: decimal(deal.salePrice),
      gci: new Prisma.Decimal(deal.gci),
      referralFee: new Prisma.Decimal(deal.referralFee),
      franchiseFee: new Prisma.Decimal(deal.franchiseFee),
      agentPayout: new Prisma.Decimal(deal.agentPayout),
      companyDollar: new Prisma.Decimal(deal.companyDollar),
      probabilityPct: decimal(deal.probabilityPct),
      rawPayload: json(deal.rawPayload),
    };
    await db.brokerageDeal.upsert({
      where: { restaurantId_externalDealId: { restaurantId, externalDealId: deal.externalDealId } },
      create: { restaurantId, externalDealId: deal.externalDealId, ...data },
      update: data,
    });
  }

  // 3) Lead spend. No unique key in the schema, so de-dupe on source + period + agent.
  for (const row of normalized.leadSpend) {
    const agentId = resolveAgent(row.agentExternalId);
    const existing = await db.brokerageLeadSpend.findFirst({
      where: { restaurantId, agentId, source: row.source, periodStart: date(row.periodStart)!, periodEnd: date(row.periodEnd)! },
      select: { id: true },
    });
    const data = {
      agentId,
      source: row.source,
      periodStart: date(row.periodStart)!,
      periodEnd: date(row.periodEnd)!,
      spend: new Prisma.Decimal(row.spend),
      attributedGci: new Prisma.Decimal(row.attributedGci),
      attributedDeals: row.attributedDeals,
      rawPayload: json(row.rawPayload),
    };
    if (existing) {
      await db.brokerageLeadSpend.update({ where: { id: existing.id }, data });
    } else {
      await db.brokerageLeadSpend.create({ data: { restaurantId, ...data } });
    }
  }

  return { summary: normalized.summary, rejected: normalized.rejected };
}
