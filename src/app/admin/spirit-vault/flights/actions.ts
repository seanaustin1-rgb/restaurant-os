"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { Prisma, type SpiritLifecycleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";
import { calculateFlightPricing } from "@/lib/spirit-vault/flight-pricing";

const FLIGHTS_PATH = "/admin/spirit-vault/flights";
const STATUS_RANK: Record<SpiritLifecycleStatus, number> = { DRAFT: 0, REVIEWED: 1, PUBLISHED: 2 };

export interface CreateSpiritFlightItemInput {
  venueSpiritId: string;
  spiritPourId: string;
  itemNote?: string | null;
}

export interface CreateSpiritFlightInput {
  name: string;
  description?: string | null;
  status?: SpiritLifecycleStatus;
  items: CreateSpiritFlightItemInput[];
}

export interface CreateSpiritFlightResult {
  id: string;
  totalPriceUsd: number;
  itemPrices: { venueSpiritId: string; spiritPourId: string; linePriceUsd: number }[];
}

interface PriceablePour {
  id: string;
  venueSpiritId: string;
  priceUsd: Prisma.Decimal | number | string | null;
  pourSizeOz: Prisma.Decimal | number | string | null;
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

function cleanText(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

function normalizeFlightItems(items: CreateSpiritFlightItemInput[]): CreateSpiritFlightItemInput[] {
  const normalized = (items ?? [])
    .map((item) => ({
      venueSpiritId: item.venueSpiritId?.trim(),
      spiritPourId: item.spiritPourId?.trim(),
      itemNote: cleanText(item.itemNote),
    }))
    .filter((item) => item.venueSpiritId && item.spiritPourId);

  if (normalized.length < 2 || normalized.length > 6) {
    throw new Error("Flights need 2-6 spirits");
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

export async function createSpiritFlight(input: CreateSpiritFlightInput): Promise<CreateSpiritFlightResult> {
  const restaurantId = await requireSpiritVaultStaff();
  const name = cleanText(input.name);
  if (!name) throw new Error("Flight name is required");
  if (name.length > 120) throw new Error("Flight name must be 120 characters or fewer");
  const description = cleanText(input.description);
  const status = validateStatus(input.status ?? "DRAFT");
  const items = normalizeFlightItems(input.items);

  const result = await prisma.$transaction(async (tx) => {
    const selectedPours = await tx.spiritPour.findMany({
      where: {
        restaurantId,
        id: { in: items.map((item) => item.spiritPourId) },
        venueSpiritId: { in: items.map((item) => item.venueSpiritId) },
        venueSpirit: { recordStatus: "PUBLISHED", publicationStatus: "PUBLISHED" },
      },
      select: {
        id: true,
        venueSpiritId: true,
        priceUsd: true,
        pourSizeOz: true,
      },
    });

    const pourById = new Map(selectedPours.map((pour) => [pour.id, pour]));
    if (pourById.size !== items.length) {
      throw new Error("Every flight item must reference a published vault spirit and priced pour");
    }

    const orderedPours: PriceablePour[] = items.map((item) => {
      const pour = pourById.get(item.spiritPourId);
      if (!pour || pour.venueSpiritId !== item.venueSpiritId) {
        throw new Error("Flight item pour does not belong to the selected spirit");
      }
      return pour;
    });
    const pricing = calculateFlightPricing(orderedPours);

    const flight = await tx.spiritFlight.create({
      data: {
        restaurantId,
        name,
        description,
        status,
        suggestedPriceUsd: new Prisma.Decimal(pricing.totalPriceUsd),
        pricingFormulaVersion: pricing.formulaVersion,
        pricingSnapshot: pricing as unknown as Prisma.InputJsonValue,
        items: {
          create: items.map((item, index) => ({
            restaurantId,
            venueSpiritId: item.venueSpiritId,
            spiritPourId: item.spiritPourId,
            pourSizeOz: new Prisma.Decimal(1),
            sortOrder: index,
            itemNote: item.itemNote,
          })),
        },
      },
      select: { id: true },
    });

    return { id: flight.id, totalPriceUsd: pricing.totalPriceUsd, itemPrices: pricing.lines };
  });

  revalidatePath(FLIGHTS_PATH);
  revalidatePath("/vault");
  return result;
}
