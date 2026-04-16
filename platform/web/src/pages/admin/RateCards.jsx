import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal from '../../components/shared/Modal';

export default function RateCards() {
  const { data, loading, refetch } = useApi('/api/rate-cards');
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [form, setForm] = useState({ name: '', card_type: 'sell', effective_date: new Date().toISOString().slice(0, 10), status: 'draft' });

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'card_type', label: 'Type', render: r => <span className={`badge ${r.card_type === 'sell' ? 'badge-green' : 'badge-blue'}`}>{r.card_type}</span> },
    { key: 'effective_date', label: 'Effective', render: r => r.effective_date?.slice(0, 10) },
    { key: 'status', label: 'Status', render: r => <span className={`badge ${r.status === 'active' ? 'badge-green' : r.status === 'draft' ? 'badge-yellow' : 'badge-red'}`}>{r.status}</span> },
    { key: 'created_by_name', label: 'Created By' },
    { key: 'actions', label: '', render: r => <button className="btn-outline btn-sm" onClick={() => loadDetail(r.id)}>View</button> },
  ];

  const loadDetail = async (id) => {
    const d = await api(`/api/rate-cards/${id}`);
    setShowDetail(d);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api('/api/rate-cards', { method: 'POST', body: form });
      setShowAdd(false);
      refetch();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Rate Cards</h2>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ New Rate Card</button>
      </div>
      <div className="card">
        <DataTable columns={columns} rows={data?.rate_cards} loading={loading} />
      </div>
      {showAdd && (
        <Modal title="New Rate Card" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd}>
            <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div className="form-row">
              <div className="form-group"><label>Type</label><select value={form.card_type} onChange={e => setForm(f => ({ ...f, card_type: e.target.value }))}><option value="sell">Sell</option><option value="buy">Buy</option></select></div>
              <div className="form-group"><label>Effective Date</label><input type="date" value={form.effective_date} onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} required /></div>
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 8 }}>Create Rate Card</button>
          </form>
        </Modal>
      )}
      {showDetail && (
        <Modal title={`Rate Card: ${showDetail.name}`} onClose={() => setShowDetail(null)}>
          <div style={{ fontSize: 13, marginBottom: 12, color: 'var(--text-muted)' }}>Type: {showDetail.card_type} | Status: {showDetail.status}</div>
          {showDetail.entries?.length > 0 ? (
            <table>
              <thead><tr><th>Prefix</th><th>Destination</th><th>Rate/min</th><th>Conn Fee</th><th>Min Dur</th><th>Increment</th></tr></thead>
              <tbody>
                {showDetail.entries.map(e => (
                  <tr key={e.id}><td>{e.prefix}</td><td>{e.destination}</td><td>${Number(e.rate_per_minute).toFixed(4)}</td><td>${Number(e.connection_fee).toFixed(4)}</td><td>{e.min_duration}s</td><td>{e.increment}s</td></tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty">No rate entries yet.</div>}
        </Modal>
      )}
    </div>
  );
}
