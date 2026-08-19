// Tenant-scoped candidate resolver for the ASAP Flight Builder. Answers one
// question: "for THIS restaurant and THIS template, which pours can fill each
// slot, best first?"
//
// flight-templates.ts owns template CONTENT and never encodes tenancy; this file
// owns the tenancy. Every query here is restaurantId-scoped, and only pours that
// could legally be saved are ever returned — published listing (recordStatus +
// publicationStatus) with a priced, sized offer, exactly the predicate
// flights/actions.ts re-validates on save. A candidate the picker offers can
// therefore never be rejected by the server for eligibility reasons.
//
// Layering: the matching / ranking / grouping half is pure and takes plain rows,
// so it is tested without a database; only loadFlightCandidatePours touches
// Prisma. Ranking is by Toast units sold in a recent window — what guests
// actually order beats alphabetical — with deterministic tiebreaks so the same
// vault always renders the same list.

import { prisma } from "@/lib/prisma";
import type { FlightTemplate, FlightTemplateRules, FlightTemplateSlot } from "@/lib/spirit-vault/flight-templates";
import { suggestBites } from "@/lib/spirit-vault/flight-pairings";

/** Days of Toast history that decide candidate rank. A season of sales — long
 *  enough to be stable, short enough to follow a menu that moved. */
export const TOAST_RANK_WINDOW_DAYS = 90;

/** One published, priced pour that may be offered as a flight component, plus the
 *  resolved fields the template rules match on. Structurally a superset of the
 *  builder's FlightPourOption, so it feeds the picker directly. */
export interface FlightCandidatePour {
  venueSpiritId: string;
  spiritPourId: string;
  name: string;
  category: string;
  pourLabel: string;
  pourSizeOz: number;
  priceUsd: number;
  oneOzPriceUsd: number;
  suggestedBites: string[];
  /** Numeric proof; null for barrel/varying-proof bottles (fails proof-bounded rules). */
  proofN: number | null;
  /** Lower-cased identity + production text that `searchTerms` scans. */
  searchText: string;
  /** The venue wrote whyWeCarry / seanShort / notes for this listing. */
  hasVenueVoice: boolean;
  /** Units sold on Toast inside the ranking window; 0 when unmatched or unsold. */
  toastUnitsSold: number;
}

/** A template slot with its resolved, ranked candidate pool. */
export interface FlightTemplateSlotCandidates {
  slot: FlightTemplateSlot;
  candidates: FlightCandidatePour[];
}

export interface FlightTemplateCandidates {
  templateKey: string;
  slots: FlightTemplateSlotCandidates[];
  /** Every pour matching at least one slot, ranked — the flat pool for one-slot templates. */
  matched: FlightCandidatePour[];
  /** Slots this vault cannot fill. The picker says so rather than silently shrinking the flight. */
  emptySlotKeys: string[];
}

// ── Row shapes (mirror the Prisma selects, so the mapping layer stays pure) ──

export interface CandidateOfferRow {
  id: string;
  toastItemGuid: string | null;
  pourLabel: string | null;
  pourSizeOz: unknown;
  priceUsd: unknown;
}

export interface CandidateListingRow {
  id: string;
  whyWeCarry: string | null;
  seanShort: string | null;
  notes: string | null;
  overrides: unknown;
  definition: {
    brand: string;
    expression: string | null;
    displayName: string | null;
    subcategory: string | null;
    category: string;
    style: string | null;
    proofN: unknown;
    prodTags: string[];
    production: unknown;
    flavor: unknown;
  };
  offers: CandidateOfferRow[];
}

function decimalToNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number((v as { toString(): string }).toString());
  return Number.isFinite(n) ? n : null;
}

function present(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim() !== "";
}

function displayName(d: CandidateListingRow["definition"]): string {
  return d.displayName ?? [d.brand, d.expression].filter(Boolean).join(" ");
}

/** Flatten the `production` Json (productionRows: [{ k, v }]) to its string values.
 *  Anything else in the column is ignored rather than stringified — no "[object
 *  Object]" noise leaking into the search haystack. */
function productionText(production: unknown): string[] {
  if (!Array.isArray(production)) return [];
  const out: string[] = [];
  for (const row of production) {
    if (!row || typeof row !== "object") continue;
    const { k, v } = row as { k?: unknown; v?: unknown };
    if (typeof k === "string") out.push(k);
    if (typeof v === "string") out.push(v);
  }
  return out;
}

