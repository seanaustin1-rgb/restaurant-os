CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "externalLocationId" TEXT,
    "displayName" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationConnection_restaurantId_provider_externalLocationId_key"
  ON "IntegrationConnection"("restaurantId", "provider", "externalLocationId");
CREATE INDEX "IntegrationConnection_restaurantId_idx" ON "IntegrationConnection"("restaurantId");
CREATE INDEX "IntegrationConnection_provider_idx" ON "IntegrationConnection"("provider");
CREATE INDEX "IntegrationConnection_category_idx" ON "IntegrationConnection"("category");

ALTER TABLE "IntegrationConnection"
  ADD CONSTRAINT "IntegrationConnection_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
