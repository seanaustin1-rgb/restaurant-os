"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { GO_LIVE_MODULE_KEY, type GoLiveAssumptions } from "@/lib/modules/go-live-coach";

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

function cleanPct(value: number, label: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) throw new Error(`${label} must be a number`);
  if (value < 0 || value > 20) throw new Error(`${label} must be between 0% and 20%`);
  return Math.round(value * 100) / 100;
}

function cleanFloor(value: number | null): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || Number.isNaN(value)) throw new Error("Cash floor must be a number");
  if (value < 0 || value > 10_000_000) throw new Error("Cash floor looks like a typo");
  return Math.round(value * 100) / 100;
}

export async function updateGoLiveAssumptions(input: {
  operatingCashFloor: number | null;
  pilotProfitPct: number;
  investorReturnPct: number;
}): Promise<void> {
  const restaurantId = await requireRestaurant();
  const settings: Partial<GoLiveAssumptions> = {
    operatingCashFloor: cleanFloor(input.operatingCashFloor),
    pilotProfitPct: cleanPct(input.pilotProfitPct, "Pilot profit skim"),
    investorReturnPct: cleanPct(input.investorReturnPct, "Investor return"),
  };

  await prisma.moduleConfig.upsert({
    where: { restaurantId_moduleKey: { restaurantId, moduleKey: GO_LIVE_MODULE_KEY } },
    update: { settings },
    create: { restaurantId, moduleKey: GO_LIVE_MODULE_KEY, settings },
  });

  revalidatePath("/modules/go-live");
  revalidatePath("/dashboard");
}
