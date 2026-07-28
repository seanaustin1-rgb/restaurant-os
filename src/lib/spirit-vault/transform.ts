// Spirit Vault — transform: one rendered guest record → split DB rows.
//
// Pure and deterministic. Consumes a record exactly as the guest engine renders
// it (the output of makeBatchSpirit, or a legacy canonical object) and returns
// the column-shaped inputs the importer writes. Kept separate from any I/O so it
// unit-tests against the real 110 records with no DB.
//
// The old single `Spirit` model was split into four:
//   • SpiritDefinition — shared, canonical knowledge (no restaurantId);
//   • VenueSpirit      — a tenant's listing of a definition (Echo's, here);
//   • SpiritPour       — a priced offer under a VenueSpirit;
//   • SpiritPriceObservation — append-only price history (seeded by the
//     importer at write time; NOT emitted here).
// This module re-slices the SAME field mappings into the three writable rows
// (definition / venueSpirit / offers); the importer wires the FKs
// (spiritDefinitionId, restaurantId, venueSpiritId) at write time.
//
// The two source shapes diverge and both must map losslessly:
//   • batch records (makeBatchSpirit output) carry status enums, `commerce`, and
//     `provenance`;
//   • the five legacy objects predate those — no status/commerce/brand; price is
//     a "$14" string and the pour size is implied by `priceL` ("2 oz pour").
// Legacy records are guest-visible today, so they map to PUBLISHED.

import type {
  SpiritLifecycleStatus,
  SpiritVerificationStatus,
  SpiritCommerceSource,
} from "@prisma/client";

/** Loosely-typed guest record — the renderer produces plain objects. */
export type GuestRecord = Record<string, any>;

/**
 * Echo's Toast prices are for a 1.5-ounce pour. The static guest data mislabels
 * this as a "2 oz pour" (`record.priceL` / `record.commerce.pourSizeOz`); that 2
 * is ignored and every primary offer is recorded at 1.5 oz. — Sean, 2026-07-28.
 */
export const ECHO_TOAST_POUR_OZ = 1.5;
const ECHO_TOAST_POUR_LABEL = "1.5 oz pour";

/**
 * Every primary offer records the 1.5 oz correction, but the rest of the
 * provenance must match the offer's actual source — a manual/legacy price must
 * not claim to be a Toast basis. `commerceSource` and `priceProvenance` never
 * contradict each other.
 */
const POUR_SIZE_NOTE =
  "Pour size corrected to 1.5 oz from the legacy '2 oz pour' guest-data display, per Sean 2026-07-28.";
const ECHO_TOAST_PRICE_PROVENANCE = `Price is Echo's Toast selling-price basis for this pour. ${POUR_SIZE_NOTE}`;
const ECHO_MANUAL_PRICE_PROVENANCE = `Price is Sean's confirmed current Echo menu price; temporary venue commerce value pending Toast integration. ${POUR_SIZE_NOTE}`;
const ECHO_LEGACY_PRICE_PROVENANCE = `Price parsed from the legacy guest-data display; venue commerce value pending Toast integration. ${POUR_SIZE_NOTE}`;

/** Shared canonical knowledge — one row per distinct spirit (no restaurantId). */
export interface SpiritDefinitionRow {
  slug: string;
  schemaVersion: string;
  verificationStatus: SpiritVerificationStatus;
  brand: string;
  expression: string | null;
  displayName: string | null;
  subcategory: string | null;
  category: string;
  silo: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  distilleryName: string | null;
  producerName: string | null;
  style: string | null;
  proofN: number | null;
  proofDisplay: string | null;
  ageText: string;
  minYears: number | null;
  maxYears: number | null;
  ageSourceUrl: string | null;
  agePending: boolean;
  unaged: boolean;
  body: number | null;
  finish: number | null;
  flavor: unknown | null;
  topNotes: string[];
  whyShort: string | null;
  why: string | null;
  production: unknown | null;
  productionStructured: unknown | null;
  prodTags: string[];
  pairings: unknown | null;
  timeline: unknown | null;
  statTiles: unknown | null;
  facts: unknown | null;
  history: string | null;
  coordinatesText: string | null;
  press: unknown | null;
  paths: unknown | null;
  sources: unknown | null;
  sourcingLimitations: string[];
  knowledgeReviewedAt: string | null; // ISO date; importer coerces to Date
  knowledgeReviewedBy: string | null;
}

