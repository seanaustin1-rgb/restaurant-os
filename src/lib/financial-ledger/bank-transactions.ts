import type {
  FinancialEventType,
  FinancialMappingStatus,
  LedgerAccount,
  Prisma,
  PrismaClient,
  TapBucket,
  TransactionBucket,
} from "@prisma/client";
import { buildLedgerDraftLines } from "./source-mapping";
import { tapBucketToFinancialEventType, tapBucketToLedgerAccount } from "./bucket-map";

type LedgerDb = PrismaClient | Prisma.TransactionClient;

export interface BankTransactionLedgerInput {
  restaurantId: string;
  sourceSystem: "plaid" | "statement";
  sourceObjectId: string;
  payload: Prisma.InputJsonValue;
  date: Date;
  amount: number;
  merchantName?: string | null;
  description?: string | null;
  categoryId?: string | null;
  bucket: TransactionBucket;
  confidence?: number | null;
}

const FIXED_OPEX_CATEGORY_HINTS = [
  "rent",
  "utilities",
  "telecom",
  "internet",
  "insurance",
  "waste",
  "trash",
  "maintenance",
  "repair",
  "cleaning",
  "professional",
  "technology",
  "software",
];

function categoryNameLooksFixed(categoryName: string | null | undefined): boolean {
  const value = (categoryName ?? "").toLowerCase();
  return FIXED_OPEX_CATEGORY_HINTS.some((hint) => value.includes(hint));
}

export function ledgerMappingForTap(input: {
  tapBucket: TapBucket | null;
  categoryName?: string | null;
  bucket: TransactionBucket;
  amount: number;
}): { eventType: FinancialEventType; ledgerAccount: LedgerAccount } {
  if (input.amount < 0 || input.tapBucket === "REVENUE" || input.bucket === "REVENUE") {
    return { eventType: "REVENUE", ledgerAccount: "REVENUE" };
  }

  if (input.tapBucket === "OPEX" || input.tapBucket == null) {
    return categoryNameLooksFixed(input.categoryName)
      ? { eventType: "FIXED_OPEX", ledgerAccount: "FIXED_OPEX" }
      : { eventType: "OPEX", ledgerAccount: "OPEX" };
  }

  if (input.tapBucket) {
    return {
      eventType: tapBucketToFinancialEventType(input.tapBucket),
      ledgerAccount: tapBucketToLedgerAccount(input.tapBucket),
    };
  }

  return { eventType: "OPEX", ledgerAccount: "OPEX" };
}

