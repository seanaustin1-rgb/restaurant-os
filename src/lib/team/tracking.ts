import type { TeamViewer } from "./access";
import { teamDb } from "./db";

/** Owners authenticate through business roles, but existing Team memberships hold visit/progress records. */
export async function teamTrackingMembership(viewer: TeamViewer) {
  return teamDb(viewer.restaurantId).teamMembership.findFirst({
    where: viewer.membershipId ? { id: viewer.membershipId, status: "ACTIVE" } : { clerkUserId: viewer.clerkUserId, status: "ACTIVE" },
    select: { id: true, lastFeedSeenAt: true },
  });
}
