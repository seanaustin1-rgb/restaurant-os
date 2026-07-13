import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadAgentRoster } from "@/lib/realestate/load-roster";
import { RosterView } from "./RosterView";

// Broker speed-to-lead roster. Resolves the signed-in broker's real-estate
// tenant and renders the worst-first agent scorecard from the deterministic
// engine. (Restaurant tenants have no leads and fall back to /dashboard.)
export default async function BrokerRosterPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, restaurant: { businessType: "REAL_ESTATE_BROKERAGE" } },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!role) redirect("/dashboard");

  const data = await loadAgentRoster(role.restaurantId);
  return <RosterView brokerageName={role.restaurant.name} restaurantId={role.restaurantId} data={data} />;
}
