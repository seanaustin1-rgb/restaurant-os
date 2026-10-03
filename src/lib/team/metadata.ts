import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { teamDb } from "./db";

/** A Team claim may mark an account Team-only only while it has no business role. */
export async function syncTeamOnlyAfterClaim(clerkUserId: string): Promise<void> {
  const businessRoles = await prisma.userRestaurantRole.count({ where: { clerkUserId } });
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(clerkUserId, {
    publicMetadata: { teamOnly: businessRoles === 0 },
  });
}

/** Called after every application path that creates a business role. */
export async function clearTeamOnlyForBusinessRole(clerkUserId: string): Promise<void> {
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(clerkUserId, { publicMetadata: { teamOnly: false } });
}

/** Recompute the hint after access is removed, without adding request-time queries. */
export async function syncTeamOnlyForCurrentAccess(clerkUserId: string): Promise<void> {
  const businessRoles = await prisma.userRestaurantRole.count({ where: { clerkUserId } });
  let teamOnly = false;
  if (businessRoles === 0) {
    const enabled = await prisma.moduleConfig.findMany({
      where: { moduleKey: "team_hub", isEnabled: true },
      select: { restaurantId: true },
    });
    for (const { restaurantId } of enabled) {
      if (await teamDb(restaurantId).teamMembership.count({ where: { clerkUserId, status: "ACTIVE" } })) {
        teamOnly = true;
        break;
      }
    }
  }
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(clerkUserId, { publicMetadata: { teamOnly } });
}
