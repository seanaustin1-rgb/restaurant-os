import { NextResponse } from "next/server";
import { VacationRentalSourceKind, type VacationRentalSourceKind as SourceKind } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { commitVacationRentalImport } from "@/lib/vacation-rentals/import-commit";
import type { VacationRentalImportPayload } from "@/lib/vacation-rentals/normalized-import";

type Body = {
  restaurantId?: string;
  sourceName?: string;
  sourceKind?: string;
  fileName?: string;
  externalAccountId?: string;
  payload?: VacationRentalImportPayload;
};

const SOURCE_KINDS = new Set<string>(Object.values(VacationRentalSourceKind));

function sourceKind(value: string | undefined): SourceKind {
  return SOURCE_KINDS.has(value ?? "") ? (value as SourceKind) : "CSV";
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const roles = await prisma.userRestaurantRole.findMany({
    where: {
      clerkUserId: userId,
      role: { in: ["OPERATOR", "MANAGER", "CONSULTANT"] },
      ...(body.restaurantId ? { restaurantId: body.restaurantId } : {}),
      restaurant: { businessType: "VACATION_RENTAL" },
    },
    select: { restaurantId: true },
  });
  if (roles.length === 0) {
    return NextResponse.json({ error: "no vacation-rental business / insufficient role" }, { status: 400 });
  }
  if (!body.restaurantId && roles.length > 1) {
    return NextResponse.json({ error: "choose a vacation-rental business before importing data" }, { status: 400 });
  }

  if (!body.payload) {
    return NextResponse.json({ error: "no rental import payload" }, { status: 400 });
  }

  const result = await commitVacationRentalImport(prisma, {
    restaurantId: roles[0].restaurantId,
    importedBy: userId,
    sourceName: body.sourceName?.trim() || "Rental import",
    sourceKind: sourceKind(body.sourceKind),
    fileName: body.fileName?.trim() || null,
    externalAccountId: body.externalAccountId?.trim() || null,
    payload: body.payload,
  });

  return NextResponse.json({
    imported: result.summary.accepted,
    batchId: result.batchId,
    sourceId: result.sourceId,
    summary: result.summary,
    rejected: result.rejected,
  });
}
