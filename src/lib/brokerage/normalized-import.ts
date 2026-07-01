import { createHash } from "node:crypto";
import type { BrokerageDealStage } from "@prisma/client";

// Normalizes a brokerage roster / deal / lead-spend import (from a back-office
// export — Brokermint, Sisu, BoldTrail… — or a generic spreadsheet) into clean
// rows for the BrokerageAgent / BrokerageDeal / BrokerageLeadSpend tables that
// the brokerage analytics module reads. Pure + side-effect free so it can be
// unit-tested and reused by both the preview and commit paths.
//
// The brokerage-specific value is the Company Dollar derivation: GCI minus the
// pass-throughs (agent payout, franchise fee, referral fee). If the export
// already carries agentPayout / companyDollar we trust it; otherwise we derive
// them from the agent split so a thin spreadsheet still produces real numbers.

export interface BrokerageImportContext {
  restaurantId: string;
}

export interface RawBrokerageAgent {
  externalAgentId: string;
  name: string;
  email?: string | null;
  status?: string | null;
  defaultSplitPct?: number | null;
  annualCap?: number | null;
  capPaid?: number | null;
  capResetDate?: string | Date | null;
  rawPayload?: unknown;
}

export interface RawBrokerageDeal {
  externalDealId?: string | null;
  agentExternalId?: string | null;
  label: string;
  market?: string | null;
  stage?: string | null;
  expectedCloseDate?: string | Date | null;
  closedDate?: string | Date | null;
  salePrice?: number | null;
  gci?: number | null;
  /** Optional: lets a thin export derive agentPayout/companyDollar from the split. */
  agentSplitPct?: number | null;
  referralFee?: number | null;
  franchiseFee?: number | null;
  agentPayout?: number | null;
  companyDollar?: number | null;
  probabilityPct?: number | null;
  rawPayload?: unknown;
}

export interface RawBrokerageLeadSpend {
  externalLeadSpendId?: string | null;
  agentExternalId?: string | null;
  source: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  spend: number;
  attributedGci?: number | null;
  attributedDeals?: number | null;
  rawPayload?: unknown;
}

export interface BrokerageImportPayload {
  agents?: RawBrokerageAgent[];
  deals?: RawBrokerageDeal[];
  leadSpend?: RawBrokerageLeadSpend[];
}

export interface BrokerageImportSummary {
  agents: number;
  deals: number;
  leadSpend: number;
  accepted: number;
  rejected: number;
  /** agentExternalIds referenced by deals/lead-spend that have no matching agent row. */
  missingAgentReferences: string[];
}

type BaseRow = {
  restaurantId: string;
  rawPayload?: unknown;
};

export type NormalizedBrokerageAgent = BaseRow & {
  externalAgentId: string;
  name: string;
  email: string | null;
  status: string | null;
  defaultSplitPct: number | null;
  annualCap: number | null;
  capPaid: number;
  capResetDate: string | Date | null;
};

export type NormalizedBrokerageDeal = BaseRow & {
  externalDealId: string;
  agentExternalId: string | null;
  label: string;
  market: string | null;
  stage: BrokerageDealStage;
  expectedCloseDate: string | Date | null;
  closedDate: string | Date | null;
  salePrice: number | null;
  gci: number;
  referralFee: number;
  franchiseFee: number;
  agentPayout: number;
  companyDollar: number;
  probabilityPct: number | null;
};

export type NormalizedBrokerageLeadSpend = BaseRow & {
  externalLeadSpendId: string;
  agentExternalId: string | null;
  source: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  spend: number;
  attributedGci: number;
  attributedDeals: number;
};

export interface NormalizedBrokerageImport {
  agents: NormalizedBrokerageAgent[];
  deals: NormalizedBrokerageDeal[];
  leadSpend: NormalizedBrokerageLeadSpend[];
  rejected: string[];
  summary: BrokerageImportSummary;
}

const DEAL_STAGES = new Set<BrokerageDealStage>(["LEAD", "ACTIVE", "PENDING", "CLOSED", "LOST"]);

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function money(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.round(Number(value) * 100) / 100 : 0;
}

function clampPct(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Number(value)));
}

