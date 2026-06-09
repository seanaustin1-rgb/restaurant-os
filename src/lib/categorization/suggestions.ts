// Suggested rules from repeated manual overrides (Phase 3 / P2 — see
// docs/specs/transaction-categorization-v2.md "Future Considerations"):
//   "you've tagged 3 VEVOR charges as Maintenance — make it a rule?"
//
// When an operator manually recategorizes the same vendor several times, the
// system should offer to turn that into a per-restaurant keyword rule so future
// imports self-categorize. This module derives a distinctive vendor keyword from
// a transaction, groups the operator's manual overrides by that keyword, and
// surfaces the ones a rule doesn't already cover. Pure logic is separated from DB
// I/O so it can be unit-tested and previewed from a script.
import type { PrismaClient } from "@prisma/client";
import { loadRules, applyRules, type CompiledRule } from "./rules";

// Generic banking/payment noise — words that say nothing about *who* was paid, so
// they make terrible keyword rules (every check/ACH/POS line contains them).
const STOPWORDS = new Set([
  "CHECK", "CHK", "PAYMENT", "PYMT", "DEPOSIT", "DEP", "WITHDRAWAL", "TRANSFER",
  "XFER", "ACH", "POS", "DEBIT", "CREDIT", "PURCHASE", "CARD", "VISA",
  "MASTERCARD", "AMEX", "ELECTRONIC", "ONLINE", "MOBILE", "RECURRING", "BILL",
  "BILLPAY", "PAY", "AUTOPAY", "FEE", "FROM", "THE", "AND", "FOR", "INC", "LLC",
  "CO", "CORP", "WWW", "COM", "HTTP", "HTTPS", "REF", "INVOICE", "INV", "ACCT",
  "ACCOUNT", "TRANSACTION",
]);

/**
 * Derive a stable, distinctive vendor keyword from a transaction. Prefers the
 * merchant name (cleaner), else the description. Strips store/ref numbers and
 * generic payment noise; returns the first ~2 meaningful words (specific enough
 * to separate "AMAZON WEB" from "AMAZON MKTPLACE", general enough to match every
 * import from that vendor). Returns null when nothing distinctive remains.
 */
export function extractVendorToken(
  merchantName: string | null | undefined,
  description: string | null | undefined,
): string | null {
  const raw = (merchantName ?? "").trim() || (description ?? "").trim();
  if (!raw) return null;
  const words = raw
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    // Keep words with at least one letter (drops pure numbers / store codes),
    // of reasonable length, that aren't generic payment noise.
    .filter((w) => /[A-Z]/.test(w) && w.length >= 3 && !STOPWORDS.has(w));
  if (words.length === 0) return null;
  return words.slice(0, 2).join(" ");
}

export interface SuggestionTxn {
  merchantName: string | null;
  description: string | null;
  categoryId: string;
}

export interface RuleSuggestion {
  /** Keyword to seed as a KEYWORD rule. */
  pattern: string;
  /** Category the operator assigned most often for this keyword. */
  categoryId: string;
  /** How many manual overrides back this suggestion. */
  count: number;
  /** Up to 3 example descriptions, for the operator to recognize the vendor. */
  samples: string[];
}

export interface BuildSuggestionsOptions {
  /** Min manual overrides on the dominant category before we suggest a rule. */
  minCount?: number;
  /** Dominant category must be at least this share of the keyword's overrides. */
  minShare?: number;
  /** Cap the number of suggestions returned (largest first). */
  limit?: number;
}

interface Bucket {
  total: number;
  byCategory: Map<string, number>;
  samples: string[];
}

/**
 * Group manual-override transactions by derived vendor keyword and emit a rule
 * suggestion per keyword whose overrides consistently point at one category.
 * Skips keywords an existing enabled rule already maps to that same category
 * (no point suggesting a rule the engine already applies); a keyword the rules
 * currently send to the *wrong* category is still suggested, because an
 * operator-priority keyword rule will correctly override the built-in vendor rule.
 */
export function buildSuggestions(
  txns: SuggestionTxn[],
  existingRules: CompiledRule[],
  options: BuildSuggestionsOptions = {},
): RuleSuggestion[] {
  const minCount = options.minCount ?? 3;
  const minShare = options.minShare ?? 0.6;
  const limit = options.limit ?? 8;

  const buckets = new Map<string, Bucket>();
  for (const t of txns) {
    const token = extractVendorToken(t.merchantName, t.description);
    if (!token) continue;
    let b = buckets.get(token);
    if (!b) {
      b = { total: 0, byCategory: new Map(), samples: [] };
      buckets.set(token, b);
    }
    b.total += 1;
    b.byCategory.set(t.categoryId, (b.byCategory.get(t.categoryId) ?? 0) + 1);
    const sample = (t.merchantName ?? t.description ?? "").trim();
    if (sample && b.samples.length < 3 && !b.samples.includes(sample)) {
      b.samples.push(sample);
    }
  }

  const suggestions: RuleSuggestion[] = [];
  for (const [token, b] of buckets) {
    // Dominant category for this keyword.
    let bestCat = "";
    let bestCount = 0;
    for (const [catId, c] of b.byCategory) {
      if (c > bestCount) {
        bestCount = c;
        bestCat = catId;
      }
    }
    if (bestCount < minCount || bestCount / b.total < minShare) continue;

    // Already covered correctly by an existing rule? Then there's nothing to add.
    const existing = applyRules(existingRules, null, token);
    if (existing && existing.categoryId === bestCat) continue;

    suggestions.push({ pattern: token, categoryId: bestCat, count: bestCount, samples: b.samples });
  }

  suggestions.sort((a, b) => b.count - a.count || (a.pattern < b.pattern ? -1 : 1));
  return suggestions.slice(0, limit);
}

export interface RuleSuggestionWithName extends RuleSuggestion {
  categoryName: string;
}

/**
 * Load a restaurant's manual overrides, compare against its live rules, and
 * return rule suggestions with category names attached (archived/missing target
 * categories are dropped — a suggestion must point at a category the operator can
 * still pick). DB I/O wrapper around the pure {@link buildSuggestions}.
 */
export async function getRuleSuggestionsForRestaurant(
  prisma: PrismaClient,
  restaurantId: string,
  options: BuildSuggestionsOptions = {},
): Promise<RuleSuggestionWithName[]> {
  const [txns, rules] = await Promise.all([
    prisma.transaction.findMany({
      where: { restaurantId, isManualOverride: true, categoryId: { not: null } },
      select: { merchantName: true, description: true, categoryId: true },
    }),
    loadRules(prisma, restaurantId),
  ]);

  const suggestions = buildSuggestions(
    txns.map((t) => ({
      merchantName: t.merchantName,
      description: t.description,
      categoryId: t.categoryId as string,
    })),
    rules,
    options,
  );
  if (suggestions.length === 0) return [];

  const ids = [...new Set(suggestions.map((s) => s.categoryId))];
  const cats = await prisma.category.findMany({
    where: { id: { in: ids }, archivedAt: null },
    select: { id: true, name: true },
  });
  const nameById = new Map(cats.map((c) => [c.id, c.name]));

  return suggestions
    .filter((s) => nameById.has(s.categoryId))
    .map((s) => ({ ...s, categoryName: nameById.get(s.categoryId) as string }));
}
