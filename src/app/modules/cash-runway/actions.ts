"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const PATH = "/modules/cash-runway";

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
 * Set (or update) the cash balance anchor: "the bank balance was X on date Y."
 * Take both from any bank statement — the runway math flows from this point.
 */
export async function setCashAnchor(balance: number, dateISO: string): Promise<void> {
  const restaurantId = await requireRestaurant();

  if (typeof balance !== "number" || Number.isNaN(balance)) {
    throw new Error("Balance must be a number");
  }
  // Negative balances are real (overdraft) but > $100M is a typo.
  if (Math.abs(balance) > 100_000_000) throw new Error("Balance looks like a typo");

  const date = new Date(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  if (date.getTime() > Date.now()) throw new Error("Anchor date can't be in the future");

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      cashBalanceAnchor: Math.round(balance * 100) / 100,
      cashBalanceAnchorDate: date,
    },
  });
  revalidatePath(PATH);
}

/**
 * Set (or clear) the minimum cash floor (B6): the least operating cash the
 * operator wants to keep on hand. Drives the deterministic cash-floor breach
 * signal + pre-sweep warning. Pass null to clear it (the signal goes silent).
 */
export async function setCashFloor(floor: number | null): Promise<void> {
  const restaurantId = await requireRestaurant();

  let value: number | null = null;
  if (floor != null) {
    if (typeof floor !== "number" || Number.isNaN(floor)) {
      throw new Error("Floor must be a number");
    }
    if (floor < 0) throw new Error("Floor can't be negative");
    if (floor > 100_000_000) throw new Error("Floor looks like a typo");
    value = Math.round(floor * 100) / 100;
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { minCashFloor: value },
  });
  revalidatePath(PATH);
}
