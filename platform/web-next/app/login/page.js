'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

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
      localStorage.setItem('iprn_user', JSON.stringify(data.user));
      router.replace('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 24 }} className="card">
      <h1 style={{ marginTop: 0 }}>IPRN Dashboard</h1>
      <form onSubmit={onSubmit}>
        <label>
          <div style={{ marginBottom: 6, color: 'var(--muted)' }}>Username</div>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label style={{ display: 'block', marginTop: 16 }}>
          <div style={{ marginBottom: 6, color: 'var(--muted)' }}>Password</div>
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
