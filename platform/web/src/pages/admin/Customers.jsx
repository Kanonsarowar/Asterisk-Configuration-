import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal from '../../components/shared/Modal';

export default function Customers() {
  const { data, loading, refetch } = useApi('/api/clients');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', status: 'active' });
  const [saving, setSaving] = useState(false);

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'company_name', label: 'Company' },
    { key: 'contact_name', label: 'Contact' },
    { key: 'billing_type', label: 'Billing', render: r => <span className={`badge ${r.billing_type === 'prepaid' ? 'badge-yellow' : 'badge-blue'}`}>{r.billing_type}</span> },
    { key: 'balance', label: 'Balance', render: r => `$${Number(r.balance).toFixed(2)}` },
    { key: 'status', label: 'Status', render: r => <span className={`badge ${r.status === 'active' ? 'badge-green' : 'badge-red'}`}>{r.status}</span> },
    { key: 'created_at', label: 'Created', render: r => new Date(r.created_at).toLocaleDateString() },
  ];

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/api/clients', { method: 'POST', body: form });
      setShowAdd(false);
      setForm({ name: '', company: '', status: 'active' });
      refetch();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Customers</h2>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Customer</button>
      </div>
      <div className="card">
        <DataTable columns={columns} rows={data?.clients} loading={loading} />
      </div>
      {showAdd && (
        <Modal title="Add Customer" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd}>
            <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div className="form-group"><label>Company</label><input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={saving}>{saving ? 'Saving...' : 'Create Customer'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
