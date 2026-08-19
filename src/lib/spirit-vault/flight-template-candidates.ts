import { prisma } from "@/lib/prisma";
import { suggestBites } from "@/lib/spirit-vault/flight-pairings";
import {
  getFlightTemplate,
  matchesFlightTemplateRules,
  type FlightTemplate,
  type FlightTemplateKey,
  type FlightTemplateMatchable,
  type FlightTemplateSlot,
} from "@/lib/spirit-vault/flight-templates";

export interface FlightTemplateCandidate {
  venueSpiritId: string;
  spiritPourId: string;
  name: string;
  category: string;
  subcategory: string | null;
  style: string | null;
  proofN: number | null;
  proofDisplay: string | null;
  pourLabel: string;
  pourSizeOz: number;
  priceUsd: number;
  oneOzPriceUsd: number;
  availability: string | null;
  toastItemGuid: string | null;
  commerceSource: string | null;
  isPrimary: boolean;
  suggestedBites: string[];
}

export interface FlightTemplateCandidateGroup {
  slot: FlightTemplateSlot;
  candidates: FlightTemplateCandidate[];
}

export interface FlightTemplateCandidateResult {
  template: FlightTemplate;
  groups: FlightTemplateCandidateGroup[];
}

type Decimalish = number | string | { toString(): string } | null | undefined;

interface CandidateOfferRow {
  id: string;
  toastItemGuid: string | null;
  pourSizeOz: Decimalish;
  pourLabel: string | null;
  priceUsd: Decimalish;
  availability: string | null;
  isPrimary: boolean;
  commerceSource: string | null;
}

interface CandidateDefinitionRow {
  brand: string;
  expression: string | null;
  displayName: string | null;
  category: string;
  subcategory: string | null;
  style: string | null;
  proofN: Decimalish;
  proofDisplay: string | null;
  flavor: unknown;
  production: unknown;
  productionStructured: unknown;
  prodTags: string[];
  topNotes: string[];
}

interface CandidateVenueSpiritRow {
  id: string;
  whyWeCarry: string | null;
  seanShort: string | null;
  definition: CandidateDefinitionRow;
  offers: CandidateOfferRow[];
}

interface FlightTemplateCandidateDb {
  venueSpirit: {
    findMany(args: unknown): Promise<CandidateVenueSpiritRow[]>;
  };
}

const UNAVAILABLE_MARKERS = [
  "86",
  "disabled",
  "hidden",
  "inactive",
  "not available",
  "out of stock",
  "sold out",
  "unavailable",
];

function num(value: Decimalish): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

function moneyLine(priceUsd: number, pourSizeOz: number): number {
  return Math.round((priceUsd / pourSizeOz) * 100) / 100;
}

function spiritName(definition: CandidateDefinitionRow): string {
  const built = [definition.brand, definition.expression].filter(Boolean).join(" ");
  return definition.displayName?.trim() || built;
}

function flattenText(value: unknown, depth = 0): string {
  if (value == null || depth > 4) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => flattenText(item, depth + 1)).join(" ");
  if (typeof value === "object") return Object.values(value).map((item) => flattenText(item, depth + 1)).join(" ");
  return "";
}

export function isFlightPourUnavailable(availability: string | null | undefined): boolean {
  const value = (availability ?? "").trim().toLowerCase();
  if (!value) return false;
  return UNAVAILABLE_MARKERS.some((marker) => value.includes(marker));
}

function toMatchable(row: CandidateVenueSpiritRow): FlightTemplateMatchable {
  const definition = row.definition;
  return {
    name: spiritName(definition),
    category: definition.category,
    subcategory: definition.subcategory,
    style: definition.style,
    proofN: num(definition.proofN),
    proofDisplay: definition.proofDisplay,
    productionText: [
      row.whyWeCarry,
      row.seanShort,
      flattenText(definition.production),
      flattenText(definition.productionStructured),
      definition.topNotes.join(" "),
    ]
      .filter(Boolean)
      .join(" "),
    tags: definition.prodTags,
  };
}

