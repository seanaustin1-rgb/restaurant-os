import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { inngest } from "@/lib/inngest/client";

// Exchanges a Plaid public_token for an access token and stores the connection
// against the signed-in operator's restaurant.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    public_token?: string;
    institution?: string | null;
  };
  if (!body.public_token) {
    return NextResponse.json({ error: "public_token required" }, { status: 400 });
  }

  // The operator must already belong to a restaurant (via onboarding).
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: "OPERATOR" },
    select: { restaurantId: true },
  });
  if (!role) {
    return NextResponse.json({ error: "no restaurant for user; complete onboarding first" }, { status: 400 });
  }

  try {
    const exchange = await plaidClient.itemPublicTokenExchange({ public_token: body.public_token });

    const connection = await prisma.plaidConnection.create({
      data: {
        restaurantId: role.restaurantId,
        itemId: exchange.data.item_id,
        accessToken: encrypt(exchange.data.access_token),
        institution: body.institution ?? null,
        isActive: true,
      },
    });

    // Kick off an initial sync. If the Inngest dev server isn't running this is
    // a no-op for now — the daily cron will pick it up regardless.
    try {
      await inngest.send({
        name: "plaid/connection.sync.requested",
        data: { plaidConnectionId: connection.id, restaurantId: role.restaurantId },
      });
    } catch {
      /* non-fatal: scheduler will sync later */
    }

    return NextResponse.json({ plaidConnectionId: connection.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "exchange failed" },
      { status: 500 },
    );
  }
}
