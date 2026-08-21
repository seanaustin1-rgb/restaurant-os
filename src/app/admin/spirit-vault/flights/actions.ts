"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { Prisma, type SpiritLifecycleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";
import { calculateFlightPricing, type FlightPricingResult } from "@/lib/spirit-vault/flight-pricing";

const FLIGHTS_PATH = "/admin/spirit-vault/flights";
const STATUS_RANK: Record<SpiritLifecycleStatus, number> = { DRAFT: 0, REVIEWED: 1, PUBLISHED: 2 };

export interface CreateSpiritFlightItemInput {
  venueSpiritId: string;
  spiritPourId: string;
  itemNote?: string | null;
  /** Internal 1-2 bite accompaniment (prep sheet only, non-guest). */
  pairingBites?: string[] | null;
}

export interface CreateSpiritFlightInput {
  name: string;
  description?: string | null;
  status?: SpiritLifecycleStatus;
  items: CreateSpiritFlightItemInput[];
}

export interface UpdateSpiritFlightInput extends CreateSpiritFlightInput {
  id: string;
}

export interface CreateSpiritFlightResult {
  id: string;
  totalPriceUsd: number;
  itemPrices: { venueSpiritId: string; spiritPourId: string; linePriceUsd: number }[];
}

async function requireSpiritVaultStaff(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...SPIRIT_VAULT_STAFF_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) throw new Error("forbidden");
  return role.restaurantId;
}

/** Length caps: a through-line lives on the placemat; an item note sits under a
 *  pour on the guest page. Bites are 1-2 word internal labels. Caps here match what
 *  the surfaces can render without overflow or truncation. */
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_ITEM_NOTE_LENGTH = 200;
const MAX_BITE_LENGTH = 80;

function cleanText(v: string | null | undefined, maxLength?: number): string | null {
  const t = (v ?? "").trim();
  if (t === "") return null;
  if (maxLength != null && t.length > maxLength) {
    throw new Error(`Text exceeds the ${maxLength}-character limit`);
  }
  return t;
}

// At most 2 bites, trimmed, de-duped, no blanks, length-capped.
function cleanBites(bites: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of bites ?? []) {
    const t = (raw ?? "").trim();
    const key = t.toLowerCase();
    if (!t || seen.has(key)) continue;
    if (t.length > MAX_BITE_LENGTH) {
      throw new Error(`Bite text exceeds the ${MAX_BITE_LENGTH}-character limit`);
    }
    seen.add(key);
    out.push(t);
    if (out.length >= 2) break;
  }
  return out;
}

function normalizeFlightItems(items: CreateSpiritFlightItemInput[]): CreateSpiritFlightItemInput[] {
  const normalized = (items ?? [])
    .map((item) => ({
      venueSpiritId: item.venueSpiritId?.trim(),
      spiritPourId: item.spiritPourId?.trim(),
      itemNote: cleanText(item.itemNote, MAX_ITEM_NOTE_LENGTH),
      pairingBites: cleanBites(item.pairingBites),
    }))
    .filter((item) => item.venueSpiritId && item.spiritPourId);

  if (normalized.length < 2 || normalized.length > 4) {
    throw new Error("Flights need 2-4 spirits");
  }

  const seenVenueSpirits = new Set<string>();
  const seenPours = new Set<string>();
  for (const item of normalized) {
    if (seenVenueSpirits.has(item.venueSpiritId)) throw new Error("A flight cannot include the same spirit twice");
    if (seenPours.has(item.spiritPourId)) throw new Error("A flight cannot include the same pour twice");
    seenVenueSpirits.add(item.venueSpiritId);
    seenPours.add(item.spiritPourId);
  }

  return normalized;
}

function validateStatus(status: SpiritLifecycleStatus): SpiritLifecycleStatus {
  if (!(status in STATUS_RANK)) throw new Error("Invalid flight status");
  return status;
}

/** Look up the ordered source pours, enforce published+priced+belongs-to-spirit,
 *  and compute the flight pricing. Shared by create and update so both price and
 *  validate identically. Runs inside the caller's transaction. */
async function resolvePricingForItems(
  tx: Prisma.TransactionClient,
  restaurantId: string,
  items: CreateSpiritFlightItemInput[],
): Promise<FlightPricingResult> {
  const selectedPours = await tx.spiritPour.findMany({
    where: {
      restaurantId,
      id: { in: items.map((item) => item.spiritPourId) },
      venueSpiritId: { in: items.map((item) => item.venueSpiritId) },
      venueSpirit: { recordStatus: "PUBLISHED", publicationStatus: "PUBLISHED" },
    },
    select: { id: true, venueSpiritId: true, priceUsd: true, pourSizeOz: true },
  });

  const pourById = new Map(selectedPours.map((pour) => [pour.id, pour]));
  if (pourById.size !== items.length) {
    throw new Error("Every flight item must reference a published vault spirit and priced pour");
  }

  const orderedPours = items.map((item) => {
    const pour = pourById.get(item.spiritPourId);
    if (!pour || pour.venueSpiritId !== item.venueSpiritId) {
      throw new Error("Flight item pour does not belong to the selected spirit");
    }
    return pour;
  });

  return calculateFlightPricing(orderedPours);
}

