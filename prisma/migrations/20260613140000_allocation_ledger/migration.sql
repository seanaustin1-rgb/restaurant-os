-- Persisted allocation ledger (Allocation engine production phase). All additive.
-- VirtualAccount gains bookkeeping timestamps; BucketAllocation is the auditable
-- daily allocation log (idempotent by restaurant+date); BucketSweep logs the
-- 10th/25th Profit/Owner's-Pay sweeps. Running balances are recomputed from these.

ALTER TABLE "VirtualAccount" ADD COLUMN IF NOT EXISTS "lastAllocatedAt" TIMESTAMP(3);
ALTER TABLE "VirtualAccount" ADD COLUMN IF NOT EXISTS "lastSweptAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "BucketAllocation" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "netSalesBasis" DECIMAL(12,2) NOT NULL,
  "salesTaxReserved" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "allocable" DECIMAL(12,2) NOT NULL,
  "profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "ownerPay" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "cogsFood" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "cogsLiquor" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "cogsBeverage" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "labor" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "opex" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "spill" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'toast',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BucketAllocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BucketAllocation_restaurantId_date_key" ON "BucketAllocation"("restaurantId","date");
CREATE INDEX IF NOT EXISTS "BucketAllocation_restaurantId_idx" ON "BucketAllocation"("restaurantId");

CREATE TABLE IF NOT EXISTS "BucketSweep" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "sweptAt" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BucketSweep_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BucketSweep_restaurantId_idx" ON "BucketSweep"("restaurantId");

DO $$ BEGIN
  ALTER TABLE "BucketAllocation" ADD CONSTRAINT "BucketAllocation_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BucketSweep" ADD CONSTRAINT "BucketSweep_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
