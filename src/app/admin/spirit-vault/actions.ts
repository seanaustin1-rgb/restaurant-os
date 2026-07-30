"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { Prisma, type SpiritLifecycleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { OPERATOR_ROLES } from "@/lib/access/roles";
import { validatePublishableSpirit } from "@/lib/spirit-vault/validate";

const ADMIN_PATH = "/admin/spirit-vault";

// Vault content editing is owner-only. Returns the operator's restaurant id.
async function requireVaultOperator(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...OPERATOR_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) throw new Error("forbidden");
  return role.restaurantId;
}

const FLAVOR_AXES = ["Sweet", "Oak", "Spice", "Fruit", "Smoke", "Earth", "Herbal"] as const;
const STATUS_RANK: Record<SpiritLifecycleStatus, number> = { DRAFT: 0, REVIEWED: 1, PUBLISHED: 2 };

export interface SpiritEditInput {
  id: string;
  whyWeCarry: string | null;
  seanShort: string | null;
  notes: string | null;
  body: number | null;
  finish: number | null;
  flavor: Record<string, number>;
  topNotes: string[];
  pairings: string[];
  recordStatus: SpiritLifecycleStatus;
  publicationStatus: SpiritLifecycleStatus;
}

function cleanText(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

function axis(v: unknown, label: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 10) throw new Error(`${label} must be 0-10`);
  return Math.round(n);
}

function bodyFinish(v: number | null | undefined, label: string): number | null {
  if (v == null || Number.isNaN(v)) return null;
  if (v < 0 || v > 10) throw new Error(`${label} must be 0-10`);
  return Math.round(v);
}

export async function updateSpirit(input: SpiritEditInput): Promise<void> {
  const restaurantId = await requireVaultOperator();

  const flavor: Record<string, number> = {};
  for (const a of FLAVOR_AXES) flavor[a] = axis(input.flavor?.[a], a);
  const topNotes = (input.topNotes ?? []).map((s) => s.trim()).filter(Boolean);
  if (topNotes.length !== 3) throw new Error("Top notes must have exactly 3 entries");
  const pairings = (input.pairings ?? []).map((s) => s.trim()).filter(Boolean);

  const rec = input.recordStatus;
  const pub = input.publicationStatus;
  if (STATUS_RANK[pub] > STATUS_RANK[rec]) {
    throw new Error(`Cannot set publication "${pub}" higher than record status "${rec}"`);
  }
  if (pub === "PUBLISHED" && pairings.length === 0) {
    throw new Error("Published records need at least one pairing");
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.venueSpirit.findFirst({
      where: { id: input.id, restaurantId },
      include: {
        definition: true,
        offers: { select: { pourSizeOz: true, priceUsd: true, isPrimary: true } },
      },
    });
    if (!existing) throw new Error("Spirit listing not found");

    // Operator edits are venue-local PRESENTATION overrides. They live on
    // VenueSpirit.overrides and never mutate the shared canonical
    // SpiritDefinition (which other tenants read). A null body/finish means "no
    // venue override — inherit the definition."
    const bodyOverride = bodyFinish(input.body, "Body");
    const finishOverride = bodyFinish(input.finish, "Finish");
    const overrides = {
      body: bodyOverride,
      finish: finishOverride,
      flavor,
      topNotes,
      pairings,
    };
    // Effective (merged) sensory values = venue override when set, else the
    // shared definition. This is what the guest sees, so it's what we validate.
    const effectiveBody = bodyOverride ?? existing.definition.body;
    const effectiveFinish = finishOverride ?? existing.definition.finish;
    const venueData = {
      whyWeCarry: cleanText(input.whyWeCarry),
      seanShort: cleanText(input.seanShort),
      notes: cleanText(input.notes),
      recordStatus: rec,
      publicationStatus: pub,
      reviewedAt: rec !== "DRAFT" ? new Date() : null,
      overrides: overrides as Prisma.InputJsonValue,
    };

    const errors = validatePublishableSpirit({
      definition: {
        ...existing.definition,
        body: effectiveBody,
        finish: effectiveFinish,
        flavor,
        topNotes,
      },
      venueSpirit: {
        ...existing,
        ...venueData,
      },
      offers: existing.offers.map((offer) => ({
        isPrimary: offer.isPrimary,
        pourSizeOz: offer.pourSizeOz == null ? null : Number(offer.pourSizeOz),
        priceUsd: offer.priceUsd == null ? null : Number(offer.priceUsd),
      })),
    });
    if (errors.length) {
      throw new Error(errors.map((error) => `${error.field}: ${error.message}`).join("; "));
    }

    // Only the tenant listing is written — shared knowledge stays canonical.
    await tx.venueSpirit.update({
      where: { id: existing.id },
      data: venueData,
    });
  });

  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/${input.id}`);
  revalidatePath("/vault");
}
