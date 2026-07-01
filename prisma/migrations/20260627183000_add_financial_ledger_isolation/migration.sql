CREATE TYPE "FinancialEventType" AS ENUM (
  'REVENUE',
  'REAL_REVENUE',
  'PASS_THROUGH',
  'AGENT_SPLIT',
  'FRANCHISE_FEE',
  'COGS',
  'LABOR',
  'OPEX',
  'FIXED_OPEX',
  'TAX_LIABILITY',
  'OWNER_PAY',
  'PROFIT',
  'DEBT_SERVICE',
  'INTERNAL_TRANSFER',
  'EXCLUDED'
);

CREATE TYPE "FinancialMappingStatus" AS ENUM (
  'RAW',
  'NORMALIZED',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXCLUDED'
);

CREATE TYPE "LedgerAccount" AS ENUM (
  'OPERATING_CASH',
  'REVENUE',
  'REAL_REVENUE',
  'PASS_THROUGH_PAYABLE',
  'AGENT_PAYABLE',
  'COGS',
  'LABOR',
  'OPEX',
  'FIXED_OPEX',
  'TAX_VAULT',
  'PROFIT',
  'OWNER_PAY',
  'DEBT_SERVICE',
  'INTERNAL_TRANSFER',
  'SUSPENSE'
);

CREATE TYPE "SyncExceptionSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKING');

CREATE TYPE "SyncExceptionType" AS ENUM (
  'MISSING_MAPPING',
  'DUPLICATE_SOURCE_EVENT',
  'STALE_SOURCE',
  'UNBALANCED_LEDGER',
  'INVALID_AMOUNT',
  'MISSING_REQUIRED_FIELD',
  'API_ERROR',
  'UNKNOWN'
);

CREATE TABLE "RawSourceEvent" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "sourceObjectType" TEXT NOT NULL,
  "sourceObjectId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "mappingStatus" "FinancialMappingStatus" NOT NULL DEFAULT 'RAW',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RawSourceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NormalizedFinancialEvent" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "rawSourceEventId" TEXT,
  "eventDate" DATE NOT NULL,
  "eventType" "FinancialEventType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "counterparty" TEXT,
  "description" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mappingStatus" "FinancialMappingStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NormalizedFinancialEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "normalizedFinancialEventId" TEXT,
  "ledgerDate" DATE NOT NULL,
  "ledgerAccount" "LedgerAccount" NOT NULL,
  "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "cashEffect" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "taxEffect" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "allocationBucket" "TapBucket",
  "memo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncException" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "rawSourceEventId" TEXT,
  "normalizedFinancialEventId" TEXT,
  "sourceSystem" TEXT NOT NULL,
  "severity" "SyncExceptionSeverity" NOT NULL DEFAULT 'WARNING',
  "issueType" "SyncExceptionType" NOT NULL,
  "message" TEXT NOT NULL,
  "detail" JSONB,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SyncException_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RawSourceEvent_restaurantId_sourceSystem_sourceObjectType_sourceObjectId_key"
  ON "RawSourceEvent"("restaurantId", "sourceSystem", "sourceObjectType", "sourceObjectId");
CREATE INDEX "RawSourceEvent_restaurantId_idx" ON "RawSourceEvent"("restaurantId");
CREATE INDEX "RawSourceEvent_sourceSystem_sourceObjectType_idx" ON "RawSourceEvent"("sourceSystem", "sourceObjectType");
CREATE INDEX "RawSourceEvent_mappingStatus_idx" ON "RawSourceEvent"("mappingStatus");
CREATE INDEX "RawSourceEvent_receivedAt_idx" ON "RawSourceEvent"("receivedAt");

CREATE INDEX "NormalizedFinancialEvent_restaurantId_idx" ON "NormalizedFinancialEvent"("restaurantId");
CREATE INDEX "NormalizedFinancialEvent_rawSourceEventId_idx" ON "NormalizedFinancialEvent"("rawSourceEventId");
CREATE INDEX "NormalizedFinancialEvent_eventDate_idx" ON "NormalizedFinancialEvent"("eventDate");
CREATE INDEX "NormalizedFinancialEvent_eventType_idx" ON "NormalizedFinancialEvent"("eventType");
CREATE INDEX "NormalizedFinancialEvent_mappingStatus_idx" ON "NormalizedFinancialEvent"("mappingStatus");

CREATE INDEX "LedgerEntry_restaurantId_idx" ON "LedgerEntry"("restaurantId");
CREATE INDEX "LedgerEntry_normalizedFinancialEventId_idx" ON "LedgerEntry"("normalizedFinancialEventId");
CREATE INDEX "LedgerEntry_ledgerDate_idx" ON "LedgerEntry"("ledgerDate");
CREATE INDEX "LedgerEntry_ledgerAccount_idx" ON "LedgerEntry"("ledgerAccount");
CREATE INDEX "LedgerEntry_allocationBucket_idx" ON "LedgerEntry"("allocationBucket");

CREATE INDEX "SyncException_restaurantId_idx" ON "SyncException"("restaurantId");
CREATE INDEX "SyncException_rawSourceEventId_idx" ON "SyncException"("rawSourceEventId");
CREATE INDEX "SyncException_normalizedFinancialEventId_idx" ON "SyncException"("normalizedFinancialEventId");
CREATE INDEX "SyncException_sourceSystem_idx" ON "SyncException"("sourceSystem");
CREATE INDEX "SyncException_severity_idx" ON "SyncException"("severity");
CREATE INDEX "SyncException_issueType_idx" ON "SyncException"("issueType");
CREATE INDEX "SyncException_resolvedAt_idx" ON "SyncException"("resolvedAt");

ALTER TABLE "RawSourceEvent"
  ADD CONSTRAINT "RawSourceEvent_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NormalizedFinancialEvent"
  ADD CONSTRAINT "NormalizedFinancialEvent_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NormalizedFinancialEvent"
  ADD CONSTRAINT "NormalizedFinancialEvent_rawSourceEventId_fkey"
  FOREIGN KEY ("rawSourceEventId") REFERENCES "RawSourceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_normalizedFinancialEventId_fkey"
  FOREIGN KEY ("normalizedFinancialEventId") REFERENCES "NormalizedFinancialEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SyncException"
  ADD CONSTRAINT "SyncException_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncException"
  ADD CONSTRAINT "SyncException_rawSourceEventId_fkey"
  FOREIGN KEY ("rawSourceEventId") REFERENCES "RawSourceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyncException"
  ADD CONSTRAINT "SyncException_normalizedFinancialEventId_fkey"
  FOREIGN KEY ("normalizedFinancialEventId") REFERENCES "NormalizedFinancialEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
