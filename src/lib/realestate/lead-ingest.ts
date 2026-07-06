import type { BrokerageSourceSystem, LeadSource, PrismaClient } from "@prisma/client";

// Lead ingestion: turn a BoldTrail webhook payload into a normalized lead, then
// idempotently upsert it. The BoldTrail Smart-Campaign webhook lands raw in
// RawSourceEvent first (audit/replay) — this module is the normalize + upsert
// half. Deterministic and defensive; no AI.
//
// ⚠ BoldTrail's exact payload field names are TBD (confirm with the Inside Real
// Estate rep). normalizeBoldTrailLead reads the common kvCORE/BoldTrail shapes
// and is the SINGLE place to adjust once the schema is confirmed.

export interface NormalizedLead {
  externalId: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null; // E.164 when parseable
  origin: LeadSource | null; // marketing channel
  receivedAt: Date | null; // from payload; the upsert defaults null → now
}

/** Map a BoldTrail/kvCORE lead-source string to our marketing-channel enum. */
export function mapLeadSource(raw: string | null | undefined): LeadSource | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("zillow")) return "ZILLOW";
  if (s.includes("realtor")) return "REALTOR_COM";
  if (s.includes("facebook") || s.includes("fb") || s.includes("meta")) return "FACEBOOK";
  if (s.includes("referral")) return "REFERRAL";
  if (s.includes("open house") || s.includes("openhouse")) return "OPEN_HOUSE";
  if (s.includes("idx") || s.includes("website") || s.includes("kvcore") || s.includes("boldtrail")) {
    return "IDX_WEBSITE";
  }
  return "OTHER";
}

/** Normalize a US phone to E.164 (+1XXXXXXXXXX). Returns null if unrecognizable. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.trim().startsWith("+") && digits.length >= 8) return `+${digits}`;
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}
function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}
function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const val = str(obj[k]);
    if (val) return val;
  }
  return null;
}
function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t);
}

/**
 * Map a BoldTrail Smart-Campaign webhook payload to a NormalizedLead. Reads the
 * contact whether it's top-level or nested under lead/contact/data. Returns null
 * if the payload carries no usable identity (no id, email, or phone).
 */
export function normalizeBoldTrailLead(payload: unknown): NormalizedLead | null {
  const obj = asRecord(payload);
  if (!obj) return null;
  const lead = asRecord(obj.lead) ?? asRecord(obj.contact) ?? asRecord(obj.data) ?? obj;

  const externalId = pick(lead, ["id", "lead_id", "leadId", "uuid", "contact_id"]);
  const first = pick(lead, ["first_name", "firstName"]);
  const last = pick(lead, ["last_name", "lastName"]);
  const joined = [first, last].filter(Boolean).join(" ");
  const fullName = pick(lead, ["name", "full_name", "fullName"]) ?? (joined || null);
  const email = pick(lead, ["email", "email_address", "emailAddress"]);
  const phone = normalizePhone(pick(lead, ["phone", "cell_phone", "mobile", "phone_number", "cellPhone"]));
  const origin = mapLeadSource(pick(lead, ["source", "lead_source", "leadSource", "source_name"]));
  const receivedAt = parseDate(pick(lead, ["created", "created_at", "createdAt", "date_created", "dateCreated"]));

  if (!externalId && !email && !phone) return null;
  return { externalId, fullName, email, phone, origin, receivedAt };
}

export interface UpsertLeadResult {
  id: string;
  created: boolean;
}

/**
 * Idempotent upsert keyed by (restaurantId, sourceSystem, externalId) — a retried
 * BoldTrail delivery updates the existing lead instead of duplicating it. When
 * externalId is null (no id in the payload) we can't dedup, so a fresh lead is
 * created. Never overwrites the response clock (receivedAt/firstTouch) on update.
 */
export async function upsertLead(
  db: PrismaClient,
  params: { restaurantId: string; normalized: NormalizedLead; rawEventId?: string | null },
): Promise<UpsertLeadResult> {
  const { restaurantId, normalized, rawEventId } = params;
  const sourceSystem: BrokerageSourceSystem = "BOLDTRAIL";

  if (normalized.externalId) {
    const existing = await db.lead.findUnique({
      where: {
        restaurantId_sourceSystem_externalId: {
          restaurantId,
          sourceSystem,
          externalId: normalized.externalId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      await db.lead.update({
        where: { id: existing.id },
        data: {
          fullName: normalized.fullName ?? undefined,
          email: normalized.email ?? undefined,
          phone: normalized.phone ?? undefined,
          origin: normalized.origin ?? undefined,
          rawEventId: rawEventId ?? undefined,
          // receivedAt / firstTouchAt / responseSeconds are intentionally left alone.
        },
      });
      return { id: existing.id, created: false };
    }
  }

  const lead = await db.lead.create({
    data: {
      restaurantId,
      sourceSystem,
      externalId: normalized.externalId,
      origin: normalized.origin,
      fullName: normalized.fullName,
      email: normalized.email,
      phone: normalized.phone,
      receivedAt: normalized.receivedAt ?? new Date(),
      rawEventId: rawEventId ?? null,
    },
    select: { id: true },
  });
  return { id: lead.id, created: true };
}