function dateValue(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function validDate(value: string | Date | null | undefined): boolean {
  if (value == null) return false;
  return !Number.isNaN(dateValue(value).getTime());
}

function stableId(prefix: string, parts: Array<string | number | Date | null | undefined>): string {
  const basis = parts.map((part) => String(part ?? "")).join("|");
  return `${prefix}-${createHash("sha1").update(basis).digest("hex").slice(0, 16)}`;
}

function dealStage(raw: RawBrokerageDeal): BrokerageDealStage {
  const provided = clean(raw.stage).toUpperCase();
  if (DEAL_STAGES.has(provided as BrokerageDealStage)) return provided as BrokerageDealStage;
  if (validDate(raw.closedDate)) return "CLOSED";
  if (validDate(raw.expectedCloseDate)) return "PENDING";
  return "ACTIVE";
}

/** Derive the pass-through split and Company Dollar, trusting explicit values when present. */
function deriveEconomics(raw: RawBrokerageDeal): {
  gci: number;
  franchiseFee: number;
  referralFee: number;
  agentPayout: number;
  companyDollar: number;
} {
  const gci = money(raw.gci);
  const franchiseFee = money(raw.franchiseFee);
  const referralFee = money(raw.referralFee);
  const agentPayout =
    raw.agentPayout != null
      ? money(raw.agentPayout)
      : raw.agentSplitPct != null
        ? money((gci * clampPct(raw.agentSplitPct)) / 100)
        : 0;
  const companyDollar =
    raw.companyDollar != null
      ? money(raw.companyDollar)
      : Math.max(0, money(gci - agentPayout - franchiseFee - referralFee));
  return { gci, franchiseFee, referralFee, agentPayout, companyDollar };
}

export function normalizeBrokerageImport(
  context: BrokerageImportContext,
  payload: BrokerageImportPayload,
): NormalizedBrokerageImport {
  const rejected: string[] = [];
  const restaurantId = context.restaurantId;
  const knownAgentIds = new Set(
    (payload.agents ?? []).map((agent) => clean(agent.externalAgentId)).filter(Boolean),
  );
  const missingAgentReferences = new Set<string>();

  const noteAgentRef = (externalAgentId: string | null | undefined): string | null => {
    const ref = clean(externalAgentId);
    if (!ref) return null;
    if (knownAgentIds.size > 0 && !knownAgentIds.has(ref)) missingAgentReferences.add(ref);
    return ref;
  };

  const agents: NormalizedBrokerageAgent[] = (payload.agents ?? []).flatMap((agent) => {
    const externalAgentId = clean(agent.externalAgentId);
    const name = clean(agent.name);
    if (!externalAgentId || !name) {
      rejected.push(`agent missing id or name: ${name || externalAgentId || "unknown"}`);
      return [];
    }
    return [
      {
        restaurantId,
        rawPayload: agent.rawPayload,
        externalAgentId,
        name,
        email: agent.email ?? null,
        status: agent.status ?? null,
        defaultSplitPct: agent.defaultSplitPct == null ? null : clampPct(agent.defaultSplitPct),
        annualCap: agent.annualCap == null ? null : money(agent.annualCap),
        capPaid: money(agent.capPaid),
        capResetDate: agent.capResetDate ?? null,
      },
    ];
  });

  const deals: NormalizedBrokerageDeal[] = (payload.deals ?? []).flatMap((deal) => {
    const label = clean(deal.label);
    const { gci, franchiseFee, referralFee, agentPayout, companyDollar } = deriveEconomics(deal);
    if (!label || (gci <= 0 && money(deal.salePrice) <= 0)) {
      rejected.push(`deal missing label or value: ${deal.externalDealId || label || "unknown"}`);
      return [];
    }
    const agentExternalId = noteAgentRef(deal.agentExternalId);
    return [
      {
        restaurantId,
        rawPayload: deal.rawPayload,
        externalDealId:
          clean(deal.externalDealId) ||
          stableId("deal", [label, deal.agentExternalId, deal.closedDate, deal.expectedCloseDate, gci]),
        agentExternalId,
        label,
        market: deal.market ?? null,
        stage: dealStage(deal),
        expectedCloseDate: deal.expectedCloseDate ?? null,
        closedDate: deal.closedDate ?? null,
        salePrice: deal.salePrice == null ? null : money(deal.salePrice),
        gci,
        referralFee,
        franchiseFee,
        agentPayout,
        companyDollar,
        probabilityPct: deal.probabilityPct == null ? null : clampPct(deal.probabilityPct),
      },
    ];
  });

  const leadSpend: NormalizedBrokerageLeadSpend[] = (payload.leadSpend ?? []).flatMap((row) => {
    const source = clean(row.source);
    if (!source || !validDate(row.periodStart) || !validDate(row.periodEnd) || money(row.spend) <= 0) {
      rejected.push(`lead spend missing source/period/spend: ${row.externalLeadSpendId || source || "unknown"}`);
      return [];
    }
    const agentExternalId = noteAgentRef(row.agentExternalId);
    return [
      {
        restaurantId,
        rawPayload: row.rawPayload,
        externalLeadSpendId:
          clean(row.externalLeadSpendId) ||
          stableId("leadspend", [source, row.agentExternalId, row.periodStart, row.periodEnd, row.spend]),
        agentExternalId,
        source,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        spend: money(row.spend),
        attributedGci: money(row.attributedGci),
        attributedDeals: Number.isFinite(row.attributedDeals) ? Math.max(0, Math.trunc(Number(row.attributedDeals))) : 0,
      },
    ];
  });

  const summary: BrokerageImportSummary = {
    agents: agents.length,
    deals: deals.length,
    leadSpend: leadSpend.length,
    accepted: agents.length + deals.length + leadSpend.length,
    rejected: rejected.length,
    missingAgentReferences: Array.from(missingAgentReferences).sort(),
  };

  return { agents, deals, leadSpend, rejected, summary };
}