/** The haystack `searchTerms` scans: identity (name, brand, expression, category,
 *  subcategory, style) plus production text (prodTags + production rows). Category
 *  is included deliberately — a Rye whose label never says "rye" should still
 *  answer a "rye" term — so `searchTerms` and `categories` overlap by design. */
function buildSearchText(d: CandidateListingRow["definition"]): string {
  return [
    displayName(d),
    d.brand,
    d.expression,
    d.category,
    d.subcategory,
    d.style,
    ...d.prodTags,
    ...productionText(d.production),
  ]
    .filter((part): part is string => typeof part === "string" && part !== "")
    .join(" ")
    .toLowerCase();
}

/** Expand one published listing into a candidate per priced+sized offer. An offer
 *  missing a price or a size is dropped here, not surfaced-then-rejected on save. */
export function listingToCandidatePours(
  listing: CandidateListingRow,
  toastUnitsByGuid: ReadonlyMap<string, number> = new Map(),
): FlightCandidatePour[] {
  const overrides = listing.overrides && typeof listing.overrides === "object" ? (listing.overrides as { flavor?: unknown }) : null;
  const suggestedBites = suggestBites(overrides?.flavor ?? listing.definition.flavor);
  const name = displayName(listing.definition);
  const searchText = buildSearchText(listing.definition);
  const proofN = decimalToNumber(listing.definition.proofN);
  const hasVenueVoice = present(listing.whyWeCarry) || present(listing.seanShort) || present(listing.notes);

  return listing.offers.flatMap((offer) => {
    const priceUsd = decimalToNumber(offer.priceUsd);
    const pourSizeOz = decimalToNumber(offer.pourSizeOz);
    if (priceUsd == null || pourSizeOz == null || pourSizeOz <= 0) return [];
    return [
      {
        venueSpiritId: listing.id,
        spiritPourId: offer.id,
        name,
        category: listing.definition.category,
        pourLabel: offer.pourLabel ?? `${pourSizeOz} oz`,
        pourSizeOz,
        priceUsd,
        oneOzPriceUsd: Math.round((priceUsd / pourSizeOz) * 100) / 100,
        suggestedBites,
        proofN,
        searchText,
        hasVenueVoice,
        toastUnitsSold: (offer.toastItemGuid ? toastUnitsByGuid.get(offer.toastItemGuid) : undefined) ?? 0,
      },
    ];
  });
}

// ── Rule matching (pure) ──

/** Bottled-in-Bond is a legal standard, not a vibe: bonded wording AND exactly 100
 *  proof. Word-boundary matching keeps "bib" off "Bibb County" — the same guard the
 *  categorization engine uses on short keywords. */
const BONDED_RE = /\b(bottled[\s-]?in[\s-]?bond(ed)?|bonded|bib)\b/;

function matchesCategories(pour: FlightCandidatePour, categories: string[]): boolean {
  const category = pour.category.toLowerCase();
  return categories.some((c) => {
    const needle = c.trim().toLowerCase();
    return needle !== "" && category.includes(needle);
  });
}

/** A pour fills a slot when it satisfies EVERY rule the slot sets; within a list
 *  rule (categories, searchTerms) any one entry is enough. Unset rules never
 *  constrain. Proof rules exclude null-proof bottles: an unknown proof cannot be
 *  proven to sit inside a range, and the builder must not guess on a proof ladder. */
export function matchesFlightTemplateRules(pour: FlightCandidatePour, rules: FlightTemplateRules): boolean {
  if (rules.proofMin != null || rules.proofMax != null) {
    if (pour.proofN == null) return false;
    if (rules.proofMin != null && pour.proofN < rules.proofMin) return false;
    if (rules.proofMax != null && pour.proofN > rules.proofMax) return false;
  }
  if (rules.categories?.length && !matchesCategories(pour, rules.categories)) return false;
  if (rules.searchTerms?.length) {
    const hit = rules.searchTerms.some((term) => {
      const needle = term.trim().toLowerCase();
      return needle !== "" && pour.searchText.includes(needle);
    });
    if (!hit) return false;
  }
  if (rules.requiresBottledInBond && !(BONDED_RE.test(pour.searchText) && pour.proofN === 100)) return false;
  if (rules.requiresVenueVoice && !pour.hasVenueVoice) return false;
  return true;
}

/** Best first: what guests actually order, then price ascending so a manager
 *  scanning a tie sees the approachable pour first, then id — fully deterministic,
 *  never locale-dependent. */
