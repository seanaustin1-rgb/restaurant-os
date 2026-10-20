-- Tenant-scope Aura snapshots (security fix, 2026-10-20).
-- Additive: existing rows keep restaurantId = NULL and are treated as belonging
-- to the env-configured Aura owner only. No data is deleted or rewritten.

-- AuraIntentSnapshot
ALTER TABLE "AuraIntentSnapshot" ADD COLUMN "restaurantId" TEXT;

DROP INDEX IF EXISTS "AuraIntentSnapshot_source_metric_date_key";
DROP INDEX IF EXISTS "AuraIntentSnapshot_source_metric_date_idx";

CREATE UNIQUE INDEX "AuraIntentSnapshot_restaurantId_source_metric_date_key"
  ON "AuraIntentSnapshot"("restaurantId", "source", "metric", "date");
CREATE INDEX "AuraIntentSnapshot_restaurantId_source_metric_date_idx"
  ON "AuraIntentSnapshot"("restaurantId", "source", "metric", "date");

ALTER TABLE "AuraIntentSnapshot"
  ADD CONSTRAINT "AuraIntentSnapshot_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ReputationSnapshot
ALTER TABLE "ReputationSnapshot" ADD COLUMN "restaurantId" TEXT;

CREATE INDEX "ReputationSnapshot_restaurantId_source_capturedAt_idx"
  ON "ReputationSnapshot"("restaurantId", "source", "capturedAt");

ALTER TABLE "ReputationSnapshot"
  ADD CONSTRAINT "ReputationSnapshot_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
