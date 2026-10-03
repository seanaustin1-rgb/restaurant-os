import type { FinancialEventType, LedgerAccount, TapBucket } from "@prisma/client";

// Shared vocabulary for comparing and porting the legacy Transaction/Category
// spine to the clean financial ledger. Keep this file pure and DB-free.
export type CanonicalBucket =
  | "REVENUE"
  | "COGS"
  | "LABOR"
  | "OPEX"
  | "TAX"
  | "OWNER_PAY"
  | "DEBT_SERVICE"
  | "OTHER";

export const CANONICAL_BUCKETS: readonly CanonicalBucket[] = [
  "REVENUE",
  "COGS",
  "LABOR",
  "OPEX",
  "TAX",
  "OWNER_PAY",
  "DEBT_SERVICE",
  "OTHER",
] as const;

export const TAP_BUCKET_TO_CANONICAL = {
  REVENUE: "REVENUE",
  COGS_FOOD: "COGS",
  COGS_LIQUOR: "COGS",
  COGS_BEVERAGE: "COGS",
  LABOR: "LABOR",
  OPEX: "OPEX",
  TAX_SALES: "TAX",
  TAX_PAYROLL: "TAX",
  OWNER_PAY: "OWNER_PAY",
  PROFIT: "DEBT_SERVICE",
  EXCLUDED: "OTHER",
} satisfies Record<TapBucket, CanonicalBucket>;

export const TAP_BUCKET_TO_LEDGER_ACCOUNT = {
  REVENUE: "REVENUE",
  COGS_FOOD: "COGS",
  COGS_LIQUOR: "COGS",
  COGS_BEVERAGE: "COGS",
  LABOR: "LABOR",
  OPEX: "OPEX",
  TAX_SALES: "TAX_VAULT",
  TAX_PAYROLL: "TAX_VAULT",
  OWNER_PAY: "OWNER_PAY",
  PROFIT: "DEBT_SERVICE",
  EXCLUDED: "SUSPENSE",
} satisfies Record<TapBucket, LedgerAccount>;

export const TAP_BUCKET_TO_FINANCIAL_EVENT_TYPE = {
  REVENUE: "REVENUE",
  COGS_FOOD: "COGS",
  COGS_LIQUOR: "COGS",
  COGS_BEVERAGE: "COGS",
  LABOR: "LABOR",
  OPEX: "OPEX",
  TAX_SALES: "TAX_LIABILITY",
  TAX_PAYROLL: "TAX_LIABILITY",
  OWNER_PAY: "OWNER_PAY",
  PROFIT: "DEBT_SERVICE",
  EXCLUDED: "EXCLUDED",
} satisfies Record<TapBucket, FinancialEventType>;

export const LEDGER_ACCOUNT_TO_CANONICAL = {
  REVENUE: "REVENUE",
  REAL_REVENUE: "REVENUE",
  COGS: "COGS",
  LABOR: "LABOR",
  OPEX: "OPEX",
  FIXED_OPEX: "OPEX",
  TAX_VAULT: "TAX",
  OWNER_PAY: "OWNER_PAY",
  DEBT_SERVICE: "DEBT_SERVICE",
  PROFIT: "DEBT_SERVICE",
  PASS_THROUGH_PAYABLE: "OTHER",
  AGENT_PAYABLE: "OTHER",
  INTERNAL_TRANSFER: "OTHER",
  SUSPENSE: "OTHER",
} satisfies Record<Exclude<LedgerAccount, "OPERATING_CASH">, CanonicalBucket>;

export const LEDGER_SPEND_ACCOUNTS: readonly LedgerAccount[] = [
  "COGS",
  "LABOR",
  "OPEX",
  "FIXED_OPEX",
  "TAX_VAULT",
  "OWNER_PAY",
  "DEBT_SERVICE",
] as const;

export const LEDGER_NON_SPEND_ACCOUNTS: readonly LedgerAccount[] = [
  "OPERATING_CASH",
  "REVENUE",
  "REAL_REVENUE",
  "PASS_THROUGH_PAYABLE",
  "AGENT_PAYABLE",
  "INTERNAL_TRANSFER",
  "PROFIT",
] as const;

export const LEDGER_INTENTIONAL_UNMAPPED_ACCOUNTS: readonly LedgerAccount[] = ["SUSPENSE"] as const;

export function tapBucketToLedgerAccount(tapBucket: TapBucket): LedgerAccount {
  return TAP_BUCKET_TO_LEDGER_ACCOUNT[tapBucket];
}

export function tapBucketToFinancialEventType(tapBucket: TapBucket): FinancialEventType {
  return TAP_BUCKET_TO_FINANCIAL_EVENT_TYPE[tapBucket];
}

export function tapBucketToCanonicalBucket(tapBucket: TapBucket | null): CanonicalBucket {
  return tapBucket == null ? "OTHER" : TAP_BUCKET_TO_CANONICAL[tapBucket];
}

export function ledgerAccountToCanonicalBucket(account: LedgerAccount): CanonicalBucket | null {
  if (account === "OPERATING_CASH") return null;
  return LEDGER_ACCOUNT_TO_CANONICAL[account];
}

export function isLedgerSpendAccount(account: LedgerAccount): boolean {
  return (LEDGER_SPEND_ACCOUNTS as readonly string[]).includes(account);
}

export function isLedgerNonSpendAccount(account: LedgerAccount): boolean {
  return (LEDGER_NON_SPEND_ACCOUNTS as readonly string[]).includes(account);
}