export function rankFlightCandidates(pours: readonly FlightCandidatePour[]): FlightCandidatePour[] {
  return [...pours].sort(
    (a, b) =>
      b.toastUnitsSold - a.toastUnitsSold ||
      a.oneOzPriceUsd - b.oneOzPriceUsd ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
      (a.spiritPourId < b.spiritPourId ? -1 : a.spiritPourId > b.spiritPourId ? 1 : 0),
  );
}

/** Group a ranked candidate pool by template slot. A pour that satisfies several
 *  slots appears under each — the slots of a progression are guidance, and the
 *  save path is what enforces one appearance per spirit in a flight. */
export function groupCandidatesByTemplateSlot(
  template: FlightTemplate,
  pours: readonly FlightCandidatePour[],
): FlightTemplateCandidates {
  const ranked = rankFlightCandidates(pours);
  const slots = template.slots.map((slot) => ({
    slot,
    candidates: ranked.filter((pour) => matchesFlightTemplateRules(pour, slot.rules)),
  }));

  const matchedIds = new Set(slots.flatMap((group) => group.candidates.map((pour) => pour.spiritPourId)));
  return {
    templateKey: template.key,
    slots,
    matched: ranked.filter((pour) => matchedIds.has(pour.spiritPourId)),
    emptySlotKeys: slots.filter((group) => group.candidates.length === 0).map((group) => group.slot.key),
  };
}

// ── Loading (the only Prisma-aware layer) ──

export interface LoadFlightCandidatesOptions {
  /** Toast ranking window; defaults to TOAST_RANK_WINDOW_DAYS. */
  windowDays?: number;
  /** Window anchor — injectable so callers (and tests) control "now". */
  now?: Date;
}

function windowStart({ windowDays = TOAST_RANK_WINDOW_DAYS, now = new Date() }: LoadFlightCandidatesOptions): Date {
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - windowDays);
  return since;
}

/** Every flight-eligible pour for one restaurant, ranked. The where-clause is the
 *  eligibility contract: this tenant, published listing, priced and sized offer. */
export async function loadFlightCandidatePours(
  restaurantId: string,
  options: LoadFlightCandidatesOptions = {},
): Promise<FlightCandidatePour[]> {
  const pricedOffer = { priceUsd: { not: null }, pourSizeOz: { not: null } } as const;

  const listings = await prisma.venueSpirit.findMany({
    where: {
      restaurantId,
      recordStatus: "PUBLISHED",
      publicationStatus: "PUBLISHED",
      offers: { some: pricedOffer },
    },
    orderBy: [{ definition: { category: "asc" } }, { slug: "asc" }],
    select: {
      id: true,
      whyWeCarry: true,
      seanShort: true,
      notes: true,
      overrides: true,
      definition: {
        select: {
          brand: true,
          expression: true,
          displayName: true,
          subcategory: true,
          category: true,
          style: true,
          proofN: true,
          prodTags: true,
          production: true,
          flavor: true,
        },
      },
      offers: {
        where: pricedOffer,
        orderBy: [{ isPrimary: "desc" }, { pourSizeOz: "asc" }],
        select: { id: true, toastItemGuid: true, pourLabel: true, pourSizeOz: true, priceUsd: true },
      },
    },
  });

  const guids = listings.flatMap((listing) =>
    listing.offers.map((offer) => offer.toastItemGuid).filter((guid): guid is string => !!guid),
  );

  // No Toast-linked pours → no sales query at all; every candidate ranks at 0 and
  // falls through to the deterministic tiebreaks.
  const toastUnitsByGuid = guids.length === 0 ? new Map<string, number>() : await loadToastUnits(restaurantId, guids, options);

  return rankFlightCandidates(listings.flatMap((listing) => listingToCandidatePours(listing, toastUnitsByGuid)));
}

async function loadToastUnits(
  restaurantId: string,
  guids: string[],
  options: LoadFlightCandidatesOptions,
): Promise<Map<string, number>> {
  const rows = await prisma.menuItemSales.groupBy({
    by: ["menuItemGuid"],
    where: { restaurantId, menuItemGuid: { in: guids }, date: { gte: windowStart(options) } },
    _sum: { quantitySold: true },
  });
  return new Map(rows.map((row) => [row.menuItemGuid, row._sum.quantitySold ?? 0]));
}

/** The resolver the builder calls: this restaurant's eligible pours, grouped and
 *  ranked for one template. */
export async function resolveFlightTemplateCandidates(
  template: FlightTemplate,
  restaurantId: string,
  options: LoadFlightCandidatesOptions = {},
): Promise<FlightTemplateCandidates> {
  return groupCandidatesByTemplateSlot(template, await loadFlightCandidatePours(restaurantId, options));
}
