// Suggested rules (Phase 3 / P2): when an operator has manually re-categorized
// several look-alike transactions the same way, offer to turn that into a Rule so
// future imports self-categorize. Pure detection over existing data — manual
// overrides are exactly the gaps the seeded rules didn't cover.
import type { PrismaClient } from "@prisma/client";
import { loadRules, applyRules } from "./rules";

export interface RuleSuggestion {
  key: string; // `${signature}::${categoryId}` — stable id for dismissals
  signature: string; // the keyword we'd match on
  categoryId: string;
  categoryName: string;
  count: number; // how many manual overrides support it
  sample: string; // one example description, for context
}

const MIN_SUPPORT = 2; // need at least this many matching manual edits to suggest
const MAX_SUGGESTIONS = 8;

// Words that make terrible keywords because they aren't vendor identifiers, so a
// rule built on them silently miscategorizes. Three families:
//  - generic banking/transaction words (CHECK, ACH, …),
//  - common English filler that leads many descriptions ("THE BUTCHER" → THE),
//  - corporate suffixes / locale tokens that aren't the distinctive part (LLC, USA).
// (The leading-boundary KEYWORD match in rules.ts already stops a kept token from
//  firing mid-word, e.g. ACE in "space"; this stops the bad token being picked at all.)
const STOPWORDS = new Set([
  // generic banking / transaction words
  "CHECK", "ACH", "POS", "DEBIT", "CREDIT", "CARD", "PAYMENT", "DEPOSIT", "WITHDRAWAL",
  "TRANSFER", "PURCHASE", "ONLINE", "BILL", "PMT", "AUTOPAY", "RECURRING", "MOBILE", "BANK",
  "PAYROLL", "WIRE", "EFT", "FEE", "FEES", "REF", "TXN", "TRANS", "INVOICE", "INV",
  // common English filler that often leads a description
  "THE", "AND", "FOR", "OVER", "EVER", "FROM", "WITH", "YOUR", "OUR", "ARE", "WAS",
  "THIS", "THAT", "NEW", "OLD", "NOT", "ALL", "ANY", "ONE", "TWO", "DAY", "DAILY",
  // corporate suffixes / locale tokens — not the distinctive part of a name
  "INC", "LLC", "LLP", "LTD", "CORP", "CO", "COMPANY", "GROUP", "USA", "US", "WWW", "COM",
]);

export function isWeakSignature(signature: string): boolean {
  const value = signature.trim().toUpperCase();
  return !value || STOPWORDS.has(value);
}

/**
 * Pick a meaningful keyword from a transaction: the first 3+ letter word that
 * isn't a generic banking/filler/locale token (see STOPWORDS). Returns null when
 * the description carries no distinctive vendor word (e.g. a payee-less check) —
 * the caller then treats it as not actionable as a vendor rule.
 */
export function signatureOf(merchant: string | null, description: string | null): string | null {
  const text = `${merchant ?? ""} ${description ?? ""}`.toUpperCase();
  const words = text.match(/[A-Z][A-Z&'-]{2,}/g) ?? [];
  for (const w of words) {
    if (!isWeakSignature(w)) return w;
  }
  return null;
}

/** Dismissed-suggestion keys, persisted in ModuleConfig.settings (no new table). */
export const SUGGESTIONS_MODULE = "ruleSuggestions";
export async function getDismissedKeys(prisma: PrismaClient, restaurantId: string): Promise<string[]> {
  const cfg = await prisma.moduleConfig.findUnique({
    where: { restaurantId_moduleKey: { restaurantId, moduleKey: SUGGESTIONS_MODULE } },
    select: { settings: true },
  });
  const s = cfg?.settings as { dismissed?: unknown } | null;
  return Array.isArray(s?.dismissed) ? (s!.dismissed as string[]) : [];
}

export async function computeRuleSuggestions(
  prisma: PrismaClient,
  restaurantId: string,
  dismissed: Set<string>,
): Promise<RuleSuggestion[]> {
  const txns = await prisma.transaction.findMany({
    where: { restaurantId, isManualOverride: true, categoryId: { not: null } },
    select: { merchantName: true, description: true, categoryId: true },
  });
  if (txns.length === 0) return [];

  const cats = await prisma.category.findMany({
    where: { restaurantId, archivedAt: null },
    select: { id: true, name: true },
  });
  const nameById = new Map(cats.map((c) => [c.id, c.name]));
  const rules = await loadRules(prisma, restaurantId);

  // Group manual overrides by (signature, category).
  interface Group { key: string; signature: string; categoryId: string; count: number; sample: string }
  const groups = new Map<string, Group>();
  for (const t of txns) {
    const signature = signatureOf(t.merchantName, t.description);
    if (!signature) continue;
    const categoryId = t.categoryId!;
    if (!nameById.has(categoryId)) continue; // category archived/removed
    const key = `${signature}::${categoryId}`;
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { key, signature, categoryId, count: 1, sample: t.description ?? t.merchantName ?? signature });
  }

  // One suggestion per signature — the category it's most often tagged as (so we
  // never offer two conflicting rules for the same keyword).
  const bestBySignature = new Map<string, Group>();
  for (const g of groups.values()) {
    const cur = bestBySignature.get(g.signature);
    if (!cur || g.count > cur.count) bestBySignature.set(g.signature, g);
  }

  const out: RuleSuggestion[] = [];
  for (const g of bestBySignature.values()) {
    if (g.count < MIN_SUPPORT) continue;
    if (dismissed.has(g.key)) continue;
    // Skip if an existing rule already auto-categorizes this keyword.
    if (applyRules(rules, null, g.signature)) continue;
    out.push({
      key: g.key,
      signature: g.signature,
      categoryId: g.categoryId,
      categoryName: nameById.get(g.categoryId)!,
      count: g.count,
      sample: g.sample,
    });
  }
  out.sort((a, b) => b.count - a.count);
  return out.slice(0, MAX_SUGGESTIONS);
}
