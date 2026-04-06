/**
 * Open on tablet: http://YOUR_VPS:3001/status
 * Shows whether Next.js (server) can reach the Fastify API — isolates proxy vs browser issues.
 */
export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const internal = process.env.API_INTERNAL_URL || 'http://127.0.0.1:3010';
  let health = { error: 'not requested' };
  let loginProbe = { error: 'not requested' };
  try {
    const r = await fetch(`${internal.replace(/\/$/, '')}/health`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    health = { status: r.status, body: await r.text() };
  } catch (e) {
    health = { error: String(e.message || e) };
  }
  try {
    const r = await fetch(`${internal.replace(/\/$/, '')}/login`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '_probe_', password: '_probe_' }),
      signal: AbortSignal.timeout(8000),
    });
    loginProbe = { status: r.status, body: (await r.text()).slice(0, 200) };
  } catch (e) {
    loginProbe = { error: String(e.message || e) };
  }

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', fontSize: 13, color: '#e2e8f0', background: '#0f172a', minHeight: '100vh' }}>
      <h1 style={{ marginTop: 0 }}>Server-side connectivity</h1>
      <p style={{ color: '#94a3b8' }}>
        If <strong>/login</strong> shows &quot;Failed to fetch&quot; but this page loads, the browser reached Next.js. Check API below.
      </p>
      <p>
        <strong>API_INTERNAL_URL</strong> (Next server → API): <code>{internal}</code>
      </p>
      <h2>GET /health</h2>
      <pre style={{ background: '#1e293b', padding: 12, overflow: 'auto' }}>{JSON.stringify(health, null, 2)}</pre>
      <p style={{ color: '#94a3b8' }}>
        Expect <code>status: 200</code> and <code>database: &quot;up&quot;</code>. If <code>error</code> or connection refused → run{' '}
        <code>pm2 restart iprn-backend</code> and check <code>platform/api/.env</code> MySQL.
      </p>
      <h2>POST /login (probe)</h2>
      <pre style={{ background: '#1e293b', padding: 12, overflow: 'auto' }}>{JSON.stringify(loginProbe, null, 2)}</pre>
      <p style={{ color: '#94a3b8' }}>
        Expect <code>status: 401</code> (invalid user). If error → API not running on 3010.
      </p>
      <p>
        <a href="/login" style={{ color: '#60a5fa' }}>
          ← Back to login
        </a>
      </p>
    </div>
  );
}
