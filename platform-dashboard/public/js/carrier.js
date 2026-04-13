const params = new URLSearchParams(location.search);
const API_BASE = (params.get('api') || 'http://127.0.0.1:3010').replace(/\/$/, '');

async function jget(path) {
  const r = await fetch(`${API_BASE}${path}`, { credentials: 'omit' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || j?.message || String(r.status));
  if (j && j.success === false) throw new Error(j?.error?.message || 'API error');
  return j;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const el = () => document.getElementById('carrier-content');

async function showLive() {
  const j = await jget('/api/live/calls');
  const rows = (j.data || []).map(
    (r) =>
      `<tr><td>${esc(r.uniqueid || '')}</td><td>${esc(r.did || '')}</td><td>${esc(r.callerid || r.caller || '')}</td>
      <td>${esc(String(r.start_time || ''))}</td><td>${esc(String(r.duration ?? ''))}</td><td>${esc(r.disposition || '')}</td></tr>`
  );
  el().innerHTML = `<h2>Live calls</h2><table class="data"><thead><tr><th>uniqueid</th><th>DID</th><th>CLI</th><th>start</th><th>dur</th><th>disp</th></tr></thead><tbody>${rows.join('') || '<tr><td colspan="6">None</td></tr>'}</tbody></table>`;
}

async function showStats() {
  const j = await jget('/api/stats/summary');
  const d = j.data || {};
  el().innerHTML = `<h2>Stats (${d.windowHours}h)</h2>
    <div class="grid"><div class="card"><div class="lbl">Calls</div><div class="val">${d.calls}</div></div>
    <div class="card"><div class="lbl">ASR %</div><div class="val">${d.asr}</div></div>
    <div class="card"><div class="lbl">ACD sec</div><div class="val">${d.acd}</div></div>
    <div class="card"><div class="lbl">CPS</div><div class="val">${d.cps}</div></div></div>`;
}

async function showFinance() {
  const j = await jget('/api/finance/summary');
  const rows = (j.data || []).map(
    (r) =>
      `<tr><td>${esc(r.currency || '')}</td><td>${Number(r.revenue || 0).toFixed(4)}</td><td>${Number(r.carrier_cost || 0).toFixed(4)}</td><td>${Number(r.profit || 0).toFixed(4)}</td></tr>`
  );
  el().innerHTML = `<h2>Finance (by currency)</h2><table class="data"><thead><tr><th>CCY</th><th>Revenue</th><th>Carrier cost</th><th>Profit</th></tr></thead><tbody>${rows.join('') || '<tr><td colspan="4">No data</td></tr>'}</tbody></table>`;
}

async function showAudio() {
  const did = prompt('DID (digits only)?', '');
  if (!did) return;
  const j = await jget(`/api/did/${encodeURIComponent(did)}/audio`);
  const d = j.data || {};
  el().innerHTML = `<h2>Audio for DID</h2><p><strong>${esc(d.did)}</strong> → <code>${esc(d.audioPath || '')}</code></p><p>${esc(d.label || '')}</p>`;
}

document.getElementById('tab-live').onclick = () => showLive().catch((e) => (el().innerHTML = `<p class="err">${esc(e.message)}</p>`));
document.getElementById('tab-stats').onclick = () => showStats().catch((e) => (el().innerHTML = `<p class="err">${esc(e.message)}</p>`));
document.getElementById('tab-finance').onclick = () => showFinance().catch((e) => (el().innerHTML = `<p class="err">${esc(e.message)}</p>`));
document.getElementById('tab-audio').onclick = () => showAudio().catch((e) => (el().innerHTML = `<p class="err">${esc(e.message)}</p>`));

showLive().catch((e) => (el().innerHTML = `<p class="err">${esc(e.message)}</p>`));
