/**
 * Builds the guest-vault data payload from canonical Spirit Vault rows.
 *
 * The static guest vault ships a data file that defines `window.SPIRIT_VAULT_DATA`.
 * The dynamic `/vault` route serves the same engine HTML and swaps that script
 * for a payload composed from SpiritDefinition + VenueSpirit + SpiritPour rows.
 */

export interface VaultDefinitionInput {
  slug: string;
  verificationStatus: string;
  brand: string;
  expression?: string | null;
  displayName?: string | null;
  subcategory?: string | null;
  category: string;
  silo?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  distilleryName?: string | null;
  producerName?: string | null;
  style?: string | null;
  proofN?: number | { toString(): string } | null;
  proofDisplay?: string | null;
  ageText: string;
  minYears?: number | null;
  maxYears?: number | null;
  ageSourceUrl?: string | null;
  agePending?: boolean | null;
  unaged?: boolean | null;
  body?: number | null;
  finish?: number | null;
  flavor?: unknown;
  topNotes?: string[];
  whyShort?: string | null;
  why?: string | null;
  production?: unknown;
  productionStructured?: unknown;
  prodTags?: string[];
  pairings?: unknown;
  timeline?: unknown;
  statTiles?: unknown;
  facts?: unknown;
  history?: string | null;
  coordinatesText?: string | null;
  press?: unknown;
  paths?: unknown;
  sources?: unknown;
  sourcingLimitations?: string[];
  knowledgeReviewedAt?: Date | string | null;
}

export interface VaultOfferInput {
  toastItemGuid?: string | null;
  pourSizeOz?: number | { toString(): string } | null;
  pourLabel?: string | null;
  priceUsd?: number | { toString(): string } | null;
  availability?: string | null;
  isPrimary?: boolean | null;
  priceIsTemporary?: boolean | null;
  priceProvenance?: string | null;
  commerceSource?: string | null;
  syncedAt?: Date | string | null;
}

/** Venue-local presentation overrides of shared definition sensory fields.
 *  Any field set here wins over the SpiritDefinition value for THIS tenant only;
 *  the shared canonical record is never mutated. Authored via the admin editor. */
export interface VaultOverridesInput {
  body?: number | null;
  finish?: number | null;
  flavor?: unknown;
  topNotes?: string[] | null;
  pairings?: unknown;
}

export interface VaultListingInput {
  id: string;
  slug: string;
  whyWeCarry?: string | null;
  seanShort?: string | null;
  notes?: string | null;
  recordStatus: string;
  publicationStatus: string;
  // Prisma Json column — the loose shape mirrors VaultOverridesInput; narrowed at use.
  overrides?: unknown;
  definition: VaultDefinitionInput;
  offers: VaultOfferInput[];
}

const PENDING = "Pending Sean review.";
const DEFAULT_PATHS = { lighter: [], similar: [], adventurous: [] };
const DEFAULT_FLAVOR = { Sweet: 5, Oak: 5, Spice: 5, Fruit: 4, Smoke: 1, Earth: 3, Herbal: 2 };
const num = (v: unknown): number | null =>
  v == null ? null : typeof v === "number" ? v : Number((v as { toString(): string }).toString());
const lower = (s: string) => s.toLowerCase();

function displayName(d: VaultDefinitionInput): string {
  return d.displayName ?? [d.brand, d.expression].filter(Boolean).join(" ");
}

function place(d: VaultDefinitionInput): string | null {
  const parts = [d.city, d.region, d.country].filter((v): v is string => typeof v === "string" && v.trim() !== "");
  return parts.length ? parts.join(" - ") : null;
}

function verification(status: string): string {
  if (status === "PARTIALLY_SOURCED") return "partially-sourced";
  if (status === "SOURCED") return "source-reviewed";
  return lower(status).replace(/_/g, "-");
}

function silo(category: string, explicit?: string | null): string {
  if (explicit) return explicit;
  const normalized = category.toLowerCase();
  if (normalized.includes("tequila") || normalized.includes("mezcal")) return "tequila";
  if (normalized.includes("rum")) return "rum";
  if (normalized.includes("scotch") || normalized.includes("irish") || normalized.includes("japanese")) return "scotch";
  return "bourbon";
}

function paths(value: unknown): Record<string, unknown[]> {
  return value && typeof value === "object" ? { ...DEFAULT_PATHS, ...(value as Record<string, unknown[]>) } : DEFAULT_PATHS;
}

function priceDisplay(usd: number | null): string {
  if (usd == null) return "Pending";
  const s = usd.toFixed(2).replace(/\.00$/, "");
  return `$${s}`;
}

