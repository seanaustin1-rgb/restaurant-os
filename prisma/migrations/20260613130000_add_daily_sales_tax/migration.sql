-- Pre-allocation Sales-Tax skim: store the collected sales tax per business day
-- (summed from the Toast Orders API per-check taxAmount). Additive + nullable;
-- safe to apply to the live DB.
ALTER TABLE "DailySales" ADD COLUMN IF NOT EXISTS "salesTaxCollected" DECIMAL(12,2);
