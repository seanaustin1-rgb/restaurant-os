-- CreateTable
CREATE TABLE "CustomFlightTemplate" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "throughLine" TEXT NOT NULL DEFAULT '',
    "autoOrder" TEXT NOT NULL DEFAULT 'slot-order',
    "slots" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFlightTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomFlightTemplate_restaurantId_name_key" ON "CustomFlightTemplate"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "CustomFlightTemplate_restaurantId_idx" ON "CustomFlightTemplate"("restaurantId");

-- AddForeignKey
ALTER TABLE "CustomFlightTemplate" ADD CONSTRAINT "CustomFlightTemplate_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
