"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const PATH = "/modules/forward-cash";

// Product decision (2026-07-13): the cash floor is owner-level — only the
// top-of-tenant role (OPERATOR; the "broker" for a brokerage tenant) may set it.
// MANAGER is intentionally deferred and may be added later; keep this list the
// single edit point when that decision is made.
const CASH_FLOOR_EDIT_ROLES = ["OPERATOR"] as const;

// Authorize an allowed role ON THIS restaurant. Scoping to the passed
// restaurantId (not "the user's first operator role") is what keeps a
// multi-tenant operator from writing the floor of a different tenant than the
// one whose Forward Cash page they're on.
async function requireCashFloorAccess(restaurantId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  if (!restaurantId) throw new Error("forbidden");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, restaurantId, role: { in: [...CASH_FLOOR_EDIT_ROLES] } },
    select: { restaurantId: true },
  });
  if (!role) throw new Error("forbidden");
}

/**
 * Set (or clear) the cash floor for a specific restaurant: the minimum operating
 * balance the operator wants to keep. Pass `null` to unset it. `restaurantId` is
 * the tenant whose Forward Cash page is open — bound and authorized here so the
 * write can never land on another tenant the user also operates.
 */
export async function setCashFloor(restaurantId: string, amount: number | null): Promise<void> {
  await requireCashFloorAccess(restaurantId);

  let value: number | null = null;
  if (amount != null) {
    if (typeof amount !== "number" || Number.isNaN(amount)) throw new Error("Floor must be a number");
    if (amount < 0) throw new Error("Cash floor can't be negative");
    if (amount > 100_000_000) throw new Error("Floor looks like a typo");
    value = Math.round(amount * 100) / 100;
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { cashFloor: value },
  });
  revalidatePath(PATH);
}
