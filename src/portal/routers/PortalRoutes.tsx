import React from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import DashboardPage from '../pages/DashboardPage';
import ProfilePage from '../pages/ProfilePage';
import LoansPage from '../pages/LoansPage';
import LoanDetailPage from '../pages/LoanDetailPage';
import ApplyLoanPage from '../pages/ApplyLoanPage';
import KycPage from '../pages/KycPage';
import PaymentsPage from '../pages/PaymentsPage';
import SavingsPage from '../pages/SavingsPage';
import TransactionsPage from '../pages/TransactionsPage';
import GroupsPage from '../pages/GroupsPage';
import NotificationsPage from '../pages/NotificationsPage';
import DocumentsPage from '../pages/DocumentsPage';
import SupportPage from '../pages/SupportPage';
import SettingsPage from '../pages/SettingsPage';

export interface PortalRouteDef {
  path: string;
  element: React.ReactNode;
}

const wrap = (page: React.ReactNode): React.ReactNode => (
  <ErrorBoundary>{page}</ErrorBoundary>
);

// Authenticated client portal routes (mounted under "/portal").
export const PORTAL_ROUTES: PortalRouteDef[] = [
  { path: '', element: wrap(<DashboardPage />) },
  { path: 'profile', element: wrap(<ProfilePage />) },
  { path: 'loans', element: wrap(<LoansPage />) },
  { path: 'loans/:id', element: wrap(<LoanDetailPage />) },
  { path: 'apply', element: wrap(<ApplyLoanPage />) },
  { path: 'kyc', element: wrap(<KycPage />) },
  { path: 'payments', element: wrap(<PaymentsPage />) },
  { path: 'savings', element: wrap(<SavingsPage />) },
  { path: 'transactions', element: wrap(<TransactionsPage />) },
  { path: 'groups', element: wrap(<GroupsPage />) },
  { path: 'notifications', element: wrap(<NotificationsPage />) },
  { path: 'documents', element: wrap(<DocumentsPage />) },
  { path: 'support', element: wrap(<SupportPage />) },
  { path: 'settings', element: wrap(<SettingsPage />) },
];
