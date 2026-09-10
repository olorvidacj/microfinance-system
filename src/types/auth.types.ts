export type AuthRole = 'STAFF' | 'CLIENT';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
  staffRole?: string | null;
  staffId?: string | null;
  borrowerId?: string | null;
  avatar?: string;
}

export interface LoginCredentials {
  emailOrPhone: string;
  password: string;
}

export interface RegistrationData {
  fullName: string;
  email?: string;
  phone?: string;
  password?: string;
  borrowerNumber?: string;
  address?: string;
  occupation?: string;
  employerOrBusiness?: string;
  monthlyIncome?: number;
  dateOfBirth?: string;
  civilStatus?: string;
}

export type RegistrationStep = 'account' | 'client' | 'security';

export interface RegistrationSteps {
  account: {
    fullName: string;
    phone: string;
    email: string;
    borrowerNumber: string;
  };
  client: {
    address: string;
    occupation: string;
    employerOrBusiness: string;
    monthlyIncome: string;
  };
  security: {
    password: string;
    confirmPassword: string;
    agreeTerms: boolean;
  };
}

export const STEP_ORDER: RegistrationStep[] = ['account', 'client', 'security'];

export const STEP_LABELS: Record<RegistrationStep, string> = {
  account: 'Account',
  client: 'Client Information',
  security: 'Security',
};

export const INITIAL_STEPS: RegistrationSteps = {
  account: { fullName: '', phone: '', email: '', borrowerNumber: '' },
  client: { address: '', occupation: '', employerOrBusiness: '', monthlyIncome: '' },
  security: { password: '', confirmPassword: '', agreeTerms: false },
};
