-- Add REVENUE to the TransactionBucket enum so bank deposits (sales inflows)
-- can be tagged as revenue on statement import. Additive, non-destructive.
ALTER TYPE "TransactionBucket" ADD VALUE IF NOT EXISTS 'REVENUE';
