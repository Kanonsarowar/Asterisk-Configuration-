/**
 * Gulf Premium Telecom — full phase architecture (canonical source).
 * Used by GET /api/system/phase-architecture and drives the Roadmap UI.
 * Version bump when phases change.
 */
export const PHASE_ARCHITECTURE_VERSION = '1.1.0';

/** @typedef {{ id: string, code: string, purpose: string, includes: string[], outputs: string[], stackMapping: string }} PhaseDef */

/** @type {PhaseDef[]} */
export const PHASE_ARCHITECTURE = [
  {
    id: 'PHASE 1',
    code: 'CORE_INFRASTRUCTURE_SETUP',
    purpose: 'Base system + telecom engine',
    includes: ['VPS setup', 'Asterisk installation (PJSIP)', 'MySQL installation', 'Node.js environment'],
    outputs: ['Running Asterisk CLI', 'Test call working'],
    stackMapping:
      'deploy.sh, check-setup.sh, /opt/asterisk-dashboard, dashboard/.env (MYSQL_*), systemd asterisk-dashboard.',
  },
  {
    id: 'PHASE 2',
    code: 'DATABASE_ARCHITECTURE',
    purpose: 'Business backbone',
    includes: ['Users', 'Suppliers', 'Numbers (DID ranges)', 'Routes (prefix logic)', 'CDR', 'Billing tables'],
    outputs: ['Optimized MySQL schema', 'Indexed prefix search'],
    stackMapping:
      'iprn_system: numbers, number_inventory, call_billing, iprn_users, user_numbers; dashboard/lib/mysql.js.',
  },
  {
    id: 'PHASE 3',
    code: 'BACKEND_API_LAYER',
    purpose: 'System control layer',
    includes: ['Fastify API', 'Auth (JWT)', 'CRUD: Users, Suppliers, Numbers, Routes'],
    outputs: ['Fully functional REST API'],
    stackMapping:
      'dashboard/server.js (HTTP API + session auth). Optional: platform/api (Fastify + JWT). Extend with /api/v2 + JWT as needed.',
  },
  {
    id: 'PHASE 4',
    code: 'ASTERISK_CONFIG_ENGINE',
    purpose: 'Dynamic telecom routing engine',
    includes: ['pjsip.conf generator', 'extensions.conf generator', 'DB → config sync'],
    outputs: ['Auto-generated routing', 'No manual config edits'],
    stackMapping:
      'dashboard/lib/config-generator.js, Apply & Reload Asterisk, Config Preview, ASTERISK_CONF_DIR.',
  },
  {
    id: 'PHASE 5',
    code: 'CDR_COLLECTION_ENGINE',
    purpose: 'Call tracking system',
    includes: ['Asterisk CDR integration', 'AMI/ARI listener', 'Real-time call logging'],
    outputs: ['Accurate call records stored in DB'],
    stackMapping:
      'CDR + Call Stats + SIP Log; lib/cdr.js, call_billing ingest. AMI/ARI daemon optional add-on.',
  },
  {
    id: 'PHASE 6',
    code: 'BILLING_AND_RATING_ENGINE',
    purpose: 'Revenue engine',
    includes: [
      'Rate lookup (prefix-based)',
      'Billing logic: min duration, rounding, balance deduction, profit calculation',
    ],
    outputs: ['Per-call cost + profit tracking'],
    stackMapping:
      'Balance, IPRN clients, number_inventory.rate_per_min, call_billing, tenant balance rules.',
  },
  {
    id: 'PHASE 7',
    code: 'FRONTEND_DASHBOARD',
    purpose: 'Operator + client interface',
    includes: ['Admin panel', 'User panel', 'Live calls', 'CDR table', 'Balance & invoices'],
    outputs: ['Full Next.js dashboard (spec target)'],
    stackMapping:
      'This repo: Node dashboard (public/ + app.js). Next.js is a parallel target; map features incrementally.',
  },
  {
    id: 'PHASE 8',
    code: 'ROUTING_INTELLIGENCE_ENGINE',
    purpose: 'Smart routing (operator level)',
    includes: ['Failover routing', 'Least Cost Routing (LCR)', 'Multi-supplier priority logic'],
    outputs: ['Optimized call routing'],
    stackMapping:
      'Suppliers + trunk + ODBC dialplan when enabled. LCR/failover: extend config-generator + Asterisk.',
  },
  {
    id: 'PHASE 9',
    code: 'FRAUD_PROTECTION_SYSTEM',
    purpose: 'Protect revenue',
    includes: ['CPS limits', 'CLI validation', 'Short call detection', 'Country restrictions'],
    outputs: ['Fraud-resistant system'],
    stackMapping:
      'ACL + dialplan rules; extend with Asterisk realtime / firewall integration.',
  },
  {
    id: 'PHASE 10',
    code: 'AUTO_SYNC_AND_DEPLOYMENT',
    purpose: 'Live system updates',
    includes: ['DB-triggered config regeneration', 'Asterisk safe reload', 'Partial update scripts'],
    outputs: ['No full system restart needed'],
    stackMapping:
      'Apply & Reload (reload modules). DB triggers for regen: optional future cron/listener.',
  },
  {
    id: 'PHASE 11',
    code: 'BACKUP_AND_RECOVERY_SYSTEM',
    purpose: 'Data protection',
    includes: ['Daily MySQL backup', 'Config backup', 'Auto cleanup (7 days retention)', 'Restore script'],
    outputs: ['Disaster recovery ready'],
    stackMapping:
      'deploy.sh config backup; document mysqldump + /etc/asterisk in cron; restore runbook in README.',
  },
  {
    id: 'PHASE 12',
    code: 'TESTING_AND_SIMULATION',
    purpose: 'System validation',
    includes: ['Call simulator', 'Prefix tester', 'Routing validator'],
    outputs: ['Verified routing + billing accuracy'],
    stackMapping: 'DID Test page, check-setup.sh; expand simulators as separate tools.',
  },
  {
    id: 'PHASE 13',
    code: 'MONITORING_AND_ANALYTICS',
    purpose: 'Business visibility',
    includes: ['ASR / ACD metrics', 'Revenue per country', 'Profit per supplier', 'Live traffic stats'],
    outputs: ['Operator insights dashboard'],
    stackMapping: 'Dashboard + Call Stats; extend MySQL aggregates and reporting APIs.',
  },
];
