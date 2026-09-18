import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Input, Label } from '../../portal/components/ui/Field';

export const StaffLoginPage: React.FC = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user && user.role === 'STAFF') {
    return <Navigate to="/staff/app" replace />;
  }

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const u = await login(email, password);
      if (u.role === 'STAFF') {
        navigate('/staff/app', { replace: true });
      } else {
        setError('This is a client member account. Please use the Client Member Portal instead.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in. Verify your work credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#091527] p-4 sm:p-6 selection:bg-amber-400 selection:text-slate-950">
      {/* Background radial glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Header Branding */}
        <div className="mb-6 flex flex-col items-center text-center text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-xl shadow-amber-500/20 ring-1 ring-amber-300/50">
            <Building2 className="h-8 w-8 stroke-[2.2]" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            HOSCOMCO Microfinance Cooperative
          </h1>
          <p className="mt-1 text-sm font-medium text-amber-300">Staff & Operations Portal</p>
          <p className="text-xs text-slate-400">Tacloban, Leyte, Philippines · Main Operations Branch</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-800 bg-white p-7 sm:p-8 shadow-2xl">
          <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Branch Personnel Sign In</h2>
              <p className="text-xs text-slate-500">Access daily client, loan, and ledger desk</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              Active Shift
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="staff-email" className="text-xs font-semibold text-slate-700">
                Work Email Address
              </Label>
              <Input
                id="staff-email"
                type="email"
                autoComplete="username"
                placeholder="officer@HOSCOMCO.coop"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="staff-password" className="text-xs font-semibold text-slate-700">
                Access Password
              </Label>
              <Input
                id="staff-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-4 py-3 text-sm font-bold text-slate-950 shadow-md transition-all hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
              ) : (
                <LockKeyhole className="h-4 w-4 text-slate-950" />
              )}
              Sign in to Operations Desk
            </button>
          </form>

          {/* Quick Demo Shift Access */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex items-center gap-1.5 pb-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Verify credentials
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Use the email registered to your HOSCOMCO work account. Contact the System
              Administrator if you do not have branch access yet.
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <Link to="/login" className="font-semibold text-slate-600 hover:text-slate-900">
              ← Client Member Portal
            </Link>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Tacloban Branch Secured
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffLoginPage;
