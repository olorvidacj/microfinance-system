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

const ClientProfilePage: React.FC = () => {
  const { id = '' } = useParams();
  const toast = useToast();
  const fetcher = useCallback(() => clientsService.get(id), [id]);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const [editOpen, setEditOpen] = React.useState(false);

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
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <PencilLine className="h-4 w-4" /> Edit profile
          </Button>
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
    </div>
  );
};

const EditProfileModal: React.FC<{ client: any; open: boolean; onClose: () => void; onDone: () => void }> = ({
  client,
  open,
  onClose,
  onDone,
}) => {
  const toast = useToast();
  const [form, setForm] = React.useState({
    fullName: client.fullName,
    phone: client.phone,
    email: client.email,
    address: client.address,
    dateOfBirth: client.dateOfBirth,
    gender: client.gender,
    civilStatus: client.civilStatus,
    employmentStatus: client.employmentStatus,
    employerOrBusiness: client.employerOrBusiness,
    occupation: client.occupation,
    monthlyIncome: String(client.monthlyIncome || 0),
    monthlyExpenses: String(client.monthlyExpenses || 0),
    notes: client.notes || '',
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setForm({
      fullName: client.fullName,
      phone: client.phone,
      email: client.email,
      address: client.address,
      dateOfBirth: client.dateOfBirth,
      gender: client.gender,
      civilStatus: client.civilStatus,
      employmentStatus: client.employmentStatus,
      employerOrBusiness: client.employerOrBusiness,
      occupation: client.occupation,
      monthlyIncome: String(client.monthlyIncome || 0),
      monthlyExpenses: String(client.monthlyExpenses || 0),
      notes: client.notes || '',
    });
  }, [client]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    try {
      await clientsService.update(client.id, {
        ...form,
        monthlyIncome: Number(form.monthlyIncome) || 0,
        monthlyExpenses: Number(form.monthlyExpenses) || 0,
      });
      onDone();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to update client.');
    } finally {
      setLoading(false);
    }
  };

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
        <Field label="Full name">
          <Input value={form.fullName} onChange={set('fullName')} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Date of birth">
          <Input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
        </Field>
        <Field label="Gender">
          <Select value={form.gender} onChange={set('gender')}>
            <option>Not specified</option>
            <option>Female</option>
            <option>Male</option>
          </Select>
        </Field>
        <Field label="Civil status">
          <Select value={form.civilStatus} onChange={set('civilStatus')}>
            <option>Single</option>
            <option>Married</option>
            <option>Widowed</option>
            <option>Separated</option>
          </Select>
        </Field>
        <Field label="Employment status">
          <Select value={form.employmentStatus} onChange={set('employmentStatus')}>
            <option>Employed</option>
            <option>Self-Employed</option>
            <option>Unemployed</option>
            <option>Retired</option>
          </Select>
        </Field>
        <Field label="Occupation">
          <Input value={form.occupation} onChange={set('occupation')} />
        </Field>
        <Field label="Employer / business">
          <Input value={form.employerOrBusiness} onChange={set('employerOrBusiness')} />
        </Field>
        <Field label="Monthly income">
          <Input type="number" value={form.monthlyIncome} onChange={set('monthlyIncome')} />
        </Field>
        <Field label="Monthly expenses">
          <Input type="number" value={form.monthlyExpenses} onChange={set('monthlyExpenses')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea rows={3} value={form.notes} onChange={set('notes')} />
          </Field>
        </div>
      </div>
    </Modal>
  );
};

export default ClientProfilePage;