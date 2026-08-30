import React, { useState } from 'react';
import {
  Building2,
  Mail,
  Lock,
  User,
  Phone,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  Smartphone,
  AlertCircle,
  Sparkles,
  BadgeCheck,
  ArrowLeft,
  UserPlus,
  LogIn,
  MapPin,
  Briefcase,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginViewProps {
  initialMode?: 'signin' | 'register';
  onBack?: () => void;
  onAuthenticated?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  initialMode = 'signin',
  onBack,
  onAuthenticated,
}) => {
  const { login, register } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);
  
  // Sign In state
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [borrowerNumber, setBorrowerNumber] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('35000');
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Feedback state
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetFeedback = () => {
    setError('');
    setInfo('');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    if (!emailOrPhone.trim() || !password) {
      setError('Please enter your email or phone number, and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      await login(emailOrPhone.trim(), password);
      onAuthenticated?.();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    if (!fullName.trim()) {
      setError('Full legal name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Philippine mobile phone number is required.');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }
    if (!agreeTerms) {
      setError('Please accept the Terms of Service and Data Privacy consent.');
      return;
    }

    setIsSubmitting(true);
    try {
      const linked = await register({
        fullName: fullName.trim(),
        email: regEmail.trim() || undefined,
        phone: phone.trim(),
        password: regPassword,
        borrowerNumber: borrowerNumber.trim() || undefined,
        address: address.trim() || undefined,
        occupation: occupation.trim() || undefined,
        monthlyIncome: monthlyIncome ? Number(monthlyIncome) : 35000,
      });

      if (!linked.borrowerId) {
        setInfo('Account created successfully! Welcome to HOSCOMO Microfinance.');
      }
      onAuthenticated?.();
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (next: 'signin' | 'register') => {
    setMode(next);
    resetFeedback();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-5xl bg-white rounded-[32px] shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-slate-200">
        
        {/* Left Branding Panel */}
        <div className="relative bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 p-8 sm:p-10 text-white hidden lg:flex lg:col-span-5 flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur-sm shadow-inner">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-bold text-xl tracking-tight">HOSCOMO</span>
                <p className="text-[11px] text-blue-200 uppercase tracking-widest font-semibold">Microfinance Cooperative</p>
              </div>
            </div>

            <h1 className="mt-12 text-2xl sm:text-3xl font-extrabold leading-snug">
              {mode === 'register' ? 'Join HOSCOMO Microfinance' : 'Cooperative Access Portal'}
            </h1>
            <p className="mt-3 text-xs sm:text-sm text-blue-100/90 leading-relaxed">
              {mode === 'register'
                ? 'Create your member account in under 2 minutes to apply for loans, manage savings passbooks, and access community solidarity programs.'
                : 'Sign in to access the Staff Management Console or the Member Client Self-Service Portal.'}
            </p>

            <div className="mt-8 space-y-3 text-xs">
              <div className="flex items-center gap-3 bg-white/10 rounded-xl px-3.5 py-2.5 border border-white/15">
                <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>Bank-grade encrypted passwords & signed sessions</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 rounded-xl px-3.5 py-2.5 border border-white/15">
                <Smartphone className="w-4 h-4 text-blue-200 shrink-0" />
                <span>Members: check balances, pay loans & request withdrawals</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 rounded-xl px-3.5 py-2.5 border border-white/15">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                <span>Staff: full origination, collections & AI underwriting suite</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-200/70">
            <span>© 2026 HOSCOMO Cooperative</span>
            <span>Tacloban, Leyte</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="p-6 sm:p-10 lg:col-span-7 flex flex-col justify-center max-h-[90vh] overflow-y-auto">
          
          {/* Header & Back Button */}
          <div className="flex items-center justify-between mb-5">
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Building2 className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-900 text-base">HOSCOMO</span>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-700 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to home
              </button>
            )}
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-2xl mb-6 border border-slate-200">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
                mode === 'signin'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
                mode === 'register'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Register as Client / Member
            </button>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="mb-4 flex items-center gap-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mb-4 flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-3">
              <BadgeCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{info}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SIGN IN FORM */}
          {/* ========================================================================= */}
          {mode === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address or Mobile Phone Number
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    placeholder="e.g. staff@hoscomo.coop or 09175554321"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition"
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 text-sm"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In to Account
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-500">Don't have a cooperative account? </span>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 underline"
                >
                  Register as Client Now
                </button>
              </div>
            </form>
          ) : (
            /* ========================================================================= */
            /* CLIENT REGISTRATION FORM */
            /* ========================================================================= */
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
                <Smartphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-blue-800">Direct Client Portal Access: </span>
                  <span>Fill in your details below. Your client passbook and portal will be provisioned instantly.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Legal Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Legal Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Maria Teresa Santos"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm transition"
                    />
                  </div>
                </div>

                {/* Philippine Mobile Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Philippine Mobile No. *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0917 123 4567"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm transition"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="maria.santos@gmail.com"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm transition"
                    />
                  </div>
                </div>

                {/* Existing Member ID to link */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Existing Member ID <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={borrowerNumber}
                    onChange={(e) => setBorrowerNumber(e.target.value)}
                    placeholder="e.g. MBR-2024-001"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm transition uppercase"
                  />
                </div>
              </div>

              {/* Address & Occupation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Residential Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Tacloban City, Leyte"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Occupation / Business
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      placeholder="e.g. Sari-Sari Store Owner"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm transition"
                    />
                  </div>
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm transition"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm transition"
                  />
                </div>
              </div>

              {/* Consent checkbox */}
              <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span className="text-[11px] text-slate-600 leading-tight">
                  I agree to the <strong>Terms of Service</strong> and consent to credit verification under the <strong>Data Privacy Act (RA 10173)</strong>.
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 text-sm"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Member Account & Enter Portal
              </button>

              <div className="text-center pt-1">
                <span className="text-xs text-slate-500">Already registered? </span>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 underline"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
