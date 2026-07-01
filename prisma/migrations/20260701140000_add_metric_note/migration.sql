-- MetricNote: a dated operator note that explains a red / over-target metric, turning a
-- scary alert into a "managed event". `audience` gates investor visibility server-side —
-- INTERNAL notes never reach an investor; only INVESTOR notes are shared outward.
CREATE TYPE "NoteAudience" AS ENUM ('INTERNAL', 'INVESTOR');

CREATE TABLE "MetricNote" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "periodKey" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" "NoteAudience" NOT NULL DEFAULT 'INTERNAL',
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "MetricNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MetricNote_restaurantId_metricKey_eventDate_idx"
  ON "MetricNote"("restaurantId", "metricKey", "eventDate");

ALTER TABLE "MetricNote"
  ADD CONSTRAINT "MetricNote_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
