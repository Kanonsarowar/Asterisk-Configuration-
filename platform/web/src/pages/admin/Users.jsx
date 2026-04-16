import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal from '../../components/shared/Modal';

export default function Users() {
  const { data, loading, refetch } = useApi('/api/users');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'user' });

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'username', label: 'Username' },
    { key: 'role', label: 'Role', render: r => (
      <span className={`badge ${r.role === 'admin' ? 'badge-red' : r.role === 'reseller' ? 'badge-yellow' : 'badge-blue'}`}>{r.role}</span>
    )},
    { key: 'balance', label: 'Balance', render: r => `$${Number(r.balance).toFixed(2)}` },
    { key: 'status', label: 'Status', render: r => <span className={`badge ${r.status === 'active' ? 'badge-green' : 'badge-red'}`}>{r.status}</span> },
    { key: 'created_at', label: 'Created', render: r => new Date(r.created_at).toLocaleDateString() },
  ];

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api('/api/users', { method: 'POST', body: form });
      setShowAdd(false);
      setForm({ username: '', password: '', role: 'user' });
      refetch();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Users</h2>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add User</button>
      </div>
      <div className="card">
        <DataTable columns={columns} rows={data?.users} loading={loading} />
      </div>
      {showAdd && (
        <Modal title="Add User" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd}>
            <div className="form-group"><label>Username</label><input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required /></div>
            <div className="form-group"><label>Password</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></div>
            <div className="form-group"><label>Role</label><select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}><option value="user">User</option><option value="reseller">Reseller</option><option value="admin">Admin</option></select></div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 8 }}>Create User</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
