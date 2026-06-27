"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { RuleMatchType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADJUSTMENT_ROLES } from "@/lib/access/roles";
import { loadRules, applyRules } from "@/lib/categorization/rules";
import { getDismissedKeys, SUGGESTIONS_MODULE } from "@/lib/categorization/suggestions";

const PATH = "/settings/rules";

// Operator-created rules win over the seeded vendor rules (priority 10+) but run
// after the payroll CHECK_MIN (priority 0) — so naming a vendor "just works".
const OPERATOR_RULE_PRIORITY = 5;

const MATCH_TYPES: RuleMatchType[] = ["KEYWORD", "REGEX", "CHECK_MIN"];

async function requireRestaurant(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ADJUSTMENT_ROLES] } },
    select: { restaurantId: true },
  });
  if (!role) throw new Error("forbidden");
  return role.restaurantId;
}

// Confirm a rule belongs to a restaurant the user may edit; returns the rule.
async function requireOwnedRule(ruleId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const rule = await prisma.rule.findUnique({
    where: { id: ruleId },
    select: { id: true, restaurantId: true, isSystem: true, matchType: true },
  });
  if (!rule) throw new Error("rule not found");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, restaurantId: rule.restaurantId, role: { in: [...ADJUSTMENT_ROLES] } },
    select: { id: true },
  });
  if (!role) throw new Error("forbidden");
  return rule;
}

// A category must exist and belong to the same restaurant before a rule can target it.
async function assertCategoryInRestaurant(categoryId: string, restaurantId: string) {
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, restaurantId },
    select: { id: true },
  });
  if (!cat) throw new Error("category not found for this restaurant");
}

// Validate a pattern for its match type (so a bad rule can't silently break import).
function validatePattern(matchType: RuleMatchType, pattern: string): string {
  const trimmed = pattern.trim();
  if (!trimmed) throw new Error("pattern required");
  if (matchType === "CHECK_MIN") {
    if (!/^\d+$/.test(trimmed)) throw new Error("check threshold must be a whole number");
  } else if (matchType === "REGEX") {
    try {
      new RegExp(trimmed, "i");
    } catch {
      throw new Error("invalid regular expression");
    }
  }
  return trimmed;
}

export interface NewRule {
  id: string;
  matchType: RuleMatchType;
  pattern: string;
  categoryId: string;
  priority: number;
  enabled: boolean;
  isSystem: boolean;
}

export async function createRule(input: {
  pattern: string;
  categoryId: string;
  matchType?: RuleMatchType;
}): Promise<NewRule> {
  const restaurantId = await requireRestaurant();
  const matchType = input.matchType && MATCH_TYPES.includes(input.matchType) ? input.matchType : "KEYWORD";
  const pattern = validatePattern(matchType, input.pattern);
  await assertCategoryInRestaurant(input.categoryId, restaurantId);

  const created = await prisma.rule.create({
    data: {
      restaurantId,
      categoryId: input.categoryId,
      matchType,
      pattern,
      priority: OPERATOR_RULE_PRIORITY,
      confidence: 0.9,
      isSystem: false,
      enabled: true,
    },
    select: { id: true, matchType: true, pattern: true, categoryId: true, priority: true, enabled: true, isSystem: true },
  });
  revalidatePath(PATH);
  return created;
}

export async function updateRule(
  ruleId: string,
  patch: { pattern?: string; categoryId?: string; priority?: number; enabled?: boolean },
): Promise<void> {
  const rule = await requireOwnedRule(ruleId);
  const data: { pattern?: string; categoryId?: string; priority?: number; enabled?: boolean } = {};

  if (patch.pattern !== undefined) {
    // The pattern of a seeded system rule (regex / check threshold) is locked —
    // operators can disable or remap it, but editing the raw pattern is advanced.
    if (rule.isSystem) throw new Error("can't edit a system rule's pattern — disable it and add your own");
    data.pattern = validatePattern(rule.matchType, patch.pattern);
  }
  if (patch.categoryId !== undefined) {
    await assertCategoryInRestaurant(patch.categoryId, rule.restaurantId);
    data.categoryId = patch.categoryId;
  }
  if (patch.priority !== undefined) {
    if (!Number.isInteger(patch.priority) || patch.priority < 0) throw new Error("priority must be a non-negative integer");
    data.priority = patch.priority;
  }
  if (patch.enabled !== undefined) data.enabled = patch.enabled;

  if (Object.keys(data).length === 0) return;
  await prisma.rule.update({ where: { id: ruleId }, data });
  revalidatePath(PATH);
}

