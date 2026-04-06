-- Multi-currency + rate audit on CDR; invoice currency + JSON summary
ALTER TABLE users
  ADD COLUMN billing_currency CHAR(3) NOT NULL DEFAULT 'USD' AFTER balance,
  ADD KEY idx_users_currency (billing_currency);

ALTER TABLE cdr
  ADD COLUMN billing_currency CHAR(3) NULL DEFAULT NULL AFTER profit,
  ADD COLUMN user_rate_per_min DECIMAL(18,6) NULL DEFAULT NULL AFTER billing_currency,
  ADD COLUMN supplier_rate_per_min DECIMAL(18,6) NULL DEFAULT NULL AFTER user_rate_per_min;

ALTER TABLE invoices
  ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'USD' AFTER total_amount,
  ADD COLUMN summary_json JSON NULL AFTER period_end;
