import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  KeyRound,
  Mail,
  MessageSquareWarning,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button, Field, Input, PasswordInput, Select, Textarea } from '../components/ui';
import { authService } from '../services/auth';

const STEPS = [
  { id: 1, label: 'Personal', icon: UserRound },
  { id: 2, label: 'Contact', icon: Mail },
  { id: 3, label: 'Verify', icon: BadgeCheck },
  { id: 4, label: 'Work', icon: Building2 },
  { id: 5, label: 'Address', icon: Phone },
  { id: 6, label: 'Account', icon: KeyRound },
  { id: 7, label: 'Review', icon: ShieldCheck },
];

interface FormState {
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  civilStatus: string;
  nationality: string;
  email: string;
  phone: string;
  secondaryPhone: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  postalCode: string;
  occupation: string;
  employerOrBusiness: string;
  monthlyIncome: string;
  borrowerNumber: string;
  password: string;
  confirmPassword: string;
  consentTerms: boolean;
  consentPrivacy: boolean;
  otp: string;
}

const initial: FormState = {
  fullName: '',
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'Female',
  civilStatus: 'Single',
  nationality: 'Filipino',
  email: '',
  phone: '',
  secondaryPhone: '',
  street: '',
  barangay: '',
  city: '',
  province: '',
  postalCode: '',
  occupation: '',
  employerOrBusiness: '',
  monthlyIncome: '',
  borrowerNumber: '',
  password: '',
  confirmPassword: '',
  consentTerms: false,
  consentPrivacy: false,
  otp: '',
};

const ClientRegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof FormState, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  };

  const fullName = useMemo(() => {
    const parts = [form.firstName, form.middleName, form.lastName].filter(Boolean);
    return parts.length === 3 ? `${parts[0]} ${parts[1].charAt(0) || ''}${parts[1] ? `. ${parts[2]}` : parts[2]}` : parts.join(' ');
  }, [form.firstName, form.middleName, form.lastName]);

  const address = useMemo(() => {
    const parts = [form.street, form.barangay, form.city, form.province, form.postalCode].filter(Boolean);
    return parts.join(', ');
  }, [form.street, form.barangay, form.city, form.province, form.postalCode]);

  const digitOnly = (s: string) => s.replace(/\D/g, '');

  const validate = (s: number): string => {
    switch (s) {
      case 1:
        if (!form.firstName.trim() || !form.lastName.trim()) return 'Please enter your first and last name.';
        if (!form.dateOfBirth) return 'Please enter your date of birth.';
        return '';
      case 2:
        if (!form.email.trim() || !/.+@.+\..+/.test(form.email)) return 'Please enter a valid email address.';
        if (digitOnly(form.phone).length < 10) return 'Please enter a valid Philippine mobile number (e.g. 0917 123 4567).';
        return '';
      case 6:
        if (form.password.length < 6) return 'Password must be at least 6 characters.';
        if (form.password !== form.confirmPassword) return 'Passwords do not match.';
        return '';
      case 7:
        if (!form.consentTerms || !form.consentPrivacy) return 'Please accept the terms and privacy policy to continue.';
        return '';
      default:
        return '';
    }
  };

  const next = () => {
    const v = validate(step);
    if (v) return setError(v);
    setError('');
    if (step === 3 && !otpVerified) return setError('Please verify your mobile number before continuing.');
    setStep((s) => Math.min(7, s + 1));
  };

  const back = () => {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  };

  const sendOtp = async () => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const res = await authService.sendRegistrationOtp(form.phone);
      setOtpSent(true);
      setNotice(res.message || 'Verification code sent.');
    } catch (err: any) {
      setError(err.message || 'Unable to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    setNotice('');
    if (digitOnly(form.otp).length !== 6) {
      return setError('Please enter the 6-digit code.');
    }
    setLoading(true);
    try {
      const res = await authService.verifyRegistrationOtp(form.phone, form.otp);
      if (res.verified) {
        setOtpVerified(true);
        setNotice('Mobile number verified successfully.');
      } else {
        setNotice('');
        setError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Incorrect or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const v = validate(7);
    if (v) return setError(v);
    setLoading(true);
    try {
      const payload: any = {
        fullName: fullName || form.fullName,
        email: form.email.trim().toLowerCase(),
        phone: digitOnly(form.phone),
        password: form.password,
        dateOfBirth: form.dateOfBirth,
        address: address || 'Tacloban City, Leyte',
        civilStatus: form.civilStatus,
        occupation: form.occupation,
        employerOrBusiness: form.employerOrBusiness,
        monthlyIncome: Number(form.monthlyIncome) || 0,
        borrowerNumber: form.borrowerNumber.trim() || undefined,
      };
      const user = await register(payload);
      setSubmitted(true);
      navigate(user.role === 'CLIENT' ? '/portal' : '/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <Check className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Welcome to HOSCOMCO!</h2>
        <p className="mt-2 text-sm text-slate-500">Your member account has been created. Taking you to your portal…</p>
      </div>
    );
  }

  return (
    <div>
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h2>
          <span className="text-sm font-medium text-slate-400">
            Step {step} of {STEPS.length}
          </span>
        </div>
        <div className="mt-3 hidden items-center justify-between sm:flex">
          {STEPS.map((s) => (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    s.id < step
                      ? 'bg-gold-400 text-navy-950'
                      : s.id === step
                        ? 'bg-gold-500/10 text-gold-700 ring-2 ring-gold-400'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {s.id < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <span className={`text-[10px] font-medium ${s.id <= step ? 'text-gold-700' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
              {s.id < STEPS.length && <div className={`mx-1 mb-4 h-0.5 flex-1 rounded ${s.id < step ? 'bg-gold-400' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 sm:hidden">
          <div className="h-full bg-gold-400 transition-all" style={{ width: `${(step / STEPS.length) * 100}%` }} />
        </div>
        <h3 className="mt-5 text-lg font-semibold text-slate-800">{STEPS[step - 1].label} details</h3>
      </div>

      {(error || notice) && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
          role="alert"
        >
          {error ? <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" /> : <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{error || notice}</span>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); submit(e); }} className="space-y-5">
        {step === 1 && (
          <>
            <Field label="First name" required>
              <Input placeholder="Maria" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="given-name" />
            </Field>
            <Field label="Middle name" hint="Optional">
              <Input placeholder="Reyes" value={form.middleName} onChange={(e) => set('middleName', e.target.value)} autoComplete="additional-name" />
            </Field>
            <Field label="Last name" required>
              <Input placeholder="Santos" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="family-name" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of birth" required>
                <Input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
              </Field>
              <Field label="Gender">
                <Select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Prefer not to say</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Civil status">
                <Select value={form.civilStatus} onChange={(e) => set('civilStatus', e.target.value)}>
                  <option>Single</option>
                  <option>Married</option>
                  <option>Widowed</option>
                  <option>Separated</option>
                </Select>
              </Field>
              <Field label="Nationality">
                <Input value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Email address" required hint="Used for statements and reset codes.">
              <Input type="email" placeholder="you@email.com" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
            </Field>
            <Field label="Mobile number" required hint="For SMS OTP verification.">
              <Input placeholder="0917 123 4567" value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" autoComplete="tel" />
            </Field>
            <Field label="Secondary contact" hint="Optional family or business phone.">
              <Input placeholder="0918 234 5678" value={form.secondaryPhone} onChange={(e) => set('secondaryPhone', e.target.value)} inputMode="tel" />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <div className="rounded-xl border border-gold-400/40 bg-gold-500/10 p-4 text-sm text-navy-900">
              <div className="flex items-center gap-2 font-semibold">
                <Phone className="h-4 w-4" /> Verify your mobile number
              </div>
              <p className="mt-1 text-xs leading-relaxed">
                A 6-digit code will be sent to <span className="font-semibold">{form.phone}</span>. This confirms you
                have access to this number.
              </p>
            </div>

            {!otpSent ? (
              <Button type="button" variant="secondary" fullWidth loading={loading} onClick={sendOtp}>
                Send verification code
              </Button>
            ) : (
              <>
                <Field label="6-digit code" required>
                  <Input
                    className="text-center font-mono text-lg tracking-widest"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    value={form.otp}
                    onChange={(e) => set('otp', e.target.value.replace(/\D/g, ''))}
                  />
                </Field>
                {otpVerified ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-gold-700">
                    <BadgeCheck className="h-4 w-4" /> Verified
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" className="flex-1" loading={loading} onClick={verifyOtp}>
                      Verify
                    </Button>
                    <Button type="button" variant="ghost" onClick={sendOtp} disabled={loading}>
                      Resend
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <Field label="Occupation" hint="e.g. Sari-sari store owner, market vendor.">
              <Input placeholder="Micro-entrepreneur" value={form.occupation} onChange={(e) => set('occupation', e.target.value)} />
            </Field>
            <Field label="Employer / Business name">
              <Input placeholder="Negosyo or employer" value={form.employerOrBusiness} onChange={(e) => set('employerOrBusiness', e.target.value)} />
            </Field>
            <Field label="Monthly income (₱)">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="15000"
                value={form.monthlyIncome}
                onChange={(e) => set('monthlyIncome', e.target.value)}
              />
            </Field>
          </>
        )}

        {step === 5 && (
          <>
            <Field label="House number & street">
              <Input placeholder="14 San Pedro St" value={form.street} onChange={(e) => set('street', e.target.value)} autoComplete="street-address" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Barangay / District">
                <Input placeholder="Poblacion" value={form.barangay} onChange={(e) => set('barangay', e.target.value)} />
              </Field>
              <Field label="City / Municipality">
                <Input placeholder="Tacloban City" value={form.city} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Province">
                <Input placeholder="Leyte" value={form.province} onChange={(e) => set('province', e.target.value)} />
              </Field>
              <Field label="Postal code">
                <Input placeholder="6500" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
              </Field>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Already an HOSCOMCO member?</span> Enter your member number
              below to link this account to your existing records. Otherwise leave it blank.
            </div>
            <Field label="Member number" hint="Optional — e.g. MBR-2024-001">
              <Input placeholder="MBR-YYYY-NNN" value={form.borrowerNumber} onChange={(e) => set('borrowerNumber', e.target.value)} />
            </Field>
            <Field label="Create a password" required hint="At least 6 characters.">
              <PasswordInput placeholder="Create password" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} />
            </Field>
            <Field label="Confirm password" required>
              <PasswordInput placeholder="Re-enter password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} />
            </Field>
          </>
        )}

        {step === 7 && (
          <>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <Row label="Name">{fullName}</Row>
              <Row label="Email">{form.email}</Row>
              <Row label="Mobile">{form.phone}</Row>
              <Row label="Phone verified">{otpVerified ? 'Yes' : 'No'}</Row>
              {form.occupation && <Row label="Occupation">{form.occupation}</Row>}
              {form.employerOrBusiness && <Row label="Employer / Business">{form.employerOrBusiness}</Row>}
              {form.monthlyIncome && <Row label="Monthly income">₱{Number(form.monthlyIncome).toLocaleString()}</Row>}
              {address && <Row label="Address">{address}</Row>}
              {form.borrowerNumber && <Row label="Member number">{form.borrowerNumber}</Row>}
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.consentTerms}
                onChange={(e) => set('consentTerms', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold-600 focus:ring-gold-500"
              />
              <span>
                I agree to the HOSCOMCO <span className="font-medium text-gold-700">Terms of Service</span> and confirm
                that the information I provided is true and complete.
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.consentPrivacy}
                onChange={(e) => set('consentPrivacy', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold-600 focus:ring-gold-500"
              />
              <span>
                I consent to the processing of my personal data for member services, in accordance with the{' '}
                <span className="font-medium text-gold-700">Data Privacy Policy</span> of HOSCOMCO.
              </span>
            </label>
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button type="button" variant="outline" onClick={back} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < 7 ? (
            <Button type="button" onClick={next}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" loading={loading}>
              <ShieldCheck className="h-4 w-4" /> Create account
            </Button>
          )}
        </div>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        Already have an account?{' '}
        <Link to="/portal/login" className="font-medium text-gold-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
    <span className="text-xs font-medium text-slate-400">{label}</span>
    <span className="text-right text-sm font-medium text-slate-700">{children}</span>
  </div>
);

export default ClientRegisterPage;