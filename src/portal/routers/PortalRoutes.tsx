import React from 'react';
import DashboardPage from '../pages/DashboardPage';
import ProfilePage from '../pages/ProfilePage';
import LoansPage from '../pages/LoansPage';
import LoanDetailPage from '../pages/LoanDetailPage';
import ApplyLoanPage from '../pages/ApplyLoanPage';
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

// Authenticated client portal routes (mounted under "/portal").
export const PORTAL_ROUTES: PortalRouteDef[] = [
  { path: '', element: <DashboardPage /> },
  { path: 'profile', element: <ProfilePage /> },
  { path: 'loans', element: <LoansPage /> },
  { path: 'loans/:id', element: <LoanDetailPage /> },
  { path: 'apply', element: <ApplyLoanPage /> },
  { path: 'payments', element: <PaymentsPage /> },
  { path: 'savings', element: <SavingsPage /> },
  { path: 'transactions', element: <TransactionsPage /> },
  { path: 'groups', element: <GroupsPage /> },
  { path: 'notifications', element: <NotificationsPage /> },
  { path: 'documents', element: <DocumentsPage /> },
  { path: 'support', element: <SupportPage /> },
  { path: 'settings', element: <SettingsPage /> },
];