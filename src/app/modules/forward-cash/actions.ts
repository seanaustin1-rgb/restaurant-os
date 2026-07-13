"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const PATH = "/modules/forward-cash";

async function requireRestaurant(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: ["OPERATOR", "MANAGER"] } },
    select: { restaurantId: true },
  });
  if (!role) throw new Error("forbidden");
  return role.restaurantId;
}

/**
 * Set (or clear) the cash floor: the minimum operating balance the operator
 * wants to keep. Pass `null` to unset it (turns the floor warning off).
 */
export async function setCashFloor(amount: number | null): Promise<void> {
  const restaurantId = await requireRestaurant();

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