/** A tenant's listing of a definition — venue-authored voice + state. */
export interface VenueSpiritRow {
  slug: string;
  recordStatus: SpiritLifecycleStatus;
  publicationStatus: SpiritLifecycleStatus;
  whyWeCarry: string | null;
  seanShort: string | null;
  notes: string | null;
  overrides: unknown | null;
  reviewedAt: string | null; // ISO date; importer coerces to Date
  reviewedBy: string | null;
}

/** A priced offer under a VenueSpirit. */
export interface SpiritPourRow {
  toastItemGuid: string | null;
  pourSizeOz: number | null;
  pourLabel: string | null;
  priceUsd: number | null;
  availability: string | null;
  isPrimary: boolean;
  priceIsTemporary: boolean;
  priceProvenance: string | null;
  commerceSource: SpiritCommerceSource;
  syncedAt: string | null;
}

export interface TransformResult {
  definition: SpiritDefinitionRow; // shared knowledge
  venueSpirit: VenueSpiritRow; // tenant listing (Echo's, during testing)
  offers: SpiritPourRow[]; // one primary offer per record
}

const LIFECYCLE: Record<string, SpiritLifecycleStatus> = {
  draft: "DRAFT",
  reviewed: "REVIEWED",
  published: "PUBLISHED",
};

const VERIFICATION: Record<string, SpiritVerificationStatus> = {
  unsourced: "UNSOURCED",
  "partially-sourced": "PARTIALLY_SOURCED",
  "source-reviewed": "SOURCED", // the source data's label for fully-sourced dossiers
  sourced: "SOURCED",
};

function lifecycle(v: unknown, fallback: SpiritLifecycleStatus): SpiritLifecycleStatus {
  return (typeof v === "string" && LIFECYCLE[v]) || fallback;
}

