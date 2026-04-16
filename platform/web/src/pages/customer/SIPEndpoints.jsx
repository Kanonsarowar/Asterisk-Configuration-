import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/shared/DataTable';
import Modal from '../../components/shared/Modal';

export default function SIPEndpoints() {
  const { user } = useAuth();
  const { data, loading, refetch } = useApi('/api/sip-endpoints');
  const [showAdd, setShowAdd] = useState(false);
  const [created, setCreated] = useState(null);
  const [form, setForm] = useState({ name: '', codecs: 'g729,alaw,ulaw', max_channels: 2, transport: 'udp', nat: true });

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'username', label: 'SIP Username' },
    { key: 'codecs', label: 'Codecs' },
    { key: 'max_channels', label: 'Max CH' },
    { key: 'transport', label: 'Transport', render: r => r.transport?.toUpperCase() },
    { key: 'status', label: 'Status', render: r => <span className={`badge ${r.status === 'active' ? 'badge-green' : 'badge-red'}`}>{r.status}</span> },
    { key: 'last_registered', label: 'Last Registered', render: r => r.last_registered ? new Date(r.last_registered).toLocaleString() : '—' },
  ];

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const res = await api('/api/sip-endpoints', {
        method: 'POST',
        body: { ...form, customer_id: user.customerId },
      });
      setCreated(res);
      refetch();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <h2>SIP Endpoints</h2>
        <button className="btn-primary" onClick={() => { setShowAdd(true); setCreated(null); }}>+ New Endpoint</button>
      </div>
      <div className="card">
        <DataTable columns={columns} rows={data?.endpoints} loading={loading} empty="No SIP endpoints configured" />
      </div>
      {showAdd && (
        <Modal title={created ? 'Endpoint Created' : 'New SIP Endpoint'} onClose={() => setShowAdd(false)}>
          {created ? (
            <div>
              <div className="card" style={{ background: 'rgba(34,197,94,.08)', border: '1px solid var(--success)', marginBottom: 16 }}>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>SIP Credentials (save these now):</p>
                <div className="form-group"><label>Username</label><input readOnly value={created.username} /></div>
                <div className="form-group"><label>Password</label><input readOnly value={created.password} /></div>
              </div>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => setShowAdd(false)}>Done</button>
            </div>
          ) : (
            <form onSubmit={handleAdd}>
              <div className="form-group"><label>Endpoint Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Office PBX" /></div>
              <div className="form-row">
                <div className="form-group"><label>Codecs</label><input value={form.codecs} onChange={e => setForm(f => ({ ...f, codecs: e.target.value }))} /></div>
                <div className="form-group"><label>Max Channels</label><input type="number" value={form.max_channels} onChange={e => setForm(f => ({ ...f, max_channels: parseInt(e.target.value) }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Transport</label>
                  <select value={form.transport} onChange={e => setForm(f => ({ ...f, transport: e.target.value }))}>
                    <option value="udp">UDP</option><option value="tcp">TCP</option><option value="tls">TLS</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>NAT</label>
                  <select value={form.nat ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, nat: e.target.value === 'yes' }))}>
                    <option value="yes">Yes</option><option value="no">No</option>
                  </select>
                </div>
              </div>
              <button className="btn-primary" style={{ width: '100%', marginTop: 8 }}>Create Endpoint</button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
