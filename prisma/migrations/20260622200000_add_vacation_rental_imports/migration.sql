CREATE TYPE "VacationRentalSourceKind" AS ENUM ('ESCAPIA', 'PMS', 'CSV', 'QUICKBOOKS', 'REVIEWS', 'MAINTENANCE', 'OTHER');
CREATE TYPE "VacationRentalImportStatus" AS ENUM ('STAGED', 'COMMITTED', 'FAILED');
CREATE TYPE "RentalExpenseKind" AS ENUM ('CLEANING', 'MAINTENANCE', 'PLATFORM_FEE', 'MANAGEMENT_FEE', 'TAX', 'OWNER_PAYOUT', 'SUPPLIES', 'UTILITIES', 'INSURANCE', 'OTHER');
CREATE TYPE "RentalIssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DEFERRED');

CREATE TABLE "VacationRentalSource" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "kind" "VacationRentalSourceKind" NOT NULL,
  "providerName" TEXT NOT NULL,
  "externalAccountId" TEXT,
  "displayName" TEXT,
  "capabilities" JSONB,
  "lastSyncedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VacationRentalSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VacationRentalImportBatch" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "sourceId" TEXT,
  "sourceName" TEXT NOT NULL,
  "status" "VacationRentalImportStatus" NOT NULL DEFAULT 'STAGED',
  "importedBy" TEXT,
  "fileName" TEXT,
  "externalCursor" TEXT,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "acceptedCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "summary" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "committedAt" TIMESTAMP(3),

  CONSTRAINT "VacationRentalImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalProperty" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "sourceId" TEXT,
  "importBatchId" TEXT,
  "externalUnitId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address1" TEXT,
  "address2" TEXT,
  "city" TEXT,
  "state" TEXT,
  "postalCode" TEXT,
  "bedrooms" INTEGER,
  "bathrooms" DECIMAL(5,2),
  "sleeps" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RentalProperty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalBooking" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "propertyId" TEXT,
  "sourceId" TEXT,
  "importBatchId" TEXT,
  "externalBookingId" TEXT NOT NULL,
  "externalUnitId" TEXT,
  "channel" TEXT,
  "guestName" TEXT,
  "bookedAt" TIMESTAMP(3),
  "checkIn" DATE NOT NULL,
  "checkOut" DATE NOT NULL,
  "nights" INTEGER NOT NULL,
  "grossRent" DECIMAL(12,2) NOT NULL,
  "fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxes" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "platformFees" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "ownerPayout" DECIMAL(12,2),
  "status" TEXT,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RentalBooking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalOwnerStatement" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "propertyId" TEXT,
  "sourceId" TEXT,
  "importBatchId" TEXT,
  "externalStatementId" TEXT NOT NULL,
  "externalUnitId" TEXT,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "grossRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "ownerPayout" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "managementFees" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "expenses" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "reserveHeld" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RentalOwnerStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalExpense" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "propertyId" TEXT,
  "sourceId" TEXT,
  "importBatchId" TEXT,
  "externalExpenseId" TEXT NOT NULL,
  "externalUnitId" TEXT,
  "kind" "RentalExpenseKind" NOT NULL DEFAULT 'OTHER',
  "vendor" TEXT,
  "description" TEXT,
  "date" DATE NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RentalExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalMaintenanceIssue" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "propertyId" TEXT,
  "sourceId" TEXT,
  "importBatchId" TEXT,
  "externalIssueId" TEXT NOT NULL,
  "externalUnitId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "RentalIssueStatus" NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "estimatedCost" DECIMAL(12,2),
  "actualCost" DECIMAL(12,2),
  "isRepeatIssue" BOOLEAN NOT NULL DEFAULT false,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RentalMaintenanceIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalReview" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "propertyId" TEXT,
  "sourceId" TEXT,
  "importBatchId" TEXT,
  "externalReviewId" TEXT NOT NULL,
  "externalUnitId" TEXT,
  "platform" TEXT NOT NULL,
  "rating" DECIMAL(3,2),
  "reviewText" TEXT,
  "reviewedAt" DATE NOT NULL,
  "responseHours" DECIMAL(8,2),
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RentalReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VacationRentalSource_restaurantId_kind_providerName_externalAccountId_key" ON "VacationRentalSource"("restaurantId", "kind", "providerName", "externalAccountId");
CREATE INDEX "VacationRentalSource_restaurantId_idx" ON "VacationRentalSource"("restaurantId");
CREATE INDEX "VacationRentalSource_kind_idx" ON "VacationRentalSource"("kind");

