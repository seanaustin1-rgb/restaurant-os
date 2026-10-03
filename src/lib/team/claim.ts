import { auth, clerkClient } from "@clerk/nextjs/server";
import { requireTeamAccess } from "./access";
import { teamDb } from "./db";
import { normalizeTeamPhone } from "./phone";
import { prisma } from "@/lib/prisma";

export class TeamClaimDenied extends Error {
  constructor() {
    super("No pending Team invitation matches your verified phone for this restaurant.");
    this.name = "TeamClaimDenied";
  }
}

/** The phone comes only from Clerk's verified primary phone, never the invite URL. */
export async function claimTeamMembership(restaurantId: string, membershipId: string): Promise<void> {
  if (!restaurantId?.trim() || !membershipId?.trim()) throw new TeamClaimDenied();
  const { userId } = await auth();
  if (!userId) throw new TeamClaimDenied();
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const phone = user.phoneNumbers.find((item) => item.id === user.primaryPhoneNumberId);
  if (!phone || phone.verification?.status !== "verified") throw new TeamClaimDenied();
  const phoneE164 = normalizeTeamPhone(phone.phoneNumber);
  const moduleConfig = await prisma.moduleConfig.findUnique({
    where: { restaurantId_moduleKey: { restaurantId, moduleKey: "team_hub" } },
    select: { isEnabled: true },
  });
  if (!moduleConfig?.isEnabled) throw new TeamClaimDenied();
  const db = teamDb(restaurantId);
  const invite = await db.teamMembership.findUnique({
    where: { restaurantId_phoneE164: { restaurantId, phoneE164 } },
    select: { id: true, status: true, clerkUserId: true },
  });
  if (invite?.id !== membershipId) throw new TeamClaimDenied();
  if (invite.status === "ACTIVE" && invite.clerkUserId === userId) {
    await requireTeamAccess(restaurantId);
    return;
  }
  if (!invite || invite.status !== "INVITED" || invite.clerkUserId) throw new TeamClaimDenied();
  const claimed = await db.teamMembership.updateMany({
    where: { id: invite.id, phoneE164, status: "INVITED", clerkUserId: null },
    data: { clerkUserId: userId, status: "ACTIVE" },
  });
  if (claimed.count !== 1) throw new TeamClaimDenied();
  await db.teamActionLog.create({ data: {
    restaurantId,
    actorId: invite.id, action: "CLAIM_MEMBER", targetType: "TeamMembership", targetId: invite.id,
  } });
  await requireTeamAccess(restaurantId);
}
