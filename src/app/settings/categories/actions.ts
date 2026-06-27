"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { TapBucket } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADJUSTMENT_ROLES } from "@/lib/access/roles";
import { TAP_BUCKET_LABEL, MISC_CATEGORY_NAME } from "@/lib/categorization/categories";

const PATH = "/settings/categories";

// Resolve the signed-in user's editable restaurant, or throw.
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

// Confirm a category belongs to a restaurant the user may edit; returns the category.
async function requireOwnedCategory(categoryId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, restaurantId: true, name: true, isSystem: true },
  });
  if (!cat) throw new Error("category not found");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, restaurantId: cat.restaurantId, role: { in: [...ADJUSTMENT_ROLES] } },
    select: { id: true },
  });
  if (!role) throw new Error("forbidden");
  return cat;
}

function assertTapBucket(b: string): asserts b is TapBucket {
  if (!(b in TAP_BUCKET_LABEL)) throw new Error("invalid tap bucket");
}

export interface NewCategory {
  id: string;
  name: string;
  tapBucket: TapBucket;
}

export async function createCategory(name: string, tapBucket: string): Promise<NewCategory> {
  const restaurantId = await requireRestaurant();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("name required");
  assertTapBucket(tapBucket);

  const existing = await prisma.category.findFirst({ where: { restaurantId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const created = await prisma.category.create({
    data: {
      restaurantId,
      name: trimmed,
      tapBucket,
      isSystem: false,
      sortOrder: (existing?.sortOrder ?? 0) + 1,
    },
    select: { id: true, name: true, tapBucket: true },
  });
  revalidatePath(PATH);
  return created;
}

export async function renameCategory(categoryId: string, name: string): Promise<void> {
  await requireOwnedCategory(categoryId);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("name required");
  await prisma.category.update({ where: { id: categoryId }, data: { name: trimmed } });
  revalidatePath(PATH);
}

export async function remapCategory(categoryId: string, tapBucket: string): Promise<void> {
  await requireOwnedCategory(categoryId);
  assertTapBucket(tapBucket);
  await prisma.category.update({ where: { id: categoryId }, data: { tapBucket } });
  revalidatePath(PATH);
}

// Archive (soft-delete). Refuses if the category is "Misc" (the catch-all) or
// still has transactions — reassign those first so no dollar is orphaned.
export async function archiveCategory(categoryId: string): Promise<void> {
  const cat = await requireOwnedCategory(categoryId);
  if (cat.name === MISC_CATEGORY_NAME) throw new Error("cannot archive the Misc catch-all");
  const count = await prisma.transaction.count({ where: { categoryId } });
  if (count > 0) throw new Error(`reassign ${count} transaction(s) first`);
  await prisma.category.update({ where: { id: categoryId }, data: { archivedAt: new Date() } });
  revalidatePath(PATH);
}

// Set (null/0 clears) a category's monthly spend budget.
export async function setCategoryBudget(categoryId: string, monthlyBudget: number | null): Promise<void> {
  await requireOwnedCategory(categoryId);
  const value =
    monthlyBudget == null || !Number.isFinite(monthlyBudget) || monthlyBudget <= 0
      ? null
      : Math.round(monthlyBudget * 100) / 100;
  await prisma.category.update({ where: { id: categoryId }, data: { monthlyBudget: value } });
  revalidatePath(PATH);
  revalidatePath("/modules/category-trends");
}
