import React from 'react';
import { ProductsView } from '../../components/ProductsView';
import { adminApi } from '../services/adminApi';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../auth/permissions';

export const LoanProductsPage: React.FC = () => {
  const { user } = useAuth();
  return <ProductsView api={adminApi.loanProducts} canEdit={hasPermission(user?.staffRole, 'manage_settings')} />;
};

export default LoanProductsPage;
