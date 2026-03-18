import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout         from './components/Layout';

import LoginPage          from './pages/LoginPage';
import IssuePage          from './pages/IssuePage';
import MasterInvoicePage  from './pages/MasterInvoicePage';
import ReturnPage         from './pages/ReturnPage';
import OutstandingPage    from './pages/OutstandingPage';
import InvoiceHistoryPage from './pages/InvoiceHistoryPage';
import ApprovalsPage      from './pages/ApprovalsPage';
import MyApprovalsPage    from './pages/MyApprovalsPage';
import UsersPage          from './pages/admin/UsersPage';
import ExecutivesPage     from './pages/admin/ExecutivesPage';
import RoutesAdminPage    from './pages/admin/RoutesAdminPage';
import MyOutstandingPage  from './pages/executive/MyOutstandingPage';

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'EXECUTIVE' ? '/me/outstanding' : '/outstanding'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Any authenticated user */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Default redirect based on role */}
              <Route index element={<RoleRedirect />} />

              {/* All authenticated roles */}
              <Route path="/invoices" element={<InvoiceHistoryPage />} />

              {/* ADMIN + OFFICE_STAFF */}
              <Route element={<ProtectedRoute roles={['ADMIN', 'OFFICE_STAFF']} />}>
                <Route path="/outstanding" element={<OutstandingPage />} />
                <Route path="/master"      element={<MasterInvoicePage />} />
                <Route path="/issue"       element={<IssuePage />} />
                <Route path="/return"      element={<ReturnPage />} />
              </Route>

              {/* ADMIN only */}
              <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route path="/approvals"        element={<ApprovalsPage />} />
                <Route path="/admin/users"      element={<UsersPage />} />
                <Route path="/admin/executives" element={<ExecutivesPage />} />
                <Route path="/admin/routes"     element={<RoutesAdminPage />} />
              </Route>

              {/* OFFICE_STAFF only */}
              <Route element={<ProtectedRoute roles={['OFFICE_STAFF']} />}>
                <Route path="/my-approvals" element={<MyApprovalsPage />} />
              </Route>

              {/* EXECUTIVE only */}
              <Route element={<ProtectedRoute roles={['EXECUTIVE']} />}>
                <Route path="/me/outstanding" element={<MyOutstandingPage />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
