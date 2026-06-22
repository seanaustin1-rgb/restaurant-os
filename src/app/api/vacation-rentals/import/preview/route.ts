import { NextResponse } from "next/server";
import { VacationRentalSourceKind, type VacationRentalSourceKind as SourceKind } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  normalizeVacationRentalImport,
  type VacationRentalImportPayload,
} from "@/lib/vacation-rentals/normalized-import";

type Body = {
  sourceName?: string;
  sourceKind?: string;
  payload?: VacationRentalImportPayload;
};

const SOURCE_KINDS = new Set<string>(Object.values(VacationRentalSourceKind));

function sourceKind(value: string | undefined): SourceKind {
  return SOURCE_KINDS.has(value ?? "") ? (value as SourceKind) : "CSV";
}

function preview<T>(rows: T[]): T[] {
  return rows.slice(0, 5);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: ["OPERATOR", "MANAGER"] } },
    select: { restaurantId: true },
  });
  if (!role) {
    return NextResponse.json({ error: "no business / insufficient role" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const payload = body.payload;
  if (!payload) {
    return NextResponse.json({ error: "no rental import payload" }, { status: 400 });
  }

  const normalized = normalizeVacationRentalImport(
    {
      restaurantId: role.restaurantId,
      sourceName: body.sourceName?.trim() || "Rental import",
      sourceKind: sourceKind(body.sourceKind),
    },
    payload,
  );

  return NextResponse.json({
    summary: normalized.batch.summary,
    rejected: normalized.rejected,
    preview: {
      properties: preview(normalized.properties),
      bookings: preview(normalized.bookings),
      ownerStatements: preview(normalized.ownerStatements),
      expenses: preview(normalized.expenses),
      maintenanceIssues: preview(normalized.maintenanceIssues),
      reviews: preview(normalized.reviews),
    },
  });
}
