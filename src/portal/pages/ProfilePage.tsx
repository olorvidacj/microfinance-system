import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  CreditCard,
  IdCard,
  Pencil,
  Save,
  ShieldCheck,
  TrendingUp,
  UserRound,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { profileService } from '../services/profile';
import { ApiError } from '../services/clientApi';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { Avatar } from '../../ui';
import { ClientProfile, KYCStatus, KycStatusData } from '../types';
import { formatDate } from '../../utils/loanMath';
import { formatMoney } from '../../../shared/client/format';
import { centsFromDb } from '../../../shared/lending';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Select,
  StatusBadge,
} from '../components/ui';
import { InfoRow, SectionDivider } from '../components/common';
import { useToast } from '../components/ui/Toast';
import { KycStatusBadge } from '../../components/KycStatusBadge';
import { CIVIL_STATUSES, PROFILE_LOCKED_MESSAGE, normaliseKycStatus, validateProfileUpdate } from '../../../shared/kyc-core';

const KYC_STEPS = ['Information', 'Documents', 'Review', 'Verification', 'Loan Eligibility'];

const kycStepIndex = (status?: string): number => {
  switch (normaliseKycStatus(status)) {
    case 'IN_PROGRESS':
    case 'SUBMITTED':
      return 1;
    case 'UNDER_REVIEW':
      return 2;
    case 'APPROVED':
      return 3;
    default:
      return 0;
  }
};

