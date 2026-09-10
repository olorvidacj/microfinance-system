import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, HandCoins, ReceiptText, Wallet } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { Amount } from '../../portal/components/ui/Amount';
import { StatCard } from '../../portal/components/common';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { collectionsService } from '../services';

const CollectionsPage: React.FC = () => {
  const navigate = useNavigate();
  const canCollect = useBranchPermission(['monitor_loan_repayment', 'process_loan_payments', 'receive_cash']);
  const fetcher = useCallback(() => collectionsService.today(), []);
  const { data, loading, error, reload } = useBranchData(fetcher);

  if (loading) return <LoadingState label="Loading today's collections…" />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;

  const { payments, totals } = data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Collections"
        subtitle={`Loan payments collected today (${new Date().toLocaleDateString()})`}
        actions={
          canCollect && (
            <Button variant="brand" onClick={() => navigate('/staff/app/payments')}>
              <HandCoins className="h-4 w-4" /> Record payment
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total collected" value={<Amount value={totals.total} />} icon={Banknote} tone="emerald" />
        <StatCard label="Transactions" value={totals.count} icon={ReceiptText} tone="blue" />
        <StatCard label="Cash" value={<Amount value={totals.cash} />} icon={Wallet} tone="amber" />
        <StatCard label="Cashless" value={<Amount value={totals.other} />} icon={Wallet} tone="violet" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ReceiptText className="h-4 w-4" /> Today's payments</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {payments.length === 0 ? (
            <EmptyState icon={<ReceiptText className="h-6 w-6" />} title="No collections yet today" description="Recorded loan payments will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {['Receipt no.', 'Borrower', 'Loan no.', 'Method', 'Collected by', 'Amount'].map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-800">{p.receiptNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{p.borrowerName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-blue-700">{p.loanNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{p.paymentMethod}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{p.collectedBy}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums font-semibold text-emerald-700"><Amount value={p.amount} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default CollectionsPage;