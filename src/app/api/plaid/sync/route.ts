import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { runPlaidSync } from "@/lib/plaid/sync";

// Manual "Sync now": pulls fresh transactions for the signed-in user's
// restaurant *synchronously* (directly via Plaid), so it works whether or not
// the Inngest background worker is running. The daily Inngest cron handles
// unattended syncing; this endpoint is the user-initiated path.
export const maxDuration = 60;

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true },
  });
  if (!role) {
    return NextResponse.json({ error: "no restaurant" }, { status: 400 });
  }

  const connections = await prisma.plaidConnection.findMany({
    where: { restaurantId: role.restaurantId, isActive: true },
    select: { id: true },
  });

  if (connections.length === 0) {
    return NextResponse.json({ triggered: 0, added: 0, warning: "No active bank connections to sync." });
  }

  // Run each connection's sync in turn. One bad connection (e.g. an expired
  // login that needs re-auth) shouldn't block the others, so capture per-
  // connection errors instead of failing the whole request.
  // Hobby serverless functions cap at 60s. The budget is checked *between*
  // pages, and a single page (Plaid fetch + ~100-row write over the pooler) can
  // take ~15s, so keep the budget low enough that one more page after the check
  // still lands well under 60s. If a connection has more pages left we report
  // hasMore and the client calls back, resuming from the committed cursor.
  const TIME_BUDGET_MS = 30_000;

  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = false;
  const errors: string[] = [];

  for (const c of connections) {
    try {
      const result = await runPlaidSync(c.id, { timeBudgetMs: TIME_BUDGET_MS });
      if ("added" in result) {
        added += result.added;
        modified += result.modified;
        removed += result.removed;
      }
      if (result.hasMore) hasMore = true;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "sync failed");
    }
  }

  return NextResponse.json({
    triggered: connections.length,
    added,
    modified,
    removed,
    hasMore,
    ...(errors.length > 0 && { warning: errors.join("; ") }),
  });
}
