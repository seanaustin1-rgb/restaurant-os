"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { BusinessType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { industryTemplateFor } from "@/lib/industry-templates";
import { MODULES } from "@/lib/modules";

const PATH = "/settings/business";

async function requireRestaurant(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: ["OPERATOR", "CONSULTANT", "MANAGER"] } },
    select: { restaurantId: true },
  });
  if (!role) throw new Error("forbidden");
  return role.restaurantId;
}

export interface BusinessTemplateInput {
  businessType: BusinessType;
  applyRecommendedModules: boolean;
  scaleValue?: number | null;
  profile?: Record<string, string | number | boolean | null>;
}

export async function updateBusinessTemplate(input: BusinessTemplateInput): Promise<void> {
  const restaurantId = await requireRestaurant();
  const template = industryTemplateFor(input.businessType);
  const scaleValue = input.scaleValue || null;
  const profile = {
    ...(input.profile ?? {}),
    [template.scaleAnchor.key]: scaleValue,
  };

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      businessType: template.key,
      seatCount: template.scaleAnchor.key === "seatCount" ? scaleValue : null,
      profile: profile as Prisma.InputJsonValue,
    },
  });

  if (input.applyRecommendedModules) {
    const defaultKeys = new Set(template.defaultModuleKeys);
    const allKeys = MODULES.map((m) => m.key);

    await prisma.$transaction([
      prisma.moduleConfig.updateMany({
        where: { restaurantId, moduleKey: { in: allKeys.filter((key) => !defaultKeys.has(key)) } },
        data: { isEnabled: false },
      }),
      ...template.defaultModuleKeys.map((moduleKey, position) =>
        prisma.moduleConfig.upsert({
          where: { restaurantId_moduleKey: { restaurantId, moduleKey } },
          update: { isEnabled: true, position },
          create: { restaurantId, moduleKey, isEnabled: true, position },
        }),
      ),
    ]);
  }

  revalidatePath(PATH);
  revalidatePath("/dashboard");
}
