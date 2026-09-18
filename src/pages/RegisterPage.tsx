import React from 'react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { RegisterForm } from '../components/auth/RegisterForm';

interface RegisterPageProps {
  onBack?: () => void;
  onSwitchToLogin?: () => void;
  onSuccess?: () => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onBack, onSwitchToLogin, onSuccess }) => {
  return (
    <AuthLayout
      title="Join HOSCOMCO Microfinance"
      subtitle="Create your member account in under 2 minutes to apply for loans, manage savings passbooks, and access community solidarity programs."
    >
      <RegisterForm
        onBack={onBack}
        onSwitchToLogin={onSwitchToLogin}
        onSuccess={onSuccess}
      />
    </AuthLayout>
  );
};

export { RegisterPage };
