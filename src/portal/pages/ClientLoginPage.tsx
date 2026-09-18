import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, KeyRound, Mail, MessageSquareWarning, Phone, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button, Field, Input, PasswordInput } from '../components/ui';
import { authService } from '../services/auth';

type Mode = 'signin' | 'forgot' | 'reset';

const ClientLoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('signin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Forgot / reset flow
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sentTo, setSentTo] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!identifier.trim() || !password) {
      setError('Please enter your mobile number or email, and your password.');
      return;
    }
    setLoading(true);
    try {
      const user = await login(identifier.trim(), password);
      navigate(user.role === 'CLIENT' ? '/portal' : '/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!sentTo) {
      if (!identifier.trim()) {
        setError('Please enter the email address linked to your account.');
        return;
      }
      setLoading(true);
      try {
        const res = await authService.forgotPassword(identifier.trim().toLowerCase());
        setNotice(res.message || 'A verification code has been sent.');
        setDemoOtp(res.demoOtp || '');
        setSentTo(identifier.trim().toLowerCase());
      } catch (err: any) {
        setError(err.message || 'Unable to send code. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!otp.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      await authService.verifyOtp(sentTo, otp.trim());
      setMode('reset');
      setError('');
      setNotice('Code verified. Please set a new password.');
    } catch (err: any) {
      setError(err.message || 'Incorrect or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(sentTo, otp.trim(), newPassword);
      setNotice('Password updated. Please sign in with your new password.');
      setMode('signin');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtp('');
      setSentTo('');
      setDemoOtp('');
    } catch (err: any) {
      setError(err.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {mode === 'signin' && 'Welcome back'}
          {mode === 'forgot' && 'Forgot password'}
          {mode === 'reset' && 'Choose a new password'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'signin' && 'Sign in to access your loans, savings, and documents.'}
          {mode === 'forgot' && 'We will email you a verification code to reset your password.'}
          {mode === 'reset' && 'Your new password must be at least 6 characters.'}
        </p>
      </div>

      {(error || notice) && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
          role="alert"
        >
          {error ? <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{error || notice}</span>
        </div>
      )}

      {demoOtp && mode === 'forgot' && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Demo mode:</span> your verification code is{' '}
          <span className="font-mono font-bold">{demoOtp}</span>
        </div>
      )}

      {mode === 'signin' && (
        <form onSubmit={handleSignIn} className="space-y-4">
          <Field label="Mobile number or email" required>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="0917 123 4567 or you@email.com"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
          </Field>

          <Field label="Password" required>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
<PasswordInput
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </Field>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError('');
                setNotice('');
              }}
              className="text-xs font-medium text-gold-700 hover:underline"
            >
              Forgot password?
            </button>
            <button
              type="button"
              onClick={() => { navigate('/portal/register'); }}
              className="text-xs font-medium text-gold-700 hover:underline"
            >
              Create an account
            </button>
          </div>

          <Button type="submit" fullWidth size="lg" loading={loading}>
            Sign in
          </Button>
        </form>
      )}

      {mode === 'forgot' && (
        <form onSubmit={handleForgot} className="space-y-4">
          {!sentTo ? (
            <Field label="Account email" required hint="Use the email you registered with.">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  type="email"
                  placeholder="you@email.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            </Field>
          ) : (
            <Field label="Verification code" required>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9 font-mono tracking-widest"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </Field>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
                setNotice('');
                setSentTo('');
              }}
              className="text-xs font-medium text-slate-500 hover:underline"
            >
              ← Back to sign in
            </button>
            {sentTo && (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setNotice('');
                  setDemoOtp('');
                  setSentTo('');
                }}
                className="text-xs font-medium text-gold-700 hover:underline"
              >
                Use a different email
              </button>
            )}
          </div>

          <Button type="submit" fullWidth size="lg" loading={loading}>
            {sentTo ? 'Verify code' : 'Send code'}
          </Button>
        </form>
      )}

      {mode === 'reset' && (
        <form onSubmit={handleReset} className="space-y-4">
          <Field label="New password" required hint="At least 6 characters.">
            <PasswordInput
              placeholder="New password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password" required>
            <PasswordInput
              placeholder="Re-enter new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Field>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError('');
                setNotice('');
              }}
              className="text-xs font-medium text-slate-500 hover:underline"
            >
              ← Back
            </button>
          </div>

          <Button type="submit" fullWidth size="lg" loading={loading}>
            Update password
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">
        New to HOSCOMO?{' '}
        <Link to="/portal/register" className="font-medium text-gold-700 hover:underline">
          Register as a member
        </Link>
      </p>

      <div className="mt-6 flex items-center justify-center gap-4 border-t border-slate-100 pt-6 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Building2 className="h-3.5 w-3.5" /> Cooperatively owned
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Bank-grade security
        </span>
      </div>
    </div>
  );
};

export default ClientLoginPage;