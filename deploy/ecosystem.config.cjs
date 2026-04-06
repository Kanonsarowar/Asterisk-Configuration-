/**
 * PM2 process file — Gulf-Premium-Telecom / IPRN stack
 *
 * Install: npm i -g pm2
 * From repo root:
 *   cd platform/api && cp .env.example .env  # configure first
 *   cd ../../platform/web-next && npm run build
 *   cd ../.. && pm2 start deploy/ecosystem.config.cjs
 *   pm2 save && pm2 startup
 *
 * Paths assume repo cloned to /telecom-system or adjust cwd below.
 */
const path = require('path');
const root = path.resolve(__dirname, '..');
const apiDir = path.join(root, 'platform', 'api');
const webDir = path.join(root, 'platform', 'web-next');
module.exports = {
  apps: [
    // Do NOT run a second app named iprn-api on the same PORT — use only iprn-backend for Fastify.
    {
      name: 'iprn-backend',
      cwd: apiDir,
      script: 'src/server.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'iprn-ami',
      cwd: apiDir,
      script: 'scripts/ami-listener.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'iprn-billing',
      cwd: apiDir,
      script: 'scripts/finalize-cdr-loop.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'iprn-config-sync',
      cwd: apiDir,
      script: 'scripts/config-sync-loop.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: 'production' },
      // Enable only if CONFIG_SYNC_OUTBOX_POLL=0 on backend (avoid double-processing)
    },
    // Optional — only if you use asterisk-mysql-generator instead of API configGenerator.
    // Uncomment or: pm2 start deploy/ecosystem.generator.cjs
    // {
    //   name: 'iprn-generator',
    //   cwd: genDir,
    //   script: 'src/cli.js',
    //   args: 'watch',
    //   interpreter: 'node',
    //   instances: 1,
    //   autorestart: true,
    //   env: { NODE_ENV: 'production' },
    // },
    {
      name: 'iprn-web',
      cwd: webDir,
      script: 'npm',
      args: 'run start',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        // Next.js proxies /api/platform/* → Fastify (tablet-safe; omit NEXT_PUBLIC_API_URL)
        API_INTERNAL_URL: 'http://127.0.0.1:3010',
      },
    },
  ],
};
