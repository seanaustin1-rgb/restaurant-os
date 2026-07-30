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

export interface VaultListingInput {
  id: string;
  slug: string;
  whyWeCarry?: string | null;
  seanShort?: string | null;
  notes?: string | null;
  recordStatus: string;
  publicationStatus: string;
  definition: VaultDefinitionInput;
  offers: VaultOfferInput[];
}

const PENDING = "Pending Sean review.";
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

function priceDisplay(usd: number | null): string {
  if (usd == null) return "Pending";
  const s = usd.toFixed(2).replace(/\.00$/, "");
  return `$${s}`;
}

/** One VenueSpirit + definition + primary offer -> the guest engine record shape. */
export function listingToVaultRecord(item: VaultListingInput): Record<string, unknown> {
  const d = item.definition;
  const primary = item.offers.find((offer) => offer.isPrimary) ?? item.offers[0] ?? null;
  const price = num(primary?.priceUsd);
  const proofN = num(d.proofN);

  const rec: Record<string, unknown> = {};
  rec.id = item.slug;
  rec.cat = d.category;
  rec.name = displayName(d);
  rec.brand = d.brand;
  if (d.expression != null) rec.expression = d.expression;
  if (d.subcategory != null) rec.subcategory = d.subcategory;
  if (d.style != null) rec.style = d.style;
  if (d.silo != null) rec.silo = d.silo;
  if (d.country != null) rec.country = d.country;
  if (d.region != null) rec.region = d.region;

  if (proofN != null) {
    rec.proofN = proofN;
    rec.proof = String(proofN);
  } else if (d.proofDisplay) {
    rec.proofN = null;
    rec.proof = d.proofDisplay;
  }
  rec.age = d.ageText;
  rec.ageData = {
    minYears: d.minYears ?? null,
    maxYears: d.maxYears ?? null,
    sourceUrl: d.ageSourceUrl ?? null,
    pending: d.agePending === true,
    unaged: d.unaged === true,
  };

  if (d.flavor) rec.flavor = d.flavor;
  if (d.body != null) rec.body = d.body;
  if (d.finish != null) rec.finish = d.finish;
  rec.topNotes = d.topNotes ?? [];
  if (d.whyShort != null) rec.whyShort = d.whyShort;
  if (d.why != null) rec.why = d.why;
  if (d.production) rec.production = d.production;
  if (d.productionStructured) rec.productionStructured = d.productionStructured;
  if (d.prodTags) rec.prodTags = d.prodTags;
  if (d.press) rec.press = d.press;
  if (d.paths) rec.paths = d.paths;
  if (d.pairings) rec.pairings = d.pairings;

  rec.dist = {
    name: d.distilleryName ?? d.producerName ?? null,
    place: place(d),
    history: d.history ?? null,
    coord: d.coordinatesText ?? null,
    timeline: d.timeline ?? null,
  };
  rec.btb = {
    stats: d.statTiles ?? null,
    facts: d.facts ?? null,
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
