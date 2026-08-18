"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";
import { generateMembershipCode } from "@/lib/spirit-vault/membership-code";

// Operator console actions for membership codes. Every action requires a positive
// staff role (absence = deny); a guest Clerk user with no UserRestaurantRole can
// never pass. All queries are scoped to the staffer's own restaurant.

const MEMBERSHIP_PATH = "/admin/spirit-vault/membership";

async function requireSpiritVaultStaff(): Promise<{ userId: string; restaurantId: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...SPIRIT_VAULT_STAFF_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) throw new Error("forbidden");
  return { userId, restaurantId: role.restaurantId };
}

export interface GenerateCodeInput {
  label?: string | null;
  grantDays?: number;
  maxRedemptions?: number | null; // null = unlimited; 1 = single-use
  expiresAt?: string | null; // ISO date
  tier?: string;
}

export interface GenerateCodeResult {
  id: string;
  /** Shown to the admin exactly once — never retrievable again. */
  plaintext: string;
  hint: string;
}

export async function generateMembershipCodeAction(input: GenerateCodeInput): Promise<GenerateCodeResult> {
  const { userId, restaurantId } = await requireSpiritVaultStaff();

  const grantDays = input.grantDays && input.grantDays > 0 ? Math.floor(input.grantDays) : 365;
  const maxRedemptions = input.maxRedemptions == null ? null : Math.max(1, Math.floor(input.maxRedemptions));
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error("invalid expiresAt");

  // Retry on the astronomically unlikely hash collision within a venue.
  for (let attempt = 0; attempt < 5; attempt++) {
    const gen = generateMembershipCode();
    const clash = await prisma.membershipCode.findUnique({
      where: { restaurantId_codeHash: { restaurantId, codeHash: gen.codeHash } },
      select: { id: true },
    });
    if (clash) continue;
    const created = await prisma.membershipCode.create({
      data: {
        restaurantId,
        codeHash: gen.codeHash,
        hint: gen.hint,
        tier: input.tier?.trim() || "echo_reserve",
        grantDays,
        maxRedemptions,
        expiresAt,
        label: input.label?.trim() || null,
        createdByClerkUserId: userId,
      },
      select: { id: true },
    });
    revalidatePath(MEMBERSHIP_PATH);
    return { id: created.id, plaintext: gen.plaintext, hint: gen.hint };
  }
  throw new Error("could not generate a unique code — please try again");
}

export async function revokeMembershipCodeAction(codeId: string): Promise<void> {
  const { restaurantId } = await requireSpiritVaultStaff();
  await prisma.membershipCode.updateMany({
    where: { id: codeId, restaurantId, status: "ACTIVE" },
    data: { status: "REVOKED" },
  });
  revalidatePath(MEMBERSHIP_PATH);
}

export interface MembershipCodeListItem {
  id: string;
  hint: string;
  label: string | null;
  tier: string;
  status: "ACTIVE" | "REVOKED";
  grantDays: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export async function listMembershipCodes(): Promise<MembershipCodeListItem[]> {
  const { restaurantId } = await requireSpiritVaultStaff();
  const rows = await prisma.membershipCode.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      hint: true,
      label: true,
      tier: true,
      status: true,
      grantDays: true,
      maxRedemptions: true,
      redemptionCount: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface RedemptionListItem {
  id: string;
  guestEmail: string | null;
  codeHint: string;
  redeemedAt: string;
}

export async function listRedemptions(limit = 50): Promise<RedemptionListItem[]> {
  const { restaurantId } = await requireSpiritVaultStaff();
  const rows = await prisma.membershipRedemption.findMany({
    where: { restaurantId },
    orderBy: { redeemedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
    select: {
      id: true,
      redeemedAt: true,
      guest: { select: { email: true } },
      code: { select: { hint: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    guestEmail: r.guest.email,
    codeHint: r.code.hint,
    redeemedAt: r.redeemedAt.toISOString(),
  }));
}
