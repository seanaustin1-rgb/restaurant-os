// Per-restaurant categorization rules engine (see docs/specs/transaction-
// categorization-v2.md, P0 #4). Replaces the hardcoded global VENDOR_PATTERNS +
// PAYROLL_CHECK_MIN with operator-owned `Rule` rows. A rule matches a
// transaction's merchant/description (or check number) and assigns a Category,
// which determines the Profit First TAP. Pure matching is separated from DB I/O
// so it can be unit-tested and reused across the import + Plaid-sync paths.
import type { PrismaClient, RuleMatchType, TapBucket, TransactionBucket } from "@prisma/client";
import { VENDOR_PATTERNS, PAYROLL_CHECK_MIN } from "./vendor-map";
import { categoryIdByName, legacyBucketToCategoryName } from "./categories";

// ─────────────────────────────────────────────────────────────
// TAP → legacy bucket (transitional dual-write)
// ─────────────────────────────────────────────────────────────
// `categoryId` is the authoritative signal now; the legacy `Transaction.bucket`
// is kept in sync (coarsely) so the older Transactions view doesn't regress
// until that column is dropped. OPEX collapses to OPEX_SUPPLIES; EXCLUDED has no
// legacy equivalent → UNCATEGORIZED.
export const TAP_BUCKET_TO_LEGACY: Record<TapBucket, TransactionBucket> = {
  COGS_FOOD: "COGS_FOOD",
  COGS_LIQUOR: "COGS_LIQUOR",
  COGS_BEVERAGE: "COGS_BEVERAGE",
  LABOR: "LABOR",
  OWNER_PAY: "OWNER_PAY",
  OPEX: "OPEX_SUPPLIES",
  TAX_SALES: "TAX_SALES",
  TAX_PAYROLL: "TAX_PAYROLL",
  REVENUE: "REVENUE",
  EXCLUDED: "UNCATEGORIZED",
};

// ─────────────────────────────────────────────────────────────
// Seed definitions (data; resolved to a categoryId at seed time)
// ─────────────────────────────────────────────────────────────
export interface RuleSeed {
  matchType: RuleMatchType;
  pattern: string; // regex SOURCE (REGEX) | keyword (KEYWORD) | threshold (CHECK_MIN)
  categoryName: string; // target category — must exist for the restaurant
  priority: number; // lower wins; CHECK_MIN runs first
  confidence: number;
  scope: "default" | "operator";
}

// Customer Zero's payroll-checkbook rule (checks numbered >= threshold are staff
// paychecks → Labor). Operator-scoped + **default OFF for new tenants** (P0 #4).
// Priority 0 so it is evaluated before any vendor rule, matching today's order.
const PAYROLL_CHECK_SEED: RuleSeed = {
  matchType: "CHECK_MIN",
  pattern: String(PAYROLL_CHECK_MIN),
  categoryName: "Payroll — Paper Checks",
  priority: 0,
  confidence: 0.7,
  scope: "operator",
};

// Vendor rules are generated from the existing (well-tuned) VENDOR_PATTERNS as
// REGEX rules, preserving first-match order via ascending priority. Each targets
// the default category for its legacy bucket (reuses the backfill name map so we
// don't restate category names). `scope` decides who inherits it.
const VENDOR_SEEDS: RuleSeed[] = VENDOR_PATTERNS.map((vp, i) => ({
  matchType: "REGEX" as const,
  pattern: vp.pattern.source,
  categoryName: legacyBucketToCategoryName(vp.bucket),
  priority: 10 + i, // after CHECK_MIN(0); preserves array order
  confidence: vp.confidence,
  scope: vp.scope,
}));

export const ALL_RULE_SEEDS: RuleSeed[] = [PAYROLL_CHECK_SEED, ...VENDOR_SEEDS];
/** National vendors — seeded for every restaurant. */
export const DEFAULT_RULE_SEEDS = ALL_RULE_SEEDS.filter((r) => r.scope === "default");
/** Customer Zero's local vendors + checkbook rule — seeded only for existing tenants. */
export const OPERATOR_RULE_SEEDS = ALL_RULE_SEEDS.filter((r) => r.scope === "operator");

// ─────────────────────────────────────────────────────────────
// Pure matching
// ─────────────────────────────────────────────────────────────
export interface CompiledRule {
  id: string;
  matchType: RuleMatchType;
  categoryId: string;
  priority: number;
  confidence: number;
  regex: RegExp | null; // KEYWORD / REGEX
  threshold: number | null; // CHECK_MIN
  patternLen: number; // tie-breaker: longer/more-specific wins
}

