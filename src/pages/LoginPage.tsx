import React from 'react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { LoginForm } from '../components/auth/LoginForm';

interface LoginPageProps {
  onBack?: () => void;
  onSwitchToRegister?: () => void;
  onSuccess?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onBack, onSwitchToRegister, onSuccess }) => {
  return (
    <AuthLayout
      title="Cooperative Access Portal"
      subtitle="Sign in to access the Staff Management Console or the Member Client Self-Service Portal."
    >
      <LoginForm
        onBack={onBack}
        onSwitchToRegister={onSwitchToRegister}
        onSuccess={onSuccess}
      />
    </AuthLayout>
  );
};

export { LoginPage };