function toCandidates(row: CandidateVenueSpiritRow): FlightTemplateCandidate[] {
  const definition = row.definition;
  const name = spiritName(definition);
  const proofN = num(definition.proofN);
  return row.offers
    .filter((offer) => !isFlightPourUnavailable(offer.availability))
    .map((offer) => {
      const priceUsd = num(offer.priceUsd);
      const pourSizeOz = num(offer.pourSizeOz);
      if (priceUsd == null || pourSizeOz == null || pourSizeOz <= 0) return null;
      return {
        venueSpiritId: row.id,
        spiritPourId: offer.id,
        name,
        category: definition.category,
        subcategory: definition.subcategory,
        style: definition.style,
        proofN,
        proofDisplay: definition.proofDisplay,
        pourLabel: offer.pourLabel?.trim() || `${pourSizeOz} oz`,
        pourSizeOz,
        priceUsd,
        oneOzPriceUsd: moneyLine(priceUsd, pourSizeOz),
        availability: offer.availability,
        toastItemGuid: offer.toastItemGuid,
        commerceSource: offer.commerceSource,
        isPrimary: offer.isPrimary,
        suggestedBites: suggestBites(definition.flavor),
      };
    })
    .filter((candidate): candidate is FlightTemplateCandidate => Boolean(candidate));
}

function sortCandidates(template: FlightTemplate, candidates: FlightTemplateCandidate[]): FlightTemplateCandidate[] {
  return [...candidates].sort((a, b) => {
    const toastRank = Number(Boolean(b.toastItemGuid)) - Number(Boolean(a.toastItemGuid));
    if (toastRank !== 0) return toastRank;

    const primaryRank = Number(b.isPrimary) - Number(a.isPrimary);
    if (primaryRank !== 0) return primaryRank;

    if (template.sort === "proof-asc") return (a.proofN ?? Number.MAX_SAFE_INTEGER) - (b.proofN ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name);
    if (template.sort === "proof-desc") return (b.proofN ?? -1) - (a.proofN ?? -1) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });
}

export async function loadFlightTemplateCandidates(
  restaurantId: string,
  templateKey: FlightTemplateKey,
  db: FlightTemplateCandidateDb = prisma as unknown as FlightTemplateCandidateDb,
): Promise<FlightTemplateCandidateResult> {
  const template = getFlightTemplate(templateKey);
  const rows = await db.venueSpirit.findMany({
    where: {
      restaurantId,
      recordStatus: "PUBLISHED",
      publicationStatus: "PUBLISHED",
      offers: { some: { priceUsd: { not: null }, pourSizeOz: { not: null } } },
    },
    select: {
      id: true,
      whyWeCarry: true,
      seanShort: true,
      definition: {
        select: {
          brand: true,
          expression: true,
          displayName: true,
          category: true,
          subcategory: true,
          style: true,
          proofN: true,
          proofDisplay: true,
          flavor: true,
          production: true,
          productionStructured: true,
          prodTags: true,
          topNotes: true,
        },
      },
      offers: {
        where: { priceUsd: { not: null }, pourSizeOz: { not: null } },
        orderBy: [{ isPrimary: "desc" }, { pourSizeOz: "asc" }],
        select: {
          id: true,
          toastItemGuid: true,
          pourSizeOz: true,
          pourLabel: true,
          priceUsd: true,
          availability: true,
          isPrimary: true,
          commerceSource: true,
        },
      },
    },
    orderBy: [{ definition: { brand: "asc" } }, { definition: { expression: "asc" } }],
  });

  const groups = template.slots.map((slot) => {
    const candidates = rows.flatMap((row) => {
      if (!matchesFlightTemplateRules(toMatchable(row), slot.rules)) return [];
      return toCandidates(row);
    });
    return { slot, candidates: sortCandidates(template, candidates) };
  });

  return { template, groups };
}
