// Vendor → TransactionBucket categorization for bank transactions (Plaid Tier 2).
// Patterns are matched case-insensitively against the merchant name + description.
// First match wins, so order more specific patterns before generic ones.

import type { TransactionBucket } from "@prisma/client";

export interface VendorPattern {
  // Matched (case-insensitively) against `${merchantName} ${description}`.
  pattern: RegExp;
  label: string;
  bucket: TransactionBucket;
  isRecurring: boolean;
  confidence: number; // 0..1
}

export interface CategorizationResult {
  bucket: TransactionBucket;
  isRecurring: boolean;
  confidence: number;
}

// NOTE: Order matters — first match wins. Operator-specific patterns (tuned to
// the Stone Grille / Copper Crust bank statements) sit alongside generic national
// vendors. Revenue/deposits are NOT matched here — the commit route buckets
// inflows (negative-amount credits) as REVENUE directly.
export const VENDOR_PATTERNS: VendorPattern[] = [
  // ── Payroll TAX → TAX_PAYROLL (MUST precede the generic Toast Payroll/LABOR
  //    match below; "TOAST PAYROLL/TAX COL" is tax remittance, excluded from TAPs) ──
  { pattern: /toast\s*payroll\s*\/\s*tax|payroll.*\btax\s*col/i, label: "Toast Payroll Tax", bucket: "TAX_PAYROLL", isRecurring: true, confidence: 0.95 },

  // ── Payroll → LABOR ──
  { pattern: /toast\s*payroll/i, label: "Toast Payroll", bucket: "LABOR", isRecurring: true, confidence: 0.95 },
  { pattern: /\badp\b/i, label: "ADP", bucket: "LABOR", isRecurring: true, confidence: 0.9 },

  // ── Food distributors / groceries → COGS_FOOD ──
  { pattern: /\bsysco\b/i, label: "Sysco", bucket: "COGS_FOOD", isRecurring: false, confidence: 0.97 },
  { pattern: /\bus\s*foods?\b/i, label: "US Foods", bucket: "COGS_FOOD", isRecurring: false, confidence: 0.96 },
  { pattern: /restaurant\s*depot/i, label: "Restaurant Depot", bucket: "COGS_FOOD", isRecurring: false, confidence: 0.96 },
  { pattern: /performance\s*md|performance\s*food/i, label: "Performance Foodservice", bucket: "COGS_FOOD", isRecurring: true, confidence: 0.93 },
  { pattern: /\bsams?\s*club\b|samsclub/i, label: "Sam's Club", bucket: "COGS_FOOD", isRecurring: false, confidence: 0.85 },
  { pattern: /\bbj'?s\s*wholesale\b/i, label: "BJ's Wholesale", bucket: "COGS_FOOD", isRecurring: false, confidence: 0.85 },
  { pattern: /pricerite/i, label: "PriceRite", bucket: "COGS_FOOD", isRecurring: false, confidence: 0.85 },
  { pattern: /sprouts/i, label: "Sprouts", bucket: "COGS_FOOD", isRecurring: false, confidence: 0.82 },
  { pattern: /\blidl\b/i, label: "Lidl", bucket: "COGS_FOOD", isRecurring: false, confidence: 0.8 },
  { pattern: /\bgiant\b(?!\s*fuel)/i, label: "Giant", bucket: "COGS_FOOD", isRecurring: false, confidence: 0.8 },

  // ── Liquor (PA state stores) → COGS_LIQUOR ──
  { pattern: /\bplcb\b|pa\s*liquor|pennsylvania\s*liquor/i, label: "PLCB", bucket: "COGS_LIQUOR", isRecurring: false, confidence: 0.95 },
  { pattern: /republic\s*national|\brndc\b/i, label: "Republic National", bucket: "COGS_LIQUOR", isRecurring: false, confidence: 0.95 },
  { pattern: /breakthru\s*beverage/i, label: "Breakthru Beverage", bucket: "COGS_LIQUOR", isRecurring: false, confidence: 0.95 },

  // ── Beer / non-alcoholic beverage distributors → COGS_BEVERAGE ──
  { pattern: /wilsbach/i, label: "Wilsbach Distributing", bucket: "COGS_BEVERAGE", isRecurring: true, confidence: 0.92 },
  { pattern: /ace\s*distributing/i, label: "Ace Distributing", bucket: "COGS_BEVERAGE", isRecurring: true, confidence: 0.9 },
  { pattern: /stockertown/i, label: "Stockertown Beverage", bucket: "COGS_BEVERAGE", isRecurring: true, confidence: 0.92 },
  { pattern: /ever\s*grain/i, label: "Ever Grain Brewing", bucket: "COGS_BEVERAGE", isRecurring: true, confidence: 0.9 },
  { pattern: /kirchner/i, label: "Kirchner Beverage", bucket: "COGS_BEVERAGE", isRecurring: true, confidence: 0.9 },
  { pattern: /abarta|coca-?cola/i, label: "Abarta Coca-Cola", bucket: "COGS_BEVERAGE", isRecurring: true, confidence: 0.9 },

  // ── Sales tax → TAX_SALES ──
  { pattern: /\bdavo\b/i, label: "Davo", bucket: "TAX_SALES", isRecurring: true, confidence: 0.95 },

  // ── Utilities → OPEX_UTILITIES ──
  { pattern: /\bppl\b|ppl\s*electric/i, label: "PPL Electric", bucket: "OPEX_UTILITIES", isRecurring: true, confidence: 0.93 },
  { pattern: /columbia\s*gas/i, label: "Columbia Gas", bucket: "OPEX_UTILITIES", isRecurring: true, confidence: 0.95 },
  { pattern: /york\s*water/i, label: "York Water", bucket: "OPEX_UTILITIES", isRecurring: true, confidence: 0.93 },
  { pattern: /\bcasella\b/i, label: "Casella Waste", bucket: "OPEX_UTILITIES", isRecurring: true, confidence: 0.9 },
  { pattern: /verizon/i, label: "Verizon", bucket: "OPEX_UTILITIES", isRecurring: true, confidence: 0.88 },

  // ── Insurance → OPEX_INSURANCE ──
  { pattern: /utica\s*mutual/i, label: "Utica Mutual", bucket: "OPEX_INSURANCE", isRecurring: true, confidence: 0.93 },

  // ── Supplies / software / services → OPEX_SUPPLIES ──
  { pattern: /\bcintas\b/i, label: "Cintas", bucket: "OPEX_SUPPLIES", isRecurring: true, confidence: 0.93 },
  { pattern: /\becolab\b/i, label: "Ecolab", bucket: "OPEX_SUPPLIES", isRecurring: true, confidence: 0.93 },
  { pattern: /webstaurant/i, label: "Webstaurant", bucket: "OPEX_SUPPLIES", isRecurring: false, confidence: 0.92 },
  { pattern: /\bgrainger\b/i, label: "Grainger", bucket: "OPEX_SUPPLIES", isRecurring: false, confidence: 0.9 },
  { pattern: /restaurant\s*store/i, label: "The Restaurant Store", bucket: "OPEX_SUPPLIES", isRecurring: false, confidence: 0.85 },
  { pattern: /marginedge/i, label: "MarginEdge", bucket: "OPEX_SUPPLIES", isRecurring: true, confidence: 0.9 },
  { pattern: /toast,?\s*inc|toast\s*\/\s*eom/i, label: "Toast (POS fees)", bucket: "OPEX_SUPPLIES", isRecurring: true, confidence: 0.85 },
  { pattern: /intuit|quickbooks/i, label: "Intuit QuickBooks", bucket: "OPEX_SUPPLIES", isRecurring: true, confidence: 0.9 },
  { pattern: /mailchimp/i, label: "Mailchimp", bucket: "OPEX_SUPPLIES", isRecurring: true, confidence: 0.88 },
  { pattern: /\bcanva\b/i, label: "Canva", bucket: "OPEX_SUPPLIES", isRecurring: true, confidence: 0.85 },
  { pattern: /\blowes?\b|lowe'?s/i, label: "Lowe's", bucket: "OPEX_SUPPLIES", isRecurring: false, confidence: 0.8 },
  { pattern: /\bvevor\b/i, label: "Vevor", bucket: "OPEX_SUPPLIES", isRecurring: false, confidence: 0.82 },
  { pattern: /ups\s*store/i, label: "UPS Store", bucket: "OPEX_SUPPLIES", isRecurring: false, confidence: 0.8 },
];

// A bank statement shows a check number but never its payee, so checks can't be
// categorized by vendor. Business rule (operator-configured): checks numbered at
// or above this value come from the payroll checkbook (the 10xxx series) and are
// staff paychecks → PAYROLL_CHECK (rolls into the Labor TAP). Checks below it
// (the 15xx series here) are AP/other and stay UNCATEGORIZED until tagged.
export const PAYROLL_CHECK_MIN = 10000;

/**
 * Categorize a transaction by matching its merchant/description against VENDOR_PATTERNS.
 * Returns UNCATEGORIZED with confidence 0 when nothing matches.
 */
export function categorizeTransaction(
  merchantName: string | null | undefined,
  description: string | null | undefined,
): CategorizationResult {
  const haystack = `${merchantName ?? ""} ${description ?? ""}`.trim();

  // Payroll paper checks: number >= PAYROLL_CHECK_MIN.
  const check = haystack.match(/\bcheck\s*#?\s*(\d+)/i);
  if (check && parseInt(check[1], 10) >= PAYROLL_CHECK_MIN) {
    return { bucket: "PAYROLL_CHECK", isRecurring: true, confidence: 0.7 };
  }

  for (const vp of VENDOR_PATTERNS) {
    if (vp.pattern.test(haystack)) {
      return {
        bucket: vp.bucket,
        isRecurring: vp.isRecurring,
        confidence: vp.confidence,
      };
    }
  }

  return { bucket: "UNCATEGORIZED", isRecurring: false, confidence: 0 };
}
