CREATE TYPE "BrokerageDealStage" AS ENUM ('LEAD', 'ACTIVE', 'PENDING', 'CLOSED', 'LOST');

CREATE TABLE "BrokerageAgent" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "externalAgentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "status" TEXT,
  "defaultSplitPct" DECIMAL(5,2),
  "annualCap" DECIMAL(12,2),
  "capPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "capResetDate" DATE,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BrokerageAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrokerageDeal" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "agentId" TEXT,
  "externalDealId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "market" TEXT,
  "stage" "BrokerageDealStage" NOT NULL DEFAULT 'ACTIVE',
  "expectedCloseDate" DATE,
  "closedDate" DATE,
  "salePrice" DECIMAL(14,2),
  "gci" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "referralFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "franchiseFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "agentPayout" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "companyDollar" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "probabilityPct" DECIMAL(5,2),
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BrokerageDeal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrokerageLeadSpend" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "agentId" TEXT,
  "source" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "spend" DECIMAL(12,2) NOT NULL,
  "attributedGci" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "attributedDeals" INTEGER NOT NULL DEFAULT 0,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BrokerageLeadSpend_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrokerageMarketMetric" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "newListings" INTEGER NOT NULL DEFAULT 0,
  "pendings" INTEGER NOT NULL DEFAULT 0,
  "closedSales" INTEGER NOT NULL DEFAULT 0,
  "avgDom" DECIMAL(8,2),
  "priceReductions" INTEGER NOT NULL DEFAULT 0,
  "showingAppointments" INTEGER NOT NULL DEFAULT 0,
  "mortgageRatePct" DECIMAL(5,2),
  "googleIntentTrendPct" DECIMAL(6,2),
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BrokerageMarketMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrokerageAgent_restaurantId_externalAgentId_key" ON "BrokerageAgent"("restaurantId", "externalAgentId");
CREATE INDEX "BrokerageAgent_restaurantId_idx" ON "BrokerageAgent"("restaurantId");
CREATE INDEX "BrokerageAgent_status_idx" ON "BrokerageAgent"("status");

CREATE UNIQUE INDEX "BrokerageDeal_restaurantId_externalDealId_key" ON "BrokerageDeal"("restaurantId", "externalDealId");
CREATE INDEX "BrokerageDeal_restaurantId_idx" ON "BrokerageDeal"("restaurantId");
CREATE INDEX "BrokerageDeal_agentId_idx" ON "BrokerageDeal"("agentId");
CREATE INDEX "BrokerageDeal_stage_idx" ON "BrokerageDeal"("stage");
CREATE INDEX "BrokerageDeal_expectedCloseDate_idx" ON "BrokerageDeal"("expectedCloseDate");
CREATE INDEX "BrokerageDeal_closedDate_idx" ON "BrokerageDeal"("closedDate");

CREATE INDEX "BrokerageLeadSpend_restaurantId_idx" ON "BrokerageLeadSpend"("restaurantId");
CREATE INDEX "BrokerageLeadSpend_agentId_idx" ON "BrokerageLeadSpend"("agentId");
CREATE INDEX "BrokerageLeadSpend_source_idx" ON "BrokerageLeadSpend"("source");
CREATE INDEX "BrokerageLeadSpend_periodStart_periodEnd_idx" ON "BrokerageLeadSpend"("periodStart", "periodEnd");

CREATE UNIQUE INDEX "BrokerageMarketMetric_restaurantId_market_date_key" ON "BrokerageMarketMetric"("restaurantId", "market", "date");
CREATE INDEX "BrokerageMarketMetric_restaurantId_idx" ON "BrokerageMarketMetric"("restaurantId");
CREATE INDEX "BrokerageMarketMetric_market_idx" ON "BrokerageMarketMetric"("market");
CREATE INDEX "BrokerageMarketMetric_date_idx" ON "BrokerageMarketMetric"("date");

ALTER TABLE "BrokerageAgent" ADD CONSTRAINT "BrokerageAgent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrokerageDeal" ADD CONSTRAINT "BrokerageDeal_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrokerageDeal" ADD CONSTRAINT "BrokerageDeal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "BrokerageAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrokerageLeadSpend" ADD CONSTRAINT "BrokerageLeadSpend_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrokerageLeadSpend" ADD CONSTRAINT "BrokerageLeadSpend_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "BrokerageAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrokerageMarketMetric" ADD CONSTRAINT "BrokerageMarketMetric_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
