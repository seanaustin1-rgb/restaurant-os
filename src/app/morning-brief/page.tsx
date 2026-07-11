import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadDashboardData } from "@/lib/dashboard/data";
import { loadForwardCash } from "@/lib/modules/forward-cash";
import { buildDailyDigest } from "@/lib/modules/daily-digest";
import { MorningBriefClient } from "@/components/morning-brief/MorningBriefClient";

const OWNER_MODE_ROLES = ["OPERATOR"] as const;

function dateLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default async function MorningBriefPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...OWNER_MODE_ROLES] } },
    orderBy: { createdAt: "asc" },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  if (!role) redirect("/dashboard");

  const [dashboard, forwardCash] = await Promise.all([
    loadDashboardData(role.restaurantId),
    loadForwardCash(role.restaurantId),
  ]);
  const digest = buildDailyDigest({
    restaurantName: role.restaurant.name,
    dateLabel: dateLabel(),
    dashboard,
    forwardCash,
  });

  return <MorningBriefClient digest={digest} />;
}
