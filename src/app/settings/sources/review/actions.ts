"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { approveFinancialEvent, excludeFinancialEvent } from "@/lib/financial-ledger/review";

const REVIEW_PATH = "/settings/sources/review";
const SOURCES_PATH = "/settings/sources";
const ACCESS_ROLES = ["OPERATOR", "CONSULTANT", "MANAGER"] as const;

async function requireReviewRole() {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ACCESS_ROLES] } },
    select: { restaurantId: true },
  });
  if (!role) throw new Error("insufficient role");

  return { userId, restaurantId: role.restaurantId };
}

export async function approveFinancialEventAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) throw new Error("missing event id");
  const { userId, restaurantId } = await requireReviewRole();

  await approveFinancialEvent(prisma, {
    restaurantId,
    normalizedFinancialEventId: eventId,
    approvedBy: userId,
  });

  revalidatePath(REVIEW_PATH);
  revalidatePath(SOURCES_PATH);
  revalidatePath("/dashboard");
}

export async function excludeFinancialEventAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) throw new Error("missing event id");
  const { userId, restaurantId } = await requireReviewRole();

  await excludeFinancialEvent(prisma, {
    restaurantId,
    normalizedFinancialEventId: eventId,
    resolvedBy: userId,
  });

  revalidatePath(REVIEW_PATH);
  revalidatePath(SOURCES_PATH);
  revalidatePath("/dashboard");
}
