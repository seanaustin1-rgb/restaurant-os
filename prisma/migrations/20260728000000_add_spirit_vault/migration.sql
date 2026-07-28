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
    "silo" TEXT NOT NULL DEFAULT 'bourbon',
    "country" TEXT DEFAULT 'USA',
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
    "priceUsd" DECIMAL(10,2),
    "pourSizeOz" DECIMAL(4,1) DEFAULT 2.0,
    "toastItemGuid" TEXT,
    "priceIsTemporary" BOOLEAN NOT NULL DEFAULT true,
    "priceProvenance" TEXT,
    "commerceSource" "SpiritCommerceSource" NOT NULL DEFAULT 'MANUAL',
    "availability" TEXT,
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

-- CreateIndex
CREATE INDEX "Spirit_restaurantId_idx" ON "Spirit"("restaurantId");

-- CreateIndex
CREATE INDEX "Spirit_restaurantId_category_idx" ON "Spirit"("restaurantId", "category");

-- CreateIndex
CREATE INDEX "Spirit_restaurantId_recordStatus_publicationStatus_idx" ON "Spirit"("restaurantId", "recordStatus", "publicationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Spirit_restaurantId_slug_key" ON "Spirit"("restaurantId", "slug");

-- AddForeignKey
ALTER TABLE "Spirit" ADD CONSTRAINT "Spirit_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

