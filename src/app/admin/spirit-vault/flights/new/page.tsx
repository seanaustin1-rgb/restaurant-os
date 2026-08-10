import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";
import { SpiritFlightCreateForm, type FlightPourOption } from "@/components/spirit-vault/SpiritFlightCreateForm";

export const dynamic = "force-dynamic";

function spiritName(item: {
  definition: { displayName: string | null; brand: string; expression: string | null };
}): string {
  return item.definition.displayName ?? [item.definition.brand, item.definition.expression].filter(Boolean).join(" ");
}

function decimalToNumber(v: { toString(): string } | number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

export default async function NewSpiritFlightPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...SPIRIT_VAULT_STAFF_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) redirect("/admin/spirit-vault/flights");

  const listings = await prisma.venueSpirit.findMany({
    where: {
      restaurantId: role.restaurantId,
      recordStatus: "PUBLISHED",
      publicationStatus: "PUBLISHED",
      offers: {
        some: {
          priceUsd: { not: null },
          pourSizeOz: { not: null },
        },
      },
    },
    orderBy: [{ definition: { category: "asc" } }, { slug: "asc" }],
    select: {
      id: true,
      definition: {
        select: {
          brand: true,
          expression: true,
          displayName: true,
          category: true,
        },
      },
      offers: {
        where: {
          priceUsd: { not: null },
          pourSizeOz: { not: null },
        },
        orderBy: [{ isPrimary: "desc" }, { pourSizeOz: "asc" }],
        select: {
          id: true,
          pourLabel: true,
          pourSizeOz: true,
          priceUsd: true,
        },
      },
    },
  });

  const pours: FlightPourOption[] = listings.flatMap((listing) =>
    listing.offers.flatMap((offer) => {
      const priceUsd = decimalToNumber(offer.priceUsd);
      const pourSizeOz = decimalToNumber(offer.pourSizeOz);
      if (priceUsd == null || pourSizeOz == null || pourSizeOz <= 0) return [];
      return [
        {
          venueSpiritId: listing.id,
          spiritPourId: offer.id,
          name: spiritName(listing),
          category: listing.definition.category,
          pourLabel: offer.pourLabel ?? `${pourSizeOz} oz`,
          pourSizeOz,
          priceUsd,
          oneOzPriceUsd: Math.round((priceUsd / pourSizeOz) * 100) / 100,
        },
      ];
    }),
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div>
        <Link href="/admin/spirit-vault/flights" className="text-xs text-muted hover:text-copper-soft">
          Back to flights
        </Link>
        <h1 className="mt-2 font-display text-2xl text-copper-soft">New Flight</h1>
        <p className="mt-1 text-sm text-muted">
          Select published vault spirits. The tool prices each component as a 1 oz pour from the selected source pour.
        </p>
      </div>

      {pours.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No priced published vault pours are available yet.
        </p>
      ) : (
        <SpiritFlightCreateForm pours={pours} />
      )}
    </main>
  );
}
