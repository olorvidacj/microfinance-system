import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, FileCheck2, Mail, Shield, ShieldCheck } from 'lucide-react';
import { RegistrationError, useAuth } from '../../context/AuthContext';
import { Button } from '../components/ui';
import { PasswordStrengthIndicator } from '../../components/common/PasswordStrengthIndicator';
import { isPasswordStrong, STRONG_PASSWORD_ERROR_MESSAGE } from '../../utils/passwordValidator';
import { MemberDetailsForm } from '../../components/onboarding/MemberDetailsForm';
import { normalizeEmail, validateRegistration, type RegistrationInput } from '../../../shared/kyc-core';

type Step = 'email' | 'details' | 'password' | 'done';

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-gold-500 focus:bg-white focus:ring-2 focus:ring-gold-500/20';

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

async function postJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new RegistrationError(data.error || 'Request failed', data.errors || {}, data.code);
  return data;
}

const StepDots: React.FC<{ step: Step }> = ({ step }) => {
  const steps: Step[] = ['email', 'details', 'password'];
  const labels = ['Verify email', 'Your details', 'Password'];
  const current = steps.indexOf(step);
  return (
    <ol className="flex items-center gap-2 text-[11px] font-medium" aria-label="Registration progress">
      {steps.map((s, i) => (
        <li key={s} className={`flex items-center gap-1.5 ${i <= current ? 'text-gold-800' : 'text-slate-400'}`}>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i < current ? 'bg-emerald-600 text-white' : i === current ? 'bg-gold-500 text-navy-950' : 'bg-slate-200'}`}>
            {i < current ? '✓' : i + 1}
          </span>
          {labels[i]}
          {i < steps.length - 1 && <span className="mx-1 text-slate-300">›</span>}
        </li>
      ))}
    </ol>
  );
};

export const ClientRegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('email');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');

  const [details, setDetails] = useState<RegistrationInput>({ address: {} });
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<Array<{ id: string; name: string; city: string }>>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState<{ fullName: string } | null>(null);

  useEffect(() => {
    fetch('/api/public/branches')
      .then((r) => r.json())
      .then((d) => setBranches(d?.branches || []))
      .catch(() => setError('Could not load the list of branches. Please refresh the page.'));
  }, []);

  const fail = (err: unknown) => {
    if (err instanceof RegistrationError) {
      setError(err.message);
      setFieldErrors(err.fieldErrors);
      if (Object.keys(err.fieldErrors).some((k) => k !== 'password' && k !== 'confirmPassword')) setStep('details');
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setToken('');
        setCodeSent(false);
        setStep('email');
      }
    } else {
      setError((err as Error)?.message || 'Something went wrong. Please try again.');
    }
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const normalized = normalizeEmail(email);
    if (!normalized) return setError('Enter a valid email address.');
    setBusy(true);
    try {
      await postJson('/api/auth/email-code', { email: normalized });
      setEmail(normalized);
      setCodeSent(true);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await postJson('/api/auth/email-code/verify', { email, code });
      setToken(data.verificationToken);
      setStep('details');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const continueToPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = validateRegistration({ ...details, email }, 'SELF', today());
    const errors = { ...result.errors };
    if (!branchId) errors.branchId = 'Choose your branch.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please correct the highlighted fields.');
      return;
    }
    setStep('password');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isPasswordStrong(password)) return setError(STRONG_PASSWORD_ERROR_MESSAGE);
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (!agree) return setError('Please accept the Terms of Service and the Data Privacy Notice (RA 10173).');
    setBusy(true);
    try {
      const user = await register({ ...details, email, branchId, password, confirmPassword, emailVerificationToken: token });
      setDone({ fullName: user.fullName });
      setStep('done');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done' && done) {
    return (
      <div id="register-success-view" className="space-y-6 py-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Your account is ready</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            Welcome, <strong className="text-slate-800">{done.fullName}</strong>. Your email is verified.
          </p>
        </div>
        <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-left text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <Shield className="h-4 w-4 shrink-0 text-amber-700" />
            Next: verify your identity (KYC)
          </div>
          <p className="mt-1.5 leading-relaxed text-amber-800">
            Upload your government ID and a selfie. You can apply for loans and use savings once a branch officer verifies them.
          </p>
        </div>
        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          <Button id="btn-complete-kyc" onClick={() => navigate('/portal/kyc', { replace: true })} className="w-full py-3 text-sm font-semibold sm:flex-1">
            <FileCheck2 className="mr-2 h-4 w-4" /> Start KYC
          </Button>
          <Button id="btn-continue-dashboard" variant="outline" onClick={() => navigate('/portal', { replace: true })} className="w-full py-3 text-sm font-semibold sm:flex-1">
            Go to dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div id="client-register-card" className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Become a member</h2>
        <StepDots step={step} />
      </div>

      {error && (
        <div id="register-error-banner" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 sm:text-sm" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={codeSent ? verifyCode : sendCode} className="space-y-4">
          <p className="text-sm text-slate-600">We will send a 6-digit code to confirm your email address.</p>
          <div>
            <label htmlFor="reg-email" className="mb-1 block text-xs font-semibold text-slate-700">
              Email address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                required
                disabled={codeSent}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>
          {codeSent && (
            <div>
              <label htmlFor="reg-code" className="mb-1 block text-xs font-semibold text-slate-700">
                6-digit code
              </label>
              <input
                id="reg-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={`${inputCls} tracking-[0.4em] text-center font-mono text-lg`}
              />
              <div className="mt-2 flex justify-between text-xs">
                <button type="button" className="text-slate-500 hover:underline" onClick={() => { setCodeSent(false); setCode(''); }}>
                  Change email
                </button>
                <button type="button" className="font-semibold text-gold-700 hover:underline" disabled={busy} onClick={() => sendCode()}>
                  Send a new code
                </button>
              </div>
            </div>
          )}
          <Button id={codeSent ? 'btn-verify-code' : 'btn-send-code'} type="submit" fullWidth loading={busy} className="py-3 text-sm font-semibold">
            {codeSent ? 'Verify code' : 'Send code'}
          </Button>
        </form>
      )}

      {step === 'details' && (
        <form onSubmit={continueToPassword} className="space-y-5" noValidate>
          <p className="text-xs text-slate-500">
            Verified email: <strong className="text-slate-700">{email}</strong>. Enter your details exactly as they appear on your government ID.
          </p>
          <div>
            <label htmlFor="reg-branch" className="mb-1 block text-xs font-medium text-slate-600">
              Your branch <span className="text-rose-500">*</span>
            </label>
            <select id="reg-branch" className={inputCls} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Choose the branch you will visit…</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.city}
                </option>
              ))}
            </select>
            {fieldErrors.branchId && <p className="mt-1 text-xs text-rose-600">{fieldErrors.branchId}</p>}
          </div>
          <MemberDetailsForm value={details} onChange={setDetails} errors={fieldErrors} channel="SELF" hideEmail idPrefix="reg" />
          <Button id="btn-details-next" type="submit" fullWidth className="py-3 text-sm font-semibold">
            Continue <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="reg-password" className="mb-1 block text-xs font-semibold text-slate-700">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input id="reg-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} pr-9`} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="reg-confirm-password" className="mb-1 block text-xs font-semibold text-slate-700">
              Confirm password <span className="text-rose-500">*</span>
            </label>
            <input id="reg-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} />
          </div>
          <PasswordStrengthIndicator password={password} confirmPassword={confirmPassword} />
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <input id="reg-agree-terms" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span className="text-xs leading-relaxed text-slate-600">
              I agree to the HOSCOMCO <span className="font-semibold text-slate-800">Terms of Service</span> and consent to the processing of my personal data under the{' '}
              <span className="font-semibold text-slate-800">Data Privacy Act (RA 10173)</span>.
            </span>
          </label>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep('details')} className="py-3">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button id="btn-submit-registration" type="submit" fullWidth loading={busy} className="py-3 text-sm font-semibold">
              <ShieldCheck className="mr-1 h-4 w-4" /> Create account
            </Button>
          </div>
        </form>
      )}

      <div className="pt-2 text-center text-xs text-slate-500">
        Already have an account?{' '}
        <Link id="link-signin" to="/portal/login" className="font-semibold text-gold-700 hover:underline">
          Sign in here
        </Link>
      </div>
    </div>
  );
};

export default ClientRegisterPage;
