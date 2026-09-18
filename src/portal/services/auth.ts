import { publicRequest } from './clientApi';

export interface OtpResult {
  success: boolean;
  message: string;
  formattedPhone?: string;
  expiresInSeconds?: number;
  expiresInMinutes?: number;
}

export const authService = {
  sendRegistrationOtp(phone: string, email?: string): Promise<OtpResult> {
    return publicRequest('/api/client/auth/send-registration-otp', { phone, email });
  },

  verifyRegistrationOtp(phone: string, otp: string): Promise<{ success: boolean; verified: boolean; message?: string }> {
    return publicRequest('/api/client/auth/verify-registration-otp', { phone, otp });
  },

  forgotPassword(email: string): Promise<OtpResult> {
    return publicRequest('/api/client/auth/forgot-password', { email });
  },

  verifyOtp(email: string, otp: string): Promise<{ success: boolean; message?: string }> {
    return publicRequest('/api/client/auth/verify-otp', { email, otp });
  },

  resetPassword(email: string, otp: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    return publicRequest('/api/client/auth/reset-password', { email, otp, newPassword });
  },
};