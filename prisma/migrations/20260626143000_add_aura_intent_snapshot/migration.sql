CREATE TABLE "AuraIntentSnapshot" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'google_business_profile',
    "metric" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuraIntentSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuraIntentSnapshot_source_metric_date_key" ON "AuraIntentSnapshot"("source", "metric", "date");
CREATE INDEX "AuraIntentSnapshot_source_metric_date_idx" ON "AuraIntentSnapshot"("source", "metric", "date");