const ProfilePage: React.FC = () => {
  const toast = useToast();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [kyc, setKyc] = useState<KycStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'kyc' | 'edit' | 'security'>('overview');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [p, k] = await Promise.all([profileService.get(), profileService.kycStatus()]);
      setProfile(p);
      setKyc(k);
    } catch (err: any) {
      setError(err.message || 'Unable to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState label="Loading your profile…" />;
  if (error || !profile) return <ErrorState message={error || 'No profile data.'} onRetry={load} />;

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'kyc' as const, label: 'KYC & Verification' },
    { id: 'edit' as const, label: 'Edit Profile' },
    { id: 'security' as const, label: 'Password' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Profile</h1>
          <p className="text-sm text-slate-500">View and update your member details.</p>
        </div>
        <Button onClick={() => setTab('edit')}>
          <Pencil className="h-4 w-4" /> Edit profile
        </Button>
      </div>

      {/* Profile header */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800" />
        <CardBody className="-mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar src={profile.avatar ?? undefined} name={profile.fullName} size={96} className="border-4 border-white text-2xl shadow-md" />
              <div className="pb-1">
                <h2 className="text-xl font-bold text-slate-900">{profile.fullName}</h2>
                <p className="text-sm text-slate-500">
                  Member <span className="font-mono text-xs">{profile.memberNumber}</span> · Joined {formatDate(profile.membershipDate)}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <KycStatusBadge status={profile.kycStatus} size="xs" />
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/10 px-2 py-0.5 text-xs font-medium text-gold-700">
                    <CreditCard className="h-3.5 w-3.5" /> Score {profile.creditScore}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    <TrendingUp className="h-3.5 w-3.5" /> Tier {profile.creditTier}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal information</CardTitle>
            </CardHeader>
            <CardBody>
              <InfoRow label="Full name" value={profile.fullName} />
              <InfoRow label="Member number" value={<span className="font-mono">{profile.memberNumber}</span>} />
              <InfoRow label="Date of birth" value={formatDate(profile.dateOfBirth)} />
              <InfoRow label="Gender" value={profile.gender || '—'} />
              <InfoRow label="Civil status" value={profile.civilStatus} />
              <InfoRow label="Employment" value={profile.employmentStatus || '—'} />
              <SectionDivider />
              <InfoRow label="Occupation" value={profile.occupation || '—'} />
              <InfoRow label="Employer / Business" value={profile.employer || '—'} />
              <InfoRow label="Monthly income" value={formatMoney(profile.monthlyIncome)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact details</CardTitle>
            </CardHeader>
            <CardBody>
              <InfoRow label="Email" value={profile.email} />
              <InfoRow label="Mobile number" value={profile.phone} />
              <InfoRow label="Barangay" value={profile.barangay || '—'} />
              <SectionDivider />
              <InfoRow label="Address" value={profile.address || '—'} />
              <InfoRow label="City / Province" value={[profile.cityMunicipality, profile.province].filter(Boolean).join(', ') || '—'} />
              <InfoRow label="Postal code" value={profile.postalCode || '—'} />
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'kyc' && (
        <Card>
          <CardHeader>
            <CardTitle>Know Your Customer (KYC) verification</CardTitle>
            {kyc && <KycStatusBadge status={kyc.kycStatus} size="sm" />}
          </CardHeader>
          <CardBody>
            {/* Workflow progress indicator */}
            <div className="mb-5 flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-100 bg-slate-50 p-1.5">
              {KYC_STEPS.map((label, i) => {
                const active = i === kycStepIndex(kyc?.kycStatus);
                const done = i < kycStepIndex(kyc?.kycStatus);
                return (
                  <div key={label} className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1 === kycStepIndex(kyc?.kycStatus) && <Clock className="h-3.5 w-3.5" />}
                    {done ? <span>{label}</span> : <span>{label}</span>}
                  </div>
                );
              })}
            </div>

            {kyc?.isVerified ? (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div className="text-sm text-emerald-800">
                  <p className="font-semibold">Your identity is verified.</p>
                  <p className="mt-0.5">You are eligible to apply for all HOSCOMCO loan products.</p>
                  {kyc.verifiedAt && (
                    <p className="mt-1 text-xs text-emerald-700">
                      Verified on {formatDate(kyc.verifiedAt)}
                      {kyc.reviewedByName ? ` by ${kyc.reviewedByName}` : ''}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="flex-1 text-sm text-amber-800">
                  <p className="font-semibold">
                    {kyc?.kycStatus === 'NOT_STARTED' ? 'Verification not yet started.' : 'Verification pending.'}
                  </p>
                  <p className="mt-0.5">Submit your information and documents to unlock loan applications.</p>
                  {(kyc?.correctionReason || kyc?.rejectionReason) && (
                    <p className="mt-1 text-xs">
                      {kyc?.correctionReason ? `Correction needed: ${kyc.correctionReason}` : `Rejected: ${kyc.rejectionReason}`}
                    </p>
                  )}
                </div>
                <Link to="/portal/kyc">
                  <Button size="sm">
                    <ShieldCheck className="h-3.5 w-3.5" /> Start KYC
                  </Button>
                </Link>
              </div>
            )}

            <h4 className="mb-2 text-sm font-semibold text-slate-700">Required documents</h4>
            <ul className="space-y-2">
              {(kyc?.requiredDocuments || []).length > 0 ? (
                kyc.requiredDocuments.map((doc) => (
                  <li key={doc.type} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${doc.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600' : doc.status === 'REJECTED' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}>
                        {doc.type === 'PHOTO_2X2' ? <UserRound className="h-4 w-4" /> : <IdCard className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                        <p className="text-xs text-slate-400">{doc.type.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    <StatusBadge status={doc.status} />
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-400">No documents required.</li>
              )}
            </ul>

            {!kyc?.isVerified && (
              <div className="mt-5 flex justify-end">
                <Link to="/portal/kyc">
                  <Button variant="outline">
                    Continue KYC <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'edit' && (
        <Card>
          <CardHeader>
            <CardTitle>Update profile details</CardTitle>
          </CardHeader>
          <CardBody>
            <EditProfileForm profile={profile} onSaved={load} />
          </CardBody>
        </Card>
      )}

      {tab === 'security' && (
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardBody>
            <ChangePasswordForm />
          </CardBody>
        </Card>
      )}
    </div>
  );
};

const EditProfileForm: React.FC<{ profile: ClientProfile; onSaved: () => void }> = ({ profile, onSaved }) => {
  const toast = useToast();
  const original = {
    phone: profile.phone || '',
    civilStatus: profile.civilStatus || '',
    occupation: profile.occupation || '',
    employer: profile.employer || '',
    monthlyIncome: centsFromDb(profile.monthlyIncome) > 0 ? profile.monthlyIncome : '',
    address: profile.address || '',
    barangay: profile.barangay || '',
    cityMunicipality: profile.cityMunicipality,
    province: profile.province || '',
  };
  const [form, setForm] = useState(original);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    // Only what the member changed, checked with the same rules as the server (shared/kyc-core/profile.ts).
    const changes = Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== original[k as keyof typeof original]));
    if (!Object.keys(changes).length) return toast.success('Nothing to save.');
    const v = validateProfileUpdate(changes);
    setErrors(v.errors);
    if (!v.ok) return;
    setSaving(true);
    try {
      await profileService.update(changes);
      toast.success('Your details were saved.');
      onSaved();
    } catch (err) {
      const fields = err instanceof ApiError && err.details && typeof err.details.fields === 'object' ? (err.details.fields as Record<string, string>) : {};
      setErrors(fields);
      toast.error(err instanceof Error ? err.message : 'Unable to save your details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p className="font-medium text-slate-800">{profile.fullName} · {profile.email}</p>
        <p className="mt-1 text-xs">{PROFILE_LOCKED_MESSAGE}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Mobile number" required error={errors.phone}>
          <Input value={form.phone} onChange={set('phone')} inputMode="tel" aria-label="Mobile number" />
        </Field>
        <Field label="Civil status" error={errors.civilStatus}>
          <Select value={form.civilStatus} onChange={set('civilStatus')} aria-label="Civil status">
            <option value="">Choose…</option>
            {CIVIL_STATUSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Occupation" error={errors.occupation}>
          <Input value={form.occupation} onChange={set('occupation')} aria-label="Occupation" />
        </Field>
        <Field label="Employer / business" error={errors.employer}>
          <Input value={form.employer} onChange={set('employer')} aria-label="Employer" />
        </Field>
        <Field label="Monthly income (₱)" error={errors.monthlyIncome}>
          <Input inputMode="decimal" value={form.monthlyIncome} onChange={set('monthlyIncome')} aria-label="Monthly income" />
        </Field>
        <Field label="Street address" error={errors.address}>
          <Input value={form.address} onChange={set('address')} aria-label="Street address" />
        </Field>
        <Field label="Barangay" error={errors.barangay}>
          <Input value={form.barangay} onChange={set('barangay')} aria-label="Barangay" />
        </Field>
        <Field label="City / municipality" error={errors.cityMunicipality}>
          <Input value={form.cityMunicipality} onChange={set('cityMunicipality')} aria-label="City" />
        </Field>
        <Field label="Province" error={errors.province}>
          <Input value={form.province} onChange={set('province')} aria-label="Province" />
        </Field>
      </div>
      <Button type="submit" loading={saving}>
        <Save className="h-4 w-4" /> Save changes
      </Button>
    </form>
  );
};

export default ProfilePage;
