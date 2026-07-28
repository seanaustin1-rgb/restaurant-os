"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { ItemStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { OPERATOR_ROLES } from "@/lib/access/roles";

const ADMIN_PATH = "/admin/spirit-vault";

// Vault content editing is owner-only. Returns the operator's restaurant id (the
// vault is a restaurant-scoped module).
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
const STATUS_RANK: Record<ItemStatus, number> = { DRAFT: 0, REVIEWED: 1, PUBLISHED: 2 };

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
  recordStatus: ItemStatus;
  publicationStatus: ItemStatus;
}

function cleanText(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}
function axis(v: unknown, label: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 10) throw new Error(`${label} must be 0–10`);
  return Math.round(n);
}
function bodyFinish(v: number | null | undefined, label: string): number | null {
  if (v == null || Number.isNaN(v)) return null;
  if (v < 0 || v > 10) throw new Error(`${label} must be 0–10`);
  return Math.round(v);
}

export async function updateSpirit(input: SpiritEditInput): Promise<void> {
  await requireVaultOperator();

  // Sensory axes + notes.
  const flavor: Record<string, number> = {};
  for (const a of FLAVOR_AXES) flavor[a] = axis(input.flavor?.[a], a);
  const topNotes = (input.topNotes ?? []).map((s) => s.trim()).filter(Boolean);
  if (topNotes.length !== 3) throw new Error("Top notes must have exactly 3 entries");
  const pairings = (input.pairings ?? []).map((s) => s.trim()).filter(Boolean);

  // Lifecycle invariant: a record can't be published to guests ahead of its
  // review state (mirrors the engine's STATUS_RANK guard).
  const rec = input.recordStatus;
  const pub = input.publicationStatus;
  if (STATUS_RANK[pub] > STATUS_RANK[rec]) {
    throw new Error(`Cannot set publication "${pub}" higher than record status "${rec}"`);
  }

  await prisma.beverageItem.update({
    where: { id: input.id },
    data: {
      whyWeCarry: cleanText(input.whyWeCarry),
      seanShort: cleanText(input.seanShort),
      notes: cleanText(input.notes),
      body: bodyFinish(input.body, "Body"),
      finish: bodyFinish(input.finish, "Finish"),
      flavor,
      topNotes,
      pairings,
      recordStatus: rec,
      publicationStatus: pub,
      reviewedAt: rec !== "DRAFT" ? new Date() : null,
      publishedAt: pub === "PUBLISHED" ? new Date() : null,
    },
  });

  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/${input.id}`);
  revalidatePath("/vault"); // published edits go live immediately, no git/deploy
}
