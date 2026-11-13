import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { OPERATOR_ROLES } from "@/lib/access/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...OPERATOR_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const items = await prisma.venueSpirit.findMany({
    where: { restaurantId: role.restaurantId },
    orderBy: [{ definition: { category: "asc" } }, { definition: { brand: "asc" } }],
    include: {
      definition: true,
      offers: {
        select: {
          pourSizeOz: true,
          priceUsd: true,
          pourLabel: true,
          isPrimary: true,
          availability: true,
        },
      },
    },
  });

  const spirits = items.map((vs) => {
    const d = vs.definition;
    const overrides = (vs.overrides ?? {}) as Record<string, unknown>;
    const flavorOverride = overrides.flavor as Record<string, number> | undefined;
    const defFlavor = d.flavor as Record<string, number> | null;

    return {
      venueSpirit_id: vs.id,
      definition_slug: d.slug,
      venue_slug: vs.slug,

      brand: d.brand,
      expression: d.expression,
      displayName: d.displayName,
      category: d.category,
      subcategory: d.subcategory,
      style: d.style,
      country: d.country,
      region: d.region,
      distilleryName: d.distilleryName,
      producerName: d.producerName,

      proofN: d.proofN ? Number(d.proofN) : null,
      proofDisplay: d.proofDisplay,
      ageText: d.ageText,
      minYears: d.minYears,
      maxYears: d.maxYears,

      recordStatus: vs.recordStatus,
      publicationStatus: vs.publicationStatus,

      pours: vs.offers.map((p) => ({
        sizeOz: p.pourSizeOz ? Number(p.pourSizeOz) : null,
        priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
        label: p.pourLabel,
        isPrimary: p.isPrimary,
        availability: p.availability,
      })),

      body: (overrides.body as number | null) ?? d.body,
      finish: (overrides.finish as number | null) ?? d.finish,
      flavor: {
        Sweet: flavorOverride?.Sweet ?? defFlavor?.Sweet ?? null,
        Oak: flavorOverride?.Oak ?? defFlavor?.Oak ?? null,
        Spice: flavorOverride?.Spice ?? defFlavor?.Spice ?? null,
        Fruit: flavorOverride?.Fruit ?? defFlavor?.Fruit ?? null,
        Smoke: flavorOverride?.Smoke ?? defFlavor?.Smoke ?? null,
        Earth: flavorOverride?.Earth ?? defFlavor?.Earth ?? null,
        Herbal: flavorOverride?.Herbal ?? defFlavor?.Herbal ?? null,
      },
      topNotes: (overrides.topNotes as string[] | undefined) ?? d.topNotes ?? [],
      pairings: (overrides.pairings as string[] | undefined) ?? (d.pairings as string[] | null) ?? [],

      whyShort: d.whyShort,

      mashBill: (overrides.mashBill as string | null) ?? null,
      caskDetails: (overrides.caskDetails as string | null) ?? null,
      productionMethod: (overrides.productionMethod as string | null) ?? null,
      servingSuggestion: (overrides.servingSuggestion as string | null) ?? null,
      suggestedCocktails: (overrides.suggestedCocktails as string[] | null) ?? [],

      whyWeCarry: vs.whyWeCarry,
      seanShort: vs.seanShort,
      notes: vs.notes,
    };
  });

  return new NextResponse(JSON.stringify(spirits, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=spirits-export.json",
    },
  });
}
