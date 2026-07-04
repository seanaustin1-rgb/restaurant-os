import type {
  FinancialEventType,
  LedgerAccount,
  Prisma,
  PrismaClient,
  TapBucket,
} from "@prisma/client";
import { buildLedgerDraftLines } from "./source-mapping";
import { ledgerMappingForTap } from "./bank-transactions";
import { signatureOf } from "@/lib/categorization/suggestions";

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

export const NO_SIGNATURE_LABEL = "(no vendor signature)";

export interface SignatureGroup {
  key: string; // `${issue} :: ${signature}` — stable id for the bulk form
  signature: string; // the vendor keyword the group is bucketed on
  issueLabel: string;
  sourceSystem: string;
  count: number;
  totalAmount: number;
  latestEventDate: Date;
  sampleLabel: string;
  eventIds: string[]; // members — the payload for a bulk approve/exclude
}

/**
 * Group pending events by (issue, vendor signature) — the SAME signature the
 * `scripts/summarize-sync-exceptions.ts` triage report and the rule-suggestion
 * engine use (`signatureOf`), so the review UI's bulk groups line up 1:1 with the
 * script's report and a bulk-apply targets exactly the rows that report describes.
 * Pure — carries the member `eventIds` so a group is directly actionable.
 */
export function groupPendingBySignature(events: PendingFinancialEventRow[]): SignatureGroup[] {
  const groups = new Map<string, SignatureGroup>();
  for (const event of events) {
    const signature = signatureOf(event.counterparty, event.description) ?? NO_SIGNATURE_LABEL;
    const issueLabel = event.issueMessage ?? "Needs mapping review";
    const key = `${issueLabel} :: ${signature}`.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.totalAmount += event.amount;
      existing.eventIds.push(event.id);
      if (event.eventDate > existing.latestEventDate) existing.latestEventDate = event.eventDate;
    } else {
      groups.set(key, {
        key,
        signature,
        issueLabel,
        sourceSystem: event.sourceSystem,
        count: 1,
        totalAmount: event.amount,
        latestEventDate: event.eventDate,
        sampleLabel: reviewLabel(event),
        eventIds: [event.id],
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || Math.abs(b.totalAmount) - Math.abs(a.totalAmount) || b.latestEventDate.getTime() - a.latestEventDate.getTime(),
  );
}

/**
 * Derive a re-typed event's ledger classification from an operator-chosen category
 * through the ONE shared tap→ledger mapping (`ledgerMappingForTap`) — never a second
 * path. `amount` is the event's stored (positive) magnitude, so REVENUE is reached
 * only when the chosen category's tapBucket is REVENUE (an explicit operator choice),
 * not inferred from a lost sign. Pure — unit-tested.
 */
export function classificationForCategory(
  category: { name: string; tapBucket: TapBucket },
  amount: number,
): { eventType: FinancialEventType; ledgerAccount: LedgerAccount; tapBucket: TapBucket } {
  const mapping = ledgerMappingForTap({
    tapBucket: category.tapBucket,
    categoryName: category.name,
    bucket: "UNCATEGORIZED",
    amount: Math.abs(amount),
  });
  return { eventType: mapping.eventType, ledgerAccount: mapping.ledgerAccount, tapBucket: category.tapBucket };
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
  input: {
    restaurantId: string;
    normalizedFinancialEventId: string;
    approvedBy: string;
    /** Optional re-type: approve as this tenant category instead of the ingest guess. */
    categoryId?: string;
  },
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

  // Classification defaults to the event's ingest guess; an operator-chosen
  // category re-derives it through the one shared mapping (never a second path).
  let eventType = event.eventType;
  let ledgerAccount = ledgerAccountForEventType(event.eventType);
  let tapBucket = tapBucketFromMetadata(event.metadata);
  let retypedCategoryId: string | null = null;

  if (input.categoryId) {
    const category = await db.category.findFirst({
      where: { id: input.categoryId, restaurantId: input.restaurantId },
      select: { name: true, tapBucket: true },
    });
    if (!category) throw new Error("category not found for this restaurant");
    const classified = classificationForCategory(category, Number(event.amount));
    eventType = classified.eventType;
    ledgerAccount = classified.ledgerAccount;
    tapBucket = classified.tapBucket;
    retypedCategoryId = input.categoryId;
  }

  await db.ledgerEntry.deleteMany({ where: { normalizedFinancialEventId: event.id } });

  const lines = buildLedgerDraftLines({
    eventType,
    ledgerAccount,
    amount: Number(event.amount),
    tapBucket,
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
      eventType,
      approvedBy: input.approvedBy,
      approvedAt: new Date(),
      // Record the operator's category choice for traceability on a re-type.
      ...(retypedCategoryId ? { metadata: { ...mergeableMetadata(event.metadata), categoryId: retypedCategoryId } } : {}),
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

function mergeableMetadata(metadata: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

/**
 * Bulk approve every event in `eventIds` as one operator-chosen category, in a
 * single all-or-nothing transaction (spec: transactional per group). Each row goes
 * through the same `approveFinancialEvent` the single-row UI uses, so a bulk clear
 * can't diverge from a per-row review. Returns the number resolved.
 */
export async function bulkApproveAsCategory(
  db: PrismaClient,
  input: { restaurantId: string; eventIds: string[]; categoryId: string; approvedBy: string },
): Promise<number> {
  if (input.eventIds.length === 0) return 0;
  await db.$transaction(
    async (tx) => {
      for (const id of input.eventIds) {
        await approveFinancialEvent(tx, {
          restaurantId: input.restaurantId,
          normalizedFinancialEventId: id,
          approvedBy: input.approvedBy,
          categoryId: input.categoryId,
        });
      }
    },
    { timeout: 120_000 },
  );
  return input.eventIds.length;
}

/** Bulk exclude every event in `eventIds`, in a single all-or-nothing transaction. */
export async function bulkExcludeFinancialEvents(
  db: PrismaClient,
  input: { restaurantId: string; eventIds: string[]; resolvedBy: string },
): Promise<number> {
  if (input.eventIds.length === 0) return 0;
  await db.$transaction(
    async (tx) => {
      for (const id of input.eventIds) {
        await excludeFinancialEvent(tx, {
          restaurantId: input.restaurantId,
          normalizedFinancialEventId: id,
          resolvedBy: input.resolvedBy,
        });
      }
    },
    { timeout: 120_000 },
  );
  return input.eventIds.length;
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
