import { query } from '../database/index.js';

export async function insertLiveCall({ uniqueid, channel, src, dst, did_number, provider_id, client_id, state = 'ringing' }) {
  try {
    await query(
      `INSERT INTO live_calls (uniqueid, channel, src, dst, did_number, provider_id, client_id, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE channel = VALUES(channel), state = VALUES(state)`,
      [uniqueid, channel, src, dst, did_number, provider_id, client_id, state]
    );
  } catch (e) {
    console.error('live_call insert failed:', e.message);
  }
}

export async function updateLiveCallState(uniqueid, state) {
  const updates = [`state = ?`];
  const params = [state];
  if (state === 'answered') {
    updates.push('answered_at = NOW(3)');
  }
  params.push(uniqueid);
  await query(`UPDATE live_calls SET ${updates.join(', ')} WHERE uniqueid = ?`, params);
}

export async function removeLiveCall(uniqueid) {
  await query('DELETE FROM live_calls WHERE uniqueid = ?', [uniqueid]);
}

export async function cleanStaleLiveCalls(maxAgeMinutes = 180) {
  await query('DELETE FROM live_calls WHERE started_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)', [maxAgeMinutes]);
}

export async function getLiveCalls(clientId = null) {
  let sql = 'SELECT lc.*, p.name AS provider_name FROM live_calls lc LEFT JOIN providers p ON p.id = lc.provider_id';
  const params = [];
  if (clientId) { sql += ' WHERE lc.client_id = ?'; params.push(clientId); }
  sql += ' ORDER BY lc.started_at DESC';
  const { rows } = await query(sql, params);
  return rows;
}

export async function getLiveCallCount() {
  const { rows } = await query('SELECT COUNT(*) AS cnt FROM live_calls');
  return rows[0]?.cnt || 0;
}

export async function insertCdr(data) {
  const { insertId } = await query(
    `INSERT INTO cdr (uniqueid, call_id, src, dst, did_number, provider_id, client_id,
      sip_account_id, start_time, answer_time, end_time, duration, disposition,
      hangup_cause, rate_per_min, connection_fee, matched_prefix, carrier_ip, sip_code, recording_file)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.uniqueid, data.call_id || data.uniqueid, data.src, data.dst,
      data.did_number || null, data.provider_id || null, data.client_id || null,
      data.sip_account_id || null, data.start_time || null, data.answer_time || null,
      data.end_time || null, data.duration || 0, data.disposition || 'FAILED',
      data.hangup_cause || null, data.rate_per_min || 0, data.connection_fee || 0,
      data.matched_prefix || null, data.carrier_ip || null, data.sip_code || null,
      data.recording_file || null,
    ]
  );
  return insertId;
}
