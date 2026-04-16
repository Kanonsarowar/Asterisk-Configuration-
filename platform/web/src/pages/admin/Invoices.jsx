import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal from '../../components/shared/Modal';

export default function Invoices() {
  const { data, loading, refetch } = useApi('/api/billing/invoices');
  const [showGen, setShowGen] = useState(false);
  const [form, setForm] = useState({ user_id: '', period_start: '', period_end: '' });

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'user_id', label: 'User ID' },
    { key: 'total_amount', label: 'Amount', render: r => `$${Number(r.total_amount).toFixed(2)}` },
    { key: 'status', label: 'Status', render: r => (
      <span className={`badge ${r.status === 'paid' ? 'badge-green' : r.status === 'issued' ? 'badge-blue' : r.status === 'draft' ? 'badge-yellow' : 'badge-red'}`}>{r.status}</span>
    )},
    { key: 'period_start', label: 'Period', render: r => `${r.period_start?.slice(0,10) || '—'} → ${r.period_end?.slice(0,10) || '—'}` },
    { key: 'created_at', label: 'Created', render: r => new Date(r.created_at).toLocaleDateString() },
  ];

  const handleGen = async (e) => {
    e.preventDefault();
    try {
      await api('/api/billing/invoices', { method: 'POST', body: form });
      setShowGen(false);
      refetch();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Invoices</h2>
        <button className="btn-primary" onClick={() => setShowGen(true)}>+ Generate Invoice</button>
      </div>
      <div className="card">
        <DataTable columns={columns} rows={data?.invoices} loading={loading} />
      </div>
      {showGen && (
        <Modal title="Generate Invoice" onClose={() => setShowGen(false)}>
          <form onSubmit={handleGen}>
            <div className="form-group"><label>User ID</label><input type="number" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} required /></div>
            <div className="form-row">
              <div className="form-group"><label>Period Start</label><input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} required /></div>
              <div className="form-group"><label>Period End</label><input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} required /></div>
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 8 }}>Generate</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
