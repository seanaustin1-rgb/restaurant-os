-- Beverage cost ratios (Milestone B): per-restaurant pour-cost targets plus a
-- manual sales-mix fallback for the denominator, used until Toast supplies the
-- per-day DailySales.liquorSales / .beverageSales breakdown. Additive — all
-- columns nullable, no changes to existing data.

-- AlterTable
ALTER TABLE "TargetSettings" ADD COLUMN "targetLiquorPourPct" DECIMAL(5,2);
ALTER TABLE "TargetSettings" ADD COLUMN "targetBeveragePourPct" DECIMAL(5,2);
ALTER TABLE "TargetSettings" ADD COLUMN "liquorSalesMixPct" DECIMAL(5,2);
ALTER TABLE "TargetSettings" ADD COLUMN "beverageSalesMixPct" DECIMAL(5,2);
