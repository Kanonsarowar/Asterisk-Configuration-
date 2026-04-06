-- Idempotent CDR billing: prevents double application of finalizeCdrFinancials (balance debit).
ALTER TABLE cdr
  ADD COLUMN financials_applied_at DATETIME(3) NULL DEFAULT NULL AFTER profit,
  ADD KEY idx_cdr_financials_pending (financials_applied_at, created_at);
