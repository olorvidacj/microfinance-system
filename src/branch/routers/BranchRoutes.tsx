import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { BranchLayout } from '../components/layout/BranchLayout';
import DashboardPage from '../pages/DashboardPage';
import PerformancePage from '../pages/PerformancePage';
import ClientsPage from '../pages/ClientsPage';
import ClientProfilePage from '../pages/ClientProfilePage';
import KycQueuePage from '../pages/KycQueuePage';
import LoanApplicationsPage from '../pages/LoanApplicationsPage';
import LoansPage from '../pages/LoansPage';
import LoanDetailsPage from '../pages/LoanDetailsPage';
import CollectionsPage from '../pages/CollectionsPage';
import ProcessPaymentPage from '../pages/ProcessPaymentPage';
import SavingsPage from '../pages/SavingsPage';
import SavingsTransactionsPage from '../pages/SavingsTransactionsPage';
import GroupLendingPage from '../pages/GroupLendingPage';
import GroupDetailPage from '../pages/GroupDetailPage';
import TransactionLedgerPage from '../pages/TransactionLedgerPage';
import DocumentsPage from '../pages/DocumentsPage';
import NotificationsPage from '../pages/NotificationsPage';
import ReportsPage from '../pages/ReportsPage';
import PersonnelProfilePage from '../pages/PersonnelProfilePage';
import ActivityLogPage from '../pages/ActivityLogPage';

export const BranchRoutes: React.FC = () => (
  <Routes>
    <Route path="/staff/app" element={<BranchLayout />}>
      <Route path="" element={<DashboardPage />} />
      <Route path="performance" element={<PerformancePage />} />
      <Route path="clients" element={<ClientsPage />} />
      <Route path="clients/:id" element={<ClientProfilePage />} />
      <Route path="kyc" element={<KycQueuePage />} />
      <Route path="applications" element={<LoanApplicationsPage />} />
      <Route path="loans" element={<LoansPage />} />
      <Route path="loans/:id" element={<LoanDetailsPage />} />
      <Route path="collections" element={<CollectionsPage />} />
      <Route path="payments" element={<ProcessPaymentPage />} />
      <Route path="savings" element={<SavingsPage />} />
      <Route path="savings/:id" element={<SavingsTransactionsPage />} />
      <Route path="groups" element={<GroupLendingPage />} />
      <Route path="groups/:id" element={<GroupDetailPage />} />
      <Route path="transactions" element={<TransactionLedgerPage />} />
      <Route path="documents" element={<DocumentsPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="profile" element={<PersonnelProfilePage />} />
      <Route path="activity" element={<ActivityLogPage />} />
      <Route path="*" element={<Navigate to="/staff/app" replace />} />
    </Route>
    <Route path="/staff/login" element={<Navigate to="/staff/app" replace />} />
    <Route path="*" element={<Navigate to="/staff/app" replace />} />
  </Routes>
);

export default BranchRoutes;