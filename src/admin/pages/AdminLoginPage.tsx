import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, ShieldCheck, MapPin, Phone, ArrowLeft,
} from 'lucide-react';
import { COOP_INFO } from '../data/mockData';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email/username and password.');
      return;
    }
    setLoading(true);
    // Mock authentication - any credentials accepted for the demo
    setTimeout(() => {
      setLoading(false);
      try {
        sessionStorage.setItem('hoscomo_admin_session', '1');
      } catch {}
      navigate('/admin');
    }, 900);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex w-1/2 relative bg-slate-900 text-white flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(245,158,11,0.3) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(59,130,246,0.3) 0%, transparent 45%)',
        }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-slate-900 font-black text-2xl shadow-lg">
            H
          </div>
          <div>
            <div className="font-bold text-lg tracking-tight leading-tight">HOSCOMO</div>
            <div className="text-[11px] text-amber-400 uppercase tracking-widest font-medium">Microfinance Cooperative</div>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-3xl font-bold leading-tight">
            Admin Console for<br />
            <span className="text-amber-400">Client Services &</span><br />
            Financial Management
          </h1>
          <p className="mt-4 text-slate-400 text-sm leading-relaxed">
            {COOP_INFO.motto}
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <ShieldCheck className="w-5 h-5 text-amber-400 mb-2" />
              <p className="text-sm font-semibold">Secure Access</p>
              <p className="text-xs text-slate-400 mt-0.5">Role-based permissions</p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <Building2 className="w-5 h-5 text-amber-400 mb-2" />
              <p className="text-sm font-semibold">Branch Network</p>
              <p className="text-xs text-slate-400 mt-0.5">Tacloban · Palo · Dulag</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-slate-500">
          <MapPin className="w-3.5 h-3.5" />
          <span>Magallanes Street, Tacloban City, Leyte 6500</span>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 p-8">
            <div className="flex lg:hidden items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-slate-900 font-black text-xl">
                H
              </div>
              <div>
                <div className="font-bold text-slate-900 leading-tight">HOSCOMO</div>
                <div className="text-[10px] text-amber-600 uppercase tracking-widest font-medium">Admin Console</div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-slate-900">Administrator Sign In</h2>
            <p className="mt-1 text-sm text-slate-500">Enter your credentials to access the admin dashboard.</p>

            {error && (
              <div className="mt-4 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email or Username
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@hoscomo.coop"
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">Password</label>
                  <button type="button" className="text-xs text-blue-600 hover:underline font-medium">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Remember me
                </label>
                <span className="text-[11px] text-slate-400">2FA Enabled</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white font-semibold rounded-xl transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {loading ? 'Signing In...' : 'Sign In to Admin Console'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3 h-3" />
                  {COOP_INFO.phone}
                </span>
                <span className="mx-2">·</span>
                {COOP_INFO.email}
              </p>
              <p className="mt-1.5 text-[10px] text-slate-300">
                For assistance, contact the system administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};