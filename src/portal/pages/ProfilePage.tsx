import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  CreditCard,
  IdCard,
  Pencil,
  Save,
  ShieldCheck,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import { profileService } from '../services/profile';
import { ClientProfile, KycStatusData } from '../types';
import { formatCurrency, formatDate } from '../../utils/loanMath';
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
  Modal,
  Select,
  StatusBadge,
} from '../components/ui';
import { InfoRow, SectionDivider } from '../components/common';
import { useToast } from '../components/ui/Toast';

const ProfilePage: React.FC = () => {
  const toast = useToast();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [kyc, setKyc] = useState<KycStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'kyc' | 'edit'>('overview');
  const [editOpen, setEditOpen] = useState(false);

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
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Profile</h1>
          <p className="text-sm text-slate-500">View and update your member details.</p>
        </div>
        <Button onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" /> Edit profile
        </Button>
      </div>

      {/* Profile header */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800" />
        <CardBody className="-mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-md">
                <img
                  src={profile.avatar}
                  alt={profile.fullName}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      `https://ui-avatars.com/api/?background=059669&color=fff&name=${encodeURIComponent(profile.fullName)}`;
                  }}
                />
              </div>
              <div className="pb-1">
                <h2 className="text-xl font-bold text-slate-900">{profile.fullName}</h2>
                <p className="text-sm text-slate-500">
                  Member <span className="font-mono text-xs">{profile.memberNumber}</span> · Joined {formatDate(profile.membershipDate)}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <StatusBadge
                    status={profile.kycStatus}
                    tone={profile.kycStatus === 'VERIFIED' ? 'green' : profile.kycStatus === 'REJECTED' ? 'red' : 'amber'}
                  />
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
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
              <InfoRow label="Nationality" value={profile.nationality || 'Filipino'} />
              <SectionDivider />
              <InfoRow label="Occupation" value={profile.occupation || '—'} />
              <InfoRow label="Employer / Business" value={profile.employer || '—'} />
              <InfoRow label="Monthly income" value={formatCurrency(profile.monthlyIncome)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact details</CardTitle>
            </CardHeader>
            <CardBody>
              <InfoRow label="Email" value={profile.email} />
              <InfoRow label="Mobile number" value={profile.phone} />
              <InfoRow label="Secondary phone" value={profile.secondaryPhone || '—'} />
              <SectionDivider />
              <InfoRow label="Address" value={profile.address || '—'} />
              <InfoRow label="City / Province" value={profile.city ? `${profile.city}${profile.province ? ', ' + profile.province : ''}` : '—'} />
              <InfoRow label="Postal code" value={profile.postalCode || '—'} />
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'kyc' && (
        <Card>
          <CardHeader>
            <CardTitle>Know Your Customer (KYC) verification</CardTitle>
            {kyc && <StatusBadge status={kyc.kycStatus} tone={kyc.isVerified ? 'green' : 'amber'} />}
          </CardHeader>
          <CardBody>
            {kyc?.isVerified ? (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-sm text-emerald-800">
                  Your identity is verified. You are eligible to apply for all HOSCOMO loan products.
                </p>
              </div>
            ) : (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">Verification pending.</span> Submit the documents below to unlock
                  loan applications.
                </p>
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
          </CardBody>
        </Card>
      )}

      {tab === 'edit' && (
        <Card>
          <CardHeader>
            <CardTitle>Update profile details</CardTitle>
          </CardHeader>
          <CardBody>
            <EditProfileForm profile={profile} onSaved={(p) => setProfile(p)} />
          </CardBody>
        </Card>
      )}

      <EditProfileModal
        profile={profile}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(p) => {
          setProfile(p);
          setEditOpen(false);
          toast.success('Profile updated successfully.');
        }}
      />
    </div>
  );
};

const EditProfileForm: React.FC<{ profile: ClientProfile; onSaved: (p: ClientProfile) => void }> = ({
  profile,
  onSaved,
}) => {
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    secondaryPhone: profile.secondaryPhone || '',
    civilStatus: profile.civilStatus || 'Single',
    occupation: profile.occupation || '',
    employer: profile.employer || '',
    monthlyIncome: String(profile.monthlyIncome || ''),
    address: profile.address || '',
    dateOfBirth: profile.dateOfBirth || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await profileService.update({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        civilStatus: form.civilStatus,
        occupation: form.occupation,
        employer: form.employer,
        monthlyIncome: Number(form.monthlyIncome) || 0,
        address: form.address,
        dateOfBirth: form.dateOfBirth,
      });
      onSaved({ ...profile, ...form, monthlyIncome: Number(form.monthlyIncome) || 0 });
      toast.success('Profile updated successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Full name" required>
        <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
      </Field>
      <Field label="Civil status">
        <Select value={form.civilStatus} onChange={(e) => setForm((f) => ({ ...f, civilStatus: e.target.value }))}>
          <option>Single</option>
          <option>Married</option>
          <option>Widowed</option>
          <option>Separated</option>
        </Select>
      </Field>
      <Field label="Email address" required>
        <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
      </Field>
      <Field label="Mobile number" required>
        <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
      </Field>
      <Field label="Secondary phone">
        <Input value={form.secondaryPhone} onChange={(e) => setForm((f) => ({ ...f, secondaryPhone: e.target.value }))} />
      </Field>
      <Field label="Date of birth">
        <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
      </Field>
      <Field label="Occupation">
        <Input value={form.occupation} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))} />
      </Field>
      <Field label="Employer / Business">
        <Input value={form.employer} onChange={(e) => setForm((f) => ({ ...f, employer: e.target.value }))} />
      </Field>
      <Field label="Monthly income (₱)">
        <Input type="number" min={0} value={form.monthlyIncome} onChange={(e) => setForm((f) => ({ ...f, monthlyIncome: e.target.value }))} />
      </Field>
      <Field label="Address">
        <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" loading={saving}>
          <Save className="h-4 w-4" /> Save changes
        </Button>
      </div>
    </form>
  );
};

const EditProfileModal: React.FC<{
  profile: ClientProfile;
  open: boolean;
  onClose: () => void;
  onSaved: (p: ClientProfile) => void;
}> = ({ profile, open, onClose, onSaved }) => (
  <Modal open={open} onClose={onClose} title="Edit profile" size="lg">
    <EditProfileForm profile={profile} onSaved={onSaved} />
  </Modal>
);

export default ProfilePage;