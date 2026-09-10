import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isBranchStaffRole } from '../components/layout/BranchLayout';
import { Input, Label } from '../../portal/components/ui/Field';

const StaffLoginPage: React.FC = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user && user.role === 'STAFF' && isBranchStaffRole(user.staffRole)) {
    return <Navigate to="/staff/app" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      if (u.role === 'STAFF' && isBranchStaffRole(u.staffRole)) {
        navigate('/staff/app', { replace: true });
      } else {
        setError('This account is not authorized for the Branch Portal. Please use the administration console.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in. Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-white">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-bold">HOSCOMO Branch Portal</h1>
          <p className="mt-1 text-sm text-blue-200">Branch personnel sign in</p>
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="staff-email">Work email</Label>
              <Input
                id="staff-email"
                type="email"
                autoComplete="username"
                placeholder="name@branch.coop"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="staff-password">Password</Label>
              <Input
                id="staff-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <LockKeyhole className="h-4 w-4" />
              Sign in to Branch Portal
            </button>
          </form>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p className="text-xs text-slate-600">
              Access is restricted to branch-assigned personnel. All actions are recorded in the branch audit trail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffLoginPage;