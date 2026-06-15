import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  ensureDefaultCategories,
  categoryIdByName,
  categoryTapById,
  MISC_CATEGORY_NAME,
} from "@/lib/categorization/categories";
import { ensureDefaultRules, loadRules, categorize, type CategorizationContext } from "@/lib/categorization/rules";
import type { CandidateTxn } from "@/lib/import/parse-statement";

// Writes confirmed statement transactions. Deduped via a synthetic plaidTxnId
// (stmt-<restaurant>-<hash>) so re-importing the same statement is idempotent.
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
    return NextResponse.json({ error: "no restaurant / insufficient role" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { transactions?: CandidateTxn[] };
  const txns = body.transactions ?? [];
  if (txns.length === 0) {
    return NextResponse.json({ error: "no transactions to import" }, { status: 400 });
  }

  // Ensure this restaurant's default categories + rules exist, then resolve the
  // maps we need to assign categoryId (authoritative) and dual-write the legacy
  // bucket. Per-restaurant rules replace the old global vendor map.
  await ensureDefaultCategories(prisma, role.restaurantId);
  await ensureDefaultRules(prisma, role.restaurantId);
  const nameToId = await categoryIdByName(prisma, role.restaurantId);
  const catCtx: CategorizationContext = {
    rules: await loadRules(prisma, role.restaurantId),
    tapById: await categoryTapById(prisma, role.restaurantId),
    revenueId: nameToId.get("Sales Deposits") ?? null,
    miscId: nameToId.get(MISC_CATEGORY_NAME) ?? null,
  };

  const data = txns.map((t) => {
    // /api/import maps credits/deposits to negative amounts; categorize() treats
    // any inflow as REVENUE by sign and runs outflows through the vendor rules.
    const { categoryId, bucket, confidence } = categorize(catCtx, null, t.description, t.amount);
    const hash = createHash("sha1").update(`${t.date}|${t.amount}|${t.description}`).digest("hex").slice(0, 16);
    return {
      restaurantId: role.restaurantId,
      plaidTxnId: `stmt-${role.restaurantId}-${hash}`,
      date: new Date(t.date),
      amount: t.amount,
      merchantName: null,
      description: t.description,
      bucket,
      categoryId,
      isRecurring: false,
      confidence,
      isManualOverride: false,
    };
  });

  const result = await prisma.transaction.createMany({ data, skipDuplicates: true });
  return NextResponse.json({ imported: result.count, submitted: txns.length });
}
