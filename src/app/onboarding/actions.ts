"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { BusinessType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { industryTemplateFor } from "@/lib/industry-templates";
import {
  plannedSourceConfigsForOnboarding,
  type OnboardingSourceSelection,
} from "@/lib/onboarding/source-selection";

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
  selectedSources?: OnboardingSourceSelection[];
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

function firstRunPath(input: OnboardingInput): string {
  if (input.tier === "TIER_3") {
    if (input.businessType === "VACATION_RENTAL") return "/import/rentals";
    if (input.businessType === "REAL_ESTATE_BROKERAGE") return "/import/brokerage";
    return "/import";
  }
  if (input.businessType === "REAL_ESTATE_BROKERAGE" && input.tier === "TIER_2") {
    return "/import/brokerage?intro=1";
  }
  if (input.tier === "TIER_4") {
    switch (input.businessType) {
      case "CONTRACTOR":
        return "/demo/contractor?from=onboarding";
      case "REAL_ESTATE_BROKERAGE":
        return realEstateKnownNumbersPath(input);
      case "VACATION_RENTAL":
        return "/demo/vacation-rental?from=onboarding";
      case "RETAIL":
        return "/demo/retail?from=onboarding";
      case "SERVICE":
        return "/demo/service?from=onboarding";
      case "RESTAURANT":
      default:
        return "/demo?from=onboarding";
    }
  }
  return "/settings/sources?intro=1";
}

function valueNumber(profile: OnboardingInput["profile"], key: string): number | null {
  const value = profile?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function realEstateKnownNumbersPath(input: OnboardingInput): string {
  const params = new URLSearchParams({ from: "onboarding" });
  params.set("name", input.name);

  const split = valueNumber(input.profile, "avgCommissionSplit");
  const avgGci = valueNumber(input.profile, "avgGci");
  const dealsPerYear = valueNumber(input.profile, "dealsPerYear");
  const leadSpend = valueNumber(input.profile, "monthlyLeadSpend");

  if (split != null) params.set("agentSplitPct", String(split));
  if (avgGci != null && dealsPerYear != null && dealsPerYear > 0) {
    params.set("monthlyGci", String(Math.round((avgGci * dealsPerYear) / 12)));
    params.set("pendingDeals", String(Math.max(1, Math.round(dealsPerYear / 8))));
  }
  if (leadSpend != null) params.set("leadSpend", String(leadSpend));

  return `/demo/real-estate?${params.toString()}`;
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
  const sourceConfigs = plannedSourceConfigsForOnboarding({
    businessType: input.businessType,
    selectedSources: input.selectedSources,
    updatedBy: userId,
  });

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
      dataSourceConfigs: {
        create: sourceConfigs,
      },
    },
  });

  redirect(firstRunPath(input));
}
