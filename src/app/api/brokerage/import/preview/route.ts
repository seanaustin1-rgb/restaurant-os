import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { normalizeBrokerageImport, type BrokerageImportPayload } from "@/lib/brokerage/normalized-import";

type Body = { restaurantId?: string; payload?: BrokerageImportPayload };

function preview<T>(rows: T[]): T[] {
  return rows.slice(0, 5);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.payload) {
    return NextResponse.json({ error: "no brokerage import payload" }, { status: 400 });
  }

  const roles = await prisma.userRestaurantRole.findMany({
    where: {
      clerkUserId: userId,
      role: { in: ["OPERATOR", "MANAGER", "CONSULTANT"] },
      ...(body.restaurantId ? { restaurantId: body.restaurantId } : {}),
    },
    select: { restaurantId: true },
  });
  if (roles.length === 0) {
    return NextResponse.json({ error: "no business / insufficient role" }, { status: 400 });
  }
  if (!body.restaurantId && roles.length > 1) {
    return NextResponse.json({ error: "choose a business before importing brokerage data" }, { status: 400 });
  }

  const normalized = normalizeBrokerageImport({ restaurantId: roles[0].restaurantId }, body.payload);

  return NextResponse.json({
    summary: normalized.summary,
    rejected: normalized.rejected,
    preview: {
      agents: preview(normalized.agents),
      deals: preview(normalized.deals),
      leadSpend: preview(normalized.leadSpend),
    },
  });
}