CREATE INDEX "VacationRentalImportBatch_restaurantId_idx" ON "VacationRentalImportBatch"("restaurantId");
CREATE INDEX "VacationRentalImportBatch_sourceId_idx" ON "VacationRentalImportBatch"("sourceId");
CREATE INDEX "VacationRentalImportBatch_status_idx" ON "VacationRentalImportBatch"("status");
CREATE INDEX "VacationRentalImportBatch_createdAt_idx" ON "VacationRentalImportBatch"("createdAt");

CREATE UNIQUE INDEX "RentalProperty_restaurantId_externalUnitId_key" ON "RentalProperty"("restaurantId", "externalUnitId");
CREATE INDEX "RentalProperty_restaurantId_idx" ON "RentalProperty"("restaurantId");
CREATE INDEX "RentalProperty_sourceId_idx" ON "RentalProperty"("sourceId");
CREATE INDEX "RentalProperty_importBatchId_idx" ON "RentalProperty"("importBatchId");
CREATE INDEX "RentalProperty_active_idx" ON "RentalProperty"("active");

CREATE UNIQUE INDEX "RentalBooking_restaurantId_externalBookingId_key" ON "RentalBooking"("restaurantId", "externalBookingId");
CREATE INDEX "RentalBooking_restaurantId_idx" ON "RentalBooking"("restaurantId");
CREATE INDEX "RentalBooking_propertyId_idx" ON "RentalBooking"("propertyId");
CREATE INDEX "RentalBooking_sourceId_idx" ON "RentalBooking"("sourceId");
CREATE INDEX "RentalBooking_importBatchId_idx" ON "RentalBooking"("importBatchId");
CREATE INDEX "RentalBooking_checkIn_idx" ON "RentalBooking"("checkIn");

CREATE UNIQUE INDEX "RentalOwnerStatement_restaurantId_externalStatementId_key" ON "RentalOwnerStatement"("restaurantId", "externalStatementId");
CREATE INDEX "RentalOwnerStatement_restaurantId_idx" ON "RentalOwnerStatement"("restaurantId");
CREATE INDEX "RentalOwnerStatement_propertyId_idx" ON "RentalOwnerStatement"("propertyId");
CREATE INDEX "RentalOwnerStatement_sourceId_idx" ON "RentalOwnerStatement"("sourceId");
CREATE INDEX "RentalOwnerStatement_importBatchId_idx" ON "RentalOwnerStatement"("importBatchId");
CREATE INDEX "RentalOwnerStatement_periodStart_periodEnd_idx" ON "RentalOwnerStatement"("periodStart", "periodEnd");

CREATE UNIQUE INDEX "RentalExpense_restaurantId_externalExpenseId_key" ON "RentalExpense"("restaurantId", "externalExpenseId");
CREATE INDEX "RentalExpense_restaurantId_idx" ON "RentalExpense"("restaurantId");
CREATE INDEX "RentalExpense_propertyId_idx" ON "RentalExpense"("propertyId");
CREATE INDEX "RentalExpense_sourceId_idx" ON "RentalExpense"("sourceId");
CREATE INDEX "RentalExpense_importBatchId_idx" ON "RentalExpense"("importBatchId");
CREATE INDEX "RentalExpense_date_idx" ON "RentalExpense"("date");
CREATE INDEX "RentalExpense_kind_idx" ON "RentalExpense"("kind");

