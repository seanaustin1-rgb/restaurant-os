import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";
import {
  SpiritFlightCreateForm,
  type FlightPourOption,
  type FlightFormInitial,
} from "@/components/spirit-vault/SpiritFlightCreateForm";
import { suggestBites } from "@/lib/spirit-vault/flight-pairings";

export const dynamic = "force-dynamic";

type Def = { displayName: string | null; brand: string; expression: string | null; category: string };

function spiritName(def: Def): string {
  return def.displayName ?? [def.brand, def.expression].filter(Boolean).join(" ");
}

function decimalToNumber(v: { toString(): string } | number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

function oneOz(priceUsd: number | null, pourSizeOz: number | null): number {
  if (priceUsd == null || pourSizeOz == null || pourSizeOz <= 0) return 0;
  return Math.round((priceUsd / pourSizeOz) * 100) / 100;
}

export default async function EditSpiritFlightPage({ params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...SPIRIT_VAULT_STAFF_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) redirect("/admin/spirit-vault/flights");

  const flight = await prisma.spiritFlight.findFirst({
    where: { id: params.id, restaurantId: role.restaurantId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: { venueSpiritId: true, spiritPourId: true, itemNote: true, pairingBites: true },
      },
    },
  });
  if (!flight) notFound();

  // Available options: published vault spirits with a priced, sized pour.
  const listings = await prisma.venueSpirit.findMany({
    where: {
      restaurantId: role.restaurantId,
      recordStatus: "PUBLISHED",
      publicationStatus: "PUBLISHED",
      offers: { some: { priceUsd: { not: null }, pourSizeOz: { not: null } } },
    },
    orderBy: [{ definition: { category: "asc" } }, { slug: "asc" }],
    select: {
      id: true,
      overrides: true,
      definition: { select: { brand: true, expression: true, displayName: true, category: true, flavor: true } },
      offers: {
        where: { priceUsd: { not: null }, pourSizeOz: { not: null } },
        orderBy: [{ isPrimary: "desc" }, { pourSizeOz: "asc" }],
        select: { id: true, pourLabel: true, pourSizeOz: true, priceUsd: true },
      },
    },
  });

  const pours: FlightPourOption[] = listings.flatMap((listing) => {
    const ov = listing.overrides && typeof listing.overrides === "object" ? (listing.overrides as { flavor?: unknown }) : null;
    const suggestedBites = suggestBites(ov?.flavor ?? listing.definition.flavor);
    return listing.offers.flatMap((offer) => {
      const priceUsd = decimalToNumber(offer.priceUsd);
      const pourSizeOz = decimalToNumber(offer.pourSizeOz);
      if (priceUsd == null || pourSizeOz == null || pourSizeOz <= 0) return [];
      return [
        {
          venueSpiritId: listing.id,
          spiritPourId: offer.id,
          name: spiritName(listing.definition),
          category: listing.definition.category,
          pourLabel: offer.pourLabel ?? `${pourSizeOz} oz`,
          pourSizeOz,
          priceUsd,
          oneOzPriceUsd: oneOz(priceUsd, pourSizeOz),
          suggestedBites,
        },
      ];
    });
  });

  // Make sure the flight's current source pours are always present as options, even
  // if that spirit was since unpublished — otherwise editing would silently drop it.
  const haveIds = new Set(pours.map((p) => p.spiritPourId));
  const missingIds = flight.items
    .map((i) => i.spiritPourId)
    .filter((id): id is string => Boolean(id) && !haveIds.has(id!));
  if (missingIds.length) {
    const extra = await prisma.spiritPour.findMany({
      where: { restaurantId: role.restaurantId, id: { in: missingIds } },
      select: {
        id: true,
        venueSpiritId: true,
        pourLabel: true,
        pourSizeOz: true,
        priceUsd: true,
        venueSpirit: {
          select: { overrides: true, definition: { select: { brand: true, expression: true, displayName: true, category: true, flavor: true } } },
        },
      },
    });
    for (const e of extra) {
      const priceUsd = decimalToNumber(e.priceUsd);
      const pourSizeOz = decimalToNumber(e.pourSizeOz);
      const ov = e.venueSpirit.overrides && typeof e.venueSpirit.overrides === "object" ? (e.venueSpirit.overrides as { flavor?: unknown }) : null;
      pours.push({
        venueSpiritId: e.venueSpiritId,
        spiritPourId: e.id,
        name: spiritName(e.venueSpirit.definition),
        category: e.venueSpirit.definition.category,
        pourLabel: e.pourLabel ?? `${pourSizeOz ?? "?"} oz`,
        pourSizeOz: pourSizeOz ?? 0,
        priceUsd: priceUsd ?? 0,
        oneOzPriceUsd: oneOz(priceUsd, pourSizeOz),
        suggestedBites: suggestBites(ov?.flavor ?? e.venueSpirit.definition.flavor),
      });
    }
  }

  const initial: FlightFormInitial = {
    name: flight.name,
    description: flight.description ?? "",
    status: flight.status,
    items: flight.items
      .filter((i): i is { venueSpiritId: string; spiritPourId: string; itemNote: string | null; pairingBites: string[] } =>
        Boolean(i.spiritPourId),
      )
      .map((i) => ({
        venueSpiritId: i.venueSpiritId,
        spiritPourId: i.spiritPourId,
        itemNote: i.itemNote ?? "",
        bites: (i.pairingBites ?? []).join(", "),
      })),
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div>
        <Link href="/admin/spirit-vault/flights" className="text-xs text-muted hover:text-copper-soft">
          Back to flights
        </Link>
        <h1 className="mt-2 font-display text-2xl text-copper-soft">Edit Flight</h1>
        <p className="mt-1 text-sm text-muted">
          Reorder, add or remove spirits, adjust notes, set status, or delete. Price regenerates from the selected pours.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <a href={`/admin/spirit-vault/flights/${flight.id}/prep`} target="_blank" rel="noreferrer" className="text-copper-soft hover:text-copper">
            Prep sheet ↗
          </a>
          {flight.status === "PUBLISHED" && (
            <>
              <a href={`/vault/flights/${flight.id}/placemat`} target="_blank" rel="noreferrer" className="text-copper-soft hover:text-copper">
                Placemat ↗
              </a>
              <a href={`/vault/flights/${flight.id}`} target="_blank" rel="noreferrer" className="text-copper-soft hover:text-copper">
                Guest page ↗
              </a>
            </>
          )}
        </div>
      </div>

      <SpiritFlightCreateForm pours={pours} flightId={flight.id} initial={initial} />
    </main>
  );
}
