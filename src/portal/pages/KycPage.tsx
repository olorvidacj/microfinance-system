import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  FileCheck2,
  Home,
  Info,
  UserRound,
  Briefcase,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import { profileService } from '../services/profile';
import { KycAddress, KycDocumentItem, KycEmployment, KycPersonalInfo, KycStatusData } from '../types';
import { formatDate } from '../../utils/loanMath';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Field,
  FormSection,
  Input,
  LoadingState,
  Select,
  StatusBadge,
} from '../components/ui';
import { InfoRow, SectionDivider } from '../components/common';
import { useToast } from '../components/ui/Toast';

const STEPS = ['Personal Info', 'Address', 'Employment', 'Documents', 'Review'] as const;

const EMPLOYMENT_STATUSES = ['Employed', 'Self-Employed', 'Business Owner', 'Unemployed', 'Retired', 'Student', 'Freelancer'];
const SOURCES_OF_INCOME = ['Salary / Wages', 'Business Income', 'Remittances', 'Pension', 'Livestock / Farming', 'Rental Income', 'Other'];
const GENDERS = ['Male', 'Female', 'Prefer not to say'];
const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'];

const emptyPersonal: KycPersonalInfo = {
  firstName: '', middleName: '', lastName: '',
  dateOfBirth: '', gender: '', civilStatus: '',
  phone: '', email: '',
};
const emptyAddress: KycAddress = {
  houseUnit: '', street: '', barangay: '',
  city: '', province: '', postalCode: '',
};
const emptyEmployment: KycEmployment = {
  occupation: '', employmentStatus: '', employer: '',
  monthlyIncome: 0, sourceOfIncome: '',
};

const KycPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kyc, setKyc] = useState<KycStatusData | null>(null);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const [personal, setPersonal] = useState<KycPersonalInfo>(emptyPersonal);
  const [address, setAddress] = useState<KycAddress>(emptyAddress);
  const [employment, setEmployment] = useState<KycEmployment>(emptyEmployment);
  const [documents, setDocuments] = useState<KycDocumentItem[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [p, k] = await Promise.all([profileService.get(), profileService.kycStatus()]);
      setKyc(k);
      setDocuments(k.requiredDocuments || []);
      if (p) {
        setPersonal({
          firstName: p.firstName || '',
          middleName: p.middleName || '',
          lastName: p.lastName || '',
          dateOfBirth: p.dateOfBirth || '',
          gender: p.gender || '',
          civilStatus: p.civilStatus || '',
          phone: p.phone || '',
          email: p.email || '',
        });
        setAddress({
          houseUnit: p.houseUnit || '',
          street: p.street || '',
          barangay: p.barangay || '',
          city: p.city || '',
          province: p.province || '',
          postalCode: p.postalCode || '',
        });
        setEmployment({
          occupation: p.occupation || '',
          employmentStatus: '',
          employer: p.employer || '',
          monthlyIncome: p.monthlyIncome || 0,
          sourceOfIncome: '',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load KYC data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const canContinue = () => {
    if (step === 0) {
      return (
        personal.firstName.trim() && personal.lastName.trim() &&
        personal.dateOfBirth && personal.phone.trim() && personal.email.trim()
      );
    }
    if (step === 1) return address.city.trim() && address.province.trim();
    if (step === 2) return employment.occupation.trim() && employment.employmentStatus && employment.monthlyIncome > 0;
    if (step === 3) return true;
    return confirm;
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await profileService.submitKyc({ personalInfo: personal, address, employment });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || 'Unable to submit KYC. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (doc: KycDocumentItem) => {
    setSaving(true);
    try {
      await profileService.uploadKycDocument({ documentType: doc.type, documentName: doc.name });
      setDocuments((prev) =>
        prev.map((d) => (d.type === doc.type ? { ...d, submitted: true, status: 'PENDING' as const } : d))
      );
      toast.success(`"${doc.type.replace(/_/g, ' ')}" uploaded successfully.`);
    } catch (err: any) {
      toast.error(err.message || 'Document upload failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading KYC verification…" />;
  if (error || !kyc) return <ErrorState message={error || 'No KYC data.'} onRetry={load} />;

  if (kyc.isVerified) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">KYC Verification</h1>
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
                <BadgeCheck className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">You are KYC verified</h2>
              <p className="max-w-md text-sm text-slate-500">
                Your identity has been verified by HOSCOMO. You are eligible to apply for loan products.
              </p>
              {kyc.verifiedAt && (
                <p className="text-xs text-slate-400">
                  Verified {formatDate(kyc.verifiedAt)}
                  {kyc.reviewedByName ? ` by ${kyc.reviewedByName}` : ''}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <Button variant="outline" onClick={() => navigate('/portal/apply')}>
                  Apply for a loan
                </Button>
                <Button variant="outline" onClick={() => navigate('/portal/profile')}>
                  View profile
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">KYC Verification</h1>
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">KYC submitted for review</h2>
              <p className="max-w-md text-sm text-slate-500">
                Your KYC application has been received and is now pending review by our staff. You will be
                notified once it is verified. You can apply for a loan once your KYC is verified.
              </p>
              <div className="mt-2 flex gap-2">
                <Button onClick={() => navigate('/portal/dashboard')}>Back to dashboard</Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">KYC Verification</h1>
        <p className="text-sm text-slate-500">Complete your Know-Your-Customer verification to unlock loan applications.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => i < step && setStep(i)}
            disabled={i > step}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              i === step ? 'bg-emerald-600 text-white' : i < step ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400'
            }`}
          >
            {i < step ? <Check className="h-3.5 w-3.5" /> : <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">{i + 1}</span>}
            {label}
          </button>
        ))}
      </div>

      {kyc.correctionReason && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Correction required</p>
            <p className="text-xs text-amber-700">{kyc.correctionReason}</p>
          </div>
        </div>
      )}

      {kyc.rejectionReason && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-800">KYC application rejected</p>
            <p className="text-xs text-rose-700">{kyc.rejectionReason}</p>
          </div>
        </div>
      )}

      <Card>
        <CardBody>
          {step === 0 && (
            <FormSection title="Personal information" description="Your legal name and identity details as they appear on your government-issued ID.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="First name" required>
                  <Input value={personal.firstName} onChange={(e) => setPersonal((p) => ({ ...p, firstName: e.target.value }))} placeholder="Rosa" />
                </Field>
                <Field label="Middle name">
                  <Input value={personal.middleName} onChange={(e) => setPersonal((p) => ({ ...p, middleName: e.target.value }))} placeholder="R." />
                </Field>
                <Field label="Last name" required>
                  <Input value={personal.lastName} onChange={(e) => setPersonal((p) => ({ ...p, lastName: e.target.value }))} placeholder="Alcantara" />
                </Field>
                <Field label="Date of birth" required>
                  <Input type="date" value={personal.dateOfBirth} onChange={(e) => setPersonal((p) => ({ ...p, dateOfBirth: e.target.value }))} />
                </Field>
                <Field label="Gender">
                  <Select value={personal.gender} onChange={(e) => setPersonal((p) => ({ ...p, gender: e.target.value }))}>
                    <option value="">Select gender…</option>
                    {GENDERS.map((g) => <option key={g}>{g}</option>)}
                  </Select>
                </Field>
                <Field label="Civil status">
                  <Select value={personal.civilStatus} onChange={(e) => setPersonal((p) => ({ ...p, civilStatus: e.target.value }))}>
                    <option value="">Select civil status…</option>
                    {CIVIL_STATUSES.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Mobile number" required>
                  <Input value={personal.phone} onChange={(e) => setPersonal((p) => ({ ...p, phone: e.target.value }))} placeholder="+63 917 000 0000" />
                </Field>
                <Field label="Email address" required>
                  <Input type="email" value={personal.email} onChange={(e) => setPersonal((p) => ({ ...p, email: e.target.value }))} placeholder="you@example.com" />
                </Field>
              </div>
            </FormSection>
          )}

          {step === 1 && (
            <FormSection title="Current address" description="Your residential address. Proof-of-address documents must match this.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="House / Unit">
                  <Input value={address.houseUnit} onChange={(e) => setAddress((a) => ({ ...a, houseUnit: e.target.value }))} placeholder="14 San Pedro St" />
                </Field>
                <Field label="Street">
                  <Input value={address.street} onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))} placeholder="Poblacion" />
                </Field>
                <Field label="Barangay">
                  <Input value={address.barangay} onChange={(e) => setAddress((a) => ({ ...a, barangay: e.target.value }))} placeholder="Barangay 1" />
                </Field>
                <Field label="Municipality / City" required>
                  <Input value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} placeholder="Tacloban City" />
                </Field>
                <Field label="Province" required>
                  <Input value={address.province} onChange={(e) => setAddress((a) => ({ ...a, province: e.target.value }))} placeholder="Leyte" />
                </Field>
                <Field label="Postal code">
                  <Input value={address.postalCode} onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))} placeholder="6500" />
                </Field>
              </div>
            </FormSection>
          )}

          {step === 2 && (
            <FormSection title="Employment & income" description="Provide your livelihood and financial information for assessment.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Occupation" required>
                  <Input value={employment.occupation} onChange={(e) => setEmployment((em) => ({ ...em, occupation: e.target.value }))} placeholder="Sari-sari store owner" />
                </Field>
                <Field label="Employment status" required>
                  <Select value={employment.employmentStatus} onChange={(e) => setEmployment((em) => ({ ...em, employmentStatus: e.target.value }))}>
                    <option value="">Select status…</option>
                    {EMPLOYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                </Field>
                <Field label="Employer / Business">
                  <Input value={employment.employer} onChange={(e) => setEmployment((em) => ({ ...em, employer: e.target.value }))} placeholder="Business or employer name" />
                </Field>
                <Field label="Monthly income (₱)" required>
                  <Input type="number" min={0} value={employment.monthlyIncome || ''} onChange={(e) => setEmployment((em) => ({ ...em, monthlyIncome: Number(e.target.value) || 0 }))} placeholder="25000" />
                </Field>
                <Field label="Source of income">
                  <Select value={employment.sourceOfIncome} onChange={(e) => setEmployment((em) => ({ ...em, sourceOfIncome: e.target.value }))}>
                    <option value="">Select source…</option>
                    {SOURCES_OF_INCOME.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                </Field>
              </div>
            </FormSection>
          )}

          {step === 3 && (
            <FormSection
              title="Required documents"
              description="Upload the required supporting documents. Staff will verify each one."
            >
              {documents.length === 0 ? (
                <EmptyState icon={<FileCheck2 className="h-6 w-6" />} title="No documents required" description="No supporting documents are required at this time." />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {documents.map((doc) => (
                    <div key={doc.type} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${doc.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600' : doc.status === 'REJECTED' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
                          <Upload className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                          <p className="text-xs text-slate-400">{doc.type.replace(/_/g, ' ').toUpperCase()}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <StatusBadge status={doc.status} />
                        {!doc.submitted && doc.status !== 'VERIFIED' && (
                          <Button size="sm" variant="outline" onClick={() => handleUpload(doc)} loading={saving}>
                            <Upload className="h-3.5 w-3.5" /> Upload
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </FormSection>
          )}

          {step === 4 && (
            <FormSection title="Review & confirm" description="Please review your information before submitting for verification.">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserRound className="h-4 w-4" /> Personal information
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    <InfoRow label="Full name" value={`${personal.firstName} ${personal.middleName} ${personal.lastName}`.trim()} />
                    <InfoRow label="Date of birth" value={personal.dateOfBirth ? formatDate(personal.dateOfBirth) : '—'} />
                    <InfoRow label="Gender" value={personal.gender || '—'} />
                    <InfoRow label="Civil status" value={personal.civilStatus || '—'} />
                    <SectionDivider />
                    <InfoRow label="Mobile" value={personal.phone || '—'} />
                    <InfoRow label="Email" value={personal.email || '—'} />
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Home className="h-4 w-4" /> Address
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    <InfoRow label="Address" value={[address.houseUnit, address.street, address.barangay].filter(Boolean).join(', ') || '—'} />
                    <InfoRow label="City" value={address.city || '—'} />
                    <InfoRow label="Province" value={address.province || '—'} />
                    <InfoRow label="Postal code" value={address.postalCode || '—'} />
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" /> Employment & income
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    <InfoRow label="Occupation" value={employment.occupation || '—'} />
                    <InfoRow label="Employment status" value={employment.employmentStatus || '—'} />
                    <InfoRow label="Employer / Business" value={employment.employer || '—'} />
                    <InfoRow label="Monthly income" value={`₱${(employment.monthlyIncome || 0).toLocaleString()}`} />
                    <InfoRow label="Source of income" value={employment.sourceOfIncome || '—'} />
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Documents
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    {documents.map((doc) => (
                      <InfoRow key={doc.type} label={doc.name} value={doc.submitted ? 'Submitted' : 'Not submitted'} />
                    ))}
                  </CardBody>
                </Card>
              </div>

              <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">
                  I confirm that the information I provided is accurate and complete. I authorize HOSCOMO Microfinance Cooperative to
                  verify this information and the documents I have submitted.
                </span>
              </label>
            </FormSection>
          )}
        </CardBody>
      </Card>

      {/* Footer navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => (step > 0 ? setStep(step - 1) : navigate('/portal/profile'))}>
          <ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Back' : 'Previous'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canContinue()}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!canContinue()} loading={saving}>
            <ShieldCheck className="h-4 w-4" /> Submit for verification
          </Button>
        )}
      </div>
    </div>
  );
};

export default KycPage;