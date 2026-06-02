-- Add PAYROLL_CHECK to the TransactionBucket enum. Staff paper paychecks
-- (check numbers >= 10000, the payroll checkbook series) bucket here and roll
-- into the Labor TAP. Additive, non-destructive.
ALTER TYPE "TransactionBucket" ADD VALUE IF NOT EXISTS 'PAYROLL_CHECK';
