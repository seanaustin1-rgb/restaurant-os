"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { TransactionBucket } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BUCKET_LABEL } from "@/lib/buckets";

// Recategorize a transaction. Marks it as a manual override so future syncs
// won't overwrite the human's choice. Only OPERATOR/MANAGER of the owning
// restaurant may do this.
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
    where: { clerkUserId: userId, restaurantId: txn.restaurantId, role: { in: ["OPERATOR", "MANAGER"] } },
    select: { id: true },
  });
  if (!role) throw new Error("forbidden");

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { bucket, isManualOverride: true },
  });

  revalidatePath("/transactions");
}