export async function mirrorBankTransactionToLedger(
  db: LedgerDb,
  input: BankTransactionLedgerInput,
): Promise<{ rawSourceEventId: string; normalizedFinancialEventId: string | null; mappingStatus: FinancialMappingStatus }> {
  // Scope the category lookup to this tenant. Category ids are global cuids, so a
  // findUnique-by-id would happily resolve a category belonging to *another*
  // restaurant and drive this restaurant's ledger mapping from it. Guarding by
  // restaurantId means a foreign/stale categoryId resolves to null and the event
  // safely falls to PENDING_REVIEW instead of being mapped off cross-tenant data.
  const category = input.categoryId
    ? await db.category.findFirst({
        where: { id: input.categoryId, restaurantId: input.restaurantId },
        select: { name: true, tapBucket: true },
      })
    : null;
  const confidence = input.confidence ?? 0;
  const mapping = ledgerMappingForTap({
    tapBucket: category?.tapBucket ?? null,
    categoryName: category?.name ?? null,
    bucket: input.bucket,
    amount: input.amount,
  });
  const mappingStatus: FinancialMappingStatus =
    confidence <= 0 || !category ? "PENDING_REVIEW" : confidence >= 0.8 ? "APPROVED" : "PENDING_REVIEW";

  const rawSourceEvent = await db.rawSourceEvent.upsert({
    where: {
      restaurantId_sourceSystem_sourceObjectType_sourceObjectId: {
        restaurantId: input.restaurantId,
        sourceSystem: input.sourceSystem,
        sourceObjectType: "bank_transaction",
        sourceObjectId: input.sourceObjectId,
      },
    },
    create: {
      restaurantId: input.restaurantId,
      sourceSystem: input.sourceSystem,
      sourceObjectType: "bank_transaction",
      sourceObjectId: input.sourceObjectId,
      payload: input.payload,
      mappingStatus: "RAW",
    },
    update: {
      payload: input.payload,
      mappingStatus: "RAW",
      processedAt: null,
    },
  });

  const existingNormalized = await db.normalizedFinancialEvent.findMany({
    where: { rawSourceEventId: rawSourceEvent.id },
    select: { id: true },
  });
  const existingIds = existingNormalized.map((row) => row.id);
  if (existingIds.length > 0) {
    await db.ledgerEntry.deleteMany({ where: { normalizedFinancialEventId: { in: existingIds } } });
    await db.syncException.deleteMany({
      where: {
        OR: [{ rawSourceEventId: rawSourceEvent.id }, { normalizedFinancialEventId: { in: existingIds } }],
      },
    });
    await db.normalizedFinancialEvent.deleteMany({ where: { id: { in: existingIds } } });
  }

  const normalized = await db.normalizedFinancialEvent.create({
    data: {
      restaurantId: input.restaurantId,
      rawSourceEventId: rawSourceEvent.id,
      eventDate: input.date,
      eventType: mapping.eventType,
      amount: Math.abs(input.amount),
      counterparty: input.merchantName ?? null,
      description: input.description ?? null,
      confidence,
      mappingStatus,
      approvedAt: mappingStatus === "APPROVED" ? new Date() : null,
      metadata: {
        source: input.sourceSystem,
        sourceObjectType: "bank_transaction",
        transactionBucket: input.bucket,
        categoryId: input.categoryId ?? null,
      },
    },
  });

  if (mappingStatus === "APPROVED") {
    const lines = buildLedgerDraftLines({
      eventType: mapping.eventType,
      ledgerAccount: mapping.ledgerAccount,
      amount: Math.abs(input.amount),
      tapBucket: category?.tapBucket ?? null,
      memo: input.description ?? input.merchantName ?? "Bank transaction",
    });
    if (lines.length > 0) {
      await db.ledgerEntry.createMany({
        data: lines.map((line) => ({
          restaurantId: input.restaurantId,
          normalizedFinancialEventId: normalized.id,
          ledgerDate: input.date,
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
  } else {
    await db.syncException.create({
      data: {
        restaurantId: input.restaurantId,
        rawSourceEventId: rawSourceEvent.id,
        normalizedFinancialEventId: normalized.id,
        sourceSystem: input.sourceSystem,
        severity: "WARNING",
        issueType: "MISSING_MAPPING",
        message: `${input.sourceSystem} bank transaction needs mapping review before it feeds the clean ledger.`,
        detail: {
          transactionBucket: input.bucket,
          categoryId: input.categoryId ?? null,
          confidence,
        },
      },
    });
  }

  await db.rawSourceEvent.update({
    where: { id: rawSourceEvent.id },
    data: { mappingStatus, processedAt: new Date() },
  });

  return { rawSourceEventId: rawSourceEvent.id, normalizedFinancialEventId: normalized.id, mappingStatus };
}

export async function removeMirroredBankTransactionsFromLedger(
  db: LedgerDb,
  input: {
    restaurantId: string;
    sourceSystem: "plaid" | "statement";
    sourceObjectIds: string[];
  },
): Promise<number> {
  if (input.sourceObjectIds.length === 0) return 0;

  const rawEvents = await db.rawSourceEvent.findMany({
    where: {
      restaurantId: input.restaurantId,
      sourceSystem: input.sourceSystem,
      sourceObjectType: "bank_transaction",
      sourceObjectId: { in: input.sourceObjectIds },
    },
    select: { id: true },
  });
  const rawIds = rawEvents.map((event) => event.id);
  if (rawIds.length === 0) return 0;

  const normalizedEvents = await db.normalizedFinancialEvent.findMany({
    where: { rawSourceEventId: { in: rawIds } },
    select: { id: true },
  });
  const normalizedIds = normalizedEvents.map((event) => event.id);

  if (normalizedIds.length > 0) {
    await db.ledgerEntry.deleteMany({ where: { normalizedFinancialEventId: { in: normalizedIds } } });
    await db.syncException.deleteMany({
      where: {
        OR: [{ rawSourceEventId: { in: rawIds } }, { normalizedFinancialEventId: { in: normalizedIds } }],
      },
    });
    await db.normalizedFinancialEvent.deleteMany({ where: { id: { in: normalizedIds } } });
  } else {
    await db.syncException.deleteMany({ where: { rawSourceEventId: { in: rawIds } } });
  }

  const deleted = await db.rawSourceEvent.deleteMany({ where: { id: { in: rawIds } } });
  return deleted.count;
}
