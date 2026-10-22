import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Banknote, Calculator, FileText, Plus, Search } from 'lucide-react';
import { LOAN_PURPOSES, LOAN_PURPOSE_LABELS, centsToDecimal, validateApplicationTerms, type LoanProduct } from '../../../shared/lending';
import { isKycVerified } from '../../../shared/kyc-core';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { Amount } from '../../portal/components/ui/Amount';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { Modal } from '../../portal/components/ui/Modal';
import { Field, Input, Select, Textarea } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { LoanQuoteView, ProductTerms, useLoanQuote } from '../../components/lending';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { clientsService, loansService } from '../services';
import { BranchApiError } from '../services/api';
import { LoanAssessmentPanel } from '../components/LoanAssessmentPanel';
import { LoanDisbursementModal } from '../components/LoanDisbursementModal';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'Submitted,Under Review', label: 'Waiting for review' },
  { value: 'Draft', label: 'Drafts / returned' },
  { value: 'Approved', label: 'Approved (to release)' },
  { value: 'Active', label: 'Active' },
  { value: 'Rejected,Cancelled', label: 'Rejected / cancelled' },
  { value: 'Closed,Written Off', label: 'Closed' },
];

const LoanApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const canOriginate = useBranchPermission(['process_loan_applications']);
  const canManage = useBranchPermission(['manage_loan_applications']);
  const canDisburse = useBranchPermission(['disburse_loans']);

  const [search, setSearch] = useState('');
  // Tellers come here to release approved loans.
  const [status, setStatus] = useState(() => (!canOriginate && !canManage && canDisburse ? 'Approved' : ''));
  const [newOpen, setNewOpen] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [disbursing, setDisbursing] = useState<string | null>(null);

  useEffect(() => {
    if (params.get('new') === '1' && canOriginate) {
      setNewOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams, canOriginate]);

  const fetcher = useCallback(async () => loansService.applications({ status: status || undefined, search: search || undefined }), [status, search]);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const rows = data || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Loan applications"
        subtitle="Applications, reviews, approvals and releases"
        actions={
          canOriginate && (
            <Button variant="brand" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" /> New application
            </Button>
          )
        }
      />

      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setStatus(t.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${status === t.value ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search by member name, phone or loan number…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading applications…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No applications" description="Nothing matches this filter." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Loan', 'Member', 'Product', 'Amount', 'Term', 'Applied', 'Officer', 'Status', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((app) => {
                  const reviewable = app.status === 'Submitted' || app.status === 'Under Review';
                  return (
                    <tr key={app.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-bold">
                        <Link to={`/staff/app/loans/${app.id}`} className="text-emerald-700 hover:underline">
                          {app.loanNumber}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800">
                        {app.borrowerName}
                        {app.borrowerPhone && <span className="block text-[11px] text-slate-400">{app.borrowerPhone}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{app.productName}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-slate-900">
                        <Amount value={app.principalAmount} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{app.termMonths} mo</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{app.applicationDate}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{app.loanOfficerName || 'Unassigned'}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {reviewable && canManage && (
                            <Button size="sm" variant="brandOutline" onClick={() => setReviewing(app.id)}>
                              <Calculator className="h-3.5 w-3.5" /> Review
                            </Button>
                          )}
                          {app.status === 'Approved' && canDisburse && (
                            <Button size="sm" variant="brand" className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => setDisbursing(app.id)}>
                              <Banknote className="h-3.5 w-3.5" /> Release
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
          onDone={(loanNumber, submitted) => {
            setNewOpen(false);
            toast.success(submitted ? `Application ${loanNumber} filed.` : `Draft ${loanNumber} saved.`);
            reload();
          }}
        />
      )}
      <LoanAssessmentPanel loanId={reviewing} onClose={() => setReviewing(null)} onAction={() => reload()} />
      <LoanDisbursementModal loanId={disbursing} onClose={() => setDisbursing(null)} onSuccess={() => reload()} />
    </div>
  );
};

interface NewApplicationModalProps {
  open: boolean;
  onClose: () => void;
  onDone: (loanNumber: string, submitted: boolean) => void;
}

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const NewApplicationModal: React.FC<NewApplicationModalProps> = ({ open, onClose, onDone }) => {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [borrowerId, setBorrowerId] = useState('');
  const [productId, setProductId] = useState('');
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('');
  const [purpose, setPurpose] = useState('BUSINESS');
  const [details, setDetails] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [requestKey, setRequestKey] = useState(newKey);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setServerErrors({});
    setSubmitError('');
    setRequestKey(newKey());
    setLoadError('');
    Promise.all([clientsService.list(), loansService.products()])
      .then(([b, p]) => {
        setBorrowers(b);
        setProducts(p);
        if (!borrowerId && b.length > 0) setBorrowerId(b[0].id);
        if (p.length > 0) {
          const first = p.find((x) => x.id === productId) ?? p[0];
          setProductId(first.id);
          setAmount(centsToDecimal(first.minAmount));
          setTerm(String(first.minTermMonths));
        }
      })
      .catch((err) => setLoadError(err?.message || 'Members or products could not be loaded.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const product = products.find((p) => p.id === productId) ?? null;
  const borrower = borrowers.find((b) => b.id === borrowerId);
  const { quote, error: quoteError } = useLoanQuote(product, amount, term);
  const purposeDetails = purpose === 'OTHER' ? { explanation: details } : details.trim() ? { details } : {};
  const validation = useMemo(() => validateApplicationTerms(product, { amount, termMonths: term, purpose, purposeDetails }), [product, amount, term, purpose, details]);
  const errors: Record<string, string> = { ...(touched ? (validation.errors as Record<string, string>) : {}), ...serverErrors };

  const submit = async (asDraft: boolean) => {
    setTouched(true);
    setServerErrors({});
    setSubmitError('');
    if (!borrowerId) {
      setSubmitError('Choose the member.');
      return;
    }
    if (!validation.ok) return;
    setLoading(true);
    try {
      const loan = await loansService.createApplication({ borrowerId, productId, amount, termMonths: term, purpose, purposeDetails, submit: !asDraft }, requestKey);
      onDone(loan.loanNumber, !asDraft);
    } catch (err) {
      if (err instanceof BranchApiError) setServerErrors(err.fieldErrors);
      setSubmitError(err instanceof Error ? err.message : 'The application could not be filed.');
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
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => submit(true)} loading={loading}>
            Save as draft
          </Button>
          <Button variant="brand" onClick={() => submit(false)} loading={loading}>
            File application
          </Button>
        </>
      }
    >
      {loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <div className="space-y-4">
          {submitError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Member" required>
              <Select value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)}>
                {borrowers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.fullName} ({b.borrowerNumber})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Loan product" required error={errors.product}>
              <Select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  const p = products.find((x) => x.id === e.target.value);
                  if (p) {
                    setAmount(centsToDecimal(p.minAmount));
                    setTerm(String(p.minTermMonths));
                  }
                }}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {borrower && !isKycVerified(borrower.kycStatus) && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">This member's KYC is not verified yet, so the application will be refused.</p>
          )}
          {product && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <ProductTerms product={product} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Amount (₱)" required error={errors.amount}>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Term (months)" required error={errors.termMonths}>
              <Input inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} />
            </Field>
            <Field label="Purpose" required error={errors.purpose}>
              <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                {LOAN_PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {LOAN_PURPOSE_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={purpose === 'OTHER' ? 'What the loan is for' : 'Details (optional)'} required={purpose === 'OTHER'} error={errors.purposeDetails}>
            <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          <LoanQuoteView quote={quote} error={quoteError} />
        </div>
      )}
    </Modal>
  );
};

export default LoanApplicationsPage;
