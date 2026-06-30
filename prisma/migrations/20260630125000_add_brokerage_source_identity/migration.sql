-- Brokerage source identity keeps canonical agents separate from vendor-specific IDs.
CREATE TYPE "BrokerageSourceSystem" AS ENUM (
  'CSV',
  'FOLLOW_UP_BOSS',
  'LONE_WOLF',
  'SKYSLOPE',
  'BOLDTRAIL',
  'MOXIWORKS',
  'DOTLOOP',
  'LOFT47',
  'QBO',
  'GOOGLE',
  'OTHER'
);

CREATE TABLE "BrokerageAgentSourceIdentity" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "sourceSystem" "BrokerageSourceSystem" NOT NULL,
  "externalAgentId" TEXT NOT NULL,
  "email" TEXT,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BrokerageAgentSourceIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrokerageAgentActivitySnapshot" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "sourceSystem" "BrokerageSourceSystem" NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "loginCount" INTEGER NOT NULL DEFAULT 0,
  "newLeadCount" INTEGER NOT NULL DEFAULT 0,
  "contactCount" INTEGER NOT NULL DEFAULT 0,
  "appointmentCount" INTEGER NOT NULL DEFAULT 0,
  "cmaCount" INTEGER NOT NULL DEFAULT 0,
  "activePipelineCount" INTEGER NOT NULL DEFAULT 0,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BrokerageAgentActivitySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrokerageAgentSourceIdentity_restaurantId_sourceSystem_externalAgentId_key"
  ON "BrokerageAgentSourceIdentity"("restaurantId", "sourceSystem", "externalAgentId");
CREATE INDEX "BrokerageAgentSourceIdentity_restaurantId_idx" ON "BrokerageAgentSourceIdentity"("restaurantId");
CREATE INDEX "BrokerageAgentSourceIdentity_agentId_idx" ON "BrokerageAgentSourceIdentity"("agentId");
CREATE INDEX "BrokerageAgentSourceIdentity_email_idx" ON "BrokerageAgentSourceIdentity"("email");

CREATE UNIQUE INDEX "BrokerageAgentActivitySnapshot_restaurantId_agentId_sourceSystem_periodStart_periodEnd_key"
  ON "BrokerageAgentActivitySnapshot"("restaurantId", "agentId", "sourceSystem", "periodStart", "periodEnd");
CREATE INDEX "BrokerageAgentActivitySnapshot_restaurantId_idx" ON "BrokerageAgentActivitySnapshot"("restaurantId");
CREATE INDEX "BrokerageAgentActivitySnapshot_agentId_idx" ON "BrokerageAgentActivitySnapshot"("agentId");
CREATE INDEX "BrokerageAgentActivitySnapshot_sourceSystem_idx" ON "BrokerageAgentActivitySnapshot"("sourceSystem");
CREATE INDEX "BrokerageAgentActivitySnapshot_periodStart_periodEnd_idx"
  ON "BrokerageAgentActivitySnapshot"("periodStart", "periodEnd");

ALTER TABLE "BrokerageAgentSourceIdentity"
  ADD CONSTRAINT "BrokerageAgentSourceIdentity_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrokerageAgentSourceIdentity"
  ADD CONSTRAINT "BrokerageAgentSourceIdentity_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "BrokerageAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrokerageAgentActivitySnapshot"
  ADD CONSTRAINT "BrokerageAgentActivitySnapshot_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrokerageAgentActivitySnapshot"
  ADD CONSTRAINT "BrokerageAgentActivitySnapshot_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "BrokerageAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
