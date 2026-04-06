'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function LivePage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  async function tick() {
    try {
      const data = await api('/api/live/calls');
      setRows(data.calls || []);
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Live calls</h1>
      <p style={{ color: 'var(--muted)' }}>Refreshes every 5s (requires AMI listener).</p>
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Uniqueid</th>
              <th>CLI</th>
              <th>Destination</th>
              <th>Started</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.uniqueid}</td>
                <td>{c.cli}</td>
                <td>{c.destination}</td>
                <td>{c.started_at}</td>
                <td>{c.last_seen_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
