// Server-only layer: the Prisma-aware loading functions for flight candidates.
// Separated from flight-template-candidates.ts so client components that import
// pure matching/ranking/grouping functions never pull Prisma into the bundle.

import { prisma } from "@/lib/prisma";
import type { FlightTemplate } from "@/lib/spirit-vault/flight-templates";
import {
  TOAST_RANK_WINDOW_DAYS,
  listingToCandidatePours,
  rankFlightCandidates,
  groupCandidatesByTemplateSlot,
  type FlightCandidatePour,
  type FlightTemplateCandidates,
} from "@/lib/spirit-vault/flight-template-candidates";

export interface LoadFlightCandidatesOptions {
  windowDays?: number;
  now?: Date;
}

function windowStart({ windowDays = TOAST_RANK_WINDOW_DAYS, now = new Date() }: LoadFlightCandidatesOptions): Date {
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - windowDays);
  return since;
}

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

export async function resolveFlightTemplateCandidates(
  template: FlightTemplate,
  restaurantId: string,
  options: LoadFlightCandidatesOptions = {},
): Promise<FlightTemplateCandidates> {
  return groupCandidatesByTemplateSlot(template, await loadFlightCandidatePours(restaurantId, options));
}
