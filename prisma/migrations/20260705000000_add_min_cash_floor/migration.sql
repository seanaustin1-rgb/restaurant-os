-- Cash floor (B6): operator-set minimum operating cash. Nullable — null means
-- "not configured", so the breach signal stays silent until the operator sets it.
-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "minCashFloor" DECIMAL(12,2);
