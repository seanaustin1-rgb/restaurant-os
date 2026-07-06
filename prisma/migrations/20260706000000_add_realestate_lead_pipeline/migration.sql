-- Real-estate speed-to-lead pipeline (v1, buyer-side): Lead + CallEvent +
-- MessageEvent, plus BROKER/AGENT roles. A brokerage is a Restaurant row with
-- businessType REAL_ESTATE_BROKERAGE; agents are BrokerageAgent (shared with the
-- roster/deals/leadSpend). BoldTrail leads land first as RawSourceEvent, then
-- normalize into Lead. Response clock = receivedAt -> firstTouchAt.
--
-- Migration-gated (like #90/#103): operator applies BEFORE deploy — code SELECTs
-- these tables/columns. Additive only; no existing rows change.

-- New RBAC roles. ADD VALUE is safe in a transaction here: the new values are not
-- referenced (no default/data) within this migration.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BROKER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'AGENT';

-- New enums
CREATE TYPE "LeadSource" AS ENUM ('ZILLOW', 'REALTOR_COM', 'IDX_WEBSITE', 'FACEBOOK', 'REFERRAL', 'OPEN_HOUSE', 'OTHER');
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'ASSIGNED', 'CONTACTED', 'ENGAGED', 'CONVERTED', 'LOST');
CREATE TYPE "LeadEscalation" AS ENUM ('PRIMARY', 'BACKUP', 'BROKER');
CREATE TYPE "TouchChannel" AS ENUM ('CALL', 'SMS', 'EMAIL');
CREATE TYPE "CallDirection" AS ENUM ('OUTBOUND', 'INBOUND');
CREATE TYPE "CallStatus" AS ENUM ('QUEUED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'NO_ANSWER', 'BUSY', 'FAILED', 'CANCELED');
CREATE TYPE "MessageChannel" AS ENUM ('SMS', 'EMAIL');
CREATE TYPE "MessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');
CREATE TYPE "MessageStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RECEIVED');

-- Lead
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "sourceSystem" "BrokerageSourceSystem" NOT NULL DEFAULT 'BOLDTRAIL',
    "externalId" TEXT,
    "origin" "LeadSource",
    "rawEventId" TEXT,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "agentId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "firstTouchAt" TIMESTAMP(3),
    "firstTouchChannel" "TouchChannel",
    "responseSeconds" INTEGER,
    "escalation" "LeadEscalation" NOT NULL DEFAULT 'PRIMARY',
    "escalatedAt" TIMESTAMP(3),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CallEvent
CREATE TABLE "CallEvent" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "leadId" TEXT,
    "agentId" TEXT,
    "direction" "CallDirection" NOT NULL DEFAULT 'OUTBOUND',
    "agentNumber" TEXT NOT NULL,
    "leadNumber" TEXT NOT NULL,
    "conferenceSid" TEXT,
    "agentCallSid" TEXT,
    "leadCallSid" TEXT,
    "status" "CallStatus" NOT NULL DEFAULT 'QUEUED',
    "initiatedAt" TIMESTAMP(3) NOT NULL,
    "agentAnsweredAt" TIMESTAMP(3),
    "leadConnectedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CallEvent_pkey" PRIMARY KEY ("id")
);

-- MessageEvent
CREATE TABLE "MessageEvent" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "leadId" TEXT,
    "agentId" TEXT,
    "channel" "MessageChannel" NOT NULL,
    "direction" "MessageDirection" NOT NULL DEFAULT 'OUTBOUND',
    "aiDrafted" BOOLEAN NOT NULL DEFAULT false,
    "aiModel" TEXT,
    "approvedAt" TIMESTAMP(3),
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "toAddress" TEXT,
    "fromAddress" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'DRAFT',
    "providerId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MessageEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes: Lead
CREATE UNIQUE INDEX "Lead_restaurantId_sourceSystem_externalId_key" ON "Lead"("restaurantId", "sourceSystem", "externalId");
CREATE INDEX "Lead_restaurantId_idx" ON "Lead"("restaurantId");
CREATE INDEX "Lead_restaurantId_receivedAt_idx" ON "Lead"("restaurantId", "receivedAt");
CREATE INDEX "Lead_restaurantId_agentId_idx" ON "Lead"("restaurantId", "agentId");
CREATE INDEX "Lead_restaurantId_status_idx" ON "Lead"("restaurantId", "status");

-- Indexes: CallEvent
CREATE UNIQUE INDEX "CallEvent_conferenceSid_key" ON "CallEvent"("conferenceSid");
CREATE INDEX "CallEvent_restaurantId_idx" ON "CallEvent"("restaurantId");
CREATE INDEX "CallEvent_restaurantId_agentId_idx" ON "CallEvent"("restaurantId", "agentId");
CREATE INDEX "CallEvent_leadId_idx" ON "CallEvent"("leadId");
CREATE INDEX "CallEvent_restaurantId_leadId_initiatedAt_idx" ON "CallEvent"("restaurantId", "leadId", "initiatedAt");
CREATE INDEX "CallEvent_agentCallSid_idx" ON "CallEvent"("agentCallSid");
CREATE INDEX "CallEvent_leadCallSid_idx" ON "CallEvent"("leadCallSid");

-- Indexes: MessageEvent
CREATE UNIQUE INDEX "MessageEvent_providerId_key" ON "MessageEvent"("providerId");
CREATE INDEX "MessageEvent_restaurantId_idx" ON "MessageEvent"("restaurantId");
CREATE INDEX "MessageEvent_restaurantId_agentId_idx" ON "MessageEvent"("restaurantId", "agentId");
CREATE INDEX "MessageEvent_leadId_idx" ON "MessageEvent"("leadId");
CREATE INDEX "MessageEvent_restaurantId_leadId_sentAt_idx" ON "MessageEvent"("restaurantId", "leadId", "sentAt");
CREATE INDEX "MessageEvent_status_idx" ON "MessageEvent"("status");

-- Foreign keys (agents -> BrokerageAgent; tenant -> Restaurant)
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "BrokerageAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallEvent" ADD CONSTRAINT "CallEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallEvent" ADD CONSTRAINT "CallEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallEvent" ADD CONSTRAINT "CallEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "BrokerageAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "BrokerageAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
