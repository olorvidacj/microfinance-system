import React, { useState } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Building,
  DollarSign,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Smartphone,
  CheckCircle2,
  BadgeCheck,
} from 'lucide-react';
import { AuthHeader } from './AuthHeader';
import { useAuth } from '../../context/AuthContext';
import {
  STEP_ORDER,
  STEP_LABELS,
  INITIAL_STEPS,
  RegistrationStep,
  RegistrationSteps,
} from '../../types/auth.types';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
  onBack?: () => void;
}

const STEP_INDEX: Record<RegistrationStep, number> = { account: 0, client: 1, security: 2 };

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onSwitchToLogin, onBack }) => {
  const { register } = useAuth();

  const [steps, setSteps] = useState<RegistrationSteps>(INITIAL_STEPS);
  const [step, setStep] = useState<RegistrationStep>('account');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const setField = <K extends keyof RegistrationSteps>(
    section: K,
    field: keyof RegistrationSteps[K],
    value: string | boolean
  ) => {
    setSteps((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as object), [field]: value } as RegistrationSteps[K],
    }));
  };

  const currentIndex = STEP_INDEX[step];
  const isLast = currentIndex === STEP_ORDER.length - 1;

  const validateCurrent = (): string | null => {
    const acc = steps.account;
    if (step === 'account') {
      if (!acc.fullName.trim()) return 'Full legal name is required.';
      if (!acc.phone.trim()) return 'Philippine mobile phone number is required.';
      if (acc.email.trim() && !/^\S+@\S+\.\S+$/.test(acc.email.trim())) return 'Please enter a valid email address.';
      return null;
    }
    if (step === 'client') {
      if (!steps.client.address.trim()) return 'Residential address is required.';
      if (!steps.client.occupation.trim()) return 'Occupation or business is required.';
      return null;
    }
    const sec = steps.security;
    if (!sec.password || sec.password.length < 8) return 'Password must be at least 8 characters.';
    if (!/([A-Za-z])/.test(sec.password) || !/([0-9])/.test(sec.password)) {
      return 'Password must contain at least one letter and one number.';
    }
    if (sec.password !== sec.confirmPassword) return 'Passwords do not match. Please verify.';
    if (!sec.agreeTerms) {
      return 'Please accept the Terms of Service and Data Privacy consent.';
    }
    return null;
  };

  const handleNext = () => {
    setError('');
    const err = validateCurrent();
    if (err) {
      setError(err);
      return;
    }
    const idx = currentIndex;
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  };

  const handleBack = () => {
    setError('');
    if (currentIndex > 0) {
      setStep(STEP_ORDER[currentIndex - 1]);
    } else {
      onBack?.();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const err = validateCurrent();
    if (err) {
      setError(err);
      return;
    }
    if (!isLast) return;

    setIsSubmitting(true);
    try {
      const acc = steps.account;
      const cli = steps.client;
      const sec = steps.security;
      const linked = await register({
        fullName: acc.fullName.trim(),
        email: acc.email.trim() || undefined,
        phone: acc.phone.trim(),
        password: sec.password,
        borrowerNumber: acc.borrowerNumber.trim() || undefined,
        address: cli.address.trim() || undefined,
        occupation: cli.occupation.trim() || undefined,
        employerOrBusiness: cli.employerOrBusiness.trim() || undefined,
        monthlyIncome: cli.monthlyIncome ? Number(cli.monthlyIncome) : 35000,
      });

      if (linked.borrowerId) {
        setInfo('Your HOSCOMO account is ready. Your client profile has been successfully linked.');
      } else {
        setInfo('Your HOSCOMO account is ready.');
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center text-center py-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900">Account Created!</h2>
        <p className="mt-2 text-sm text-slate-600">
          Welcome to HOSCOMO, {steps.account.fullName.split(' ')[0]}.
        </p>
        {info && (
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-3">
            <BadgeCheck className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{info}</span>
          </div>
        )}
        <button
          type="button"
          onClick={onSuccess}
          className="mt-6 w-full py-3 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold rounded-xl shadow-md shadow-gold-500/20 transition flex items-center justify-center gap-2 text-sm"
        >
          Enter Client Portal
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const showSteps = (
    <div className="flex p-1 bg-slate-100 rounded-2xl mb-6 border border-slate-200">
      {STEP_ORDER.map((s, i) => (
        <div
          key={s}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
            i === currentIndex
              ? 'bg-gold-400 text-navy-950 shadow-sm shadow-gold-500/20'
              : i < currentIndex
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-500'
          }`}
        >
          <span>{i + 1}</span>
          <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {onBack && (
        <div className="flex items-center justify-between mb-5">
          <AuthHeader />
          <button
            type="button"
            onClick={onBack}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy-950 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </button>
        </div>
      )}

      {showSteps}

      {error && (
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === 'account' && (
        <div className="space-y-3.5">
          <div className="bg-gold-500/10 border border-gold-400/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-navy-900">
            <Smartphone className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-gold-700">Step 1 of 3 — Your Account. </span>
              <span>Complete your registration to access your HOSCOMO client portal.</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Legal Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={steps.account.fullName}
                onChange={(e) => setField('account', 'fullName', e.target.value)}
                placeholder="e.g. Maria Teresa Santos"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Philippine Mobile No. *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                required
                value={steps.account.phone}
                onChange={(e) => setField('account', 'phone', e.target.value)}
                placeholder="0917 123 4567"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={steps.account.email}
                onChange={(e) => setField('account', 'email', e.target.value)}
                placeholder="maria.santos@gmail.com"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Existing Member ID <span className="text-slate-400 font-normal">(Optional — leave blank if new member)</span>
            </label>
            <input
              type="text"
              value={steps.account.borrowerNumber}
              onChange={(e) => setField('account', 'borrowerNumber', e.target.value)}
              placeholder="e.g. MBR-2026-001"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition uppercase"
            />
          </div>
        </div>
      )}

      {step === 'client' && (
        <div className="space-y-3.5">
          <div className="bg-gold-500/10 border border-gold-400/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-navy-900">
            <Briefcase className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-gold-700">Step 2 of 3 — Your Client Information. </span>
              <span>Help us get to know you so we can tailor our financial services.</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Residential Address *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={steps.client.address}
                onChange={(e) => setField('client', 'address', e.target.value)}
                placeholder="e.g. Tacloban City, Leyte"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Occupation / Business *
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={steps.client.occupation}
                onChange={(e) => setField('client', 'occupation', e.target.value)}
                placeholder="e.g. Sari-Sari Store Owner"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Employer / Business Name <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={steps.client.employerOrBusiness}
                onChange={(e) => setField('client', 'employerOrBusiness', e.target.value)}
                placeholder="e.g. Santos General Store"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Monthly Income *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                required
                value={steps.client.monthlyIncome}
                onChange={(e) => setField('client', 'monthlyIncome', e.target.value)}
                placeholder="e.g. 35000"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
              />
            </div>
          </div>
        </div>
      )}

      {step === 'security' && (
        <div className="space-y-3.5">
          <div className="bg-gold-500/10 border border-gold-400/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-navy-900">
            <Lock className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-gold-700">Step 3 of 3 — Secure Your Account. </span>
              <span>Choose a strong password to protect your member account.</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Create Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={steps.security.password}
                onChange={(e) => setField('security', 'password', e.target.value)}
                placeholder="Min. 8 characters, with a letter and number"
                className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={steps.security.confirmPassword}
                onChange={(e) => setField('security', 'confirmPassword', e.target.value)}
                placeholder="Repeat password"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 outline-none text-xs sm:text-sm transition"
              />
            </div>
          </div>

          <ul className="space-y-1.5 text-[11px]">
            <li className={`flex items-center gap-2 ${steps.security.password.length >= 8 ? 'text-emerald-700' : 'text-slate-500'}`}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              At least 8 characters
            </li>
            <li className={`flex items-center gap-2 ${/([A-Za-z])/.test(steps.security.password) && /([0-9])/.test(steps.security.password) ? 'text-emerald-700' : 'text-slate-500'}`}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Contains a letter and a number
            </li>
            <li className={`flex items-center gap-2 ${steps.security.password && steps.security.password === steps.security.confirmPassword ? 'text-emerald-700' : 'text-slate-500'}`}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Passwords match
            </li>
          </ul>

          <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={steps.security.agreeTerms}
              onChange={(e) => setField('security', 'agreeTerms', e.target.checked)}
              className="mt-0.5 rounded text-gold-600 focus:ring-gold-500 border-slate-300"
            />
            <span className="text-[11px] text-slate-600 leading-tight">
              I agree to the <strong>Terms of Service</strong> and consent to credit verification under the <strong>Data Privacy Act (RA 10173)</strong>.
            </span>
          </label>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3 mt-6">
        <button
          type="button"
          onClick={handleBack}
          className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-sm font-semibold flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        {!isLast ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex-[2] py-3 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold rounded-xl shadow-md shadow-gold-500/20 transition flex items-center justify-center gap-2 text-sm"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-[2] py-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-md shadow-green-600/20 transition flex items-center justify-center gap-2 text-sm"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Account
          </button>
        )}
      </div>

      {onSwitchToLogin && (
        <div className="text-center pt-4">
          <span className="text-xs text-slate-500">Already registered? </span>
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-xs font-bold text-gold-600 hover:text-gold-700 underline"
          >
            Sign In
          </button>
        </div>
      )}
    </div>
  );
};

export { RegisterForm };
