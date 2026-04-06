-- =============================================================================
-- IPRN Telecom Platform — Sample Seed Data
-- Database: iprn_platform
-- Apply:    mysql -u root iprn_platform < 002_seed_data.sql
-- =============================================================================

USE `iprn_platform`;

-- ---------------------------------------------------------------------------
-- Users (password hashes are placeholders — replace with real bcrypt hashes)
-- ---------------------------------------------------------------------------
INSERT INTO `users` (`username`, `password_hash`, `role`, `balance`, `status`) VALUES
  ('admin',     '$2b$12$placeholder_admin_hash_value_here000000000000000', 'admin',    0,        'active'),
  ('reseller1', '$2b$12$placeholder_reseller_hash_value_here00000000000', 'reseller', 5000.00,  'active'),
  ('user1',     '$2b$12$placeholder_user1_hash_value_here0000000000000',  'user',     1250.50,  'active'),
  ('user2',     '$2b$12$placeholder_user2_hash_value_here0000000000000',  'user',     800.00,   'active');

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
INSERT INTO `customers` (`name`, `company`, `contact_info`, `user_id`) VALUES
  ('Alpha Telecom',  'Alpha Telecom Ltd',  '{"email":"alpha@example.com","phone":"+442071234567"}', 3),
  ('Beta Comms',     'Beta Comms GmbH',    '{"email":"beta@example.com","phone":"+4930123456"}',    4);

-- ---------------------------------------------------------------------------
-- Suppliers (IP-authenticated SIP trunks)
-- ---------------------------------------------------------------------------
INSERT INTO `suppliers` (`name`, `host`, `port`, `protocol`, `codecs`, `cost_per_min`, `active`) VALUES
  ('Vultr',     '108.61.70.46',    5060, 'pjsip', 'g729,alaw,ulaw', 0.015,  1),
  ('Hetzner',   '157.90.193.196',  5060, 'pjsip', 'g729,alaw,ulaw', 0.012,  1),
  ('OVH',       '51.77.77.223',    5060, 'pjsip', 'alaw,ulaw',      0.018,  1),
  ('AWS',       '52.28.165.40',    5060, 'pjsip', 'g729,alaw,ulaw', 0.020,  1),
  ('Contabo',   '149.12.160.10',   5060, 'pjsip', 'g729,alaw',      0.010,  1);

-- ---------------------------------------------------------------------------
-- Numbers (DID / premium number ranges)
-- ---------------------------------------------------------------------------
INSERT INTO `numbers` (`prefix`, `range_start`, `range_end`, `country`, `supplier_id`, `customer_id`, `rate_per_min`, `type`, `status`) VALUES
  ('4420',   '71234500', '71234599', 'GB', 1, 1,  0.50, 'premium',     'assigned'),
  ('4420',   '71234600', '71234699', 'GB', 2, NULL, 0.45, 'premium',     'available'),
  ('4930',   '1234500',  '1234599',  'DE', 2, 2,  0.35, 'premium',     'assigned'),
  ('393',    '199030200','199030299','IT', 3, NULL, 0.40, 'premium',     'available'),
  ('1202',   '5551000',  '5551099',  'US', 4, NULL, 0.25, 'non-premium', 'available'),
  ('77',     '0100000',  '0199999',  'KZ', 5, NULL, 0.60, 'premium',     'available');

-- ---------------------------------------------------------------------------
-- Routes (prefix-based with multi-supplier failover)
-- ---------------------------------------------------------------------------
INSERT INTO `routes` (`prefix`, `supplier_id`, `priority`, `rate`, `active`) VALUES
  ('4420',   1,  10,  0.015,  1),   -- UK London: Vultr primary
  ('4420',   2,  20,  0.012,  1),   -- UK London: Hetzner fallback
  ('4930',   2,  10,  0.012,  1),   -- DE Berlin: Hetzner primary
  ('4930',   3,  20,  0.018,  1),   -- DE Berlin: OVH fallback
  ('393',    3,  10,  0.018,  1),   -- IT Mobile: OVH primary
  ('393',    1,  20,  0.015,  1),   -- IT Mobile: Vultr fallback
  ('1202',   4,  10,  0.020,  1),   -- US DC: AWS primary
  ('1202',   1,  20,  0.015,  1),   -- US DC: Vultr fallback
  ('77',     5,  10,  0.010,  1),   -- KZ: Contabo primary
  ('77',     2,  20,  0.012,  1),   -- KZ: Hetzner fallback
  ('1',      4,  50,  0.020,  1),   -- US catch-all
  ('44',     1,  50,  0.015,  1),   -- UK catch-all
  ('49',     2,  50,  0.012,  1),   -- DE catch-all
  ('39',     3,  50,  0.018,  1);   -- IT catch-all
