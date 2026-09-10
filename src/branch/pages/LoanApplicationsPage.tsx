import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Calculator, FileText, Plus, Search } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { Amount } from '../../portal/components/ui/Amount';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { Modal } from '../../portal/components/ui/Modal';
import { Field, Input, Select } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { clientsService, loansService } from '../services';
import { BranchLoan, LoanProduct } from '../types';
import { LoanAssessmentPanel } from '../components/LoanAssessmentPanel';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Under Review', label: 'Under Review' },
  { value: 'For Assessment', label: 'For Assessment' },
];

const LoanApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const canOriginate = useBranchPermission(['process_loan_applications']);
  const canManage = useBranchPermission(['manage_loan_applications', 'approve_sensitive_operations']);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [assessing, setAssessing] = useState<BranchLoan | null>(null);

  useEffect(() => {
    if (params.get('new') === '1' && canOriginate) {
      setNewOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams, canOriginate]);

  const fetcher = useCallback(
    async () => loansService.applications({ status: status || undefined, search: search || undefined }),
    [status, search]
  );
  const { data, loading, error, reload } = useBranchData(fetcher);

  const rows = data || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Loan applications"
        subtitle="Applications in the pipeline awaiting processing and assessment"
        actions={
          canOriginate && (
            <Button variant="brand" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" /> New application
            </Button>
          )
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by borrower or loan number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="lg:w-48">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading loan applications…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No applications" description="No loan applications match your filters." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Application', 'Client', 'Product', 'Amount', 'Term', 'Applied', 'Officer', 'Status', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-800">
                      <Link to={`/staff/app/loans/${app.id}`} className="text-blue-700 hover:text-blue-900">
                        {app.loanNumber}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{app.borrowerName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{app.productName}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-800"><Amount value={app.principalAmount} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{app.termMonths} mo</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{app.applicationDate}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{app.loanOfficerName || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={app.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {canManage && ['Draft', 'Submitted'].includes(app.status) && (
                        <Button size="sm" variant="brandOutline" onClick={() => setAssessing(app)}>
                          <Calculator className="h-3.5 w-3.5" /> Assess
                        </Button>
                      )}
                      {!['Draft', 'Submitted'].includes(app.status) && (
                        <Button size="sm" variant="outline" onClick={() => navigate(`/staff/app/loans/${app.id}`)}>
                          View
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {canOriginate && (
        <NewApplicationModal
          open={newOpen}
          onClose={() => setNewOpen(false)}
          onDone={() => {
            setNewOpen(false);
            toast.success('Loan application submitted');
            reload();
          }}
        />
      )}

      <LoanAssessmentPanel
        loan={assessing}
        onClose={() => setAssessing(null)}
        onAction={() => reload()}
      />
    </div>
  );
};

const NewApplicationModal: React.FC<{ open: boolean; onClose: () => void; onDone: () => void }> = ({ open, onClose, onDone }) => {
  const toast = useToast();
  const clients = useBranchData(() => clientsService.list({}));
  const products = useBranchData(() => loansService.products());

  const [borrowerId, setBorrowerId] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [productId, setProductId] = useState('');
  const [principal, setPrincipal] = useState('30000');
  const [term, setTerm] = useState('12');
  const [rate, setRate] = useState('12');
  const [frequency, setFrequency] = useState('Monthly');
  const [interestType, setInterestType] = useState('Flat Rate');
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(false);

  const productOptions = products.data || [];
  const selectedProduct = useMemo<LoanProduct | undefined>(() => productOptions.find((p) => p.id === productId), [productOptions, productId]);

  useEffect(() => {
    if (selectedProduct) {
      setRate(String(selectedProduct.interestRatePerMonth ? Math.round(selectedProduct.interestRatePerMonth * 100) : 12));
      if (!principal) setPrincipal(String(selectedProduct.maxAmount || 50000));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

  const submit = async () => {
    if (!borrowerId && !borrowerName) {
      toast.error('Select or type the client name.');
      return;
    }
    setLoading(true);
    try {
      await loansService.createApplication({
        borrowerId: borrowerId || undefined,
        borrowerName: borrowerId ? undefined : borrowerName,
        productId: productId || undefined,
        productName: selectedProduct?.name || 'General Loan',
        principalAmount: Number(principal) || 0,
        termMonths: Number(term) || 6,
        interestRate: Number(rate) || 12,
        repaymentFrequency: frequency,
        interestType,
        purpose,
      });
      onDone();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to submit loan application.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New loan application"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={loading}>
            <FileText className="h-4 w-4" /> Submit application
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client (select)" hint={clients.error ? 'Client list unavailable — type the name instead.' : 'Registered clients in this branch'}>
          <Select value={borrowerId} onChange={(e) => { setBorrowerId(e.target.value); }}>
            <option value="">— Select client —</option>
            {(clients.data || []).map((c) => (
              <option key={c.id} value={c.id}>{c.fullName} ({c.borrowerNumber})</option>
            ))}
          </Select>
        </Field>
        <Field label="Or type client name">
          <Input value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="New / walk-in client name" />
        </Field>
        <Field label="Loan product">
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">— Select product —</option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Purpose">
          <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Loan purpose" />
        </Field>
        <Field label="Principal amount (₱)">
          <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
        </Field>
        <Field label="Term (months)">
          <Input type="number" value={term} onChange={(e) => setTerm(e.target.value)} />
        </Field>
        <Field label="Interest rate (%)">
          <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Field label="Interest type">
          <Select value={interestType} onChange={(e) => setInterestType(e.target.value)}>
            <option>Flat Rate</option>
            <option>Reducing Balance</option>
          </Select>
        </Field>
        <Field label="Repayment frequency">
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option>Monthly</option>
            <option>Weekly</option>
            <option>Quarterly</option>
            <option>Lump-sum</option>
          </Select>
        </Field>
      </div>
      {selectedProduct && selectedProduct.description && (
        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">{selectedProduct.description}</p>
      )}
    </Modal>
  );
};

export default LoanApplicationsPage;