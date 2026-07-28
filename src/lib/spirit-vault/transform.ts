// Spirit Vault — transform: one rendered guest record → DB rows (Spirit + pours).
//
// Pure and deterministic. Consumes a record exactly as the guest engine renders
// it (the output of makeBatchSpirit, or a legacy canonical object) and returns
// the column-shaped inputs the importer writes. Kept separate from any I/O so it
// unit-tests against the real 110 records with no DB.
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

export interface SpiritRow {
  slug: string;
  recordStatus: SpiritLifecycleStatus;
  publicationStatus: SpiritLifecycleStatus;
  verificationStatus: SpiritVerificationStatus;
  brand: string;
  expression: string | null;
  displayName: string | null;
  subcategory: string | null;
  category: string;
  silo: string | null;
  country: string | null;
  region: string | null;
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
  whyShort: string | null;
  why: string | null;
  whyWeCarry: string | null;
  seanShort: string | null;
  notes: string | null;
  topNotes: string[];
  flavor: unknown | null;
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
  reviewedAt: string | null; // ISO date; importer coerces to Date
}

export interface PourRow {
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
  spirit: SpiritRow;
  pours: PourRow[];
}

const LIFECYCLE: Record<string, SpiritLifecycleStatus> = {
  draft: "DRAFT",
  reviewed: "REVIEWED",
  published: "PUBLISHED",
};

const VERIFICATION: Record<string, SpiritVerificationStatus> = {
  unsourced: "UNSOURCED",
  "partially-sourced": "PARTIALLY_SOURCED",
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

/** Map a single guest record to its Spirit row + pour rows. */
export function guestRecordToRows(r: GuestRecord): TransformResult {
  // Legacy objects have no publication/record status and are guest-visible.
  const publicationStatus = lifecycle(r.publicationStatus, "PUBLISHED");
  const recordStatus = lifecycle(r.recordStatus, "PUBLISHED");
  const verificationStatus =
    (typeof r.verificationStatus === "string" && VERIFICATION[r.verificationStatus]) ||
    "PARTIALLY_SOURCED";

  const spirit: SpiritRow = {
    slug: String(r.id),
    recordStatus,
    publicationStatus,
    verificationStatus,
    brand: nz(r.brand) ?? nz(r.name) ?? String(r.id),
    expression: nz(r.expression),
    displayName: nz(r.name),
    subcategory: nz(r.subcategory),
    category: nz(r.cat) ?? "Unknown",
    silo: nz(r.silo),
    country: nz(r.country),
    region: nz(r.region),
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
    whyShort: nz(r.whyShort),
    why: nz(r.why),
    whyWeCarry: nz(r.whyWeCarry),
    seanShort: nz(r.seanShort),
    notes: nz(r.notes),
    topNotes: Array.isArray(r.topNotes) ? r.topNotes.filter((x: unknown) => typeof x === "string") : [],
    flavor: r.flavor ?? null,
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
    reviewedAt: nz(r.reviewedAt),
  };

  const pours: PourRow[] = [pourFromRecord(r)];

  return { spirit, pours };
}

/** The one primary pour a legacy/batch record implies. When Toast provides the
 *  full 2–3 pour set, the sync layer adds the rest; each existing record has
 *  exactly one, flagged primary. */
function pourFromRecord(r: GuestRecord): PourRow {
  const c = r.commerce;
  if (c) {
    const source: SpiritCommerceSource =
      typeof c.source === "string" && c.source.toLowerCase() === "toast" ? "TOAST" : "MANUAL";
    return {
      toastItemGuid: nz(c.toastItemGuid),
      pourSizeOz: typeof c.pourSizeOz === "number" ? c.pourSizeOz : parsePourOz(r.priceL),
      pourLabel: nz(r.priceL),
      priceUsd: parseMoney(c.pourPriceUsd),
      availability: nz(c.availability),
      isPrimary: true,
      priceIsTemporary: c.priceIsTemporary !== false,
      priceProvenance: nz(c.priceProvenance),
      commerceSource: source,
      syncedAt: nz(c.sourceRecordedAt),
    };
  }
  // Legacy: no commerce block — derive from the display price + label.
  return {
    toastItemGuid: null,
    pourSizeOz: parsePourOz(r.priceL),
    pourLabel: nz(r.priceL),
    priceUsd: parseMoney(r.price),
    availability: nz(r.status?.[0]?.t),
    isPrimary: true,
    priceIsTemporary: true,
    priceProvenance: null,
    commerceSource: "MANUAL",
    syncedAt: null,
  };
}
