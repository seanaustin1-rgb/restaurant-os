"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ADJUSTMENT_ROLES } from "@/lib/access/roles";

const PATH = "/settings/beverage";

async function requireRestaurant(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ADJUSTMENT_ROLES] } },
    select: { restaurantId: true },
  });
  if (!role) throw new Error("forbidden");
  return role.restaurantId;
}

export interface BeverageSettings {
  liquorSalesMixPct: number | null;
  beverageSalesMixPct: number | null;
  targetLiquorPourPct: number | null;
  targetBeveragePourPct: number | null;
}

// A percent must be null (clear it) or a number in [0, 100]; anything else is a
// typo we reject rather than store.
function clean(v: number | null | undefined, label: string): number | null {
  if (v == null || Number.isNaN(v)) return null;
  if (v < 0 || v > 100) throw new Error(`${label} must be between 0 and 100`);
  return Math.round(v * 100) / 100;
}

export async function updateBeverageSettings(input: BeverageSettings): Promise<void> {
  const restaurantId = await requireRestaurant();
  const data = {
    liquorSalesMixPct: clean(input.liquorSalesMixPct, "Liquor sales mix"),
    beverageSalesMixPct: clean(input.beverageSalesMixPct, "Beer/beverage sales mix"),
    targetLiquorPourPct: clean(input.targetLiquorPourPct, "Liquor pour-cost target"),
    targetBeveragePourPct: clean(input.targetBeveragePourPct, "Beer/beverage cost target"),
  };
  // TargetSettings is created at onboarding, but upsert keeps this safe for any
  // restaurant that predates it.
  await prisma.targetSettings.upsert({
    where: { restaurantId },
    update: data,
    create: { restaurantId, ...data },
  });
  revalidatePath(PATH);
  revalidatePath("/dashboard");
}
