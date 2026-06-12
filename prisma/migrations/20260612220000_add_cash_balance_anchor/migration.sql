-- Cash Runway: operator-entered balance anchor (balance on a known date).
-- Additive, nullable — safe for existing rows.
ALTER TABLE "Restaurant" ADD COLUMN "cashBalanceAnchor" DECIMAL(12,2);
ALTER TABLE "Restaurant" ADD COLUMN "cashBalanceAnchorDate" DATE;
