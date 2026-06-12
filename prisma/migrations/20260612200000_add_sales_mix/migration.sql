-- Add per-day revenue-center sales mix to DailySales (Toast era groupBy REVENUE_CENTER).
-- Additive, nullable JSONB — safe for existing rows.
ALTER TABLE "DailySales" ADD COLUMN "mixByRevenueCenter" JSONB;
