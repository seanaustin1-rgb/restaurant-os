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
  style: string | null;
  proof: string | null;
  age: string | null;
  origin: string | null;
  flavor: Record<string, number>;
  body: number | null;
  finish: number | null;
  topNotes: string[];
  taste: string | null;
  mash: string | null;
  cask: string | null;
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

// Production is stored as rows like [["Mash Bill","70% corn…",true], …]; pull the
// value of the first row whose label matches.
function prodRow(production: unknown, re: RegExp): string | null {
  if (!Array.isArray(production)) return null;
  for (const row of production) {
    if (Array.isArray(row) && typeof row[0] === "string" && re.test(row[0]) && typeof row[1] === "string" && row[1].trim()) {
      return row[1].trim();
    }
  }
  return null;
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
                  style: true,
                  proofN: true,
                  proofDisplay: true,
                  ageText: true,
                  city: true,
                  region: true,
                  country: true,
                  distilleryName: true,
                  flavor: true,
                  body: true,
                  finish: true,
                  topNotes: true,
                  whyShort: true,
                  production: true,
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
    const origin = [d.city, d.region].filter((s): s is string => typeof s === "string" && s.trim() !== "").join(", ") || d.country || null;
    return {
      order: index + 1,
      slug: item.venueSpirit.slug,
      name: d.displayName ?? [d.brand, d.expression].filter(Boolean).join(" "),
      category: d.category,
      style: d.style ?? null,
      proof: proofN != null ? `${proofN} proof` : d.proofDisplay ?? null,
      age: d.ageText && d.ageText !== "NAS" ? d.ageText : null,
      origin: d.distilleryName ?? origin,
      flavor: asFlavor(ov?.flavor ?? d.flavor),
      body: num(d.body),
      finish: num(d.finish),
      topNotes: (ovTop.length ? ovTop : asStrings(d.topNotes)).slice(0, 3),
      taste: d.whyShort ?? null,
      mash: prodRow(d.production, /mash/i),
      cask: prodRow(d.production, /matur|cask|barrel|wood|cooper/i),
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
