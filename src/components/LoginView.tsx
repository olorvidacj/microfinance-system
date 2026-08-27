import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DemoAccount {
  label: string;
  email: string;
  password: string;
}

interface LoginViewProps {
  onBack?: () => void;
  onAuthenticated?: () => void;
}

const FALLBACK_DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Staff — Super Admin', email: 'elena.rostata@hoscomo.coop', password: 'Admin@123' },
  { label: 'Staff — Loan Processor', email: 'grace.m@hoscomo.coop', password: 'Staff@123' },
  { label: 'Client Portal Member', email: 'teresa.alcantara@gmail.com', password: 'Client@123' },
];

export const LoginView: React.FC<LoginViewProps> = ({ onBack, onAuthenticated }) => {
  const { login, register } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [borrowerNumber, setBorrowerNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>(FALLBACK_DEMO_ACCOUNTS);

  useEffect(() => {
    fetch('/api/auth/demo-accounts')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.accounts?.length) setDemoAccounts(data.accounts);
      })
      .catch(() => {});
  }, []);

  const resetFeedback = () => {
    setError('');
    setInfo('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    setIsSubmitting(true);
    try {
      if (mode === 'signin') {
        await login(email.trim(), password);
        onAuthenticated?.();
      } else {
        const linked = await register({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          borrowerNumber: borrowerNumber.trim() || undefined,
        });
        if (!linked.borrowerId) {
          setInfo('Account created. A loan officer will link your member record after verification.');
        }
        onAuthenticated?.();
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (next: 'signin' | 'register') => {
    setMode(next);
    resetFeedback();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-5xl bg-white rounded-[32px] shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 border border-slate-200">
        {/* Left Branding Panel */}
        <div className="relative bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 p-10 text-white hidden lg:flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur-sm">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-xl tracking-tight">HOSCOMO</span>
                <p className="text-[11px] text-blue-200 uppercase tracking-widest">Microfinance Cooperative</p>
              </div>
            </div>

            <h1 className="mt-14 text-3xl font-bold leading-snug">
              Secure Access to Loans, Savings & Member Services
            </h1>
            <p className="mt-4 text-sm text-blue-100/90 leading-relaxed max-w-sm">
              Staff console and the Client Self-Service Portal are now protected. Sign in with your
              cooperative credentials to continue.
            </p>

            <div className="mt-8 space-y-3 text-xs">
              <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 border border-white/15">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Bank-grade encrypted passwords & signed sessions</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 border border-white/15">
                <Smartphone className="w-4 h-4 text-blue-200" />
                <span>Clients: check balances, pay loans & request withdrawals</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 border border-white/15">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Staff: full origination, collections & AI underwriting suite</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-blue-200/70">© 2026 HOSCOMO Microfinance • Tacloban, Leyte</p>
        </div>

        {/* Right Form Panel */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-6 lg:mb-0">
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-900 text-lg">HOSCOMO</span>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="ml-auto lg:ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-700 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to home
              </button>
            )}
          </div>

          {/* Web Access Notice */}
          <div className="mb-6 p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900">
            <Smartphone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-800">Borrower / Client Access: </span>
              <span>Client self-service & new member registration are hosted on the <strong>HOSCOMO React Native Mobile App</strong>. Web portal sign-in is reserved for Cooperative Staff & Administrators.</span>
            </div>
          </div>

          <h2 className="text-xl font-bold text-slate-900">
            Staff & Administration Sign In
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-6">
            Enter your cooperative staff credentials to access the management workstation.
          </p>

          {error && (
            <div className="mb-4 flex items-center gap-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 flex items-center gap-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-3">
              <BadgeCheck className="w-4 h-4 shrink-0" />
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@hoscomo.coop"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
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
              Sign In to Workstation
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              Demo Accounts — click to autofill
            </div>
            <div className="space-y-2">
              {demoAccounts.map((acct) => (
                <button
                  key={acct.email}
                  onClick={() => {
                    switchMode('signin');
                    setEmail(acct.email);
                    setPassword(acct.password);
                    resetFeedback();
                  }}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 transition text-left group"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800">{acct.label}</div>
                    <div className="text-[11px] text-slate-400 truncate font-mono">{acct.email}</div>
                  </div>
                  <code className="text-[11px] text-slate-500 group-hover:text-blue-700 shrink-0">{acct.password}</code>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
