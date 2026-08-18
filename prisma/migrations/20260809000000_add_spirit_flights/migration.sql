-- Spirit Vault flights: bartender-built, Toast-trackable flight definitions.
-- Flights reference existing venue spirits/pours; they do not copy bottle data.

CREATE TABLE "SpiritFlight" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "SpiritLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "suggestedPriceUsd" DECIMAL(10,2),
    "pricingFormulaVersion" TEXT NOT NULL DEFAULT 'component_1oz_sum_v1',
    "pricingSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpiritFlight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpiritFlightItem" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "venueSpiritId" TEXT NOT NULL,
    "spiritPourId" TEXT,
    "pourSizeOz" DECIMAL(4,1) NOT NULL DEFAULT 1.0,
    "sortOrder" INTEGER NOT NULL,
    "itemNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpiritFlightItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SpiritFlightItem_pourSizeOz_check" CHECK ("pourSizeOz" > 0)
);

CREATE UNIQUE INDEX "SpiritFlight_id_restaurantId_key" ON "SpiritFlight"("id", "restaurantId");
CREATE UNIQUE INDEX "SpiritFlight_restaurantId_name_key" ON "SpiritFlight"("restaurantId", "name");
CREATE INDEX "SpiritFlight_restaurantId_status_idx" ON "SpiritFlight"("restaurantId", "status");

CREATE UNIQUE INDEX "SpiritFlightItem_flightId_sortOrder_key" ON "SpiritFlightItem"("flightId", "sortOrder");
CREATE UNIQUE INDEX "SpiritFlightItem_flightId_venueSpiritId_key" ON "SpiritFlightItem"("flightId", "venueSpiritId");
CREATE INDEX "SpiritFlightItem_restaurantId_idx" ON "SpiritFlightItem"("restaurantId");
CREATE INDEX "SpiritFlightItem_venueSpiritId_idx" ON "SpiritFlightItem"("venueSpiritId");
CREATE INDEX "SpiritFlightItem_spiritPourId_idx" ON "SpiritFlightItem"("spiritPourId");

ALTER TABLE "SpiritFlight"
    ADD CONSTRAINT "SpiritFlight_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpiritFlightItem"
    ADD CONSTRAINT "SpiritFlightItem_flightId_restaurantId_fkey"
    FOREIGN KEY ("flightId", "restaurantId") REFERENCES "SpiritFlight"("id", "restaurantId")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpiritFlightItem"
    ADD CONSTRAINT "SpiritFlightItem_venueSpiritId_restaurantId_fkey"
    FOREIGN KEY ("venueSpiritId", "restaurantId") REFERENCES "VenueSpirit"("id", "restaurantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SpiritFlightItem"
    ADD CONSTRAINT "SpiritFlightItem_spiritPourId_restaurantId_fkey"
    FOREIGN KEY ("spiritPourId", "restaurantId") REFERENCES "SpiritPour"("id", "restaurantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
