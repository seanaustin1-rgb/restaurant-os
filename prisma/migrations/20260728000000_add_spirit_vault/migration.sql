-- CreateEnum
CREATE TYPE "SpiritLifecycleStatus" AS ENUM ('DRAFT', 'REVIEWED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SpiritVerificationStatus" AS ENUM ('UNSOURCED', 'PARTIALLY_SOURCED', 'SOURCED');

-- CreateEnum
CREATE TYPE "SpiritCommerceSource" AS ENUM ('TOAST', 'MANUAL');

-- CreateTable
CREATE TABLE "SpiritDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT 'spirit-v1',
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
    "flavor" JSONB,
    "topNotes" TEXT[],
    "whyShort" TEXT,
    "why" TEXT,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpiritDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueSpirit" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "spiritDefinitionId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "recordStatus" "SpiritLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "publicationStatus" "SpiritLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "whyWeCarry" TEXT,
    "seanShort" TEXT,
    "notes" TEXT,
    "overrides" JSONB,
    "reviewedAt" DATE,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueSpirit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpiritPour" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "venueSpiritId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "SpiritPriceObservation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "priceUsd" DECIMAL(10,2) NOT NULL,
    "pourSizeOz" DECIMAL(4,1),
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveAt" TIMESTAMP(3),
    "source" "SpiritCommerceSource" NOT NULL DEFAULT 'MANUAL',
    "provenance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpiritPriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpiritDefinition_slug_key" ON "SpiritDefinition"("slug");

-- CreateIndex
CREATE INDEX "SpiritDefinition_category_idx" ON "SpiritDefinition"("category");

-- CreateIndex
CREATE INDEX "SpiritDefinition_brand_idx" ON "SpiritDefinition"("brand");

-- CreateIndex
CREATE INDEX "VenueSpirit_restaurantId_idx" ON "VenueSpirit"("restaurantId");

-- CreateIndex
CREATE INDEX "VenueSpirit_spiritDefinitionId_idx" ON "VenueSpirit"("spiritDefinitionId");

-- CreateIndex
CREATE INDEX "VenueSpirit_restaurantId_recordStatus_publicationStatus_idx" ON "VenueSpirit"("restaurantId", "recordStatus", "publicationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "VenueSpirit_id_restaurantId_key" ON "VenueSpirit"("id", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueSpirit_restaurantId_slug_key" ON "VenueSpirit"("restaurantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "VenueSpirit_restaurantId_spiritDefinitionId_key" ON "VenueSpirit"("restaurantId", "spiritDefinitionId");

-- CreateIndex
CREATE INDEX "SpiritPour_venueSpiritId_idx" ON "SpiritPour"("venueSpiritId");

-- CreateIndex
CREATE INDEX "SpiritPour_restaurantId_idx" ON "SpiritPour"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "SpiritPour_id_restaurantId_key" ON "SpiritPour"("id", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "SpiritPour_restaurantId_toastItemGuid_key" ON "SpiritPour"("restaurantId", "toastItemGuid");

-- CreateIndex
CREATE INDEX "SpiritPriceObservation_offerId_observedAt_idx" ON "SpiritPriceObservation"("offerId", "observedAt");

-- CreateIndex
CREATE INDEX "SpiritPriceObservation_restaurantId_idx" ON "SpiritPriceObservation"("restaurantId");

-- AddForeignKey
ALTER TABLE "VenueSpirit" ADD CONSTRAINT "VenueSpirit_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueSpirit" ADD CONSTRAINT "VenueSpirit_spiritDefinitionId_fkey" FOREIGN KEY ("spiritDefinitionId") REFERENCES "SpiritDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpiritPour" ADD CONSTRAINT "SpiritPour_venueSpiritId_restaurantId_fkey" FOREIGN KEY ("venueSpiritId", "restaurantId") REFERENCES "VenueSpirit"("id", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpiritPriceObservation" ADD CONSTRAINT "SpiritPriceObservation_offerId_restaurantId_fkey" FOREIGN KEY ("offerId", "restaurantId") REFERENCES "SpiritPour"("id", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Integrity guardrails (stronger than comment-only rules; the app-layer publish
-- validator adds the richer checks like topNotes-exactly-3). Postgres enums
-- compare by declaration order (DRAFT < REVIEWED < PUBLISHED), so a venue's
-- publication may never outrank its record lifecycle.
ALTER TABLE "VenueSpirit" ADD CONSTRAINT "VenueSpirit_publication_le_record_check"
    CHECK ("publicationStatus" <= "recordStatus");
ALTER TABLE "SpiritDefinition" ADD CONSTRAINT "SpiritDefinition_body_range_check"
    CHECK ("body" >= 0 AND "body" <= 10);
ALTER TABLE "SpiritDefinition" ADD CONSTRAINT "SpiritDefinition_finish_range_check"
    CHECK ("finish" >= 0 AND "finish" <= 10);
