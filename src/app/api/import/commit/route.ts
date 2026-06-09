import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import type { TransactionBucket } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  ensureDefaultCategories,
  categoryIdByName,
  categoryTapById,
  MISC_CATEGORY_NAME,
} from "@/lib/categorization/categories";
import { ensureDefaultRules, loadRules, applyRules, TAP_BUCKET_TO_LEGACY } from "@/lib/categorization/rules";
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
  const tapById = await categoryTapById(prisma, role.restaurantId);
  const rules = await loadRules(prisma, role.restaurantId);
  const miscId = nameToId.get(MISC_CATEGORY_NAME) ?? null;
  const revenueId = nameToId.get("Sales Deposits") ?? null;

  const data = txns.map((t) => {
    // /api/import maps credits/deposits to negative amounts. Treat any inflow as
    // REVENUE (sales deposits) rather than running it through expense rules.
    let categoryId: string | null;
    let bucket: TransactionBucket;
    let confidence: number;
    if (t.amount < 0) {
      categoryId = revenueId;
      bucket = "REVENUE";
      confidence = 0.9;
    } else {
      const match = applyRules(rules, null, t.description);
      if (match) {
        categoryId = match.categoryId;
        const tap = tapById.get(match.categoryId);
        bucket = tap ? TAP_BUCKET_TO_LEGACY[tap] : "UNCATEGORIZED";
        confidence = match.confidence;
      } else {
        // No rule matched — give it the Misc category (rolls into OpEx) but keep
        // the legacy bucket UNCATEGORIZED so the cleanup view still surfaces it.
        categoryId = miscId;
        bucket = "UNCATEGORIZED";
        confidence = 0;
      }
    }
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
