import React from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './layouts/AdminLayout';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { ClientManagementPage } from './pages/ClientManagementPage';
import { KycVerificationPage } from './pages/KycVerificationPage';
import { LoanManagementPage } from './pages/LoanManagementPage';
import { SavingsManagementPage } from './pages/SavingsManagementPage';
import { FinancialTransactionsPage } from './pages/TransactionsPage';
import { LendingGroupsPage } from './pages/LendingGroupsPage';
import { BranchManagementPage } from './pages/BranchManagementPage';
import { ReportsAnalyticsPage } from './pages/ReportsAnalyticsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SystemSettingsPage } from './pages/SystemSettingsPage';

const ADMIN_SESSION_KEY = 'HOSCOMCO_admin_session';

export const AdminRouteGate: React.FC = () => {
  const hasSession = () => {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  };

  if (!hasSession()) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
};

export const AdminRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route element={<AdminRouteGate />}>
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="clients" element={<ClientManagementPage />} />
          <Route path="kyc" element={<KycVerificationPage />} />
          <Route path="loans" element={<LoanManagementPage />} />
          <Route path="savings" element={<SavingsManagementPage />} />
          <Route path="transactions" element={<FinancialTransactionsPage />} />
          <Route path="groups" element={<LendingGroupsPage />} />
          <Route path="branches" element={<BranchManagementPage />} />
          <Route path="reports" element={<ReportsAnalyticsPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SystemSettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
};

export default AdminRoutes;