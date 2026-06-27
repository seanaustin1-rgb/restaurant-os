"use server";

import { randomBytes } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendAccessInviteEmail } from "@/lib/email/access-invite";

const PATH = "/settings/access";
const ALLOWED_ROLES: UserRole[] = ["OPERATOR", "CONSULTANT", "INVESTOR", "MANAGER"];
const ROLE_LABELS: Record<UserRole, string> = {
  OPERATOR: "owner/operator",
  CONSULTANT: "consultant/accountant",
  INVESTOR: "investor",
  MANAGER: "manager",
};

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

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return `${base}${path}`;
}

async function clerkUserIdForEmail(email: string): Promise<string | null> {
  const client = await clerkClient();
  const users = await client.users.getUserList({ emailAddress: [email] });
  return users.data[0]?.id ?? null;
}

async function currentUserEmail(userId: string): Promise<string | null> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const primaryId = user.primaryEmailAddressId;
  return user.emailAddresses.find((email) => email.id === primaryId)?.emailAddress.toLowerCase() ?? user.emailAddresses[0]?.emailAddress.toLowerCase() ?? null;
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

export async function inviteAccessByEmail(input: {
  email: string;
  role: string;
}): Promise<{ status: "granted" | "invited"; inviteUrl?: string; emailSent?: boolean; note?: string }> {
  const { userId, restaurantId } = await requireOperator();
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("A valid email is required.");
  const role = cleanRole(input.role);

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true },
  });
  const existingUserId = await clerkUserIdForEmail(email);
  if (existingUserId) {
    await prisma.userRestaurantRole.upsert({
      where: {
        clerkUserId_restaurantId: {
          clerkUserId: existingUserId,
          restaurantId,
        },
      },
      update: { role },
      create: { clerkUserId: existingUserId, restaurantId, role },
    });
    revalidatePath(PATH);
    revalidatePath("/dashboard");
    return { status: "granted", note: "This email already has a Clerk account, so access was granted immediately." };
  }

  const token = randomBytes(24).toString("hex");
  const invite = await prisma.businessAccessInvite.create({
    data: {
      restaurantId,
      email,
      role,
      token,
      invitedBy: userId,
    },
  });
  const inviteUrl = appUrl(`/access/accept?token=${invite.token}`);
  const result = await sendAccessInviteEmail({
    to: email,
    businessName: restaurant?.name ?? "this business",
    roleLabel: ROLE_LABELS[role],
    inviteUrl,
  });

  revalidatePath(PATH);
  return {
    status: "invited",
    inviteUrl,
    emailSent: result.sent,
    note: result.sent ? "Invite email sent." : result.reason,
  };
}

export async function revokeAccessInvite(input: { inviteId: string }): Promise<void> {
  const { userId, restaurantId } = await requireOperator();
  await prisma.businessAccessInvite.updateMany({
    where: { id: input.inviteId, restaurantId, status: "PENDING" },
    data: { status: "REVOKED", revokedAt: new Date(), acceptedBy: userId },
  });
  revalidatePath(PATH);
}

export async function acceptAccessInvite(token: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to accept this invite.");

  const invite = await prisma.businessAccessInvite.findUnique({
    where: { token },
    select: { id: true, restaurantId: true, email: true, role: true, status: true },
  });
  if (!invite || invite.status !== "PENDING") throw new Error("This invite is no longer active.");

  const email = await currentUserEmail(userId);
  if (!email || email !== invite.email.toLowerCase()) {
    throw new Error(`This invite is for ${invite.email}. Sign in with that email to accept it.`);
  }

  await prisma.$transaction([
    prisma.userRestaurantRole.upsert({
      where: {
        clerkUserId_restaurantId: {
          clerkUserId: userId,
          restaurantId: invite.restaurantId,
        },
      },
      update: { role: invite.role },
      create: { clerkUserId: userId, restaurantId: invite.restaurantId, role: invite.role },
    }),
    prisma.businessAccessInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedBy: userId, acceptedAt: new Date() },
    }),
  ]);

  revalidatePath("/dashboard");
  redirect("/dashboard");
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
