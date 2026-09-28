import React, { useState } from 'react';
import {
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  Shield,
  FileCheck2,
  ArrowRight,
} from 'lucide-react';
import { AuthHeader } from './AuthHeader';
import { useAuth } from '../../context/AuthContext';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
  onBack?: () => void;
}

const SUFFIX_OPTIONS = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'];

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onSwitchToLogin,
  onBack,
}) => {
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [hasNoMiddleName, setHasNoMiddleName] = useState(false);
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = (): string | null => {
    if (!firstName.trim() || firstName.trim().length < 2) {
      return 'Please enter your legal First Name.';
    }
    if (!lastName.trim() || lastName.trim().length < 2) {
      return 'Please enter your legal Last Name.';
    }
    if (!hasNoMiddleName && middleName.trim()) {
      const invalidPlaceholders = ['n/a', 'na', 'none', '-', '.'];
      if (invalidPlaceholders.includes(middleName.trim().toLowerCase())) {
        return 'Please check "I don\'t have a middle name" instead of typing N/A or None.';
      }
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const isPhMobile = /^(09\d{9}|639\d{9}|9\d{9})$/.test(cleanPhone);
    if (!isPhMobile) {
      return 'Please enter a valid Philippine mobile phone number (e.g. 0917 123 4567).';
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Please enter a valid email address or leave it blank.';
    }
    if (!password || password.length < 6) {
      return 'Password must be at least 6 characters.';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match. Please verify.';
    }
    if (!agreeTerms) {
      return 'Please accept the Terms of Service and Data Privacy Policy consent (RA 10173).';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const valErr = validate();
    if (valErr) {
      setError(valErr);
      return;
    }

    setIsSubmitting(true);
    try {
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('63')) cleanPhone = '0' + cleanPhone.slice(2);
      if (cleanPhone.startsWith('9') && cleanPhone.length === 10) cleanPhone = '0' + cleanPhone;

      const composedFullName = [
        firstName.trim(),
        (!hasNoMiddleName && middleName.trim()) ? middleName.trim() : null,
        lastName.trim(),
        suffix.trim() ? suffix.trim() : null,
      ].filter(Boolean).join(' ');

      await register({
        fullName: composedFullName,
        firstName: firstName.trim(),
        middleName: (!hasNoMiddleName && middleName.trim()) ? middleName.trim() : undefined,
        lastName: lastName.trim(),
        suffix: suffix.trim() || undefined,
        hasNoMiddleName,
        phone: cleanPhone,
        email: email.trim().toLowerCase() || undefined,
        password,
        confirmPassword,
        agreeTerms,
      });

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your information and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div id="register-form-success" className="p-6 text-center space-y-4 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Account created successfully.</h3>
          <p className="text-xs text-slate-500 mt-1">
            Your client member account has been registered with status{' '}
            <span className="font-semibold text-amber-700">KYC Not Started</span>.
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-left text-xs text-amber-900">
          <div className="flex items-center gap-1.5 font-semibold text-amber-950">
            <Shield className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Complete Your KYC</span>
          </div>
          <p className="mt-1 leading-relaxed text-amber-800 text-[11px]">
            Please complete your KYC verification to access loan applications and other HOSCOMO services.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              onSuccess?.();
            }}
            className="w-full py-2.5 px-4 bg-gold-500 hover:bg-gold-400 text-slate-900 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Continue to Complete KYC</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="simplified-register-form" className="p-6">
      <AuthHeader />
      <div className="mb-2">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Client Registration
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Quick account creation for HOSCOMO Microfinance Cooperative
        </p>
      </div>

      <div className="mt-3 mb-4 rounded-xl border border-gold-400/30 bg-gold-500/10 p-3 text-xs text-slate-900 flex items-start gap-2.5">
        <Smartphone className="w-4 h-4 text-gold-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-gold-800">Quick Registration: </span>
          <span>Enter your legal name and contact details. Address and full KYC documents will be completed in the next step.</span>
        </div>
      </div>

      {error && (
        <div
          id="register-error-alert"
          className="mb-4 flex items-center gap-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-3"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Legal First & Middle Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="modal-reg-fname" className="block text-xs font-semibold text-slate-700 mb-1">
              Legal First Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="modal-reg-fname"
                type="text"
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setError(''); }}
                placeholder="e.g. Maria Teresa"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="modal-reg-mname" className="block text-xs font-semibold text-slate-700">
                Middle Name
              </label>
              <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasNoMiddleName}
                  onChange={(e) => {
                    setHasNoMiddleName(e.target.checked);
                    if (e.target.checked) setMiddleName('');
                  }}
                  className="h-3 w-3 rounded border-slate-300 text-gold-600 focus:ring-gold-500"
                />
                <span>No middle name</span>
              </label>
            </div>
            <input
              id="modal-reg-mname"
              type="text"
              disabled={hasNoMiddleName}
              autoComplete="additional-name"
              value={middleName}
              onChange={(e) => { setMiddleName(e.target.value); setError(''); }}
              placeholder={hasNoMiddleName ? 'None' : 'e.g. Reyes'}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs transition disabled:opacity-50 disabled:bg-slate-100"
            />
          </div>
        </div>

        {/* Legal Last Name & Suffix */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="sm:col-span-2">
            <label htmlFor="modal-reg-lname" className="block text-xs font-semibold text-slate-700 mb-1">
              Legal Last Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="modal-reg-lname"
              type="text"
              required
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); setError(''); }}
              placeholder="e.g. Santos"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs transition"
            />
          </div>

          <div>
            <label htmlFor="modal-reg-suffix" className="block text-xs font-semibold text-slate-700 mb-1">
              Suffix
            </label>
            <select
              id="modal-reg-suffix"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:border-gold-400 outline-none transition"
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
          <label htmlFor="modal-reg-phone" className="block text-xs font-semibold text-slate-700 mb-1">
            Philippine Mobile Number <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="modal-reg-phone"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(''); }}
              placeholder="0917 123 4567"
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs transition"
            />
          </div>
        </div>

        {/* Email Address (Optional) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="modal-reg-email" className="block text-xs font-semibold text-slate-700">
              Email Address
            </label>
            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              Optional
            </span>
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="modal-reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="name@email.com (optional)"
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs transition"
            />
          </div>
        </div>

        {/* Password and Confirm Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="modal-reg-password" className="block text-xs font-semibold text-slate-700 mb-1">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="modal-reg-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Min. 6 chars"
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="modal-reg-confirm" className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="modal-reg-confirm"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Repeat password"
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Consent checkbox */}
        <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
          <input
            id="modal-reg-agree"
            type="checkbox"
            required
            checked={agreeTerms}
            onChange={(e) => { setAgreeTerms(e.target.checked); setError(''); }}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold-600 focus:ring-gold-500"
          />
          <span className="text-[11px] text-slate-600 leading-tight">
            I agree to the HOSCOMO <strong>Terms of Service</strong> and consent to data processing under the <strong>Data Privacy Act (RA 10173)</strong>.
          </span>
        </label>

        {/* Action buttons */}
        <div className="pt-2 flex items-center justify-between gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Back
            </button>
          )}
          <button
            id="modal-btn-register-submit"
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-4 bg-gold-400 hover:bg-gold-300 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-xl shadow-md shadow-gold-500/20 transition flex items-center justify-center gap-2 text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Account…</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Create Client Account</span>
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-4 pt-3 border-t border-slate-100 text-center">
        <span className="text-xs text-slate-500">Already registered? </span>
        <button
          id="btn-switch-to-login"
          type="button"
          onClick={onSwitchToLogin}
          className="text-xs font-bold text-gold-700 hover:text-slate-900 underline"
        >
          Sign in here
        </button>
      </div>
    </div>
  );
};

export default RegisterForm;