CREATE UNIQUE INDEX "RentalMaintenanceIssue_restaurantId_externalIssueId_key" ON "RentalMaintenanceIssue"("restaurantId", "externalIssueId");
CREATE INDEX "RentalMaintenanceIssue_restaurantId_idx" ON "RentalMaintenanceIssue"("restaurantId");
CREATE INDEX "RentalMaintenanceIssue_propertyId_idx" ON "RentalMaintenanceIssue"("propertyId");
CREATE INDEX "RentalMaintenanceIssue_sourceId_idx" ON "RentalMaintenanceIssue"("sourceId");
CREATE INDEX "RentalMaintenanceIssue_importBatchId_idx" ON "RentalMaintenanceIssue"("importBatchId");
CREATE INDEX "RentalMaintenanceIssue_status_idx" ON "RentalMaintenanceIssue"("status");
CREATE INDEX "RentalMaintenanceIssue_openedAt_idx" ON "RentalMaintenanceIssue"("openedAt");

CREATE UNIQUE INDEX "RentalReview_restaurantId_externalReviewId_key" ON "RentalReview"("restaurantId", "externalReviewId");
CREATE INDEX "RentalReview_restaurantId_idx" ON "RentalReview"("restaurantId");
CREATE INDEX "RentalReview_propertyId_idx" ON "RentalReview"("propertyId");
CREATE INDEX "RentalReview_sourceId_idx" ON "RentalReview"("sourceId");
CREATE INDEX "RentalReview_importBatchId_idx" ON "RentalReview"("importBatchId");
CREATE INDEX "RentalReview_platform_idx" ON "RentalReview"("platform");
CREATE INDEX "RentalReview_reviewedAt_idx" ON "RentalReview"("reviewedAt");

ALTER TABLE "VacationRentalSource" ADD CONSTRAINT "VacationRentalSource_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VacationRentalImportBatch" ADD CONSTRAINT "VacationRentalImportBatch_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VacationRentalImportBatch" ADD CONSTRAINT "VacationRentalImportBatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "VacationRentalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalProperty" ADD CONSTRAINT "RentalProperty_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalProperty" ADD CONSTRAINT "RentalProperty_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "VacationRentalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalProperty" ADD CONSTRAINT "RentalProperty_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "VacationRentalImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalBooking" ADD CONSTRAINT "RentalBooking_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalBooking" ADD CONSTRAINT "RentalBooking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "RentalProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalBooking" ADD CONSTRAINT "RentalBooking_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "VacationRentalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalBooking" ADD CONSTRAINT "RentalBooking_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "VacationRentalImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalOwnerStatement" ADD CONSTRAINT "RentalOwnerStatement_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalOwnerStatement" ADD CONSTRAINT "RentalOwnerStatement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "RentalProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalOwnerStatement" ADD CONSTRAINT "RentalOwnerStatement_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "VacationRentalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalOwnerStatement" ADD CONSTRAINT "RentalOwnerStatement_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "VacationRentalImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalExpense" ADD CONSTRAINT "RentalExpense_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalExpense" ADD CONSTRAINT "RentalExpense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "RentalProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalExpense" ADD CONSTRAINT "RentalExpense_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "VacationRentalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalExpense" ADD CONSTRAINT "RentalExpense_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "VacationRentalImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalMaintenanceIssue" ADD CONSTRAINT "RentalMaintenanceIssue_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalMaintenanceIssue" ADD CONSTRAINT "RentalMaintenanceIssue_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "RentalProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalMaintenanceIssue" ADD CONSTRAINT "RentalMaintenanceIssue_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "VacationRentalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalMaintenanceIssue" ADD CONSTRAINT "RentalMaintenanceIssue_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "VacationRentalImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalReview" ADD CONSTRAINT "RentalReview_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalReview" ADD CONSTRAINT "RentalReview_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "RentalProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalReview" ADD CONSTRAINT "RentalReview_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "VacationRentalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalReview" ADD CONSTRAINT "RentalReview_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "VacationRentalImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
