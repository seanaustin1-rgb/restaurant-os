import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { BusinessType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sourceMapFor, type SourceCategory } from "@/lib/source-map";
import {
  buildSourceSetupNote,
  isSourceProfileId,
  sourceProfile,
  sourceSetupChecklist,
} from "@/lib/source-profiles";

type Body = {
  restaurantId?: string;
  profileId?: unknown;
  category?: string;
  providerName?: string;
};

const ACCESS_ROLES = ["OPERATOR", "MANAGER", "CONSULTANT"] as const;

function optionForProfile(input: {
  businessType: BusinessType;
  profileId: string;
  category?: string;
  providerName?: string;
}): { category: SourceCategory; providerName: string } | null {
  const sourceMap = sourceMapFor(input.businessType);
  for (const group of sourceMap.groups) {
    for (const option of group.options) {
      if (option.profileId !== input.profileId) continue;
      if (input.category && group.category !== input.category) return null;
      if (input.providerName && option.name !== input.providerName) return null;
      return { category: group.category, providerName: option.name };
    }
  }
  return null;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!isSourceProfileId(body.profileId)) {
    return NextResponse.json({ error: "unknown source profile" }, { status: 400 });
  }

  const roles = await prisma.userRestaurantRole.findMany({
    where: {
      clerkUserId: userId,
      role: { in: [...ACCESS_ROLES] },
      ...(body.restaurantId ? { restaurantId: body.restaurantId } : {}),
    },
    select: { restaurantId: true, restaurant: { select: { businessType: true } } },
  });

  if (roles.length === 0) return NextResponse.json({ error: "no accessible business" }, { status: 403 });
  if (!body.restaurantId && roles.length > 1) {
    return NextResponse.json({ error: "choose a business before requesting API setup" }, { status: 400 });
  }

  const role = roles[0];
  const profile = sourceProfile(body.profileId);
  if (!profile) return NextResponse.json({ error: "unknown source profile" }, { status: 400 });

  const option = optionForProfile({
    businessType: role.restaurant.businessType,
    profileId: body.profileId,
    category: body.category,
    providerName: body.providerName,
  });
  if (!option) {
    return NextResponse.json({ error: "source profile is not available for this business template" }, { status: 400 });
  }

  const notes = buildSourceSetupNote(profile);
  const config = await prisma.dataSourceConfig.upsert({
    where: {
      restaurantId_category_providerName: {
        restaurantId: role.restaurantId,
        category: option.category,
        providerName: option.providerName,
      },
    },
    update: {
      status: "PLANNED",
      notes,
      updatedBy: userId,
    },
    create: {
      restaurantId: role.restaurantId,
      category: option.category,
      providerName: option.providerName,
      status: "PLANNED",
      notes,
      updatedBy: userId,
    },
    select: { category: true, providerName: true, status: true, notes: true },
  });

  return NextResponse.json({
    profile: {
      id: profile.id,
      label: profile.label,
      connectionLabel: profile.connectionLabel,
      csvFallback: profile.csvFallback,
      credentialIntake: profile.credentialIntake,
    },
    checklist: sourceSetupChecklist(profile),
    config,
  });
}
