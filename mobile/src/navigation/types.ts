import { NavigatorScreenParams } from '@react-navigation/native';
import { PaymentReceipt, LoanItem } from '../types';

// --- Auth ---
export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  VerifyOtp: { email: string; mode: 'reset' };
  ResetPassword: { email: string };
  Register: undefined;
};

// --- Client tabs ---
export type ClientTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  LoansTab: NavigatorScreenParams<LoansStackParamList>;
  SavingsTab: NavigatorScreenParams<SavingsStackParamList>;
  NotificationsTab: NavigatorScreenParams<NotificationsStackParamList>;
  MoreTab: NavigatorScreenParams<MoreStackParamList>;
};

export type HomeStackParamList = {
  Home: undefined;
  KycStatus: undefined;
  KycForm: undefined;
  KycSubmitted: { referenceNumber?: string; submittedAt?: string } | undefined;
};

export type LoansStackParamList = {
  LoansList: undefined;
  LoanDetail: { loanId: string } | { loan: LoanItem };
  LoanApplication: undefined;
  Payments: { loanId?: string } | undefined;
  PaymentReceipt: { receipt: PaymentReceipt };
};

export type SavingsStackParamList = {
  Savings: undefined;
};

export type NotificationsStackParamList = {
  Notifications: undefined;
};

export type MoreStackParamList = {
  More: undefined;
  Profile: undefined;
  Settings: undefined;
  GroupLending: undefined;
  Transactions: undefined;
  Documents: undefined;
  HelpSupport: undefined;
  KycStatus: undefined;
  KycForm: undefined;
};

// --- Branch personnel ---
export type BranchStackParamList = {
  BranchHome: undefined;
  KycQueue: undefined;
  KycReviewDetail: { clientId: string };
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Client: NavigatorScreenParams<ClientTabParamList>;
  Branch: NavigatorScreenParams<BranchStackParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}