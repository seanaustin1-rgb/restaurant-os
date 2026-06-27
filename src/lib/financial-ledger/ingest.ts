import { createHash } from "node:crypto";
import type { FinancialMappingStatus, Prisma, PrismaClient } from "@prisma/client";
import { buildLedgerDraftLines, decideFinancialMapping } from "./source-mapping";

export interface IngestFinancialSourceEventInput {
  restaurantId: string;
  sourceSystem: string;
  sourceObjectType: string;
  sourceObjectId: string;
  payload: Prisma.InputJsonValue;
  amount: number;
  eventDate: Date;
  syncBatchId?: string | null;
  description?: string | null;
  counterparty?: string | null;
  minimumAutoConfidence?: number;
}

export interface IngestFinancialSourceEventResult {
  rawSourceEventId: string;
  normalizedFinancialEventId: string | null;
  mappingStatus: FinancialMappingStatus;
  ledgerEntryCount: number;
  syncExceptionId: string | null;
  skippedExisting: boolean;
}

function stableJson(value: Prisma.InputJsonValue): string {
  return JSON.stringify(value, (_key, current) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return current;
    return Object.keys(current)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (current as Record<string, unknown>)[key];
        return acc;
      }, {});
  });
}

function hashPayload(payload: Prisma.InputJsonValue): string {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

export async function ingestFinancialSourceEvent(
  db: PrismaClient,
  input: IngestFinancialSourceEventInput,
): Promise<IngestFinancialSourceEventResult> {
  return db.$transaction(async (tx) => {
    const payloadHash = hashPayload(input.payload);
    const rawSourceEvent = await tx.rawSourceEvent.upsert({
      where: {
        restaurantId_sourceSystem_sourceObjectType_sourceObjectId: {
          restaurantId: input.restaurantId,
          sourceSystem: input.sourceSystem,
          sourceObjectType: input.sourceObjectType,
          sourceObjectId: input.sourceObjectId,
        },
      },
      update: {
        payload: input.payload,
        payloadHash,
        syncBatchId: input.syncBatchId ?? undefined,
        processedAt: null,
        mappingStatus: "RAW",
      },
      create: {
        restaurantId: input.restaurantId,
        sourceSystem: input.sourceSystem,
        sourceObjectType: input.sourceObjectType,
        sourceObjectId: input.sourceObjectId,
        syncBatchId: input.syncBatchId ?? null,
        payload: input.payload,
        payloadHash,
      },
    });

    const existingNormalized = await tx.normalizedFinancialEvent.findFirst({
      where: { rawSourceEventId: rawSourceEvent.id },
      select: { id: true, mappingStatus: true },
    });
    if (existingNormalized) {
      return {
        rawSourceEventId: rawSourceEvent.id,
        normalizedFinancialEventId: existingNormalized.id,
        mappingStatus: existingNormalized.mappingStatus,
        ledgerEntryCount: 0,
        syncExceptionId: null,
        skippedExisting: true,
      };
    }

    const rules = await tx.sourceMappingRule.findMany({
      where: {
        restaurantId: input.restaurantId,
        sourceSystem: input.sourceSystem,
        enabled: true,
      },
    });
    const decision = decideFinancialMapping(
      {
        sourceSystem: input.sourceSystem,
        sourceObjectType: input.sourceObjectType,
        payload: input.payload,
      },
      rules,
      input.minimumAutoConfidence,
    );

    let normalizedFinancialEventId: string | null = null;
    let ledgerEntryCount = 0;
    let syncExceptionId: string | null = null;

    if (decision.eventType && decision.ledgerAccount) {
      const normalized = await tx.normalizedFinancialEvent.create({
        data: {
          restaurantId: input.restaurantId,
          rawSourceEventId: rawSourceEvent.id,
          eventDate: input.eventDate,
          eventType: decision.eventType,
          amount: input.amount,
          counterparty: input.counterparty ?? null,
          description: input.description ?? null,
          confidence: decision.confidence,
          mappingStatus: decision.status,
          approvedAt: decision.status === "APPROVED" ? new Date() : null,
          metadata: decision.ruleId ? { sourceMappingRuleId: decision.ruleId } : undefined,
        },
      });
      normalizedFinancialEventId = normalized.id;

      if (decision.status === "APPROVED") {
        const lines = buildLedgerDraftLines({
          eventType: decision.eventType,
          ledgerAccount: decision.ledgerAccount,
          amount: input.amount,
          tapBucket: decision.tapBucket,
          memo: input.description,
        });

        if (lines.length > 0) {
          const created = await tx.ledgerEntry.createMany({
            data: lines.map((line) => ({
              restaurantId: input.restaurantId,
              normalizedFinancialEventId: normalized.id,
              ledgerDate: input.eventDate,
              ledgerAccount: line.ledgerAccount,
              debit: line.debit,
              credit: line.credit,
              cashEffect: line.cashEffect,
              taxEffect: line.taxEffect,
              allocationBucket: line.allocationBucket,
              memo: line.memo,
            })),
          });
          ledgerEntryCount = created.count;
        }
      }
    }

    if (decision.exception) {
      const exception = await tx.syncException.create({
        data: {
          restaurantId: input.restaurantId,
          rawSourceEventId: rawSourceEvent.id,
          normalizedFinancialEventId,
          sourceSystem: input.sourceSystem,
          severity: decision.exception.severity,
          issueType: decision.exception.issueType,
          message: decision.exception.message,
          detail: decision.exception.detail
            ? (decision.exception.detail as Prisma.InputJsonObject)
            : undefined,
        },
      });
      syncExceptionId = exception.id;
    }

    await tx.rawSourceEvent.update({
      where: { id: rawSourceEvent.id },
      data: {
        mappingStatus: decision.status,
        processedAt: new Date(),
      },
    });

    return {
      rawSourceEventId: rawSourceEvent.id,
      normalizedFinancialEventId,
      mappingStatus: decision.status,
      ledgerEntryCount,
      syncExceptionId,
      skippedExisting: false,
    };
  });
}
