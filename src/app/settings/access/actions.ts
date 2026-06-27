"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PATH = "/settings/access";
const ALLOWED_ROLES: UserRole[] = ["OPERATOR", "CONSULTANT", "INVESTOR", "MANAGER"];

async function requireOperator() {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: "OPERATOR" },
    select: { restaurantId: true },
  });
  if (!role) throw new Error("Only an owner/operator can manage access.");
  return { userId, restaurantId: role.restaurantId };
}

function cleanRole(role: string): UserRole {
  if (!ALLOWED_ROLES.includes(role as UserRole)) throw new Error("Unknown role.");
  return role as UserRole;
}

export async function saveAccessRole(input: {
  clerkUserId: string;
  role: string;
}): Promise<void> {
  const { restaurantId } = await requireOperator();
  const clerkUserId = input.clerkUserId.trim();
  if (!clerkUserId) throw new Error("Clerk user ID is required.");
  const role = cleanRole(input.role);

  await prisma.userRestaurantRole.upsert({
    where: {
      clerkUserId_restaurantId: {
        clerkUserId,
        restaurantId,
      },
    },
    update: { role },
    create: { clerkUserId, restaurantId, role },
  });

  revalidatePath(PATH);
  revalidatePath("/dashboard");
}

export async function removeAccessRole(input: { roleId: string }): Promise<void> {
  const { userId, restaurantId } = await requireOperator();
  const role = await prisma.userRestaurantRole.findFirst({
    where: { id: input.roleId, restaurantId },
    select: { id: true, clerkUserId: true, role: true },
  });
  if (!role) throw new Error("Access row not found.");
  if (role.clerkUserId === userId) throw new Error("You cannot remove your own access.");

  if (role.role === "OPERATOR") {
    const operatorCount = await prisma.userRestaurantRole.count({
      where: { restaurantId, role: "OPERATOR" },
    });
    if (operatorCount <= 1) throw new Error("A business must keep at least one operator.");
  }

  await prisma.userRestaurantRole.delete({ where: { id: role.id } });
  revalidatePath(PATH);
  revalidatePath("/dashboard");
}
