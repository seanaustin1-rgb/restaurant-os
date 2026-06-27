"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { BusinessType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { industryTemplateFor } from "@/lib/industry-templates";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "business"}-${suffix}`;
}

export interface OnboardingInput {
  name: string;
  businessType: BusinessType;
  scaleValue?: number;
  profile?: Record<string, string | number | boolean | null>;
  tier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";
}

function targetData(template: ReturnType<typeof industryTemplateFor>) {
  const t = template.defaultTargets;
  return {
    targetPrimeCost: t.targetPrimeCost ?? null,
    targetFoodCost: t.targetFoodCost ?? null,
    targetLiquorCost: t.targetLiquorCost ?? null,
    targetLaborCost: t.targetLaborCost ?? null,
    targetLiquorPourPct: t.targetLiquorPourPct ?? null,
    targetBeveragePourPct: t.targetBeveragePourPct ?? null,
  };
}

export async function createRestaurant(input: OnboardingInput): Promise<void> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const template = industryTemplateFor(input.businessType);
  const scaleValue = input.scaleValue || null;
  const profile = {
    ...(input.profile ?? {}),
    [template.scaleAnchor.key]: scaleValue,
  };

  await prisma.restaurant.create({
    data: {
      name: input.name,
      slug: slugify(input.name),
      businessType: template.key,
      seatCount: template.scaleAnchor.key === "seatCount" ? scaleValue : null,
      profile: profile as Prisma.InputJsonValue,
      userRoles: {
        create: { clerkUserId: userId, role: "OPERATOR" },
      },
      tapSettings: {
        create: {},
      },
      targetSettings: {
        create: targetData(template),
      },
      moduleConfigs: {
        create: template.defaultModuleKeys.map((moduleKey, i) => ({ moduleKey, position: i })),
      },
      virtualAccounts: {
        create: template.seedAccounts.map((account) => ({
          key: account.key,
          name: account.name,
          targetPct: account.targetPct,
        })),
      },
    },
  });

  redirect(input.tier === "TIER_3" ? "/import" : "/settings/sources?intro=1");
}
