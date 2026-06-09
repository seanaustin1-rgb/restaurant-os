-- Per-restaurant categorization rules: replaces the hardcoded global
-- VENDOR_PATTERNS + PAYROLL_CHECK_MIN with operator-owned, per-tenant data.
-- Additive — no changes to existing tables. See
-- docs/specs/transaction-categorization-v2.md (P0 #4).

-- CreateEnum
CREATE TYPE "RuleMatchType" AS ENUM ('KEYWORD', 'REGEX', 'CHECK_MIN');

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "matchType" "RuleMatchType" NOT NULL DEFAULT 'KEYWORD',
    "pattern" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rule_restaurantId_idx" ON "Rule"("restaurantId");

-- CreateIndex
CREATE INDEX "Rule_categoryId_idx" ON "Rule"("categoryId");

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
