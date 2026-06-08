import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { categorizeTransaction } from "@/lib/categorization/vendor-map";
import {
  ensureDefaultCategories,
  categoryIdByName,
  legacyBucketToCategoryName,
} from "@/lib/categorization/categories";
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

  // Ensure this restaurant has the default categories, then resolve names -> ids
  // so we can dual-write the new categoryId alongside the legacy bucket.
  await ensureDefaultCategories(prisma, role.restaurantId);
  const catIdByName = await categoryIdByName(prisma, role.restaurantId);

  const data = txns.map((t) => {
    // /api/import maps credits/deposits to negative amounts. Treat any inflow as
    // REVENUE (sales deposits) rather than running it through expense vendor rules.
    const cat =
      t.amount < 0
        ? { bucket: "REVENUE" as const, isRecurring: false, confidence: 0.9 }
        : categorizeTransaction(null, t.description);
    const hash = createHash("sha1").update(`${t.date}|${t.amount}|${t.description}`).digest("hex").slice(0, 16);
    return {
      restaurantId: role.restaurantId,
      plaidTxnId: `stmt-${role.restaurantId}-${hash}`,
      date: new Date(t.date),
      amount: t.amount,
      merchantName: null,
      description: t.description,
      bucket: cat.bucket,
      categoryId: catIdByName.get(legacyBucketToCategoryName(cat.bucket)) ?? null,
      isRecurring: cat.isRecurring,
      confidence: cat.confidence,
      isManualOverride: false,
    };
  });

  const result = await prisma.transaction.createMany({ data, skipDuplicates: true });
  return NextResponse.json({ imported: result.count, submitted: txns.length });
}
