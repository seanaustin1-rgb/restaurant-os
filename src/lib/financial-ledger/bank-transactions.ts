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

function ledgerMappingForTap(input: {
  tapBucket: TapBucket | null;
  categoryName?: string | null;
  bucket: TransactionBucket;
  amount: number;
}): { eventType: FinancialEventType; ledgerAccount: LedgerAccount } {
  if (input.amount < 0 || input.tapBucket === "REVENUE" || input.bucket === "REVENUE") {
    return { eventType: "REVENUE", ledgerAccount: "REVENUE" };
  }

  switch (input.tapBucket) {
    case "COGS_FOOD":
    case "COGS_LIQUOR":
    case "COGS_BEVERAGE":
      return { eventType: "COGS", ledgerAccount: "COGS" };
    case "LABOR":
      return { eventType: "LABOR", ledgerAccount: "LABOR" };
    case "TAX_SALES":
    case "TAX_PAYROLL":
      return { eventType: "TAX_LIABILITY", ledgerAccount: "TAX_VAULT" };
    case "OWNER_PAY":
      return { eventType: "OWNER_PAY", ledgerAccount: "OWNER_PAY" };
    case "PROFIT":
      return { eventType: "DEBT_SERVICE", ledgerAccount: "DEBT_SERVICE" };
    case "EXCLUDED":
      return { eventType: "EXCLUDED", ledgerAccount: "SUSPENSE" };
    case "OPEX":
    default:
      return {
        eventType: categoryNameLooksFixed(input.categoryName) ? "FIXED_OPEX" : "FIXED_OPEX",
        ledgerAccount: "FIXED_OPEX",
      };
  }
}

export async function mirrorBankTransactionToLedger(
  db: LedgerDb,
  input: BankTransactionLedgerInput,
): Promise<{ rawSourceEventId: string; normalizedFinancialEventId: string | null; mappingStatus: FinancialMappingStatus }> {
  const category = input.categoryId
    ? await db.category.findUnique({
        where: { id: input.categoryId },
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