function nz(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** Parse a "$14" / "$16.50" display string into a number, or null. */
function parseMoney(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Pull the ounce figure out of a pour label like "2 oz pour". */
function parsePourOz(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = v.match(/([\d.]+)\s*oz/i);
  return m ? Number(m[1]) : null;
}

/** Map a single guest record to its definition / venueSpirit / offer rows. */
export function guestRecordToRows(r: GuestRecord): TransformResult {
  // Legacy objects have no publication/record status and are guest-visible.
  const publicationStatus = lifecycle(r.publicationStatus, "PUBLISHED");
  const recordStatus = lifecycle(r.recordStatus, "PUBLISHED");
  // Missing/unknown → UNSOURCED (the 5 legacy dossiers carry no status and are
  // genuinely unsourced). Never default to PARTIALLY_SOURCED — that overstated
  // the sourcing of unverified rows.
  const verificationStatus =
    (typeof r.verificationStatus === "string" && VERIFICATION[r.verificationStatus]) ||
    "UNSOURCED";

  const definition: SpiritDefinitionRow = {
    slug: String(r.id),
    schemaVersion: nz(r.schemaVersion) ?? "spirit-v1",
    verificationStatus,
    brand: nz(r.brand) ?? nz(r.name) ?? String(r.id),
    expression: nz(r.expression),
    displayName: nz(r.name),
    subcategory: nz(r.subcategory),
    category: nz(r.cat) ?? "Unknown",
    // Do NOT trust r.silo: makeBatchSpirit hardcodes 'bourbon' on every record,
    // which would mislabel the 48 non-bourbons. Stays null until the canonical
    // category→silhouette mapper lands (Phase 1.5).
    silo: null,
    country: nz(r.country),
    region: nz(r.region),
    city: nz(r.city),
    distilleryName: nz(r.distilleryName) ?? nz(r.dist?.name),
    producerName: nz(r.producerName),
    style: nz(r.style),
    proofN: typeof r.proofN === "number" ? r.proofN : null,
    proofDisplay: typeof r.proofN === "number" ? null : nz(r.proof),
    ageText: nz(r.age) ?? "NAS",
    minYears: typeof r.ageData?.minYears === "number" ? r.ageData.minYears : null,
    maxYears: typeof r.ageData?.maxYears === "number" ? r.ageData.maxYears : null,
    ageSourceUrl: nz(r.ageData?.sourceUrl),
    agePending: r.ageData?.pending === true,
    unaged: r.ageData?.unaged === true,
    body: typeof r.body === "number" ? r.body : null,
    finish: typeof r.finish === "number" ? r.finish : null,
    flavor: r.flavor ?? null,
    topNotes: Array.isArray(r.topNotes) ? r.topNotes.filter((x: unknown) => typeof x === "string") : [],
    whyShort: nz(r.whyShort),
    why: nz(r.why),
    production: r.production ?? null,
    productionStructured: r.productionStructured ?? null,
    prodTags: Array.isArray(r.prodTags) ? r.prodTags.filter((x: unknown) => typeof x === "string") : [],
    pairings: r.pairings ?? null,
    timeline: r.dist?.timeline ?? null,
    statTiles: r.btb?.stats ?? null,
    facts: r.btb?.facts ?? null,
    history: nz(r.dist?.history),
    coordinatesText: nz(r.dist?.coord),
    press: r.press ?? null,
    paths: r.paths ?? null,
    sources: r.provenance?.sources ?? null,
    sourcingLimitations: Array.isArray(r.provenance?.sourcingLimitations)
      ? r.provenance.sourcingLimitations.filter((x: unknown) => typeof x === "string")
      : [],
    // The dossier review date describes the shared KNOWLEDGE (ratings, sources,
    // production), so it lives on the definition, not the venue listing.
    knowledgeReviewedAt: nz(r.reviewedAt),
    knowledgeReviewedBy: null,
  };

  const venueSpirit: VenueSpiritRow = {
    slug: String(r.id),
    recordStatus,
    publicationStatus,
    whyWeCarry: nz(r.whyWeCarry),
    seanShort: nz(r.seanShort),
    notes: nz(r.notes),
    overrides: null,
    // Venue-level publication review is distinct from the dossier's knowledge
    // review; none has happened at import time.
    reviewedAt: null,
    reviewedBy: null,
  };

  const offers: SpiritPourRow[] = [pourFromRecord(r)];

  return { definition, venueSpirit, offers };
}

/** The one primary offer a legacy/batch record implies. When Toast provides the
 *  full 2–3 pour set, the sync layer adds the rest; each existing record has
 *  exactly one, flagged primary. The pour size is always Echo's real 1.5 oz —
 *  the legacy "2 oz" display is deliberately ignored (see ECHO_TOAST_POUR_OZ). */
function pourFromRecord(r: GuestRecord): SpiritPourRow {
  const c = r.commerce;
  if (c) {
    const isToast = typeof c.source === "string" && c.source.toLowerCase() === "toast";
    const source: SpiritCommerceSource = isToast ? "TOAST" : "MANUAL";
    return {
      toastItemGuid: nz(c.toastItemGuid),
      pourSizeOz: ECHO_TOAST_POUR_OZ,
      pourLabel: ECHO_TOAST_POUR_LABEL,
      priceUsd: parseMoney(c.pourPriceUsd),
      availability: nz(c.availability),
      isPrimary: true,
      priceIsTemporary: c.priceIsTemporary !== false,
      // Provenance matches the source — never claim a Toast basis for a manual price.
      priceProvenance: isToast ? ECHO_TOAST_PRICE_PROVENANCE : ECHO_MANUAL_PRICE_PROVENANCE,
      commerceSource: source,
      syncedAt: nz(c.sourceRecordedAt),
    };
  }
  // Legacy: no commerce block — derive the price from the display string.
  return {
    toastItemGuid: null,
    pourSizeOz: ECHO_TOAST_POUR_OZ,
    pourLabel: ECHO_TOAST_POUR_LABEL,
    priceUsd: parseMoney(r.price),
    availability: nz(r.status?.[0]?.t),
    isPrimary: true,
    priceIsTemporary: true,
    priceProvenance: ECHO_LEGACY_PRICE_PROVENANCE,
    commerceSource: "MANUAL",
    syncedAt: null,
  };
}
