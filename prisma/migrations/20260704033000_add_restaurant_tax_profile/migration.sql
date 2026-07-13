-- Adds tenant-owned sales-tax profile configuration for Tax Vault reconciliation.
-- Operator must apply this migration before deploying code that reads Restaurant.taxProfile.
ALTER TABLE "Restaurant" ADD COLUMN "taxProfile" JSONB;
