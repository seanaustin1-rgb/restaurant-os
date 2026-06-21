-- Industry template foundation. Existing tenants remain restaurant-shaped.
CREATE TYPE "BusinessType" AS ENUM ('RESTAURANT', 'SERVICE', 'RETAIL');

ALTER TABLE "Restaurant"
  ADD COLUMN "businessType" "BusinessType" NOT NULL DEFAULT 'RESTAURANT';
