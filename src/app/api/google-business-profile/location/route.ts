import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  GOOGLE_BUSINESS_PROFILE_CATEGORY,
  GOOGLE_BUSINESS_PROFILE_PROVIDER,
  type GoogleBusinessProfileLocation,
} from "@/lib/integrations/google-business-profile/oauth";

function appUrl(path: string): URL {
  return new URL(path, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
}

function locationsFromMetadata(metadata: unknown): GoogleBusinessProfileLocation[] {
  if (!metadata || typeof metadata !== "object" || !("locations" in metadata)) return [];
  const locations = (metadata as { locations?: unknown }).locations;
  if (!Array.isArray(locations)) return [];
  return locations.filter((location): location is GoogleBusinessProfileLocation => {
    if (!location || typeof location !== "object") return false;
    const value = location as Partial<GoogleBusinessProfileLocation>;
    return typeof value.accountId === "string" && typeof value.locationId === "string" && typeof value.title === "string";
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(appUrl("/sign-in"));

  const form = await req.formData();
  const connectionId = String(form.get("connectionId") ?? "");
  const locationId = String(form.get("locationId") ?? "");
  if (!connectionId || !locationId) {
    return NextResponse.redirect(appUrl("/settings/sources?google=error&reason=missing_location"));
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection || connection.provider !== GOOGLE_BUSINESS_PROFILE_PROVIDER) {
    return NextResponse.redirect(appUrl("/settings/sources?google=error&reason=connection_not_found"));
  }

  const role = await prisma.userRestaurantRole.findFirst({
    where: {
      clerkUserId: userId,
      restaurantId: connection.restaurantId,
      role: { in: ["OPERATOR", "CONSULTANT", "MANAGER"] },
    },
    select: { restaurantId: true },
  });
  if (!role) return NextResponse.redirect(appUrl("/dashboard"));

  const locations = locationsFromMetadata(connection.metadata);
  const location = locations.find((item) => item.locationId === locationId);
  if (!location) {
    return NextResponse.redirect(appUrl("/settings/sources?google=error&reason=location_not_found"));
  }

  const notes = `Authorized Google Business Profile: ${location.title}${location.address ? ` (${location.address})` : ""}`;

  const existing = await prisma.integrationConnection.findFirst({
    where: {
      restaurantId: role.restaurantId,
      provider: GOOGLE_BUSINESS_PROFILE_PROVIDER,
      externalLocationId: location.locationId,
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    if (existing && existing.id !== connection.id) {
      await tx.integrationConnection.update({
        where: { id: existing.id },
        data: {
          category: GOOGLE_BUSINESS_PROFILE_CATEGORY,
          externalAccountId: location.accountId,
          displayName: location.title,
          accessToken: connection.accessToken,
          refreshToken: connection.refreshToken,
          expiresAt: connection.expiresAt,
          scopes: connection.scopes,
          metadata: connection.metadata == null ? Prisma.JsonNull : (connection.metadata as unknown as Prisma.InputJsonValue),
          isActive: true,
        },
      });
      await tx.integrationConnection.delete({ where: { id: connection.id } });
    } else {
      await tx.integrationConnection.update({
        where: { id: connection.id },
        data: {
          category: GOOGLE_BUSINESS_PROFILE_CATEGORY,
          externalAccountId: location.accountId,
          externalLocationId: location.locationId,
          displayName: location.title,
          isActive: true,
        },
      });
    }

    await tx.dataSourceConfig.upsert({
      where: {
        restaurantId_category_providerName: {
          restaurantId: role.restaurantId,
          category: "aura",
          providerName: "Google Business Profile",
        },
      },
      update: {
        status: "CONNECTED",
        notes,
        updatedBy: userId,
      },
      create: {
        restaurantId: role.restaurantId,
        category: "aura",
        providerName: "Google Business Profile",
        status: "CONNECTED",
        notes,
        updatedBy: userId,
      },
    });
  });

  return NextResponse.redirect(appUrl("/settings/sources?google=connected"));
}
