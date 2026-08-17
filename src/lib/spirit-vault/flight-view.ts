import { prisma } from "@/lib/prisma";
import type { SpiritLifecycleStatus } from "@prisma/client";

// Shared read model for a flight's guest/staff surfaces (placemat, prep sheet,
// digital page). Resolves venue overrides over the shared definition the same way
// /vault does, so every surface shows the same effective values.

export interface FlightPourView {
  order: number;
  slug: string;
  name: string;
  category: string;
  proof: string | null;
  age: string | null;
  flavor: Record<string, number>;
  topNotes: string[];
  taste: string | null;
  itemNote: string | null;
  bites: string[];
}

export interface FlightView {
  id: string;
  name: string;
  description: string | null;
  status: SpiritLifecycleStatus;
  totalPriceUsd: number | null;
  venueName: string | null;
  pours: FlightPourView[];
}

function num(v: { toString(): string } | number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

function asFlavor(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const src = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  for (const [k, val] of Object.entries(src)) if (typeof val === "number") out[k] = val;
  return out;
}

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export async function loadFlightView(
  restaurantId: string,
  id: string,
  opts: { publishedOnly?: boolean } = {},
): Promise<FlightView | null> {
  const flight = await prisma.spiritFlight.findFirst({
    where: { id, restaurantId, ...(opts.publishedOnly ? { status: "PUBLISHED" } : {}) },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      suggestedPriceUsd: true,
      restaurant: { select: { name: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          itemNote: true,
          pairingBites: true,
          venueSpirit: {
            select: {
              slug: true,
              overrides: true,
              definition: {
                select: {
                  brand: true,
                  expression: true,
                  displayName: true,
                  category: true,
                  proofN: true,
                  proofDisplay: true,
                  ageText: true,
                  flavor: true,
                  topNotes: true,
                  whyShort: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!flight) return null;

  const pours: FlightPourView[] = flight.items.map((item, index) => {
    const d = item.venueSpirit.definition;
    const ov = item.venueSpirit.overrides && typeof item.venueSpirit.overrides === "object"
      ? (item.venueSpirit.overrides as { flavor?: unknown; topNotes?: unknown })
      : null;
    const proofN = num(d.proofN);
    const ovTop = asStrings(ov?.topNotes);
    return {
      order: index + 1,
      slug: item.venueSpirit.slug,
      name: d.displayName ?? [d.brand, d.expression].filter(Boolean).join(" "),
      category: d.category,
      proof: proofN != null ? `${proofN} proof` : d.proofDisplay ?? null,
      age: d.ageText && d.ageText !== "NAS" ? d.ageText : null,
      flavor: asFlavor(ov?.flavor ?? d.flavor),
      topNotes: (ovTop.length ? ovTop : asStrings(d.topNotes)).slice(0, 3),
      taste: d.whyShort ?? null,
      itemNote: item.itemNote,
      bites: asStrings(item.pairingBites),
    };
  });

  return {
    id: flight.id,
    name: flight.name,
    description: flight.description,
    status: flight.status,
    totalPriceUsd: num(flight.suggestedPriceUsd),
    venueName: flight.restaurant?.name ?? null,
    pours,
  };
}
