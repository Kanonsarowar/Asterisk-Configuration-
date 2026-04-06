-- Prevent duplicate CDR rows when both ODBC and AMI write the same call (same Asterisk uniqueid).
-- MySQL allows multiple NULLs in a UNIQUE index; avoid storing '' as uniqueid from ingest.
-- If this fails, dedupe first: DELETE duplicates keeping MIN(id) per non-null uniqueid.
ALTER TABLE cdr
  ADD UNIQUE KEY uq_cdr_uniqueid (uniqueid);
