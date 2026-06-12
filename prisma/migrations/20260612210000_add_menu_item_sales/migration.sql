-- Per-day, per-menu-item sales from the Toast Analytics menu report.
-- New table — additive, safe for existing data.
CREATE TABLE "MenuItemSales" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "menuItemGuid" TEXT NOT NULL,
    "menuItemName" TEXT NOT NULL,
    "quantitySold" INTEGER NOT NULL,
    "netSales" DECIMAL(12,2) NOT NULL,
    "avgPrice" DECIMAL(10,2),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemSales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MenuItemSales_restaurantId_date_menuItemGuid_key" ON "MenuItemSales"("restaurantId", "date", "menuItemGuid");

CREATE INDEX "MenuItemSales_restaurantId_date_idx" ON "MenuItemSales"("restaurantId", "date");

ALTER TABLE "MenuItemSales" ADD CONSTRAINT "MenuItemSales_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
