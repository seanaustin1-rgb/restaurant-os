import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { commitBrokerageImport } from "@/lib/brokerage/import-commit";
import type { BrokerageImportPayload } from "@/lib/brokerage/normalized-import";

type Body = { payload?: BrokerageImportPayload };

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: ["OPERATOR", "MANAGER", "CONSULTANT"] } },
    select: { restaurantId: true },
  });
  if (!role) {
    return NextResponse.json({ error: "no business / insufficient role" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.payload) {
    return NextResponse.json({ error: "no brokerage import payload" }, { status: 400 });
  }

  const result = await commitBrokerageImport(prisma, {
    restaurantId: role.restaurantId,
    payload: body.payload,
  });

  return NextResponse.json({
    imported: result.summary.accepted,
    summary: result.summary,
    rejected: result.rejected,
  });
}
