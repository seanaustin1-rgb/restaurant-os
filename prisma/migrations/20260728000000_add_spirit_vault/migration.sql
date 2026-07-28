-- CreateEnum
CREATE TYPE "SpiritLifecycleStatus" AS ENUM ('DRAFT', 'REVIEWED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SpiritVerificationStatus" AS ENUM ('UNSOURCED', 'PARTIALLY_SOURCED', 'SOURCED');

-- CreateEnum
CREATE TYPE "SpiritCommerceSource" AS ENUM ('TOAST', 'MANUAL');

-- CreateTable
CREATE TABLE "Spirit" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT 'spirit-v1',
    "recordStatus" "SpiritLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "publicationStatus" "SpiritLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "verificationStatus" "SpiritVerificationStatus" NOT NULL DEFAULT 'PARTIALLY_SOURCED',
    "brand" TEXT NOT NULL,
    "expression" TEXT,
    "displayName" TEXT,
    "subcategory" TEXT,
    "category" TEXT NOT NULL,
    "silo" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "distilleryName" TEXT,
    "producerName" TEXT,
    "style" TEXT,
    "proofN" DECIMAL(5,2),
    "proofDisplay" TEXT,
    "ageText" TEXT NOT NULL DEFAULT 'NAS',
    "minYears" INTEGER,
    "maxYears" INTEGER,
    "ageSourceUrl" TEXT,
    "agePending" BOOLEAN NOT NULL DEFAULT false,
    "unaged" BOOLEAN NOT NULL DEFAULT false,
    "body" INTEGER NOT NULL DEFAULT 5,
    "finish" INTEGER NOT NULL DEFAULT 5,
    "whyShort" TEXT,
    "why" TEXT,
    "whyWeCarry" TEXT,
    "seanShort" TEXT,
    "notes" TEXT,
    "topNotes" TEXT[],
    "flavor" JSONB,
    "production" JSONB,
    "productionStructured" JSONB,
    "prodTags" TEXT[],
    "pairings" JSONB,
    "timeline" JSONB,
    "statTiles" JSONB,
    "facts" JSONB,
    "history" TEXT,
    "coordinatesText" TEXT,
    "press" JSONB,
    "paths" JSONB,
    "sources" JSONB,
    "sourcingLimitations" TEXT[],
    "reviewedAt" DATE,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spirit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpiritPour" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "spiritId" TEXT NOT NULL,
    "toastItemGuid" TEXT,
    "pourSizeOz" DECIMAL(4,1),
    "pourLabel" TEXT,
    "priceUsd" DECIMAL(10,2),
    "availability" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "priceIsTemporary" BOOLEAN NOT NULL DEFAULT true,
    "priceProvenance" TEXT,
    "commerceSource" "SpiritCommerceSource" NOT NULL DEFAULT 'MANUAL',
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpiritPour_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Spirit_restaurantId_idx" ON "Spirit"("restaurantId");

-- CreateIndex
CREATE INDEX "Spirit_restaurantId_category_idx" ON "Spirit"("restaurantId", "category");

-- CreateIndex
CREATE INDEX "Spirit_restaurantId_recordStatus_publicationStatus_idx" ON "Spirit"("restaurantId", "recordStatus", "publicationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Spirit_restaurantId_slug_key" ON "Spirit"("restaurantId", "slug");

-- CreateIndex
CREATE INDEX "SpiritPour_restaurantId_idx" ON "SpiritPour"("restaurantId");

-- CreateIndex
CREATE INDEX "SpiritPour_spiritId_idx" ON "SpiritPour"("spiritId");

-- CreateIndex
CREATE UNIQUE INDEX "SpiritPour_restaurantId_toastItemGuid_key" ON "SpiritPour"("restaurantId", "toastItemGuid");

-- AddForeignKey
ALTER TABLE "Spirit" ADD CONSTRAINT "Spirit_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpiritPour" ADD CONSTRAINT "SpiritPour_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpiritPour" ADD CONSTRAINT "SpiritPour_spiritId_fkey" FOREIGN KEY ("spiritId") REFERENCES "Spirit"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Integrity guardrails (stronger than comment-only rules; app-layer validation
-- still applies for richer checks like topNotes-exactly-3 at publish time).
-- Postgres enums compare by declaration order (DRAFT < REVIEWED < PUBLISHED),
-- so publication may never outrank the record's own lifecycle state.
ALTER TABLE "Spirit" ADD CONSTRAINT "Spirit_publication_le_record_check"
    CHECK ("publicationStatus" <= "recordStatus");
ALTER TABLE "Spirit" ADD CONSTRAINT "Spirit_body_range_check"
    CHECK ("body" >= 0 AND "body" <= 10);
ALTER TABLE "Spirit" ADD CONSTRAINT "Spirit_finish_range_check"
    CHECK ("finish" >= 0 AND "finish" <= 10);
