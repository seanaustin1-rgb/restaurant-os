-- Per-category monthly spend budget (OpEx sub-budgets etc.). Additive + nullable.
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "monthlyBudget" DECIMAL(12,2);
