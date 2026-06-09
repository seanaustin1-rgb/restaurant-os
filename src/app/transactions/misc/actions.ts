"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { TAP_BUCKET_TO_LEGACY } from "@/lib/categorization/rules";

// Bulk-assign a category to many transactions at once (the Misc cleanup flow).
// Marks each as a manual override so future imports/syncs won't re-sweep them.
// Only OPERATOR/MANAGER of the owning restaurant may do this; the updateMany is
// scoped to that restaurant so foreign ids can't be touched.
export async function assignCategoryBulk(
  transactionIds: string[],
  categoryId: string,
): Promise<{ count: number }> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const ids = [...new Set(transactionIds)].filter(Boolean);
  if (ids.length === 0) return { count: 0 };

  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, restaurantId: true, tapBucket: true },
  });
  if (!cat) throw new Error("category not found");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, restaurantId: cat.restaurantId, role: { in: ["OPERATOR", "MANAGER"] } },
    select: { id: true },
  });
  if (!role) throw new Error("forbidden");

  const res = await prisma.transaction.updateMany({
    // restaurantId scope means ids from another tenant are silently ignored.
    where: { id: { in: ids }, restaurantId: cat.restaurantId },
    data: { categoryId: cat.id, bucket: TAP_BUCKET_TO_LEGACY[cat.tapBucket], isManualOverride: true },
  });

  revalidatePath("/transactions/misc");
  revalidatePath("/dashboard");
  return { count: res.count };
}