/**
 * Persist an explicit precedence order from drag-to-reorder. `orderedIds` is the
 * rows the operator just rearranged, top-first (= runs-first). We permute
 * priorities **within this set only**, so reordering the visible (operator) rules
 * never disturbs hidden/built-in rules:
 *   - if the set's current priorities are all distinct, we reuse those exact
 *     values (a pure permutation — zero impact on any other rule's band), or
 *   - if they collide (e.g. every operator rule still defaults to 5), we hand out
 *     a contiguous run from the set's minimum so the order is total and tie-free.
 * Returns the new {id, priority} map so the client can update without a refetch.
 */
export async function reorderRules(orderedIds: string[]): Promise<{ id: string; priority: number }[]> {
  const restaurantId = await requireRestaurant();
  if (orderedIds.length === 0) return [];
  // Every id must belong to this restaurant (and the set must be exactly these).
  const rules = await prisma.rule.findMany({
    where: { id: { in: orderedIds }, restaurantId },
    select: { id: true, priority: true },
  });
  if (rules.length !== orderedIds.length) throw new Error("some rules not found for this restaurant");

  const current = rules.map((r) => r.priority);
  const allDistinct = new Set(current).size === current.length;
  const min = Math.min(...current);
  const slots = allDistinct
    ? [...current].sort((a, b) => a - b) // reuse the same values, just reassigned in the new order
    : orderedIds.map((_, i) => min + i); // contiguous from the set's min — unique + ordered

  const mapping = orderedIds.map((id, i) => ({ id, priority: slots[i] }));
  // Batched array transaction — never interactive — for the Supabase pooler.
  await prisma.$transaction(mapping.map((m) => prisma.rule.update({ where: { id: m.id }, data: { priority: m.priority } })));
  revalidatePath(PATH);
  return mapping;
}

export async function deleteRule(ruleId: string): Promise<void> {
  const rule = await requireOwnedRule(ruleId);
  // System (seeded) rules can be disabled but not deleted, so the seed set stays
  // reconstructible. Operator-created rules can be removed outright.
  if (rule.isSystem) throw new Error("system rules can be disabled but not deleted");
  await prisma.rule.delete({ where: { id: ruleId } });
  revalidatePath(PATH);
}

export interface PreviewResult {
  categoryName: string | null; // null = no rule matched (would fall back to Misc)
  ruleId: string | null;
  confidence: number | null;
}

// ── Suggested rules ──────────────────────────────────────────
// Accept a suggestion → create the keyword rule (reuses createRule's validation
// + category-ownership check). Once it exists, the suggestion engine stops
// offering it (an existing rule now covers that keyword).
export async function acceptRuleSuggestion(signature: string, categoryId: string): Promise<void> {
  await createRule({ pattern: signature, categoryId, matchType: "KEYWORD" });
}

// Dismiss a suggestion → remember it (in ModuleConfig settings, no extra table)
// so it isn't offered again even if the operator keeps hand-tagging it.
export async function dismissRuleSuggestion(key: string): Promise<void> {
  const restaurantId = await requireRestaurant();
  const dismissed = await getDismissedKeys(prisma, restaurantId);
  if (!dismissed.includes(key)) dismissed.push(key);
  await prisma.moduleConfig.upsert({
    where: { restaurantId_moduleKey: { restaurantId, moduleKey: SUGGESTIONS_MODULE } },
    update: { settings: { dismissed } },
    create: { restaurantId, moduleKey: SUGGESTIONS_MODULE, settings: { dismissed } },
  });
  revalidatePath(PATH);
}

// Live "what would this categorize as?" tester — runs the real engine server-side.
export async function previewCategorization(sample: string): Promise<PreviewResult> {
  const restaurantId = await requireRestaurant();
  const text = sample.trim();
  if (!text) return { categoryName: null, ruleId: null, confidence: null };
  const rules = await loadRules(prisma, restaurantId);
  const match = applyRules(rules, null, text);
  if (!match) return { categoryName: null, ruleId: null, confidence: null };
  const cat = await prisma.category.findUnique({ where: { id: match.categoryId }, select: { name: true } });
  return { categoryName: cat?.name ?? null, ruleId: match.ruleId, confidence: match.confidence };
}
