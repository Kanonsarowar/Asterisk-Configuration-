-- Extend fraud + billing JSON for routing engine (MySQL 8+)
UPDATE system_settings
SET svalue = JSON_MERGE_PATCH(
  COALESCE(svalue, JSON_OBJECT()),
  JSON_OBJECT(
    'max_calls_per_user_per_minute', 120,
    'max_unique_destinations_per_user_per_minute', 40,
    'block_empty_cli', TRUE,
    'cli_min_digits', 6,
    'cli_blocked_regexes', JSON_ARRAY('^0{6,}$', '^1{6,}$'),
    'block_repeated_digit_cli', TRUE,
    'strict_cli_on_premium', TRUE,
    'premium_cli_extra_regexes', JSON_ARRAY()
  )
)
WHERE skey = 'fraud';

UPDATE system_settings
SET svalue = JSON_MERGE_PATCH(
  COALESCE(svalue, JSON_OBJECT()),
  JSON_OBJECT(
    'lcr_tie_break', 'priority_then_supplier_id'
  )
)
WHERE skey = 'billing';
