import React, { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Banknote, HandCoins, ReceiptText, RefreshCw, Wallet } from 'lucide-react';
import { formatBps } from '../../../shared/lending';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { StatCard } from '../../portal/components/common';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { useToast } from '../../portal/components/ui/Toast';
import { peso } from '../../components/lending';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { collectionsService } from '../services';

const CollectionsPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const canCollect = useBranchPermission(['process_loan_repayments']);
  const canRunCheck = useBranchPermission(['monitor_loan_repayment', 'process_loan_repayments']);
  const fetcher = useCallback(() => Promise.all([collectionsService.today(), collectionsService.overdue()]), []);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const [running, setRunning] = useState(false);

  const runCheck = async () => {
    setRunning(true);
    try {
      const r = await collectionsService.runOverdueCheck();
      toast.success(r.penaltiesCharged ? `${r.penaltiesCharged} penalties charged (₱${r.amountCharged}).` : 'Overdue check done; no new penalties were due.');
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The overdue check failed.');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <LoadingState label="Loading collections…" />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;
  const [today, overview] = data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Collections"
        subtitle={`Overdue loans and portfolio at risk as of ${overview.asOf}`}
        actions={
          <div className="flex gap-2">
            {canRunCheck && (
              <Button variant="outline" onClick={runCheck} loading={running}>
                <RefreshCw className="h-4 w-4" /> Run overdue check
              </Button>
            )}
            {canCollect && (
              <Button variant="brand" onClick={() => navigate('/staff/app/payments')}>
                <HandCoins className="h-4 w-4" /> Record payment
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collected today" value={peso(today.totals.total)} icon={Banknote} tone="emerald" />
        <StatCard label="Payments today" value={today.totals.count} icon={ReceiptText} tone="blue" />
        <StatCard label="Outstanding principal" value={peso(overview.portfolio)} icon={Wallet} tone="amber" />
        <StatCard label="Loans overdue" value={`${overview.overdue.length} of ${overview.activeLoans}`} icon={AlertTriangle} tone="violet" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio at risk</CardTitle>
          <span className="text-xs text-slate-400">Outstanding principal of loans past due by more than N days, over all outstanding principal</span>
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {overview.par.map((b) => (
            <div key={b.days} className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase text-slate-400">PAR {b.days === 0 ? '1' : b.days}</p>
              <p className={`text-xl font-bold tabular-nums ${b.ratioBps > 0 ? 'text-rose-700' : 'text-slate-800'}`}>{formatBps(b.ratioBps)}</p>
              <p className="text-xs text-slate-500">{peso(b.atRisk)}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Overdue loans
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {overview.overdue.length === 0 ? (
            <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="No overdue loans" description="Every active loan is up to date." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Loan', 'Member', 'Days past due', 'Overdue', 'Penalties owed', 'Principal outstanding', 'Officer', ''].map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {overview.overdue.map((l) => (
                    <tr key={l.loanId}>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">
                        <Link to={`/staff/app/loans/${l.loanId}`} className="text-emerald-700 hover:underline">
                          {l.loanNumber}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {l.borrowerName}
                        <span className="block text-[11px] text-slate-400">{l.borrowerPhone}</span>
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 font-bold ${l.daysPastDue > 30 ? 'text-rose-700' : 'text-amber-700'}`}>{l.daysPastDue}</td>
                      <td className="whitespace-nowrap px-4 py-3">{peso(l.overdueAmount)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-rose-700">{peso(l.penaltiesOutstanding)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{peso(l.outstandingPrincipal)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{l.loanOfficerName || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {canCollect && (
                          <Button size="sm" variant="brand" onClick={() => navigate(`/staff/app/payments?loan=${l.loanId}`)}>
                            Collect
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4" /> Today's payments
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {today.payments.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No payments recorded today.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <tbody className="divide-y divide-slate-100">
                {today.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-semibold">{p.receiptNumber}</td>
                    <td className="px-4 py-3">{p.borrowerName}</td>
                    <td className="px-4 py-3 text-emerald-700">{p.loanNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{p.paymentMethod}</td>
                    <td className="px-4 py-3 text-slate-600">{p.collectedBy}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{peso(String(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default CollectionsPage;
