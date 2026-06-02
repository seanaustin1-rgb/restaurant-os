import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runPlaidSync } from "@/lib/plaid/sync";

// DEV ONLY: runs the Plaid sync directly (no Inngest needed) so you can test
// the worker logic. POST { plaidConnectionId } to sync one, or omit to sync all active.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}) as { plaidConnectionId?: string });

  try {
    if (body.plaidConnectionId) {
      const result = await runPlaidSync(body.plaidConnectionId);
      return NextResponse.json({ plaidConnectionId: body.plaidConnectionId, result });
    }

    const connections = await prisma.plaidConnection.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const synced = [];
    for (const c of connections) {
      synced.push({ id: c.id, result: await runPlaidSync(c.id) });
    }
    return NextResponse.json({ count: synced.length, synced });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
