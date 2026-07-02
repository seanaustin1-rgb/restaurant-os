"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ADJUSTMENT_ROLES } from "@/lib/access/roles";

const PATH = "/settings/allocation";

async function requireRestaurant(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ADJUSTMENT_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) throw new Error("forbidden");
  return role.restaurantId;
}

// The six TAP percentages (whole-number percents). Spill is held at 0 (no column
// yet) until the allocation-engine migration lands â€” see the allocation spec.
export interface TapSettingsInput {
  profitPct: number;
  ownerPayPct: number;
  cogsFoodPct: number;
  cogsLiquorPct: number;
  laborPct: number;
  opexPct: number;
  simulationMode: boolean;
}

// Each percent must be a number in [0, 100]; a blank/NaN is a typo we reject
// rather than silently store as 0 (which would quietly break the 100% total).
function clean(v: number | null | undefined, label: string): number {
  if (v == null || Number.isNaN(v)) throw new Error(`${label} is required`);
  if (v < 0 || v > 100) throw new Error(`${label} must be between 0 and 100`);
  return Math.round(v * 100) / 100;
}

export async function updateTapSettings(input: TapSettingsInput): Promise<void> {
  const restaurantId = await requireRestaurant();

  const data = {
    profitPct: clean(input.profitPct, "Profit"),
    ownerPayPct: clean(input.ownerPayPct, "Owner Pay"),
    cogsFoodPct: clean(input.cogsFoodPct, "COGS â€” Food"),
    cogsLiquorPct: clean(input.cogsLiquorPct, "COGS â€” Wine & Spirits"),
    laborPct: clean(input.laborPct, "Labor"),
    opexPct: clean(input.opexPct, "OpEx"),
    simulationMode: input.simulationMode,
  };

  // The TAPs allocate 100% of sales, so they must total exactly 100. Allow a
  // hair of float slack (rounding) but reject a real mismatch.
  const total =
    data.profitPct +
    data.ownerPayPct +
    data.cogsFoodPct +
    data.cogsLiquorPct +
    data.laborPct +
    data.opexPct;
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`TAP percentages must total 100% â€” they currently sum to ${Math.round(total * 100) / 100}%`);
  }

  // TapSettings is created at onboarding, but upsert keeps this safe for any
  // restaurant that predates it (all columns have schema defaults).
  await prisma.tapSettings.upsert({
    where: { restaurantId },
    update: data,
    create: { restaurantId, ...data },
  });
  revalidatePath(PATH);
  revalidatePath("/dashboard");
}
