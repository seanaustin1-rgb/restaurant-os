-- Profit First: Debt Service is paid from Profit distributions, not OpEx.
-- Add a PROFIT rollup so the "Debt Service" category can target it.
-- Additive + idempotent; safe to apply to the live DB.
ALTER TYPE "TapBucket" ADD VALUE IF NOT EXISTS 'PROFIT';
