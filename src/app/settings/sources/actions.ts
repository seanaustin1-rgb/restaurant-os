"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { DataSourceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sourceMapFor, type SourceCategory } from "@/lib/source-map";

const PATH = "/settings/sources";

async function requireRestaurant() {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: ["OPERATOR", "CONSULTANT", "MANAGER"] } },
    select: { restaurantId: true, restaurant: { select: { businessType: true } } },
  });
  if (!role) throw new Error("forbidden");
  return { userId, restaurantId: role.restaurantId, businessType: role.restaurant.businessType };
}

export interface UpdateSourceConfigInput {
  category: SourceCategory;
  providerName: string;
  status: DataSourceStatus;
  notes?: string;
}

export async function updateSourceConfig(input: UpdateSourceConfigInput): Promise<void> {
  const { userId, restaurantId, businessType } = await requireRestaurant();
  const sourceMap = sourceMapFor(businessType);
  const group = sourceMap.groups.find((g) => g.category === input.category);
  const provider = group?.options.find((o) => o.name === input.providerName);
  if (!group || !provider) throw new Error("Unknown source option for this business template.");
  if (input.category === "aura" && input.providerName === "Google Business Profile" && input.status === "CONNECTED") {
    const activeGoogleConnection = await prisma.integrationConnection.findFirst({
      where: {
        restaurantId,
        provider: "GOOGLE_BUSINESS_PROFILE",
        isActive: true,
        externalLocationId: { notIn: ["pending", "unselected"] },
      },
      select: { id: true },
    });
    if (!activeGoogleConnection) {
      throw new Error("Authorize Google Business Profile and choose a location before marking it connected.");
    }
  }

  await prisma.dataSourceConfig.upsert({
    where: {
      restaurantId_category_providerName: {
        restaurantId,
        category: input.category,
        providerName: input.providerName,
      },
    },
    update: {
      status: input.status,
      notes: input.notes?.trim() || null,
      updatedBy: userId,
    },
    create: {
      restaurantId,
      category: input.category,
      providerName: input.providerName,
      status: input.status,
      notes: input.notes?.trim() || null,
      updatedBy: userId,
    },
  });

  revalidatePath(PATH);
}
