import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { createHash } from 'crypto';
import { generateAsteriskConfigs, reloadAsterisk } from '../services/configGenerator.js';
import { auditLog } from '../lib/audit.js';

export default async function configRoutes(fastify) {
  fastify.post('/config/sync', async (req, reply) => {
    const keyOk = req.headers['x-internal-key'] === process.env.INTERNAL_API_KEY;
    if (!keyOk && req.userCtx?.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const actorId = req.userCtx?.id ?? null;
    const { files, checksum } = await generateAsteriskConfigs();
    const tag = `v-${Date.now()}`;
    await query(
      `INSERT INTO config_versions (version_tag, files_json, checksum, created_by, applied_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
      [tag, JSON.stringify(Object.keys(files)), checksum, actorId]
    );
    await reloadAsterisk();
    await auditLog('config_sync', actorId, { tag });
    return { ok: true, version_tag: tag, checksum };
  });

  fastify.get('/config/versions', {
    preHandler: [requireRoles('admin')],
  }, async () => {
    const r = await query(
      'SELECT id, version_tag, checksum, created_at, applied_at FROM config_versions ORDER BY id DESC LIMIT 50'
    );
    return { versions: r.rows };
  });

  fastify.post('/config/rollback/:id', {
    preHandler: [requireRoles('admin')],
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const id = parseInt(req.params.id, 10);
    const v = await query('SELECT * FROM config_versions WHERE id = ?', [id]);
    if (!v.rows[0]) return reply.code(404).send({ error: 'Not found' });
    const { files, checksum } = await generateAsteriskConfigs();
    const curSum = createHash('sha256').update(JSON.stringify(files)).digest('hex');
    if (curSum === v.rows[0].checksum) {
      await reloadAsterisk();
      await auditLog('config_rollback_noop', ctx.id, { id });
      return { ok: true, note: 'Regenerated config matches snapshot checksum; reloaded only' };
    }
    return reply.code(409).send({
      error: 'Rollback requires stored file bodies; use version control / backup of /etc/asterisk',
      hint: 'Implement object storage for files_json content in production',
    });
  });
}
