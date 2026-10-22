import React, { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, HandCoins, PencilLine, PiggyBank, ShieldCheck, Users } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { Amount } from '../../portal/components/ui/Amount';
import { InfoRow, SectionDivider } from '../../portal/components/common';
import { LoadingState, ErrorState } from '../../portal/components/ui/States';
import { Modal } from '../../portal/components/ui/Modal';
import { Field, Input, Select, Textarea } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { useBranchData } from '../hooks/useBranchData';
import { clientsService } from '../services';
import { BranchApiError } from '../services/api';
import { CIVIL_STATUSES, EMPLOYMENT_STATUSES, GENDERS, identityLockedByKyc, type StaffMemberField } from '../../../shared/kyc-core';
import { KycReviewPanel } from '../components/KycReviewPanel';

const ClientProfilePage: React.FC = () => {
  const { id = '' } = useParams();
  const toast = useToast();
  const fetcher = useCallback(() => clientsService.get(id), [id]);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const [editOpen, setEditOpen] = React.useState(false);
  const [kycReviewOpen, setKycReviewOpen] = React.useState(false);

  if (loading) return <LoadingState label="Loading client profile…" />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;

  const { client, loans, documents, savingsAccounts } = data;
  const initials = (client.fullName || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.fullName}
        subtitle={`${client.borrowerNumber} · Member since ${client.membershipDate}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="brand" size="sm" onClick={() => setKycReviewOpen(true)}>
              <ShieldCheck className="h-4 w-4" /> Review KYC Application
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <PencilLine className="h-4 w-4" /> Edit profile
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={client.kycStatus} />
        <StatusBadge status={client.memberStatus} />
        <StatusBadge status={client.creditTier} tone="purple" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col items-center px-5 py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-lg font-bold text-white">
                {initials}
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">{client.fullName}</h3>
              <p className="text-sm text-slate-400">{client.occupation || '—'}</p>
              {client.kycStatus === 'VERIFIED' ? (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" /> KYC verified
                </span>
              ) : (
                <span className="mt-2 text-xs text-amber-600">KYC not yet verified</span>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile details</CardTitle>
            </CardHeader>
            <CardBody>
              <InfoRow label="Date of birth" value={client.dateOfBirth} />
              <InfoRow label="Gender" value={client.gender} />
              <InfoRow label="Civil status" value={client.civilStatus} />
              <InfoRow label="Employment" value={client.employmentStatus} />
              <InfoRow label="Employer / business" value={client.employerOrBusiness || '—'} />
              <SectionDivider />
              <InfoRow label="Monthly income" value={<Amount value={client.monthlyIncome} />} />
              <InfoRow label="Monthly expenses" value={<Amount value={client.monthlyExpenses} />} />
              <InfoRow label="Credit score" value={client.creditScore ?? '—'} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardBody>
              <InfoRow label="Phone" value={client.phone} />
              <InfoRow label="Email" value={client.email || '—'} />
              <InfoRow label="Address" value={client.address || '—'} />
              {client.facebookAccount && <InfoRow label="Facebook" value={client.facebookAccount} />}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HandCoins className="h-4 w-4" /> Loans</CardTitle>
              <Link to={`/staff/app/applications?client=${client.id}`} className="text-xs font-medium text-emerald-700 hover:text-emerald-900">
                New loan application →
              </Link>
            </CardHeader>
            <CardBody className="p-0">
              {loans.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">No loan accounts.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {loans.map((loan) => (
                    <Link key={loan.id} to={`/staff/app/loans/${loan.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{loan.loanNumber}</p>
                        <p className="truncate text-xs text-slate-500">{loan.productName}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums text-slate-800"><Amount value={loan.remainingBalance} /></p>
                          <p className="text-xs text-slate-400">balance</p>
                        </div>
                        <StatusBadge status={loan.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Savings</CardTitle>
            </CardHeader>
            <CardBody>
              {savingsAccounts.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">No savings accounts.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {savingsAccounts.map((acc) => (
                    <Link key={acc.id} to={`/staff/app/savings/${acc.id}`} className="flex items-center justify-between py-3 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{acc.id}</p>
                        <p className="text-xs text-slate-400">Passbook savings account</p>
                      </div>
                      <Amount value={acc.balance} className="text-base font-bold" />
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</CardTitle>
            </CardHeader>
            <CardBody>
              {documents.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">No documents on file.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{doc.docName}</p>
                        <p className="text-xs text-slate-400">{doc.docType} · {doc.docNumber}</p>
                      </div>
                      <StatusBadge status={doc.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {client.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Notes</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-sm text-slate-600">{client.notes}</p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <EditProfileModal
        client={client}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onDone={() => {
          setEditOpen(false);
          reload();
          toast.success('Profile updated');
        }}
      />

      {kycReviewOpen && (
        <KycReviewPanel
          clientId={client.id}
          onClose={() => setKycReviewOpen(false)}
          onDone={() => {
            setKycReviewOpen(false);
            reload();
            toast.success('KYC decision recorded.');
          }}
        />
      )}
    </div>
  );
};

/** The member fields the branch edits; values as the client record holds them. */
interface EditableClient {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  dateOfBirth: string;
  gender: string;
  civilStatus: string;
  employmentStatus: string;
  employerOrBusiness: string;
  occupation: string;
  monthlyIncome: number | string | null;
  monthlyExpenses: number | string | null;
  notes?: string | null;
  kycStatus?: string | null;
}

type EditForm = Record<StaffMemberField, string>;

const formFrom = (c: EditableClient): EditForm => ({
  fullName: c.fullName ?? '',
  phone: c.phone ?? '',
  email: c.email ?? '',
  address: c.address ?? '',
  dateOfBirth: c.dateOfBirth ?? '',
  gender: c.gender ?? '',
  civilStatus: c.civilStatus ?? '',
  employmentStatus: c.employmentStatus ?? '',
  employerOrBusiness: c.employerOrBusiness ?? '',
  occupation: c.occupation ?? '',
  monthlyIncome: String(c.monthlyIncome ?? '0'),
  monthlyExpenses: String(c.monthlyExpenses ?? '0'),
  notes: c.notes ?? '',
});

/** The shared choices, plus the stored value when it is an older one, so opening the form never changes it. */
const choices = (list: readonly string[], current: string) => (current && !list.includes(current) ? [current, ...list] : [...list]);

/**
 * Staff edit a member's record. The server applies the same rules as the
 * member's own edits (shared/kyc-core/profile.ts), checks that the phone and
 * email are not used by anyone else, and changes the member's login with them;
 * its per-field messages are shown under each field.
 */
const EditProfileModal: React.FC<{ client: EditableClient; open: boolean; onClose: () => void; onDone: () => void }> = ({ client, open, onClose, onDone }) => {
  const toast = useToast();
  const [form, setForm] = React.useState<EditForm>(() => formFrom(client));
  const [errors, setErrors] = React.useState<Partial<Record<StaffMemberField, string>>>({});
  const [loading, setLoading] = React.useState(false);
  const identityLocked = identityLockedByKyc(client.kycStatus);

  React.useEffect(() => {
    setForm(formFrom(client));
    setErrors({});
  }, [client]);

  const set = (k: StaffMemberField) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async () => {
    setLoading(true);
    setErrors({});
    try {
      // Sent as typed: the server validates each value and changes only what differs.
      await clientsService.update(client.id, form);
      onDone();
    } catch (err) {
      if (err instanceof BranchApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      toast.error(err instanceof Error ? err.message : 'Unable to update client.');
    } finally {
      setLoading(false);
    }
  };

  const lockHint = identityLocked ? 'Fixed by the member’s KYC; the member updates it through KYC.' : undefined;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit client profile"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={loading}>Save changes</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" hint={lockHint} error={errors.fullName}>
          <Input value={form.fullName} onChange={set('fullName')} disabled={identityLocked} aria-invalid={Boolean(errors.fullName)} />
        </Field>
        <Field label="Mobile number" hint={lockHint ?? 'Also the member’s sign-in. e.g. 0917 123 4567'} error={errors.phone}>
          <Input value={form.phone} onChange={set('phone')} disabled={identityLocked} inputMode="tel" aria-invalid={Boolean(errors.phone)} />
        </Field>
        <Field label="Email" hint={lockHint ?? 'Also the member’s sign-in.'} error={errors.email}>
          <Input type="email" value={form.email} onChange={set('email')} disabled={identityLocked} aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field label="Date of birth" hint={lockHint} error={errors.dateOfBirth}>
          <Input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} disabled={identityLocked} aria-invalid={Boolean(errors.dateOfBirth)} />
        </Field>
        <Field label="Gender" error={errors.gender}>
          <Select value={form.gender} onChange={set('gender')}>
            {choices(GENDERS, client.gender).map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
        <Field label="Civil status" error={errors.civilStatus}>
          <Select value={form.civilStatus} onChange={set('civilStatus')}>
            {choices(CIVIL_STATUSES, client.civilStatus).map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
        <Field label="Employment status" error={errors.employmentStatus}>
          <Select value={form.employmentStatus} onChange={set('employmentStatus')}>
            {choices(EMPLOYMENT_STATUSES, client.employmentStatus).map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
        <Field label="Address" error={errors.address}>
          <Input value={form.address} onChange={set('address')} />
        </Field>
        <Field label="Occupation" error={errors.occupation}>
          <Input value={form.occupation} onChange={set('occupation')} />
        </Field>
        <Field label="Employer / business" error={errors.employerOrBusiness}>
          <Input value={form.employerOrBusiness} onChange={set('employerOrBusiness')} />
        </Field>
        <Field label="Monthly income (₱)" error={errors.monthlyIncome}>
          <Input inputMode="decimal" value={form.monthlyIncome} onChange={set('monthlyIncome')} />
        </Field>
        <Field label="Monthly expenses (₱)" error={errors.monthlyExpenses}>
          <Input inputMode="decimal" value={form.monthlyExpenses} onChange={set('monthlyExpenses')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes" error={errors.notes}>
            <Textarea rows={3} value={form.notes} onChange={set('notes')} />
          </Field>
        </div>
      </div>
    </Modal>
  );
};

export default ClientProfilePage;