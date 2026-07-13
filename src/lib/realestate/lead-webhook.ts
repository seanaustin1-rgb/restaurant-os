import type { Prisma, PrismaClient } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { normalizeBoldTrailLead, upsertLead } from "./lead-ingest";

// Webhook orchestration (impure): land raw → upsert → enqueue the alert event.
// Kept separate from lead-ingest.ts so the normalize/upsert unit tests don't
// pull in the Inngest client. Not unit-tested (prisma + inngest).

export const LEAD_RECEIVED_EVENT = "realestate/lead.received";

export interface IngestResult {
  leadId: string | null;
  created: boolean;
  ignored: boolean;
}

/**
 * Full BoldTrail webhook ingest:
 *  1. Land the raw payload in RawSourceEvent (audit/replay + idempotency).
 *  2. Normalize + idempotently upsert the Lead.
 *  3. For a genuinely NEW lead only, enqueue the alert/escalation event
 *     (a re-delivery updates the lead but does not re-alert).
 * Ignores payloads with no usable contact identity.
 */
export async function ingestBoldTrailLead(
  db: PrismaClient,
  restaurantId: string,
  payload: unknown,
): Promise<IngestResult> {
  const normalized = normalizeBoldTrailLead(payload);
  if (!normalized) return { leadId: null, created: false, ignored: true };

  const sourceObjectId = normalized.externalId ?? normalized.email ?? normalized.phone ?? "unknown";
  const jsonPayload = (payload ?? {}) as Prisma.InputJsonValue;

  const raw = await db.rawSourceEvent.upsert({
    where: {
      restaurantId_sourceSystem_sourceObjectType_sourceObjectId: {
        restaurantId,
        sourceSystem: "boldtrail",
        sourceObjectType: "lead",
        sourceObjectId,
      },
    },
    create: {
      restaurantId,
      sourceSystem: "boldtrail",
      sourceObjectType: "lead",
      sourceObjectId,
      payload: jsonPayload,
    },
    update: { payload: jsonPayload },
    select: { id: true },
  });

  const res = await upsertLead(db, { restaurantId, normalized, rawEventId: raw.id });

  if (res.created) {
    await inngest.send({
      name: LEAD_RECEIVED_EVENT,
      data: { restaurantId, leadId: res.id },
    });
  }

  return { leadId: res.id, created: res.created, ignored: false };
}
