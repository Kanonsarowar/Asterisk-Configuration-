'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';
import { setStoredUser } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/login', {
        method: 'POST',
        body: { username, password },
        headers: {},
      });
      setToken(data.token);
      setStoredUser(data.user);
      router.replace('/dashboard');
    } catch (err) {
      const hint =
        err?.data?.hint ||
        (err.message?.includes('fetch') || err.message === 'Failed to fetch'
          ? 'Cannot reach API. On a tablet, do not use NEXT_PUBLIC_API_URL=http://127.0.0.1:3010 — leave it unset so requests use /api/platform proxy, or set it to your server public URL.'
          : '');
      setError([err.message || 'Login failed', hint].filter(Boolean).join(' '));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '72px auto', padding: 32 }} className="card">
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em' }}>TELECOM</div>
      <h1 style={{ marginTop: 8, marginBottom: 8 }}>Sign in</h1>
      <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 14 }}>IPRN platform — Fastify API</p>
      <form onSubmit={onSubmit}>
        <label>
          <span className="field-label">Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label style={{ display: 'block', marginTop: 16 }}>
          <span className="field-label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p style={{ color: '#f87171' }}>{error}</p>}
        <button className="btn" type="submit" disabled={loading} style={{ marginTop: 20 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
