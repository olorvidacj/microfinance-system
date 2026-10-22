import React from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './layouts/AdminLayout';
import { AdminBranchProvider } from './branchScope';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { ClientManagementPage } from './pages/ClientManagementPage';
import { KycVerificationPage } from './pages/KycVerificationPage';
import { LoanManagementPage } from './pages/LoanManagementPage';
import { LoanProductsPage } from './pages/LoanProductsPage';
import { SavingsManagementPage } from './pages/SavingsManagementPage';
import { FinancialTransactionsPage } from './pages/TransactionsPage';
import { LendingGroupsPage } from './pages/LendingGroupsPage';
import { BranchManagementPage } from './pages/BranchManagementPage';
import { ReportsAnalyticsPage } from './pages/ReportsAnalyticsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SystemSettingsPage } from './pages/SystemSettingsPage';

import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../auth/permissions';


export const AdminRouteGate: React.FC = () => {
  const { user, isRestoring } = useAuth();

  if (isRestoring) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  // The console's data covers every branch; the API requires view_all_records,
  // so the screens do too. Branch staff use the branch app.
  if (!user || user.role !== 'STAFF') return <Navigate to="/admin/login" replace />;
  if (!hasPermission(user.staffRole, 'view_all_records')) return <Navigate to="/staff/app" replace />;

  return <Outlet />;
};

export const AdminRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route element={<AdminRouteGate />}>
        <Route path="/" element={<AdminBranchProvider><AdminLayout /></AdminBranchProvider>}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="clients" element={<ClientManagementPage />} />
          <Route path="kyc" element={<KycVerificationPage />} />
          <Route path="loans" element={<LoanManagementPage />} />
          <Route path="loan-products" element={<LoanProductsPage />} />
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