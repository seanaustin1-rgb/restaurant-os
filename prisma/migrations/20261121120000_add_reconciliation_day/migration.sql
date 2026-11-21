-- CreateTable
CREATE TABLE "ReconciliationDay" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clean" BOOLEAN NOT NULL,
    "checks" JSONB NOT NULL,
    "openBacklogCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationDay_restaurantId_clean_date_idx" ON "ReconciliationDay"("restaurantId", "clean", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationDay_restaurantId_date_key" ON "ReconciliationDay"("restaurantId", "date");

-- AddForeignKey
ALTER TABLE "ReconciliationDay" ADD CONSTRAINT "ReconciliationDay_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

