import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GOOGLE_BUSINESS_PROFILE_PROVIDER } from "@/lib/integrations/google-business-profile/oauth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: "OPERATOR" },
    select: { restaurantId: true },
  });
  if (!role) {
    return NextResponse.json({ error: "Only the owner/operator can disconnect Google authorization." }, { status: 403 });
  }

  const connection = await prisma.integrationConnection.findFirst({
    where: {
      id,
      restaurantId: role.restaurantId,
      provider: GOOGLE_BUSINESS_PROFILE_PROVIDER,
    },
    select: { id: true },
  });
  if (!connection) {
    return NextResponse.json({ error: "connection not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.integrationConnection.delete({ where: { id: connection.id } }),
    prisma.dataSourceConfig.upsert({
      where: {
        restaurantId_category_providerName: {
          restaurantId: role.restaurantId,
          category: "aura",
          providerName: "Google Business Profile",
        },
      },
      update: {
        status: "PLANNED",
        notes: "Google Business Profile authorization was disconnected by the owner/operator.",
        updatedBy: userId,
      },
      create: {
        restaurantId: role.restaurantId,
        category: "aura",
        providerName: "Google Business Profile",
        status: "PLANNED",
        notes: "Google Business Profile authorization was disconnected by the owner/operator.",
        updatedBy: userId,
      },
    }),
  ]);

  return NextResponse.json({ removed: true });
}
