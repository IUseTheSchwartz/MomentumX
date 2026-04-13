import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AppShell from './components/AppShell';

import Landing from './pages/Landing';
import AuthCallback from './pages/AuthCallback';
import Denied from './pages/Denied';
import Ineligible from './pages/Ineligible';

import Dashboard from './pages/app/Dashboard';
import Leads from './pages/app/Leads';
import KPI from './pages/app/KPI';
import Requirements from './pages/app/Requirements';
import Recordings from './pages/app/Recordings';
import BookOfBusiness from './pages/app/BookOfBusiness';
import Support from './pages/app/Support';

import Overview from './pages/admin/Overview';
import Agents from './pages/admin/Agents';
import AgentsRequirements from './pages/admin/AgentsRequirements';
import LeadsAdmin from './pages/admin/LeadsAdmin';
import ReplacementRequests from './pages/admin/ReplacementRequests';
import Tiers from './pages/admin/Tiers';
import Distribution from './pages/admin/Distribution';
import Logs from './pages/admin/Logs';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/denied" element={<Denied />} />
      <Route path="/ineligible" element={<Ineligible />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="kpi" element={<KPI />} />
        <Route path="requirements" element={<Requirements />} />
        <Route path="recordings" element={<Recordings />} />
        <Route path="book" element={<BookOfBusiness />} />
        <Route path="support" element={<Support />} />
      </Route>

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AppShell admin />
          </AdminRoute>
        }
      >
        <Route index element={<Navigate to="/admin/overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="agents" element={<Agents />} />
        <Route path="agents-requirements" element={<AgentsRequirements />} />
        <Route path="leads" element={<LeadsAdmin />} />
        <Route path="replacement-requests" element={<ReplacementRequests />} />
        <Route path="tiers" element={<Tiers />} />
        <Route path="distribution" element={<Distribution />} />
        <Route path="logs" element={<Logs />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
