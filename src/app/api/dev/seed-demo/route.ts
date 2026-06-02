import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { seedDemoData } from "@/lib/dev/seed-demo";

// DEV ONLY: seed a month of demo data.
// - If signed in: seeds into the user's restaurant (creating one + OPERATOR role if needed).
// - If called without a session (e.g. curl): creates a standalone "Demo Bistro".
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { restaurantId?: string };
  const { userId } = await auth();

  let restaurantId = body.restaurantId;

  if (!restaurantId && userId) {
    const role = await prisma.userRestaurantRole.findFirst({
      where: { clerkUserId: userId },
      select: { restaurantId: true },
    });
    restaurantId = role?.restaurantId;
  }

  if (!restaurantId) {
    const suffix = Math.random().toString(36).slice(2, 7);
    const created = await prisma.restaurant.create({
      data: {
        name: "Demo Bistro",
        slug: `demo-bistro-${suffix}`,
        seatCount: 120,
        tapSettings: { create: {} },
        ...(userId ? { userRoles: { create: { clerkUserId: userId, role: "OPERATOR" } } } : {}),
      },
    });
    restaurantId = created.id;
  }

  try {
    const result = await seedDemoData(restaurantId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "seed failed" },
      { status: 500 },
    );
  }
}
