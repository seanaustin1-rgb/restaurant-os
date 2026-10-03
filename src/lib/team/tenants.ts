import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireTeamAccess, TeamAccessDenied, type TeamViewer } from "./access";

export interface TeamTenant {
  id: string;
  name: string;
  viewer: TeamViewer;
}

/** Enumerate enabled tenants, then positively check access to each one. */
export async function listMyTeamTenants(): Promise<TeamTenant[]> {
  const { userId } = await auth();
  if (!userId) return [];
  const enabled = await prisma.moduleConfig.findMany({
    where: { moduleKey: "team_hub", isEnabled: true },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });
  const tenants: TeamTenant[] = [];
  for (const row of enabled) {
    try {
      const viewer = await requireTeamAccess(row.restaurantId);
      tenants.push({ id: row.restaurantId, name: row.restaurant.name, viewer });
    } catch (error) {
      if (!(error instanceof TeamAccessDenied)) throw error;
    }
  }
  return tenants;
}