export interface RuleInput {
  id: string;
  matchType: RuleMatchType;
  pattern: string;
  categoryId: string;
  priority: number;
  confidence: number;
}

const CHECK_NO_RE = /\bcheck\s*#?\s*(\d+)/i;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Compile one rule row for matching. Returns null if its pattern is invalid. */
export function compileRule(r: RuleInput): CompiledRule | null {
  const base = {
    id: r.id,
    matchType: r.matchType,
    categoryId: r.categoryId,
    priority: r.priority,
    confidence: r.confidence,
    patternLen: r.pattern.length,
  };
  try {
    if (r.matchType === "CHECK_MIN") {
      const threshold = parseInt(r.pattern, 10);
      if (Number.isNaN(threshold)) return null;
      return { ...base, regex: null, threshold };
    }
    const source = r.matchType === "KEYWORD" ? escapeRegex(r.pattern) : r.pattern;
    return { ...base, regex: new RegExp(source, "i"), threshold: null };
  } catch {
    // Bad operator-authored regex — skip it rather than break the whole import.
    return null;
  }
}

/** Sort compiled rules into evaluation order: priority asc, then longer pattern. */
export function sortRules(rules: CompiledRule[]): CompiledRule[] {
  return [...rules].sort(
    (a, b) => a.priority - b.priority || b.patternLen - a.patternLen || (a.id < b.id ? -1 : 1),
  );
}

export interface RuleMatch {
  categoryId: string;
  confidence: number;
  ruleId: string;
}

/**
 * First matching rule wins (rules must be pre-sorted via sortRules / loadRules).
 * Returns null when nothing matches (caller falls back to Misc).
 */
export function applyRules(
  rules: CompiledRule[],
  merchantName: string | null | undefined,
  description: string | null | undefined,
): RuleMatch | null {
  const haystack = `${merchantName ?? ""} ${description ?? ""}`.trim();
  if (!haystack) return null;
  const checkMatch = haystack.match(CHECK_NO_RE);
  const checkNo = checkMatch ? parseInt(checkMatch[1], 10) : null;

  for (const r of rules) {
    if (r.matchType === "CHECK_MIN") {
      if (r.threshold != null && checkNo != null && checkNo >= r.threshold) {
        return { categoryId: r.categoryId, confidence: r.confidence, ruleId: r.id };
      }
    } else if (r.regex && r.regex.test(haystack)) {
      return { categoryId: r.categoryId, confidence: r.confidence, ruleId: r.id };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// DB I/O
// ─────────────────────────────────────────────────────────────
/** Load + compile a restaurant's enabled rules, sorted into evaluation order. */
export async function loadRules(prisma: PrismaClient, restaurantId: string): Promise<CompiledRule[]> {
  const rows = await prisma.rule.findMany({
    where: { restaurantId, enabled: true },
    select: { id: true, matchType: true, pattern: true, categoryId: true, priority: true, confidence: true },
  });
  const compiled = rows.map(compileRule).filter((r): r is CompiledRule => r !== null);
  return sortRules(compiled);
}

/** Insert the given seeds as system rules (resolving categoryName -> id). */
export async function seedRules(
  prisma: PrismaClient,
  restaurantId: string,
  seeds: RuleSeed[],
): Promise<number> {
  const idByName = await categoryIdByName(prisma, restaurantId);
  const data = seeds
    .map((s) => {
      const categoryId = idByName.get(s.categoryName);
      if (!categoryId) return null; // category not seeded for this restaurant — skip
      return {
        restaurantId,
        categoryId,
        matchType: s.matchType,
        pattern: s.pattern,
        priority: s.priority,
        confidence: s.confidence,
        isSystem: true,
        enabled: true,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);
  if (data.length === 0) return 0;
  const res = await prisma.rule.createMany({ data });
  return res.count;
}

/**
 * Idempotently seed the DEFAULT (national) rules for a restaurant. No-op if the
 * restaurant already has any system rules (so it never duplicates, and never
 * clobbers operator-seeded local rules). Categories must already exist
 * (call ensureDefaultCategories first).
 */
export async function ensureDefaultRules(prisma: PrismaClient, restaurantId: string): Promise<number> {
  const existing = await prisma.rule.count({ where: { restaurantId, isSystem: true } });
  if (existing > 0) return 0;
  return seedRules(prisma, restaurantId, DEFAULT_RULE_SEEDS);
}
