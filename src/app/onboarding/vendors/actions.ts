"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ADJUSTMENT_ROLES } from "@/lib/access/roles";
import { keywordMatchesText, TAP_BUCKET_TO_LEGACY } from "@/lib/categorization/rules";
import { signatureOf } from "@/lib/categorization/suggestions";

// User-created rules win over seeded vendor rules (10+) but run after the
// payroll CHECK_MIN (0) — same band the rules screen uses.
const OPERATOR_RULE_PRIORITY = 5;

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

export interface VendorMapping {
  signature: string;
  categoryId: string;
}

export interface ConfirmResult {
  vendorsMapped: number;
  rulesCreated: number;
  rulesUpdated: number;
  txnsRecategorized: number;
}

/**
 * Confirm vendor→category mappings from the setup wizard. For each: seed (or
 * update) a per-tenant KEYWORD rule so future imports self-categorize, and
 * recategorize the matching existing transactions (categoryId + legacy bucket +
 * isManualOverride). Idempotent — re-running with the same mappings updates the
 * same rule and re-applies the same category.
 */
export async function confirmVendorMappings(mappings: VendorMapping[]): Promise<ConfirmResult> {
  const restaurantId = await requireRestaurant();
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return { vendorsMapped: 0, rulesCreated: 0, rulesUpdated: 0, txnsRecategorized: 0 };
  }

  // Categories the user may target (this restaurant, not archived).
  const cats = await prisma.category.findMany({
    where: { restaurantId, archivedAt: null },
    select: { id: true, tapBucket: true },
  });
  const tapById = new Map(cats.map((c) => [c.id, c.tapBucket]));

  let rulesCreated = 0;
  let rulesUpdated = 0;
  let txnsRecategorized = 0;
  let vendorsMapped = 0;

  for (const m of mappings) {
    const signature = (m.signature ?? "").trim();
    const categoryId = m.categoryId;
    if (!signature || !categoryId) continue;
    if (!signatureOf(signature, null)) continue;
    const tap = tapById.get(categoryId);
    if (!tap) continue; // category not in this restaurant — skip silently
    vendorsMapped++;

    // 1) Seed / update the keyword rule (pattern = the vendor signature).
    const existing = await prisma.rule.findFirst({
      where: { restaurantId, matchType: "KEYWORD", pattern: signature },
      select: { id: true, categoryId: true },
    });
    if (existing) {
      if (existing.categoryId !== categoryId) {
        await prisma.rule.update({ where: { id: existing.id }, data: { categoryId, enabled: true } });
        rulesUpdated++;
      }
    } else {
      await prisma.rule.create({
        data: {
          restaurantId,
          categoryId,
          matchType: "KEYWORD",
          pattern: signature,
          priority: OPERATOR_RULE_PRIORITY,
          confidence: 0.9,
          isSystem: false,
          enabled: true,
        },
      });
      rulesCreated++;
    }

    // 2) Recategorize the vendor's existing transactions (categoryId is what the
    //    dashboard reads; also dual-write the coarse legacy bucket + mark manual).
    const legacy = TAP_BUCKET_TO_LEGACY[tap];
    const candidates = await prisma.transaction.findMany({
      where: {
        restaurantId,
        OR: [
          { merchantName: { contains: signature, mode: "insensitive" } },
          { description: { contains: signature, mode: "insensitive" } },
        ],
      },
      select: { id: true, merchantName: true, description: true },
    });
    const matchedIds = candidates
      .filter((t) => keywordMatchesText(signature, t.merchantName, t.description))
      .map((t) => t.id);
    if (matchedIds.length > 0) {
      const res = await prisma.transaction.updateMany({
        where: { restaurantId, id: { in: matchedIds } },
        data: { categoryId, bucket: legacy, isManualOverride: true },
      });
      txnsRecategorized += res.count;
    }
  }

  // Numbers move on the dashboard and every category-driven view.
  for (const p of ["/dashboard", "/modules/allocation", "/modules/spending", "/modules/category-trends", "/modules/vendor-spend", "/onboarding/vendors", "/transactions"]) {
    revalidatePath(p);
  }

  return { vendorsMapped, rulesCreated, rulesUpdated, txnsRecategorized };
}
