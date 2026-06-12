-- Add actual worked labor hours to DailySales (Toast era hourlyJobTotalHours).
-- Additive, nullable — safe for existing rows.
ALTER TABLE "DailySales" ADD COLUMN "laborHours" DECIMAL(7,2);
