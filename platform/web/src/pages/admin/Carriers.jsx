import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal from '../../components/shared/Modal';

export default function Carriers() {
  const { data, loading, refetch } = useApi('/api/providers');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', host: '', port: 5060, transport: 'udp', auth_type: 'ip', codecs: 'g729,alaw,ulaw', max_channels: 0, cps_limit: 0, cost_per_minute: 0, connection_fee: 0 });

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'host', label: 'Host' },
    { key: 'port', label: 'Port' },
    { key: 'transport', label: 'Transport', render: r => r.transport?.toUpperCase() },
    { key: 'auth_type', label: 'Auth' },
    { key: 'max_channels', label: 'Max CH', render: r => r.max_channels || '∞' },
    { key: 'cps_limit', label: 'CPS', render: r => r.cps_limit || '∞' },
    { key: 'cost_per_minute', label: 'Cost/min', render: r => `$${Number(r.cost_per_minute).toFixed(4)}` },
    { key: 'status', label: 'Status', render: r => <span className={`badge ${r.status === 'active' ? 'badge-green' : 'badge-red'}`}>{r.status}</span> },
  ];

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api('/api/providers', { method: 'POST', body: form });
      setShowAdd(false);
      refetch();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Carriers</h2>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Carrier</button>
      </div>
      <div className="card">
        <DataTable columns={columns} rows={data?.providers} loading={loading} />
      </div>
      {showAdd && (
        <Modal title="Add Carrier" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd}>
            <div className="form-row">
              <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div className="form-group"><label>Host IP</label><input value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Port</label><input type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: parseInt(e.target.value) }))} /></div>
              <div className="form-group"><label>Transport</label><select value={form.transport} onChange={e => setForm(f => ({ ...f, transport: e.target.value }))}><option value="udp">UDP</option><option value="tcp">TCP</option><option value="tls">TLS</option></select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Auth Type</label><select value={form.auth_type} onChange={e => setForm(f => ({ ...f, auth_type: e.target.value }))}><option value="ip">IP</option><option value="registration">Registration</option><option value="both">Both</option></select></div>
              <div className="form-group"><label>Codecs</label><input value={form.codecs} onChange={e => setForm(f => ({ ...f, codecs: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Max Channels (0=unlimited)</label><input type="number" value={form.max_channels} onChange={e => setForm(f => ({ ...f, max_channels: parseInt(e.target.value) }))} /></div>
              <div className="form-group"><label>CPS Limit (0=unlimited)</label><input type="number" value={form.cps_limit} onChange={e => setForm(f => ({ ...f, cps_limit: parseInt(e.target.value) }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Cost/Minute</label><input type="number" step="0.0001" value={form.cost_per_minute} onChange={e => setForm(f => ({ ...f, cost_per_minute: e.target.value }))} /></div>
              <div className="form-group"><label>Connection Fee</label><input type="number" step="0.0001" value={form.connection_fee} onChange={e => setForm(f => ({ ...f, connection_fee: e.target.value }))} /></div>
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 8 }}>Create Carrier</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
