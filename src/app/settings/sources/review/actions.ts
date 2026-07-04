"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  approveFinancialEvent,
  excludeFinancialEvent,
  bulkApproveAsCategory,
  bulkExcludeFinancialEvents,
} from "@/lib/financial-ledger/review";
import { keywordPatternProblem, signatureOf } from "@/lib/categorization/suggestions";
import { createRule } from "@/app/settings/rules/actions";

const REVIEW_PATH = "/settings/sources/review";
const SOURCES_PATH = "/settings/sources";
const ACCESS_ROLES = ["OPERATOR", "CONSULTANT", "MANAGER"] as const;

async function requireReviewRole() {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ACCESS_ROLES] } },
    select: { restaurantId: true },
  });
  if (!role) throw new Error("insufficient role");

  return { userId, restaurantId: role.restaurantId };
}

function revalidateReview() {
  revalidatePath(REVIEW_PATH);
  revalidatePath(SOURCES_PATH);
  revalidatePath("/dashboard");
}

/**
 * Try to save a vendor rule from a review re-type (Feature 2). Routes through the
 * SAME `keywordPatternProblem` guardrail as the manual rule form — no bypass — and
 * returns a human-readable note. Never throws: a bad/absent signature just means
 * "approved without a rule", so the approve itself is never rolled back.
 */
async function trySaveRuleFromReview(
  restaurantId: string,
  counterparty: string | null,
  description: string | null,
  categoryId: string,
): Promise<string> {
  const signature = signatureOf(counterparty, description);
  if (!signature) return "Approved — no distinctive vendor keyword to build a rule from.";

  const problem = keywordPatternProblem(signature);
  if (problem) return `Approved, but no rule saved: ${problem}.`;

  // Don't stack a duplicate rule if this keyword is already covered.
  const existing = await prisma.rule.findFirst({
    where: { restaurantId, matchType: "KEYWORD", pattern: signature },
    select: { id: true },
  });
  if (existing) return `Approved — a rule for "${signature}" already exists.`;

  try {
    await createRule({ pattern: signature, categoryId, matchType: "KEYWORD" });
    return `Approved and saved rule: "${signature}" → this category.`;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "rule could not be saved";
    return `Approved, but no rule saved: ${reason}.`;
  }
}

export async function approveFinancialEventAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) throw new Error("missing event id");
  const categoryId = String(formData.get("categoryId") ?? "").trim() || undefined;
  const saveRule = formData.get("saveRule") === "on";
  const { userId, restaurantId } = await requireReviewRole();

  // Fetch the vendor text up-front (tenant-scoped) so a rule-save can derive its
  // signature; also confirms the event belongs to this tenant before we mutate.
  const event = await prisma.normalizedFinancialEvent.findFirst({
    where: { id: eventId, restaurantId },
    select: { counterparty: true, description: true },
  });
  if (!event) throw new Error("financial event not found");

  await approveFinancialEvent(prisma, {
    restaurantId,
    normalizedFinancialEventId: eventId,
    approvedBy: userId,
    categoryId,
  });

  let notice = "Approved to ledger.";
  if (saveRule && categoryId) {
    notice = await trySaveRuleFromReview(restaurantId, event.counterparty, event.description, categoryId);
  }

  revalidateReview();
  redirect(`${REVIEW_PATH}?notice=${encodeURIComponent(notice)}`);
}

export async function excludeFinancialEventAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) throw new Error("missing event id");
  const { userId, restaurantId } = await requireReviewRole();

  await excludeFinancialEvent(prisma, {
    restaurantId,
    normalizedFinancialEventId: eventId,
    resolvedBy: userId,
  });

  revalidateReview();
}

/**
 * Bulk approve-all-as-category or exclude-all for a review group (Feature 3).
 * `eventIds` is a comma-joined list carried by the group form. Transactional +
 * tenant-scoped inside the shared review functions.
 */
export async function bulkResolveGroupAction(formData: FormData): Promise<void> {
  const action = String(formData.get("action") ?? "");
  const eventIds = String(formData.get("eventIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  if (eventIds.length === 0) throw new Error("no events in group");

  const { userId, restaurantId } = await requireReviewRole();

  let count = 0;
  if (action === "approve") {
    if (!categoryId) throw new Error("choose a category to approve the group as");
    count = await bulkApproveAsCategory(prisma, { restaurantId, eventIds, categoryId, approvedBy: userId });
  } else if (action === "exclude") {
    count = await bulkExcludeFinancialEvents(prisma, { restaurantId, eventIds, resolvedBy: userId });
  } else {
    throw new Error("unknown bulk action");
  }

  // Aggregate audit line (per-row who/when is already stamped on each event +
  // SyncException by the shared review functions).
  console.info(
    `[review-bulk] ${action} count=${count} restaurant=${restaurantId} actor=${userId} category=${categoryId || "-"}`,
  );

  revalidateReview();
  redirect(`${REVIEW_PATH}?notice=${encodeURIComponent(`${action === "approve" ? "Approved" : "Excluded"} ${count} item${count === 1 ? "" : "s"}.`)}`);
}
