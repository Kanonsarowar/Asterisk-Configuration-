import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: '📊' },
  { to: '/admin/customers', label: 'Customers', icon: '👥' },
  { to: '/admin/did-inventory', label: 'DID Inventory', icon: '📞' },
  { to: '/admin/carriers', label: 'Carriers', icon: '🔌' },
  { to: '/admin/routes', label: 'Routing', icon: '🔀' },
  { to: '/admin/rate-cards', label: 'Rate Cards', icon: '💰' },
  { to: '/admin/sip-trunks', label: 'SIP Trunks', icon: '📡' },
  { to: '/admin/invoices', label: 'Invoices', icon: '📄' },
  { to: '/admin/live-calls', label: 'Live Calls', icon: '🟢' },
  { to: '/admin/cdr', label: 'CDR', icon: '📋' },
  { to: '/admin/traffic', label: 'Traffic Stats', icon: '📈' },
  { to: '/admin/fraud', label: 'Fraud Alerts', icon: '🛡️' },
  { to: '/admin/users', label: 'Users', icon: '⚙️' },
];

const customerLinks = [
  { to: '/portal', label: 'Dashboard', icon: '📊' },
  { to: '/portal/dids', label: 'My DIDs', icon: '📞' },
  { to: '/portal/sip-endpoints', label: 'SIP Endpoints', icon: '📡' },
  { to: '/portal/ivr', label: 'IVR', icon: '🎵' },
  { to: '/portal/cdr', label: 'CDR Reports', icon: '📋' },
  { to: '/portal/invoices', label: 'Invoices', icon: '📄' },
  { to: '/portal/recordings', label: 'Recordings', icon: '🎙️' },
  { to: '/portal/usage', label: 'Usage Stats', icon: '📈' },
];

export default function Layout() {
  const { user, logout, isAdmin, isReseller } = useAuth();
  const navigate = useNavigate();
  const links = (isAdmin || isReseller) ? adminLinks : customerLinks;

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 220, background: '#0c1222', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>IPRN Platform</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            {user?.username} ({user?.role})
          </div>
        </div>
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/admin' || l.to === '/portal'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
                fontSize: 13, color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                background: isActive ? 'rgba(59,130,246,.08)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
              })}>
              <span>{l.icon}</span>{l.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          {user?.balance !== undefined && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              Balance: <span style={{ color: 'var(--success)', fontWeight: 600 }}>${Number(user.balance).toFixed(2)}</span>
            </div>
          )}
          <button className="btn-outline" style={{ width: '100%', fontSize: 12 }} onClick={handleLogout}>Sign Out</button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
