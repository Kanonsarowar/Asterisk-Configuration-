-- Richer real-time call rows for AMI monitor
ALTER TABLE live_calls
  ADD COLUMN linkedid VARCHAR(128) NULL DEFAULT NULL AFTER uniqueid,
  ADD COLUMN direction ENUM('inbound','outbound','unknown') NOT NULL DEFAULT 'unknown' AFTER destination,
  ADD COLUMN state VARCHAR(64) NULL DEFAULT NULL AFTER direction,
  ADD COLUMN dialplan_context VARCHAR(256) NULL DEFAULT NULL AFTER channel,
  ADD COLUMN exten VARCHAR(64) NULL DEFAULT NULL AFTER dialplan_context,
  ADD COLUMN accountcode VARCHAR(64) NULL DEFAULT NULL AFTER exten,
  ADD KEY idx_live_linkedid (linkedid);
