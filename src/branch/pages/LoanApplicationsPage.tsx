import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calculator,
  FileText,
  Plus,
  Search,
  Banknote,
  CheckCircle2,
  Clock,
  CheckCheck,
  AlertCircle,
} from 'lucide-react';
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
import { LoanDisbursementModal } from '../components/LoanDisbursementModal';

const STATUS_TABS = [
  { value: '', label: 'All Applications' },
  { value: 'Submitted', label: 'Submitted / Review' },
  { value: 'For Assessment', label: 'For Assessment' },
  { value: 'Approved', label: 'Approved (For Disbursement)' },
  { value: 'Active', label: 'Disbursed / Active' },
  { value: 'Completed', label: 'Completed' },
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
  const [disbursing, setDisbursing] = useState<BranchLoan | null>(null);

  useEffect(() => {
    if (params.get('new') === '1' && canOriginate) {
      setNewOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams, canOriginate]);

  const fetcher = useCallback(
    async () => loansService.list({ status: status || undefined, search: search || undefined }),
    [status, search]
  );
  const { data, loading, error, reload } = useBranchData(fetcher);

  const rows = data || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Loan Applications & Portfolio"
        subtitle="Origination pipeline, credit assessments, approvals, and fund disbursements"
        actions={
          canOriginate && (
            <Button variant="brand" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" /> New application
            </Button>
          )
        }
      />

      {/* Filter Tabs & Search */}
      <Card className="p-4">
        <div className="space-y-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
            {STATUS_TABS.map((t) => {
              const active = status === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setStatus(t.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by borrower name, phone, or loan application number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading loan pipeline…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No applications found"
          description="No loan applications match your current status filter or search query."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Application', 'Client', 'Product', 'Principal', 'Term', 'Applied', 'Officer', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((app) => {
                  const s = String(app.status || '').toUpperCase();
                  const isPendingReview = ['DRAFT', 'SUBMITTED', 'PENDING', 'UNDER REVIEW', 'UNDER_REVIEW'].includes(s);
                  const isForAssessment = ['FOR ASSESSMENT', 'FOR_ASSESSMENT', 'RECOMMENDED'].includes(s);
                  const isApproved = ['APPROVED', 'FOR_DISBURSEMENT'].includes(s);
                  const isDisbursed = ['ACTIVE', 'DISBURSED', 'IN ARREARS', 'IN_ARREARS'].includes(s);

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-900">
                        <Link to={`/staff/app/loans/${app.id}`} className="text-emerald-700 hover:text-emerald-900 hover:underline">
                          {app.loanNumber}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-800 font-medium">
                        {app.borrowerName}
                        {app.borrowerPhone && (
                          <span className="block text-[11px] text-slate-400">{app.borrowerPhone}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{app.productName}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums font-bold text-slate-900">
                        <Amount value={app.principalAmount} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{app.termMonths} mo</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{app.applicationDate}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{app.loanOfficerName || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(isPendingReview || isForAssessment) && canManage && (
                            <Button size="sm" variant="brandOutline" onClick={() => setAssessing(app)}>
                              <Calculator className="h-3.5 w-3.5" /> Assess & Review
                            </Button>
                          )}

                          {isApproved && canManage && (
                            <Button
                              size="sm"
                              variant="brand"
                              className="bg-emerald-700 hover:bg-emerald-800 text-white"
                              onClick={() => setDisbursing(app)}
                            >
                              <Banknote className="h-3.5 w-3.5" /> Disburse
                            </Button>
                          )}

                          <Button size="sm" variant="outline" onClick={() => navigate(`/staff/app/loans/${app.id}`)}>
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Credit Assessment Panel */}
      <LoanAssessmentPanel
        loan={assessing}
        onClose={() => setAssessing(null)}
        onAction={() => reload()}
        onDisbursePrompt={(l) => {
          setAssessing(null);
          setDisbursing(l);
        }}
      />

      {/* Atomic Disbursement Modal */}
      <LoanDisbursementModal
        loan={disbursing}
        onClose={() => setDisbursing(null)}
        onSuccess={() => reload()}
      />
    </div>
  );
};

interface NewApplicationModalProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

const NewApplicationModal: React.FC<NewApplicationModalProps> = ({ open, onClose, onDone }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [borrowerId, setBorrowerId] = useState('');
  const [productId, setProductId] = useState('');
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('');
  const [frequency, setFrequency] = useState('Monthly');
  const [purpose, setPurpose] = useState('');

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const [b, p] = await Promise.all([clientsService.list(), loansService.products()]);
        setBorrowers(b);
        setProducts(p);
        if (b.length > 0) setBorrowerId(b[0].id);
        if (p.length > 0) {
          setProductId(p[0].id);
          setAmount(String(p[0].minAmount || 10000));
          setTerm(String(p[0].minTermMonths || 6));
        }
      } catch {}
    };
    load();
  }, [open]);

  const selProd = products.find((p) => p.id === productId) || products[0];

  const handleSubmit = async () => {
    if (!borrowerId || !productId || !amount || !term || !purpose) {
      toast.error('All fields are required.');
      return;
    }
    setLoading(true);
    try {
      await loansService.createApplication({
        borrowerId,
        productId,
        productName: selProd?.name,
        principalAmount: Number(amount),
        termMonths: Number(term),
        repaymentFrequency: frequency,
        interestRate: selProd?.interestRate || 12,
        interestType: selProd?.interestType || 'Flat Rate',
        purpose,
      });
      onDone();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit loan application.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Originate Staff Loan Application"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSubmit} loading={loading}>
            Submit Application
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Client / Borrower" required>
          <Select value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)}>
            {borrowers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.fullName} ({b.borrowerNumber}) · KYC: {b.kycStatus}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Loan Product" required>
          <Select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const p = products.find((x) => x.id === e.target.value);
              if (p) {
                setAmount(String(p.minAmount));
                setTerm(String(p.minTermMonths));
              }
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (₱{Number(p.minAmount).toLocaleString()} - ₱{Number(p.maxAmount).toLocaleString()})
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Principal Amount (₱)" required>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Term (Months)" required>
            <Input type="number" value={term} onChange={(e) => setTerm(e.target.value)} />
          </Field>
        </div>

        <Field label="Repayment Frequency" required>
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="Monthly">Monthly</option>
            <option value="Semi-Monthly">Semi-Monthly</option>
            <option value="Weekly">Weekly</option>
            <option value="Daily">Daily</option>
          </Select>
        </Field>

        <Field label="Loan Purpose" required>
          <Input
            placeholder="e.g. Sari-sari store capital expansion"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
};

export default LoanApplicationsPage;