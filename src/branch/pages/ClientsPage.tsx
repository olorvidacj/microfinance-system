import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, Search, UserPlus, Users } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { Amount } from '../../portal/components/ui/Amount';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { Modal } from '../../portal/components/ui/Modal';
import { Field, Input, Select, Textarea } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { clientsService } from '../services';
import { ClientSummary } from '../types';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Irregular', label: 'Irregular' },
  { value: 'Suspended', label: 'Suspended' },
  { value: 'Rejected', label: 'Rejected' },
];

const KYC_OPTIONS = [
  { value: '', label: 'All KYC' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'PENDING', label: 'Pending Review' },
  { value: 'Under Review', label: 'Under Review' },
  { value: 'CORRECTION_REQUIRED', label: 'Correction Requested' },
  { value: 'REJECTED', label: 'Rejected' },
];

const SORT_OPTIONS = [
  { value: 'joinedDateDesc', label: 'Newest first' },
  { value: 'nameAsc', label: 'Name A–Z' },
  { value: 'membershipAsc', label: 'Oldest members' },
];

const initialForm = {
  fullName: '',
  phone: '',
  email: '',
  idNumber: '',
  address: '',
  occupation: '',
  employerOrBusiness: '',
  employmentStatus: 'Employed',
  monthlyIncome: '',
  monthlyExpenses: '',
  gender: 'Not specified',
  civilStatus: 'Single',
  dateOfBirth: '',
};

const exportCsv = (rows: ClientSummary[]) => {
  const header = ['Borrower No.', 'Name', 'Phone', 'Email', 'Member Status', 'KYC Status', 'Savings', 'Joined'];
  const lines = rows.map((r) =>
    [r.borrowerNumber, r.fullName, r.phone, r.email, r.memberStatus, r.kycStatus, r.savingsBalance || 0, r.joinedDate || r.membershipDate]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const ClientsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const canRegister = useBranchPermission(['register_clients', 'manage_kyc', 'assist_clients']);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [kyc, setKyc] = useState('');
  const [sort, setSort] = useState('joinedDateDesc');
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    if (params.get('new') === '1' && canRegister) {
      setNewOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams, canRegister]);

  const fetcher = useCallback(
    async () =>
      clientsService.list({
        search: search || undefined,
        status: status || undefined,
        kyc: kyc || undefined,
        sort,
      }),
    [search, status, kyc, sort]
  );
  const { data, loading, error, reload } = useBranchData(fetcher);

  const visible = data || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clients"
        subtitle="Registered clients and members in this branch"
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv(visible)}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            {canRegister && (
              <Button variant="brand" onClick={() => setNewOpen(true)}>
                <Plus className="h-4 w-4" /> Register client
              </Button>
            )}
          </>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by name, borrower number, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="lg:w-40">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select value={kyc} onChange={(e) => setKyc(e.target.value)} className="lg:w-44">
            {KYC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="lg:w-44">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading clients…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : visible.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No clients found" description="Try adjusting your search or filters." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Client', 'Borrower No.', 'Phone', 'KYC', 'Member status', 'Savings', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((row) => (
                  <tr key={row.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/staff/app/clients/${row.id}`)}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#091527] text-xs font-bold text-amber-400 ring-1 ring-amber-400/30">
                          {(row.fullName || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-800">{row.fullName}</div>
                          <div className="text-xs text-slate-400">{row.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{row.borrowerNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{row.phone}</td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={row.kycStatus} /></td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={row.memberStatus} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-slate-700"><Amount value={row.savingsBalance} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link to={`/staff/app/clients/${row.id}`} className="text-xs font-semibold text-amber-600 hover:text-amber-700">
                        View profile →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <RegisterClientModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onDone={() => {
          setNewOpen(false);
          toast.success('Client registered');
          reload();
        }}
      />
    </div>
  );
};

export const RegisterClientModal: React.FC<{ open: boolean; onClose: () => void; onDone: () => void }> = ({ open, onClose, onDone }) => {
  const toast = useToast();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof initialForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    try {
      await clientsService.create({
        ...form,
        monthlyIncome: Number(form.monthlyIncome) || 0,
        monthlyExpenses: Number(form.monthlyExpenses) || 0,
      });
      setForm(initialForm);
      onDone();
      toast.success('Client registered successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Unable to register client.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register new client"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={loading}>
            <UserPlus className="h-4 w-4" /> Register client
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required>
          <Input value={form.fullName} onChange={set('fullName')} placeholder="Juan Dela Cruz" />
        </Field>
        <Field label="Date of birth">
          <Input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
        </Field>
        <Field label="Phone" required>
          <Input value={form.phone} onChange={set('phone')} placeholder="0917 000 0000" />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} placeholder="name@example.com" />
        </Field>
        <Field label="Valid ID no.">
          <Input value={form.idNumber} onChange={set('idNumber')} placeholder="ID-0000-000" />
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
        <Field label="Employer / business">
          <Input value={form.employerOrBusiness} onChange={set('employerOrBusiness')} />
        </Field>
        <Field label="Occupation">
          <Input value={form.occupation} onChange={set('occupation')} />
        </Field>
        <Field label="Monthly income">
          <Input type="number" value={form.monthlyIncome} onChange={set('monthlyIncome')} />
        </Field>
        <Field label="Monthly expenses">
          <Input type="number" value={form.monthlyExpenses} onChange={set('monthlyExpenses')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address">
            <Textarea rows={3} value={form.address} onChange={set('address')} placeholder="Street, Barangay, City/Town, Province" />
          </Field>
        </div>
      </div>
    </Modal>
  );
};

export default ClientsPage;