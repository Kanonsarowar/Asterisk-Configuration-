import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/shared/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import Customers from './pages/admin/Customers';
import DIDInventory from './pages/admin/DIDInventory';
import Carriers from './pages/admin/Carriers';
import AdminRoutes from './pages/admin/Routes';
import RateCards from './pages/admin/RateCards';
import SIPTrunks from './pages/admin/SIPTrunks';
import Invoices from './pages/admin/Invoices';
import LiveCalls from './pages/admin/LiveCalls';
import CDR from './pages/admin/CDR';
import TrafficStats from './pages/admin/TrafficStats';
import FraudAlerts from './pages/admin/FraudAlerts';
import Users from './pages/admin/Users';
import PortalDashboard from './pages/customer/PortalDashboard';
import MyDIDs from './pages/customer/MyDIDs';
import SIPEndpoints from './pages/customer/SIPEndpoints';
import IVR from './pages/customer/IVR';
import CustomerCDR from './pages/customer/CustomerCDR';
import CustomerInvoices from './pages/customer/CustomerInvoices';
import Recordings from './pages/customer/Recordings';
import UsageStats from './pages/customer/UsageStats';

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'user' ? '/portal' : '/admin'} replace /> : <Login />} />

      <Route path="/admin" element={<ProtectedRoute roles={['admin','reseller']}><Layout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="did-inventory" element={<DIDInventory />} />
        <Route path="carriers" element={<Carriers />} />
        <Route path="routes" element={<AdminRoutes />} />
        <Route path="rate-cards" element={<RateCards />} />
        <Route path="sip-trunks" element={<SIPTrunks />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="live-calls" element={<LiveCalls />} />
        <Route path="cdr" element={<CDR />} />
        <Route path="traffic" element={<TrafficStats />} />
        <Route path="fraud" element={<FraudAlerts />} />
        <Route path="users" element={<Users />} />
      </Route>

      <Route path="/portal" element={<ProtectedRoute roles={['user']}><Layout /></ProtectedRoute>}>
        <Route index element={<PortalDashboard />} />
        <Route path="dids" element={<MyDIDs />} />
        <Route path="sip-endpoints" element={<SIPEndpoints />} />
        <Route path="ivr" element={<IVR />} />
        <Route path="cdr" element={<CustomerCDR />} />
        <Route path="invoices" element={<CustomerInvoices />} />
        <Route path="recordings" element={<Recordings />} />
        <Route path="usage" element={<UsageStats />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? (user.role === 'user' ? '/portal' : '/admin') : '/login'} replace />} />
    </Routes>
  );
}
