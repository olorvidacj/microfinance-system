import React, { useEffect, useState } from 'react';
import type { LoanProduct } from '../../../shared/lending';
import { CalculatorView } from '../../components/CalculatorView';
import { loansService } from '../services';

const LoanCalculatorPage: React.FC = () => {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  useEffect(() => {
    // Roles without product access still get the free-form calculator.
    loansService.products().then(setProducts).catch(() => setProducts([]));
  }, []);
  return <CalculatorView products={products} />;
};

export default LoanCalculatorPage;
