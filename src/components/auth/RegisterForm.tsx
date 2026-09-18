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
} from 'lucide-react';
import { AuthHeader } from './AuthHeader';
import { useAuth } from '../../context/AuthContext';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
  onBack?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onSwitchToLogin,
  onBack,
}) => {
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
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
    if (!fullName.trim() || fullName.trim().length < 2) {
      return 'Please enter your full legal name.';
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
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
      return 'Please accept the Terms of Service and Data Privacy Policy consent.';
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
      const cleanPhone = phone.replace(/\D/g, '');
      await register({
        fullName: fullName.trim(),
        phone: cleanPhone,
        email: email.trim().toLowerCase() || undefined,
        password,
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your information and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div id="register-form-success" className="p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Welcome to HOSCOMCO!</h3>
          <p className="text-xs text-slate-500 mt-1">
            Your client member account has been registered with status{' '}
            <span className="font-semibold text-amber-700">Pending KYC</span>.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Taking you to your member portal…
          </p>
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
          Quick account creation for HOSCOMCO Microfinance Cooperative
        </p>
      </div>

      <div className="mt-4 mb-4 rounded-xl border border-gold-400/30 bg-gold-500/10 p-3 text-xs text-navy-900 flex items-start gap-2.5">
        <Smartphone className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-gold-700">Simple & Fast: </span>
          <span>Fill in your basic contact info. Address, business, and KYC documents can be submitted anytime from your portal.</span>
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

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Full Name */}
        <div>
          <label htmlFor="modal-reg-name" className="block text-xs font-semibold text-slate-700 mb-1">
            Full Legal Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="modal-reg-name"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setError(''); }}
              placeholder="e.g. Maria Teresa Santos"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
            />
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
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
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
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
            />
          </div>
        </div>

        {/* Password and Confirm Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
            I agree to the HOSCOMCO <strong>Terms of Service</strong> and consent to data processing under the <strong>Data Privacy Act (RA 10173)</strong>.
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
            className="flex-1 py-2.5 px-4 bg-gold-400 hover:bg-gold-300 disabled:opacity-60 disabled:cursor-not-allowed text-navy-950 font-semibold rounded-xl shadow-md shadow-gold-500/20 transition flex items-center justify-center gap-2 text-xs sm:text-sm"
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

      <div className="mt-5 pt-4 border-t border-slate-100 text-center">
        <span className="text-xs text-slate-500">Already registered? </span>
        <button
          id="btn-switch-to-login"
          type="button"
          onClick={onSwitchToLogin}
          className="text-xs font-bold text-gold-600 hover:text-navy-950 underline"
        >
          Sign in here
        </button>
      </div>
    </div>
  );
};

export default RegisterForm;
