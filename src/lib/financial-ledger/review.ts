import type {
  FinancialEventType,
  LedgerAccount,
  Prisma,
  PrismaClient,
  TapBucket,
} from "@prisma/client";
import { buildLedgerDraftLines } from "./source-mapping";

type ReviewDb = PrismaClient | Prisma.TransactionClient;

export interface PendingFinancialEventRow {
  id: string;
  eventDate: Date;
  eventType: FinancialEventType;
  amount: number;
  counterparty: string | null;
  description: string | null;
  confidence: number;
  sourceSystem: string;
  sourceObjectType: string;
  sourceObjectId: string;
  issueMessage: string | null;
}

export interface PendingFinancialEventGroup {
  key: string;
  sourceSystem: string;
  issueMessage: string;
  label: string;
  count: number;
  totalAmount: number;
  latestEventDate: Date;
}

function reviewLabel(event: Pick<PendingFinancialEventRow, "counterparty" | "description" | "sourceObjectId">): string {
  return event.counterparty || event.description || event.sourceObjectId;
}

export function groupPendingFinancialEvents(events: PendingFinancialEventRow[]): PendingFinancialEventGroup[] {
  const groups = new Map<string, PendingFinancialEventGroup>();
  for (const event of events) {
    const issueMessage = event.issueMessage ?? "Needs mapping review";
    const label = reviewLabel(event);
    const key = `${event.sourceSystem}::${issueMessage}::${label}`.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.totalAmount += event.amount;
      if (event.eventDate > existing.latestEventDate) existing.latestEventDate = event.eventDate;
    } else {
      groups.set(key, {
        key,
        sourceSystem: event.sourceSystem,
        issueMessage,
        label,
        count: 1,
        totalAmount: event.amount,
        latestEventDate: event.eventDate,
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || Math.abs(b.totalAmount) - Math.abs(a.totalAmount) || b.latestEventDate.getTime() - a.latestEventDate.getTime(),
  );
}

function ledgerAccountForEventType(eventType: FinancialEventType): LedgerAccount {
  switch (eventType) {
    case "REVENUE":
      return "REVENUE";
    case "REAL_REVENUE":
      return "REAL_REVENUE";
    case "PASS_THROUGH":
      return "PASS_THROUGH_PAYABLE";
    case "AGENT_SPLIT":
      return "AGENT_PAYABLE";
    case "COGS":
      return "COGS";
    case "LABOR":
      return "LABOR";
    case "OPEX":
      return "OPEX";
    case "TAX_LIABILITY":
      return "TAX_VAULT";
    case "OWNER_PAY":
      return "OWNER_PAY";
    case "PROFIT":
      return "PROFIT";
    case "DEBT_SERVICE":
      return "DEBT_SERVICE";
    case "INTERNAL_TRANSFER":
      return "INTERNAL_TRANSFER";
    case "FIXED_OPEX":
      return "FIXED_OPEX";
    case "FRANCHISE_FEE":
      return "FIXED_OPEX";
    case "EXCLUDED":
    default:
      return "SUSPENSE";
  }
}

function tapBucketFromMetadata(metadata: Prisma.JsonValue | null | undefined): TapBucket | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).tapBucket;
  return typeof value === "string" ? (value as TapBucket) : null;
}

export async function loadPendingFinancialEvents(
  db: PrismaClient,
  restaurantId: string,
  limit = 25,
): Promise<PendingFinancialEventRow[]> {
  const events = await db.normalizedFinancialEvent.findMany({
    where: { restaurantId, mappingStatus: "PENDING_REVIEW" },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      eventDate: true,
      eventType: true,
      amount: true,
      counterparty: true,
      description: true,
      confidence: true,
      rawSourceEvent: {
        select: {
          sourceSystem: true,
          sourceObjectType: true,
          sourceObjectId: true,
        },
      },
      syncExceptions: {
        where: { resolvedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { message: true },
      },
    },
  });

  return events.map((event) => ({
    id: event.id,
    eventDate: event.eventDate,
    eventType: event.eventType,
    amount: Number(event.amount),
    counterparty: event.counterparty,
    description: event.description,
    confidence: event.confidence,
    sourceSystem: event.rawSourceEvent?.sourceSystem ?? "unknown",
    sourceObjectType: event.rawSourceEvent?.sourceObjectType ?? "unknown",
    sourceObjectId: event.rawSourceEvent?.sourceObjectId ?? event.id,
    issueMessage: event.syncExceptions[0]?.message ?? null,
  }));
}

export async function approveFinancialEvent(
  db: ReviewDb,
  input: { restaurantId: string; normalizedFinancialEventId: string; approvedBy: string },
): Promise<void> {
  const event = await db.normalizedFinancialEvent.findFirst({
    where: { id: input.normalizedFinancialEventId, restaurantId: input.restaurantId },
    select: {
      id: true,
      restaurantId: true,
      eventDate: true,
      eventType: true,
      amount: true,
      description: true,
      metadata: true,
    },
  });
  if (!event) throw new Error("financial event not found");

  await db.ledgerEntry.deleteMany({ where: { normalizedFinancialEventId: event.id } });

  const lines = buildLedgerDraftLines({
    eventType: event.eventType,
    ledgerAccount: ledgerAccountForEventType(event.eventType),
    amount: Number(event.amount),
    tapBucket: tapBucketFromMetadata(event.metadata),
    memo: event.description ?? "Reviewed financial event",
  });

  if (lines.length > 0) {
    await db.ledgerEntry.createMany({
      data: lines.map((line) => ({
        restaurantId: event.restaurantId,
        normalizedFinancialEventId: event.id,
        ledgerDate: event.eventDate,
        ledgerAccount: line.ledgerAccount,
        debit: line.debit,
        credit: line.credit,
        cashEffect: line.cashEffect,
        taxEffect: line.taxEffect,
        allocationBucket: line.allocationBucket,
        memo: line.memo,
      })),
    });
  }

  await db.normalizedFinancialEvent.update({
    where: { id: event.id },
    data: {
      mappingStatus: "APPROVED",
      approvedBy: input.approvedBy,
      approvedAt: new Date(),
    },
  });
  await db.syncException.updateMany({
    where: {
      restaurantId: input.restaurantId,
      normalizedFinancialEventId: event.id,
      resolvedAt: null,
    },
    data: { resolvedAt: new Date(), resolvedBy: input.approvedBy },
  });
}

export async function excludeFinancialEvent(
  db: ReviewDb,
  input: { restaurantId: string; normalizedFinancialEventId: string; resolvedBy: string },
): Promise<void> {
  const event = await db.normalizedFinancialEvent.findFirst({
    where: { id: input.normalizedFinancialEventId, restaurantId: input.restaurantId },
    select: { id: true },
  });
  if (!event) throw new Error("financial event not found");

  await db.ledgerEntry.deleteMany({ where: { normalizedFinancialEventId: event.id } });
  await db.normalizedFinancialEvent.update({
    where: { id: event.id },
    data: { mappingStatus: "EXCLUDED", eventType: "EXCLUDED" },
  });
  await db.syncException.updateMany({
    where: {
      restaurantId: input.restaurantId,
      normalizedFinancialEventId: event.id,
      resolvedAt: null,
    },
    data: { resolvedAt: new Date(), resolvedBy: input.resolvedBy },
  });
}
