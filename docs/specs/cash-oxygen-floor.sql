-- Cash Oxygen Floor reference schema/query.
-- The app currently computes this from the existing Restaurant cash anchor plus
-- categorized Transaction rows. When QuickBooks balance and expense sync becomes
-- first-class, these tables are the persistence shape to feed the same module.

CREATE TABLE cash_balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL,
  source TEXT NOT NULL, -- qbo, plaid, manual
  source_account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  balance NUMERIC(14, 2) NOT NULL,
  is_liquid BOOLEAN NOT NULL DEFAULT TRUE,
  as_of_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE fixed_operating_expense_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL,
  source TEXT NOT NULL, -- qbo, plaid, manual
  source_transaction_id TEXT,
  expense_date DATE NOT NULL,
  vendor_name TEXT,
  account_name TEXT NOT NULL,
  mapped_category TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  is_fixed_burn BOOLEAN NOT NULL DEFAULT TRUE,
  exclude_from_cash_floor BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

WITH latest_liquid_cash AS (
  SELECT DISTINCT ON (business_id, source_account_id)
    business_id,
    source_account_id,
    balance
  FROM cash_balance_snapshots
  WHERE is_liquid = TRUE
  ORDER BY business_id, source_account_id, as_of_date DESC, created_at DESC
),
liquid_cash AS (
  SELECT business_id, SUM(balance) AS total_liquid_cash
  FROM latest_liquid_cash
  GROUP BY business_id
),
fixed_burn AS (
  SELECT
    business_id,
    SUM(amount) AS fixed_burn_90_day_total,
    SUM(amount) / 90.0 AS avg_daily_fixed_burn
  FROM fixed_operating_expense_snapshots
  WHERE expense_date >= CURRENT_DATE - INTERVAL '90 days'
    AND is_fixed_burn = TRUE
    AND exclude_from_cash_floor = FALSE
  GROUP BY business_id
)
SELECT
  c.business_id,
  c.total_liquid_cash,
  f.fixed_burn_90_day_total,
  f.avg_daily_fixed_burn,
  c.total_liquid_cash / NULLIF(f.avg_daily_fixed_burn, 0) AS cash_oxygen_days,
  CASE
    WHEN f.avg_daily_fixed_burn IS NULL OR f.avg_daily_fixed_burn <= 0 THEN 'unknown'
    WHEN c.total_liquid_cash / f.avg_daily_fixed_burn >= 45 THEN 'green'
    WHEN c.total_liquid_cash / f.avg_daily_fixed_burn >= 21 THEN 'yellow'
    ELSE 'red'
  END AS status
FROM liquid_cash c
LEFT JOIN fixed_burn f ON f.business_id = c.business_id;