/** One VenueSpirit + definition + primary offer -> the guest engine record shape. */
export function listingToVaultRecord(item: VaultListingInput): Record<string, unknown> {
  const d = item.definition;
  // Venue presentation overrides win over the shared definition for this tenant.
  const ov = (item.overrides ?? {}) as VaultOverridesInput;
  const primary = item.offers.find((offer) => offer.isPrimary) ?? item.offers[0] ?? null;
  const price = num(primary?.priceUsd);
  const proofN = num(d.proofN);

  const rec: Record<string, unknown> = {};
  rec.id = item.slug;
  rec.cat = d.category;
  rec.silo = silo(d.category, d.silo);
  rec.name = displayName(d);
  rec.brand = d.brand;
  if (d.expression != null) rec.expression = d.expression;
  if (d.subcategory != null) rec.subcategory = d.subcategory;
  rec.style = d.style ?? d.category;
  if (d.country != null) rec.country = d.country;
  if (d.region != null) rec.region = d.region;
  rec.distillery = `${d.producerName ?? d.distilleryName ?? d.brand} - ${[d.city, d.region, d.country].filter(Boolean).join(", ") || "Pending"}`;

  if (proofN != null) {
    rec.proofN = proofN;
    rec.proof = String(proofN);
  } else if (d.proofDisplay) {
    rec.proofN = null;
    rec.proof = d.proofDisplay;
  } else {
    rec.proofN = null;
    rec.proof = "Pending";
  }
  rec.age = d.ageText;
  rec.ageData = {
    minYears: d.minYears ?? null,
    maxYears: d.maxYears ?? null,
    sourceUrl: d.ageSourceUrl ?? null,
    pending: d.agePending === true,
    unaged: d.unaged === true,
  };

  rec.flavor = ov.flavor ?? d.flavor ?? DEFAULT_FLAVOR;
  rec.body = ov.body ?? d.body ?? 5;
  rec.finish = ov.finish ?? d.finish ?? 5;
  const effTopNotes =
    Array.isArray(ov.topNotes) && ov.topNotes.length ? ov.topNotes : d.topNotes?.length ? d.topNotes : null;
  rec.topNotes = effTopNotes ?? [PENDING, PENDING, PENDING];
  rec.whyShort = d.whyShort ?? PENDING;
  rec.why = d.why ?? PENDING;
  rec.production = Array.isArray(d.production) ? d.production : [];
  if (d.productionStructured) rec.productionStructured = d.productionStructured;
  rec.prodTags = d.prodTags ?? [];
  if (d.press) rec.press = d.press;
  rec.paths = paths(d.paths);
  rec.pairings = ov.pairings ?? d.pairings ?? [];

  rec.dist = {
    name: d.distilleryName ?? d.producerName ?? d.brand,
    place: place(d) ?? "Pending",
    history: d.history ?? PENDING,
    coord: d.coordinatesText ?? "Pending",
    timeline: Array.isArray(d.timeline) ? d.timeline : [],
  };
  rec.btb = {
    stats: Array.isArray(d.statTiles) ? d.statTiles : [],
    facts: Array.isArray(d.facts) ? d.facts : [],
  };
  rec.provenance = {
    sources: d.sources ?? null,
    sourcingLimitations: d.sourcingLimitations ?? [],
  };

  rec.whyWeCarry = item.whyWeCarry ?? PENDING;
  rec.seanShort = item.seanShort ?? PENDING;
  rec.notes = item.notes ?? PENDING;
  rec.commerce = {
    pourPriceUsd: price,
    pourSizeOz: num(primary?.pourSizeOz),
    pourLabel: primary?.pourLabel ?? null,
    toastItemGuid: primary?.toastItemGuid ?? null,
    availability: primary?.availability ?? null,
    priceIsTemporary: primary?.priceIsTemporary ?? true,
    priceProvenance: primary?.priceProvenance ?? null,
    source: primary?.commerceSource ? lower(primary.commerceSource) : null,
    sourceRecordedAt: primary?.syncedAt ?? null,
  };
  rec.price = priceDisplay(price);
  rec.priceL = primary?.pourLabel ?? "1.5 oz pour";
  rec.status = [{ k: lower(item.publicationStatus), t: primary?.availability ?? "Availability pending" }];
  rec.reviewedAt =
    d.knowledgeReviewedAt instanceof Date
      ? d.knowledgeReviewedAt.toISOString().slice(0, 10)
      : d.knowledgeReviewedAt ?? null;
  rec.recordStatus = lower(item.recordStatus);
  rec.publicationStatus = lower(item.publicationStatus);
  rec.verificationStatus = verification(d.verificationStatus);
  return rec;
}

/** Serialize rows into the `window.SPIRIT_VAULT_DATA` script body. */
export function buildVaultPayloadScript(items: VaultListingInput[]): string {
  const records = items.map(listingToVaultRecord);
  return `window.SPIRIT_VAULT_DATA = function(){ return ${JSON.stringify(records)}; };`;
}
