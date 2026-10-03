import { auth } from "@clerk/nextjs/server";
import { Prisma, TeamDept, TeamRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { teamDb } from "./db";

const ROLE_RANK: Record<TeamRole, number> = {
  MEMBER: 0,
  CONTRIBUTOR: 1,
  MANAGER: 2,
};

export interface TeamViewer {
  restaurantId: string;
  clerkUserId: string;
  membershipId: string | null;
  role: TeamRole;
  departments: TeamDept[];
}

export class TeamAccessDenied extends Error {
  constructor() {
    super("Team Hub access denied");
    this.name = "TeamAccessDenied";
  }
}

/** Resolve a user's Team role for exactly the restaurant supplied by the caller. */
export async function requireTeamAccess(
  restaurantId: string,
  minRole: TeamRole = "MEMBER",
): Promise<TeamViewer> {
  if (typeof restaurantId !== "string" || !restaurantId.trim() || !(minRole in ROLE_RANK)) {
    throw new TeamAccessDenied();
  }
  const { userId } = await auth();
  if (!userId) throw new TeamAccessDenied();

  const moduleConfig = await prisma.moduleConfig.findUnique({
    where: { restaurantId_moduleKey: { restaurantId, moduleKey: "team_hub" } },
    select: { isEnabled: true },
  });
  if (!moduleConfig?.isEnabled) throw new TeamAccessDenied();

  const businessRole = await prisma.userRestaurantRole.findUnique({
    where: { clerkUserId_restaurantId: { clerkUserId: userId, restaurantId } },
    select: { role: true },
  });
  if (businessRole?.role === "OPERATOR" || businessRole?.role === "MANAGER") {
    return {
      restaurantId,
      clerkUserId: userId,
      membershipId: null,
      role: "MANAGER",
      departments: [],
    };
  }

  const membership = await teamDb(restaurantId).teamMembership.findUnique({
    where: { restaurantId_clerkUserId: { restaurantId, clerkUserId: userId } },
    select: { id: true, status: true, role: true, departments: true },
  });
  if (membership?.status !== "ACTIVE" || ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
    throw new TeamAccessDenied();
  }

  return {
    restaurantId,
    clerkUserId: userId,
    membershipId: membership.id,
    role: membership.role,
    departments: membership.departments,
  };
}

/** Required predicate for published lesson reads, including direct links and tokens. */
export function visibleLessonFilter(viewer: TeamViewer): Prisma.TeamLessonWhereInput {
  if (viewer.role === "MANAGER") return { status: "PUBLISHED" };

  return {
    status: "PUBLISHED",
    managersOnly: false,
    OR: [
      { audience: { isEmpty: true } },
      { audience: { hasSome: viewer.departments } },
    ],
  };
}
