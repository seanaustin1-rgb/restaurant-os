CREATE TYPE "DataSourceStatus" AS ENUM ('PLANNED', 'CONNECTED', 'NOT_NEEDED', 'BLOCKED');

CREATE TABLE "DataSourceConfig" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "status" "DataSourceStatus" NOT NULL DEFAULT 'PLANNED',
  "notes" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DataSourceConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DataSourceConfig_restaurantId_category_providerName_key"
  ON "DataSourceConfig"("restaurantId", "category", "providerName");

CREATE INDEX "DataSourceConfig_restaurantId_idx" ON "DataSourceConfig"("restaurantId");
CREATE INDEX "DataSourceConfig_status_idx" ON "DataSourceConfig"("status");

ALTER TABLE "DataSourceConfig"
  ADD CONSTRAINT "DataSourceConfig_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
