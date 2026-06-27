import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadDashboardData, type DashboardData } from "@/lib/dashboard/data";
import { loadDashboardLayout } from "@/lib/dashboard/layout-store";
import { DashboardView } from "@/components/dashboard/DashboardView";

// Loads live data for each restaurant the signed-in user belongs to.
export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const roles = await prisma.userRestaurantRole.findMany({
    where: { clerkUserId: userId },
    select: {
      restaurantId: true,
      role: true,
      createdAt: true,
      restaurant: {
        select: {
          _count: {
            select: {
              dailySales: true,
              transactions: true,
              posConnections: true,
              plaidConnections: true,
            },
          },
        },
      },
    },
    distinct: ["restaurantId"],
  });

  roles.sort((a, b) => {
    const aCount = a.restaurant._count;
    const bCount = b.restaurant._count;
    const aScore = aCount.dailySales * 4 + aCount.transactions + aCount.posConnections * 10 + aCount.plaidConnections * 10;
    const bScore = bCount.dailySales * 4 + bCount.transactions + bCount.posConnections * 10 + bCount.plaidConnections * 10;
    if (bScore !== aScore) return bScore - aScore;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  if (roles.length > 0 && roles.every((role) => role.role === "INVESTOR")) {
    redirect("/investor");
  }

  const dashboards: DashboardData[] = [];
  for (const r of roles) {
    dashboards.push(await loadDashboardData(r.restaurantId));
  }

  const layout = await loadDashboardLayout(userId);

  const roleAssignments = roles.map((role) => ({ restaurantId: role.restaurantId, role: role.role }));

  return (
    <DashboardView
      dashboards={dashboards}
      moduleOrder={layout.order}
      pinnedModules={layout.pinned}
      roleAssignments={roleAssignments}
    />
  );
}
