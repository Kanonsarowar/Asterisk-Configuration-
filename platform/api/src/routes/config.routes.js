import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';
import {
  runConfigSync,
  applySnapshotFromVersion,
} from '../services/configSyncService.js';

export default async function configRoutes(fastify) {
  fastify.post('/config/sync', async (req, reply) => {
    const keyOk = req.headers['x-internal-key'] === process.env.INTERNAL_API_KEY;
    if (!keyOk && req.userCtx?.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const actorId = req.userCtx?.id ?? null;
    try {
      const out = await runConfigSync({
        actorId,
        triggerSource: 'manual',
        recordVersion: true,
        reload: req.body?.reload !== false && process.env.CONFIG_SYNC_RELOAD !== '0',
      });
      await auditLog('config_sync', actorId, { tag: out.version_tag });
      return out;
    } catch (e) {
      if (e.code === 'ASTERISK_UNREACHABLE') {
        return reply.code(503).send({ error: e.message, code: e.code });
      }
      throw e;
    }
  });

  fastify.get('/config/versions', {
    preHandler: [requireRoles('admin')],
  }, async () => {
    const r = await query(
      `SELECT id, version_tag, trigger_source, checksum, created_at, applied_at,
              (snapshot_json IS NOT NULL AND LENGTH(snapshot_json) > 0) AS has_snapshot
       FROM config_versions ORDER BY id DESC LIMIT 100`
    );
    return { versions: r.rows };
  });

  fastify.get('/config/versions/:id', {
    preHandler: [requireRoles('admin')],
  }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const v = await query(
      `SELECT id, version_tag, trigger_source, checksum, created_at, applied_at,
              (snapshot_json IS NOT NULL) AS has_snapshot
       FROM config_versions WHERE id = ?`,
      [id]
    );
    if (!v.rows[0]) return reply.code(404).send({ error: 'Not found' });
    return v.rows[0];
  });

  fastify.post('/config/rollback/:id', {
    preHandler: [requireRoles('admin')],
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const id = parseInt(req.params.id, 10);
    const v = await query('SELECT * FROM config_versions WHERE id = ?', [id]);
    if (!v.rows[0]) return reply.code(404).send({ error: 'Not found' });
    if (!v.rows[0].snapshot_json) {
      return reply.code(409).send({
        error: 'No snapshot for this version',
        hint: 'Apply sql/008_config_sync_outbox.sql and run a new sync to populate snapshots',
      });
    }
    try {
      const { checksum, matches } = await applySnapshotFromVersion(v.rows[0], {
        reload: req.body?.reload !== false && process.env.CONFIG_SYNC_RELOAD !== '0',
      });
      const tag = `rollback-from-${id}-${Date.now()}`;
      const snapStored =
        typeof v.rows[0].snapshot_json === 'string'
          ? v.rows[0].snapshot_json
          : JSON.stringify(v.rows[0].snapshot_json);
      await query(
        `INSERT INTO config_versions (version_tag, trigger_source, files_json, snapshot_json, checksum, created_by, applied_at)
         VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
        [
          tag,
          `rollback:${id}`,
          JSON.stringify(['pjsipBody', 'extBody', 'pjsipConf', 'extensionsConf']),
          snapStored,
          checksum,
          ctx.id,
        ]
      );
      await auditLog('config_rollback', ctx.id, { fromVersionId: id, tag });
      return { ok: true, version_tag: tag, checksum, checksum_match: matches };
    } catch (e) {
      if (e.code === 'ASTERISK_UNREACHABLE') {
        return reply.code(503).send({ error: e.message, code: e.code });
      }
      throw e;
    }
  });
}
