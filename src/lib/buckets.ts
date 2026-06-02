import type { TransactionBucket } from "@prisma/client";

// Ordered list of transaction buckets with display labels. Used by the
// recategorization UI and anywhere buckets are shown. String literals are
// assignable to the Prisma TransactionBucket enum type.
export const BUCKETS: { value: TransactionBucket; label: string }[] = [
  { value: "REVENUE", label: "Revenue" },
  { value: "COGS_FOOD", label: "COGS — Food" },
  { value: "COGS_LIQUOR", label: "COGS — Liquor" },
  { value: "COGS_BEVERAGE", label: "COGS — Beverage" },
  { value: "LABOR", label: "Labor" },
  { value: "PAYROLL_CHECK", label: "Labor — Paper Checks" },
  { value: "OPEX_RENT", label: "OpEx — Rent" },
  { value: "OPEX_UTILITIES", label: "OpEx — Utilities" },
  { value: "OPEX_INSURANCE", label: "OpEx — Insurance" },
  { value: "OPEX_SUPPLIES", label: "OpEx — Supplies" },
  { value: "DEBT_SERVICE", label: "Debt Service" },
  { value: "OWNER_PAY", label: "Owner Pay" },
  { value: "TAX_SALES", label: "Tax — Sales" },
  { value: "TAX_PAYROLL", label: "Tax — Payroll" },
  { value: "UNCATEGORIZED", label: "Uncategorized" },
];

export const BUCKET_LABEL: Record<string, string> = Object.fromEntries(
  BUCKETS.map((b) => [b.value, b.label]),
);
