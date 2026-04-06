import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function uploadDir() {
  const d = process.env.IVR_UPLOAD_DIR || join(__dirname, '../../uploads/ivr');
  await mkdir(d, { recursive: true });
  return d;
}

export default async function ivrRoutes(fastify) {
  fastify.get('/ivr', async () => {
    const r = await query('SELECT id, name, audio_file, language, created_at FROM ivr ORDER BY name');
    return { ivr: r.rows };
  });

  fastify.post('/ivr/upload', {
    preHandler: [requireRoles('admin', 'reseller')],
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const name = String(req.query?.name || 'IVR').slice(0, 255);
    const language = String(req.query?.language || 'en').slice(0, 16);
    const mp = await req.file();
    if (!mp) return reply.code(400).send({ error: 'file field required' });
    const buf = await mp.toBuffer();
    const dir = await uploadDir();
    const safeName = String(mp.filename || 'prompt.wav').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = join(dir, `${Date.now()}_${safeName}`);
    await writeFile(path, buf);
    const ins = await query(
      `INSERT INTO ivr (name, audio_file, language) VALUES (?, ?, ?)`,
      [String(name).slice(0, 255), path, String(language).slice(0, 16)]
    );
    const id = ins.insertId;
    const r = await query('SELECT * FROM ivr WHERE id = ?', [id]);
    await auditLog('ivr_upload', ctx.id, { id });
    return r.rows[0];
  });

  fastify.put('/ivr/:id', {
    preHandler: [requireRoles('admin', 'reseller')],
  }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const { name, language } = req.body || {};
    await query(`UPDATE ivr SET name = COALESCE(?, name), language = COALESCE(?, language) WHERE id = ?`, [
      name ? String(name).slice(0, 255) : null,
      language ? String(language).slice(0, 16) : null,
      id,
    ]);
    const r = await query('SELECT * FROM ivr WHERE id = ?', [id]);
    if (!r.rows[0]) return reply.code(404).send({ error: 'Not found' });
    return r.rows[0];
  });
}
