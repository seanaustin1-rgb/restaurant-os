-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OPERATOR', 'CONSULTANT', 'INVESTOR', 'MANAGER');

-- CreateEnum
CREATE TYPE "PosProvider" AS ENUM ('TOAST', 'CLOVER', 'SQUARE');

-- CreateEnum
CREATE TYPE "TransactionBucket" AS ENUM ('COGS_FOOD', 'COGS_LIQUOR', 'COGS_BEVERAGE', 'LABOR', 'OPEX_RENT', 'OPEX_UTILITIES', 'OPEX_INSURANCE', 'OPEX_SUPPLIES', 'DEBT_SERVICE', 'OWNER_PAY', 'TAX_SALES', 'TAX_PAYROLL', 'UNCATEGORIZED');

-- CreateEnum
CREATE TYPE "AiActionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "clerkOrgId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "seatCount" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRestaurantRole" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRestaurantRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosConnection" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "provider" "PosProvider" NOT NULL,
    "externalId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySales" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "grossSales" DECIMAL(12,2) NOT NULL,
    "netSales" DECIMAL(12,2) NOT NULL,
    "foodSales" DECIMAL(12,2),
    "liquorSales" DECIMAL(12,2),
    "beverageSales" DECIMAL(12,2),
    "covers" INTEGER,
    "checkCount" INTEGER,
    "laborCost" DECIMAL(12,2),
    "hoursOpen" DECIMAL(5,2),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaidConnection" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "institution" TEXT,
    "cursor" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "plaidConnectionId" TEXT,
    "plaidTxnId" TEXT,
    "date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "merchantName" TEXT,
    "description" TEXT,
    "bucket" "TransactionBucket" NOT NULL DEFAULT 'UNCATEGORIZED',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TapSettings" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "profitPct" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "ownerPayPct" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "cogsFoodPct" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "cogsLiquorPct" DECIMAL(5,2) NOT NULL DEFAULT 12.00,
    "laborPct" DECIMAL(5,2) NOT NULL DEFAULT 32.00,
    "opexPct" DECIMAL(5,2) NOT NULL DEFAULT 28.00,
    "simulationMode" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TapSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualAccount" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "bucket" "TransactionBucket" NOT NULL,
    "name" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "targetPct" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetSettings" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "targetPrimeCost" DECIMAL(5,2),
    "targetFoodCost" DECIMAL(5,2),
    "targetLiquorCost" DECIMAL(5,2),
    "targetLaborCost" DECIMAL(5,2),
    "targetRevPASH" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleConfig" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewCache" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ReviewCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialCache" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "SocialCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiActionLog" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "action" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "status" "AiActionStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_clerkOrgId_key" ON "Restaurant"("clerkOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE INDEX "UserRestaurantRole_restaurantId_idx" ON "UserRestaurantRole"("restaurantId");

-- CreateIndex
CREATE INDEX "UserRestaurantRole_clerkUserId_idx" ON "UserRestaurantRole"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRestaurantRole_clerkUserId_restaurantId_key" ON "UserRestaurantRole"("clerkUserId", "restaurantId");

-- CreateIndex
CREATE INDEX "PosConnection_restaurantId_idx" ON "PosConnection"("restaurantId");

-- CreateIndex
CREATE INDEX "DailySales_restaurantId_idx" ON "DailySales"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "DailySales_restaurantId_date_key" ON "DailySales"("restaurantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PlaidConnection_itemId_key" ON "PlaidConnection"("itemId");

-- CreateIndex
CREATE INDEX "PlaidConnection_restaurantId_idx" ON "PlaidConnection"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_plaidTxnId_key" ON "Transaction"("plaidTxnId");

-- CreateIndex
CREATE INDEX "Transaction_restaurantId_idx" ON "Transaction"("restaurantId");

-- CreateIndex
CREATE INDEX "Transaction_restaurantId_date_idx" ON "Transaction"("restaurantId", "date");

-- CreateIndex
CREATE INDEX "Transaction_bucket_idx" ON "Transaction"("bucket");

-- CreateIndex
CREATE UNIQUE INDEX "TapSettings_restaurantId_key" ON "TapSettings"("restaurantId");

-- CreateIndex
CREATE INDEX "VirtualAccount_restaurantId_idx" ON "VirtualAccount"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualAccount_restaurantId_bucket_key" ON "VirtualAccount"("restaurantId", "bucket");

-- CreateIndex
CREATE UNIQUE INDEX "TargetSettings_restaurantId_key" ON "TargetSettings"("restaurantId");

-- CreateIndex
CREATE INDEX "ModuleConfig_restaurantId_idx" ON "ModuleConfig"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleConfig_restaurantId_moduleKey_key" ON "ModuleConfig"("restaurantId", "moduleKey");

-- CreateIndex
CREATE INDEX "ReviewCache_restaurantId_source_idx" ON "ReviewCache"("restaurantId", "source");

-- CreateIndex
CREATE INDEX "SocialCache_restaurantId_platform_idx" ON "SocialCache"("restaurantId", "platform");

-- CreateIndex
CREATE INDEX "AiActionLog_restaurantId_idx" ON "AiActionLog"("restaurantId");

-- CreateIndex
CREATE INDEX "AiActionLog_status_idx" ON "AiActionLog"("status");

-- AddForeignKey
ALTER TABLE "UserRestaurantRole" ADD CONSTRAINT "UserRestaurantRole_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosConnection" ADD CONSTRAINT "PosConnection_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySales" ADD CONSTRAINT "DailySales_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaidConnection" ADD CONSTRAINT "PlaidConnection_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_plaidConnectionId_fkey" FOREIGN KEY ("plaidConnectionId") REFERENCES "PlaidConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TapSettings" ADD CONSTRAINT "TapSettings_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualAccount" ADD CONSTRAINT "VirtualAccount_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetSettings" ADD CONSTRAINT "TargetSettings_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleConfig" ADD CONSTRAINT "ModuleConfig_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCache" ADD CONSTRAINT "ReviewCache_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialCache" ADD CONSTRAINT "SocialCache_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiActionLog" ADD CONSTRAINT "AiActionLog_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
