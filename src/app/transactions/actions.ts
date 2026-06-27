"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { TransactionBucket } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADJUSTMENT_ROLES } from "@/lib/access/roles";
import { BUCKET_LABEL } from "@/lib/buckets";
import { ensureDefaultCategories, categoryIdByName, legacyBucketToCategoryName } from "@/lib/categorization/categories";

// Recategorize a transaction. Marks it as a manual override so future syncs
// won't overwrite the human's choice.
export async function setTransactionBucket(transactionId: string, bucket: TransactionBucket): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");

  if (!(bucket in BUCKET_LABEL)) throw new Error("invalid bucket");

  const txn = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { restaurantId: true },
  });
  if (!txn) throw new Error("transaction not found");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, restaurantId: txn.restaurantId, role: { in: [...ADJUSTMENT_ROLES] } },
    select: { id: true },
  });
  if (!role) throw new Error("forbidden");

  // The dashboard rolls up by categoryId, so a manual bucket change must also move
  // the transaction's category — otherwise the edit wouldn't affect any gauge.
  // Map the chosen legacy bucket to its default category for this restaurant.
  await ensureDefaultCategories(prisma, txn.restaurantId);
  const idByName = await categoryIdByName(prisma, txn.restaurantId);
  const categoryId = idByName.get(legacyBucketToCategoryName(bucket)) ?? null;

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { bucket, categoryId, isManualOverride: true },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}
