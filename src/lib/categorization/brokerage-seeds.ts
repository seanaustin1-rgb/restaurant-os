// Brokerage vendor rule seeds — the national/franchise vendors every real-estate
// brokerage has (platforms, MLS/boards, franchises, lead-gen, transaction tools).
// Local vendors (title companies, closers) surface as exceptions in week one and
// become tenant rules — that's the review flow working as designed, not a gap.
//
// Format is the engine's real `RuleSeed` (categoryName targets a BROKERAGE_CATEGORIES
// row; seedRules skips any seed whose category isn't seeded). Every pattern is a
// distinctive brand or a multi-word phrase — built to pass `keywordPatternProblem`
// (no generic single words, no short tokens); brokerage-seeds.test.ts enforces that
// AND that every categoryName exists in the brokerage taxonomy.
//
// Source: docs/fable-5/seed-packs-brokerage-rental.md, mapped to the actual
// taxonomy. Inflow/commission descriptors are ordered FIRST (lower priority number
// = higher precedence) so "dotloop payout" wins over the bare "dotloop" software
// rule when both would match.
import type { RuleSeed } from "./rules";

interface BrokerageSeedSpec {
  pattern: string;
  categoryName: string;
}

// Ordered most-specific / highest-precedence first.
const SPECS: BrokerageSeedSpec[] = [
  // ── Commission inflows (platform disbursements) ──────────────────────────
  { pattern: "dotloop payout", categoryName: "Commission Income" },
  { pattern: "skyslope", categoryName: "Commission Income" },
  { pattern: "earnest money", categoryName: "Escrow / Earnest Money (Held)" },

  // ── Agent splits / referrals ─────────────────────────────────────────────
  { pattern: "commission split", categoryName: "Agent Commission Split" },
  { pattern: "agent commission", categoryName: "Agent Commission Split" },
  { pattern: "referral fee", categoryName: "Agent Commission Split" },

  // ── MLS / board / association / licensing ────────────────────────────────
  { pattern: "bright mls", categoryName: "MLS & Board Dues" },
  { pattern: "mls dues", categoryName: "MLS & Board Dues" },
  { pattern: "supra ekey", categoryName: "MLS & Board Dues" },
  { pattern: "sentrilock", categoryName: "MLS & Board Dues" },
  { pattern: "national association of realtors", categoryName: "Association Dues" },
  { pattern: "realtors association", categoryName: "Association Dues" },
  { pattern: "real estate commission", categoryName: "Licensing & Compliance" },

  // ── Franchise ────────────────────────────────────────────────────────────
  { pattern: "keller williams", categoryName: "Franchise Fee" },
  { pattern: "remax llc", categoryName: "Franchise Fee" },
  { pattern: "coldwell banker", categoryName: "Franchise Fee" },
  { pattern: "exp realty", categoryName: "Franchise Fee" },
  { pattern: "berkshire hathaway homeservices", categoryName: "Franchise Fee" },

  // ── Lead gen ─────────────────────────────────────────────────────────────
  { pattern: "zillow group", categoryName: "Lead Generation" },
  { pattern: "realtor.com", categoryName: "Lead Generation" },
  { pattern: "opcity", categoryName: "Lead Generation" },
  { pattern: "homes.com", categoryName: "Lead Generation" },

  // ── Transaction tools / CRM / software ───────────────────────────────────
  { pattern: "follow up boss", categoryName: "Technology / Software" },
  { pattern: "kvcore", categoryName: "Technology / Software" },
  { pattern: "boomtown", categoryName: "Technology / Software" },
  { pattern: "docusign", categoryName: "Technology / Software" },
  { pattern: "dotloop", categoryName: "Technology / Software" }, // bare — payout handled above
  { pattern: "showingtime", categoryName: "Technology / Software" },
  { pattern: "transaction desk", categoryName: "Technology / Software" },

  // ── Insurance ────────────────────────────────────────────────────────────
  { pattern: "errors and omissions", categoryName: "E&O Insurance" },
  { pattern: "e&o insurance", categoryName: "E&O Insurance" },

  // ── Listing costs ────────────────────────────────────────────────────────
  { pattern: "real estate photography", categoryName: "Listing Costs" },
  { pattern: "matterport", categoryName: "Listing Costs" },
  { pattern: "home warranty", categoryName: "Listing Costs" },
  { pattern: "home staging", categoryName: "Listing Costs" },
];

// Priority band after any CHECK_MIN(0); ascending index preserves the specificity
// order above. Confidence mirrors an accepted operator rule (brand-name keyword).
export const BROKERAGE_RULE_SEEDS: RuleSeed[] = SPECS.map((s, i) => ({
  matchType: "KEYWORD" as const,
  pattern: s.pattern,
  categoryName: s.categoryName,
  priority: 10 + i,
  confidence: 0.9,
  scope: "default" as const,
}));
