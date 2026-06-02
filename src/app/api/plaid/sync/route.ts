import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

// Triggers a sync for all of the signed-in user's restaurant's active connections.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true },
  });
  if (!role) {
    return NextResponse.json({ error: "no restaurant" }, { status: 400 });
  }

  const connections = await prisma.plaidConnection.findMany({
    where: { restaurantId: role.restaurantId, isActive: true },
    select: { id: true },
  });

  try {
    await Promise.all(
      connections.map((c) =>
        inngest.send({
          name: "plaid/connection.sync.requested",
          data: { plaidConnectionId: c.id, restaurantId: role.restaurantId },
        }),
      ),
    );
    return NextResponse.json({ triggered: connections.length });
  } catch {
    // Inngest dev server may be offline locally; surface gracefully.
    return NextResponse.json(
      { triggered: 0, warning: "could not reach Inngest; the daily sync will catch up" },
      { status: 202 },
    );
  }
}
