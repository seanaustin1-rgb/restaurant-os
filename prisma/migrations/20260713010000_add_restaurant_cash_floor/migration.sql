-- Adds an operator-set cash floor: the minimum operating balance to keep on hand.
-- Forward Cash sweep-safety (B6) reads Restaurant.cashFloor.
-- Operator must apply this migration before deploying code that reads Restaurant.cashFloor.
ALTER TABLE "Restaurant" ADD COLUMN "cashFloor" DECIMAL(12,2);
