"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";
import type { FlightTemplateSlot } from "@/lib/spirit-vault/flight-templates";

const FLIGHTS_PATH = "/admin/spirit-vault/flights";
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_THROUGHLINE_LENGTH = 500;
const MAX_SLOTS = 8;
const MAX_LABEL_LENGTH = 80;
const MAX_ITEM_NOTE_LENGTH = 200;

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

export interface CustomTemplateSlotInput {
  key: string;
  label: string;
  itemNote: string;
  rules: {
    proofMin?: number | null;
    proofMax?: number | null;
    categories?: string[];
    searchTerms?: string[];
  };
}

export interface SaveCustomTemplateInput {
  id?: string;
  name: string;
  description: string;
  throughLine: string;
  autoOrder: "slot-order" | "proof-asc" | "proof-desc";
  slots: CustomTemplateSlotInput[];
}

function validateSlots(slots: CustomTemplateSlotInput[]): FlightTemplateSlot[] {
  if (slots.length === 0) throw new Error("At least one slot is required.");
  if (slots.length > MAX_SLOTS) throw new Error(`Maximum ${MAX_SLOTS} slots allowed.`);

  const keys = new Set<string>();
  return slots.map((s, i) => {
    const key = s.key.trim() || `slot-${i}`;
    if (keys.has(key)) throw new Error(`Duplicate slot key: ${key}`);
    keys.add(key);

    const label = s.label.trim();
    if (!label) throw new Error(`Slot ${i + 1} needs a label.`);
    if (label.length > MAX_LABEL_LENGTH) throw new Error(`Slot label must be ${MAX_LABEL_LENGTH} characters or fewer.`);

    const itemNote = s.itemNote.trim();
    if (itemNote.length > MAX_ITEM_NOTE_LENGTH) throw new Error(`Item note must be ${MAX_ITEM_NOTE_LENGTH} characters or fewer.`);

    return {
      key,
      label,
      itemNote,
      rules: {
        ...(s.rules.proofMin != null ? { proofMin: s.rules.proofMin } : {}),
        ...(s.rules.proofMax != null ? { proofMax: s.rules.proofMax } : {}),
        ...(s.rules.categories?.length ? { categories: s.rules.categories.filter((c) => c.trim()) } : {}),
        ...(s.rules.searchTerms?.length ? { searchTerms: s.rules.searchTerms.filter((t) => t.trim()) } : {}),
      },
    };
  });
}

export async function saveCustomTemplate(input: SaveCustomTemplateInput): Promise<{ id: string }> {
  const restaurantId = await requireSpiritVaultStaff();

  const name = input.name.trim();
  if (!name) throw new Error("Template name is required.");
  if (name.length > MAX_NAME_LENGTH) throw new Error(`Name must be ${MAX_NAME_LENGTH} characters or fewer.`);

  const description = input.description.trim().slice(0, MAX_DESCRIPTION_LENGTH);
  const throughLine = input.throughLine.trim().slice(0, MAX_THROUGHLINE_LENGTH);
  const autoOrder = ["slot-order", "proof-asc", "proof-desc"].includes(input.autoOrder) ? input.autoOrder : "slot-order";
  const slots = validateSlots(input.slots);

  if (input.id) {
    const existing = await prisma.customFlightTemplate.findFirst({
      where: { id: input.id, restaurantId },
    });
    if (!existing) throw new Error("Template not found.");

    await prisma.customFlightTemplate.update({
      where: { id: input.id },
      data: { name, description, throughLine, autoOrder, slots },
    });
    revalidatePath(FLIGHTS_PATH);
    return { id: input.id };
  }

  const created = await prisma.customFlightTemplate.create({
    data: { restaurantId, name, description, throughLine, autoOrder, slots },
  });
  revalidatePath(FLIGHTS_PATH);
  return { id: created.id };
}

export async function deleteCustomTemplate(id: string): Promise<void> {
  const restaurantId = await requireSpiritVaultStaff();
  const existing = await prisma.customFlightTemplate.findFirst({
    where: { id, restaurantId },
  });
  if (!existing) throw new Error("Template not found.");
  await prisma.customFlightTemplate.delete({ where: { id } });
  revalidatePath(FLIGHTS_PATH);
}

export async function listCustomTemplates(): Promise<
  { id: string; name: string; description: string; throughLine: string; autoOrder: string; slots: unknown }[]
> {
  const restaurantId = await requireSpiritVaultStaff();
  return prisma.customFlightTemplate.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, description: true, throughLine: true, autoOrder: true, slots: true },
  });
}
