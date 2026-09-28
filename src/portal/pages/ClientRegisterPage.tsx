import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
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
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../components/ui';

interface RegistrationFormState {
  firstName: string;
  middleName: string;
  hasNoMiddleName: boolean;
  lastName: string;
  suffix: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

const initialForm: RegistrationFormState = {
  firstName: '',
  middleName: '',
  hasNoMiddleName: false,
  lastName: '',
  suffix: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreeTerms: false,
};

const SUFFIX_OPTIONS = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'];

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
    const fName = form.firstName.trim();
    if (!fName || fName.length < 2) {
      return 'Please enter your legal First Name as shown on your government ID.';
    }

    const lName = form.lastName.trim();
    if (!lName || lName.length < 2) {
      return 'Please enter your legal Last Name.';
    }

    if (!form.hasNoMiddleName && form.middleName.trim()) {
      const invalidMiddlePlaceholders = ['n/a', 'na', 'none', '-', '.'];
      if (invalidMiddlePlaceholders.includes(form.middleName.trim().toLowerCase())) {
        return 'Please check "I don\'t have a middle name" instead of typing N/A or None.';
      }
    }

    // Philippine mobile number validation
    const cleanPhone = form.phone.replace(/\D/g, '');
    const isPhMobile = /^(09\d{9}|639\d{9}|9\d{9})$/.test(cleanPhone);
    if (!isPhMobile) {
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
      return 'You must agree to the Terms of Service and Data Privacy Policy (RA 10173) to create an account.';
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
      let cleanPhone = form.phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('63')) cleanPhone = '0' + cleanPhone.slice(2);
      if (cleanPhone.startsWith('9') && cleanPhone.length === 10) cleanPhone = '0' + cleanPhone;

      const composedFullName = [
        form.firstName.trim(),
        (!form.hasNoMiddleName && form.middleName.trim()) ? form.middleName.trim() : null,
        form.lastName.trim(),
        form.suffix.trim() ? form.suffix.trim() : null,
      ].filter(Boolean).join(' ');

      const user = await register({
        fullName: composedFullName,
        firstName: form.firstName.trim(),
        middleName: (!form.hasNoMiddleName && form.middleName.trim()) ? form.middleName.trim() : undefined,
        lastName: form.lastName.trim(),
        suffix: form.suffix.trim() || undefined,
        hasNoMiddleName: form.hasNoMiddleName,
        phone: cleanPhone,
        email: form.email.trim().toLowerCase() || undefined,
        password: form.password,
        confirmPassword: form.confirmPassword,
        agreeTerms: form.agreeTerms,
      });

      setRegisteredUser({
        fullName: user.fullName || composedFullName,
        email: user.email || form.email.trim(),
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your information and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (registeredUser) {
    return (
      <div id="register-success-view" className="py-6 text-center animate-fade-in space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
          <CheckCircle2 className="h-8 w-8" />
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Account created successfully.
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
            Your client account for <strong className="text-slate-800">{registeredUser.fullName}</strong> has been created.
          </p>
        </div>

        <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-left text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <Shield className="h-4 w-4 text-amber-700 shrink-0" />
            <span>Complete Your KYC</span>
          </div>
          <p className="mt-1.5 leading-relaxed text-amber-800">
            Your account has been created. Please complete your KYC verification to access HOSCOMO services such as loan applications and savings withdrawals.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-md mx-auto">
          <Button
            id="btn-complete-kyc"
            onClick={() => navigate('/portal/kyc', { replace: true })}
            className="w-full sm:flex-1 py-3 text-sm font-semibold shadow-md shadow-emerald-600/10"
          >
            <FileCheck2 className="h-4 w-4 mr-2" /> Complete KYC
          </Button>

          <Button
            id="btn-continue-dashboard"
            variant="outline"
            onClick={() => navigate('/portal', { replace: true })}
            className="w-full sm:flex-1 py-3 text-sm font-semibold border-slate-300 hover:bg-slate-50"
          >
            Continue to Dashboard <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
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
          Create Client Account
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Sign up with your basic details. Full KYC verification will follow before applying for loans.
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
        {/* Legal First & Middle Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="reg-firstname" className="block text-xs font-semibold text-slate-700 mb-1">
              Legal First Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="reg-firstname"
                type="text"
                required
                autoComplete="given-name"
                placeholder="e.g. Maria Teresa"
                value={form.firstName}
                onChange={(e) => update('firstName', e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="reg-middlename" className="block text-xs font-semibold text-slate-700">
                Middle Name
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.hasNoMiddleName}
                  onChange={(e) => {
                    update('hasNoMiddleName', e.target.checked);
                    if (e.target.checked) update('middleName', '');
                  }}
                  className="h-3 w-3 rounded border-slate-300 text-gold-600 focus:ring-gold-500"
                />
                <span>I don't have a middle name</span>
              </label>
            </div>
            <input
              id="reg-middlename"
              type="text"
              disabled={form.hasNoMiddleName}
              autoComplete="additional-name"
              placeholder={form.hasNoMiddleName ? 'No middle name' : 'e.g. Reyes'}
              value={form.middleName}
              onChange={(e) => update('middleName', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Legal Last Name & Suffix */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="reg-lastname" className="block text-xs font-semibold text-slate-700 mb-1">
              Legal Last Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="reg-lastname"
              type="text"
              required
              autoComplete="family-name"
              placeholder="e.g. Santos"
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition"
            />
          </div>

          <div>
            <label htmlFor="reg-suffix" className="block text-xs font-semibold text-slate-700 mb-1">
              Suffix <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
            </label>
            <select
              id="reg-suffix"
              value={form.suffix}
              onChange={(e) => update('suffix', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:bg-white focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition"
            >
              <option value="">None</option>
              {SUFFIX_OPTIONS.filter(Boolean).map((sfx) => (
                <option key={sfx} value={sfx}>
                  {sfx}
                </option>
              ))}
            </select>
          </div>
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
            Accepts format: 09XXXXXXXXX or +639XXXXXXXXX.
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
              I agree to the HOSCOMO <span className="font-semibold text-slate-800">Terms of Service</span> and consent to data processing under the <span className="font-semibold text-slate-800">Data Privacy Act (RA 10173)</span>.
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
            <ShieldCheck className="h-4 w-4 mr-1" /> Create Client Account
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
