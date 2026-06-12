"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MODULES } from "@/lib/mock/dashboard";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  // Append a short suffix to keep slugs unique without a DB round-trip.
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "restaurant"}-${suffix}`;
}

export interface OnboardingInput {
  name: string;
  seatCount: number;
  tier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";
}

// The 6 Profit First virtual accounts every restaurant starts with.
const SEED_ACCOUNTS: { key: string; name: string; targetPct: number }[] = [
  { key: "profit", name: "Profit", targetPct: 5 },
  { key: "owner_pay", name: "Owner Pay", targetPct: 5 },
  { key: "cogs_food", name: "COGS — Food", targetPct: 18 },
  { key: "cogs_liquor", name: "COGS — Liquor", targetPct: 12 },
  { key: "labor", name: "Labor", targetPct: 32 },
  { key: "opex", name: "OpEx + Spill", targetPct: 28 },
];

export async function createRestaurant(input: OnboardingInput): Promise<void> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  await prisma.restaurant.create({
    data: {
      name: input.name,
      slug: slugify(input.name),
      seatCount: input.seatCount || null,
      userRoles: {
        create: { clerkUserId: userId, role: "OPERATOR" },
      },
      tapSettings: {
        create: {}, // schema defaults: 5/5/18/12/32/28, simulationMode = true
      },
      targetSettings: {
        // Pour-cost targets default to common industry benchmarks (liquor ≤20%,
        // beer/bev ≤24% of their respective sales); sales-mix left null until the
        // operator sets it or Toast supplies the per-day split.
        create: {
          targetPrimeCost: 60,
          targetFoodCost: 18,
          targetLiquorCost: 12,
          targetLaborCost: 32,
          targetLiquorPourPct: 20,
          targetBeveragePourPct: 24,
        },
      },
      moduleConfigs: {
        create: DEFAULT_MODULES.map((mod, i) => ({ moduleKey: mod.key, position: i })),
      },
      virtualAccounts: {
        create: SEED_ACCOUNTS.map((a) => ({ key: a.key, name: a.name, targetPct: a.targetPct })),
      },
    },
  });

  // Tier 3 (statement upload) sends them to import their history first.
  redirect(input.tier === "TIER_3" ? "/import" : "/dashboard");
}
