import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadDashboardData, type DashboardData } from "@/lib/dashboard/data";
import { loadModuleOrder } from "@/lib/dashboard/layout-store";
import { DashboardView } from "@/components/dashboard/DashboardView";

// Loads live data for each restaurant the signed-in user belongs to.
export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const roles = await prisma.userRestaurantRole.findMany({
    where: { clerkUserId: userId },
    select: { restaurantId: true },
    distinct: ["restaurantId"],
  });

  const dashboards: DashboardData[] = [];
  for (const r of roles) {
    dashboards.push(await loadDashboardData(r.restaurantId));
  }

  const moduleOrder = await loadModuleOrder(userId);

  return <DashboardView dashboards={dashboards} moduleOrder={moduleOrder} />;
}