/** Build the nested `items.create` payload for a flight (order = array index).
 *  restaurantId is intentionally omitted — it is part of the item's composite FK to
 *  the parent flight, so Prisma sets it from the parent on nested create (passing it
 *  explicitly is rejected as an unknown argument). */
function flightItemCreateData(items: CreateSpiritFlightItemInput[]) {
  return items.map((item, index) => ({
    venueSpiritId: item.venueSpiritId,
    spiritPourId: item.spiritPourId,
    pourSizeOz: new Prisma.Decimal(1),
    sortOrder: index,
    itemNote: item.itemNote,
    pairingBites: item.pairingBites ?? [],
  }));
}

export async function createSpiritFlight(input: CreateSpiritFlightInput): Promise<CreateSpiritFlightResult> {
  const restaurantId = await requireSpiritVaultStaff();
  const name = cleanText(input.name);
  if (!name) throw new Error("Flight name is required");
  if (name.length > 120) throw new Error("Flight name must be 120 characters or fewer");
  const description = cleanText(input.description, MAX_DESCRIPTION_LENGTH);
  const status = validateStatus(input.status ?? "DRAFT");
  const items = normalizeFlightItems(input.items);

  const result = await prisma.$transaction(async (tx) => {
    const pricing = await resolvePricingForItems(tx, restaurantId, items);

    const flight = await tx.spiritFlight.create({
      data: {
        restaurantId,
        name,
        description,
        status,
        suggestedPriceUsd: new Prisma.Decimal(pricing.totalPriceUsd),
        pricingFormulaVersion: pricing.formulaVersion,
        pricingSnapshot: pricing as unknown as Prisma.InputJsonValue,
        items: { create: flightItemCreateData(items) },
      },
      select: { id: true },
    });

    return { id: flight.id, totalPriceUsd: pricing.totalPriceUsd, itemPrices: pricing.lines };
  });

  revalidatePath(FLIGHTS_PATH);
  revalidatePath("/vault");
  return result;
}

/** Edit an existing flight: name/description/status + full item set (add / remove /
 *  reorder). Items are replaced wholesale from the incoming order, so the price and
 *  sortOrder always match what the manager sees. */
export async function updateSpiritFlight(input: UpdateSpiritFlightInput): Promise<CreateSpiritFlightResult> {
  const restaurantId = await requireSpiritVaultStaff();
  const id = input.id?.trim();
  if (!id) throw new Error("Flight id is required");
  const name = cleanText(input.name);
  if (!name) throw new Error("Flight name is required");
  if (name.length > 120) throw new Error("Flight name must be 120 characters or fewer");
  const description = cleanText(input.description, MAX_DESCRIPTION_LENGTH);
  const status = validateStatus(input.status ?? "DRAFT");
  const items = normalizeFlightItems(input.items);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.spiritFlight.findFirst({ where: { id, restaurantId }, select: { id: true } });
    if (!existing) throw new Error("Flight not found");

    const pricing = await resolvePricingForItems(tx, restaurantId, items);

    // Replace the item set so reorder / add / remove all resolve in one write and
    // never trip the [flightId, sortOrder] / [flightId, venueSpiritId] uniques.
    await tx.spiritFlightItem.deleteMany({ where: { flightId: id, restaurantId } });
    await tx.spiritFlight.update({
      where: { id },
      data: {
        name,
        description,
        status,
        suggestedPriceUsd: new Prisma.Decimal(pricing.totalPriceUsd),
        pricingFormulaVersion: pricing.formulaVersion,
        pricingSnapshot: pricing as unknown as Prisma.InputJsonValue,
        items: { create: flightItemCreateData(items) },
      },
    });

    return { id, totalPriceUsd: pricing.totalPriceUsd, itemPrices: pricing.lines };
  });

  revalidatePath(FLIGHTS_PATH);
  revalidatePath(`${FLIGHTS_PATH}/${id}`);
  revalidatePath("/vault");
  return result;
}

/** Publish-toggle (or move to any lifecycle status) without touching items/pricing. */
export async function setSpiritFlightStatus(input: { id: string; status: SpiritLifecycleStatus }): Promise<void> {
  const restaurantId = await requireSpiritVaultStaff();
  const id = input.id?.trim();
  if (!id) throw new Error("Flight id is required");
  const status = validateStatus(input.status);

  // updateMany scoped by restaurantId → never touches another tenant's flight.
  const res = await prisma.spiritFlight.updateMany({ where: { id, restaurantId }, data: { status } });
  if (res.count === 0) throw new Error("Flight not found");

  revalidatePath(FLIGHTS_PATH);
  revalidatePath(`${FLIGHTS_PATH}/${id}`);
  revalidatePath("/vault");
}

export async function deleteSpiritFlight(input: { id: string }): Promise<void> {
  const restaurantId = await requireSpiritVaultStaff();
  const id = input.id?.trim();
  if (!id) throw new Error("Flight id is required");

  // deleteMany scoped by restaurantId; items cascade via the FK.
  const res = await prisma.spiritFlight.deleteMany({ where: { id, restaurantId } });
  if (res.count === 0) throw new Error("Flight not found");

  revalidatePath(FLIGHTS_PATH);
  revalidatePath("/vault");
}
