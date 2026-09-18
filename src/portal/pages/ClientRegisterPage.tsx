import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  Smartphone,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../components/ui';

interface RegistrationFormState {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

const initialForm: RegistrationFormState = {
  fullName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreeTerms: false,
};

export const ClientRegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<RegistrationFormState>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<{
    fullName: string;
    email?: string;
  } | null>(null);

  const update = <K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const validate = (): string | null => {
    const cleanName = form.fullName.trim();
    if (!cleanName || cleanName.length < 2) {
      return 'Please enter your full legal name (as shown on a government ID).';
    }

    const cleanPhone = form.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return 'Please enter a valid Philippine mobile number (e.g. 0917 123 4567 or +63 917 123 4567).';
    }

    if (form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        return 'Please enter a valid email address, or leave it blank.';
      }
    }

    if (!form.password || form.password.length < 6) {
      return 'Password must be at least 6 characters.';
    }

    if (form.password !== form.confirmPassword) {
      return 'Passwords do not match. Please verify.';
    }

    if (!form.agreeTerms) {
      return 'You must agree to the Terms of Service and Data Privacy Policy to create an account.';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = form.phone.replace(/\D/g, '');
      const user = await register({
        fullName: form.fullName.trim(),
        phone: cleanPhone,
        email: form.email.trim().toLowerCase() || undefined,
        password: form.password,
      });

      setRegisteredUser({
        fullName: user.fullName || form.fullName.trim(),
        email: user.email || form.email.trim(),
      });

      // Redirect into portal to show dashboard with Pending KYC status
      setTimeout(() => {
        navigate('/portal', { replace: true });
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your information and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (registeredUser) {
    return (
      <div id="register-success-view" className="py-6 text-center animate-fade-in">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Welcome to HOSCOMCO!
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Your client account for <strong className="text-slate-800">{registeredUser.fullName}</strong> has been created.
        </p>

        <div className="mx-auto mt-5 max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-left text-xs text-amber-900">
          <div className="flex items-center gap-2 font-semibold text-amber-950">
            <Shield className="h-4 w-4 text-amber-700 shrink-0" />
            <span>Account Status: Pending KYC / Incomplete Profile</span>
          </div>
          <p className="mt-1 leading-relaxed text-amber-800">
            All financial balances start at ₱0.00. You can complete your profile and KYC verification directly in your member portal to unlock loan applications.
          </p>
        </div>

        <div className="mt-6 flex flex-col items-center justify-center gap-2">
          <Button
            id="btn-go-to-portal"
            onClick={() => navigate('/portal', { replace: true })}
            className="w-full max-w-xs"
          >
            Go to Member Portal <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
          <span className="text-[11px] text-slate-400">Redirecting automatically…</span>
        </div>
      </div>
    );
  }

  return (
    <div id="client-register-card" className="space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-800 ring-1 ring-inset ring-gold-500/20 mb-2">
          <Smartphone className="h-3.5 w-3.5 text-gold-700" />
          <span>Quick Client Registration</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Create Member Account
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Register in seconds with just your basic contact details. Complete your profile and KYC documents later.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div
          id="register-error-banner"
          className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs sm:text-sm text-rose-700"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Simplified Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div>
          <label htmlFor="reg-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
            Full Legal Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="reg-fullname"
              type="text"
              required
              autoComplete="name"
              placeholder="e.g. Maria Teresa Santos"
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            As shown on your government-issued ID.
          </p>
        </div>

        {/* Mobile Number */}
        <div>
          <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700 mb-1">
            Philippine Mobile Number <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="reg-phone"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="0917 123 4567"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Used for account sign in, notifications, and security notices.
          </p>
        </div>

        {/* Email Address (Optional) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700">
              Email Address
            </label>
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">
              Optional
            </span>
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="you@email.com (optional)"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            If provided, you can also use your email to sign in and receive statements.
          </p>
        </div>

        {/* Password and Confirm Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 mb-1">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition"
              />
              <button
                type="button"
                id="toggle-password-visibility"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="Repeat password"
                value={form.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition"
              />
              <button
                type="button"
                id="toggle-confirm-password-visibility"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Terms & Privacy Consent */}
        <div className="pt-2">
          <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/70 p-3 hover:bg-slate-50 transition">
            <input
              id="reg-agree-terms"
              type="checkbox"
              required
              checked={form.agreeTerms}
              onChange={(e) => update('agreeTerms', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold-600 focus:ring-gold-500"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              I agree to the HOSCOMCO <span className="font-semibold text-slate-800">Terms of Service</span> and consent to data processing under the <span className="font-semibold text-slate-800">Data Privacy Act (RA 10173)</span>.
            </span>
          </label>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <Button
            id="btn-submit-registration"
            type="submit"
            fullWidth
            loading={loading}
            className="py-3 text-sm font-semibold"
          >
            <ShieldCheck className="h-4 w-4 mr-1" /> Create Account
          </Button>
        </div>
      </form>

      {/* Footer link to sign in */}
      <div className="pt-2 text-center text-xs text-slate-500">
        <span>Already have an account? </span>
        <Link
          id="link-signin"
          to="/portal/login"
          className="font-semibold text-gold-700 hover:text-gold-800 hover:underline"
        >
          Sign in here
        </Link>
      </div>
    </div>
  );
};

export default ClientRegisterPage;
