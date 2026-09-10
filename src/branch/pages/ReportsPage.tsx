import React, { useCallback, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { Amount } from '../../portal/components/ui/Amount';
import { LoadingState, ErrorState } from '../../portal/components/ui/States';
import { Field, Input } from '../../portal/components/ui/Field';
import { Tabs } from '../../portal/components/ui/Tabs';
import { useBranchData } from '../hooks/useBranchData';
import { reportsService } from '../services';
import { ReportRow } from '../types';

const REPORT_TYPES = [
  { id: 'clients', label: 'Clients' },
  { id: 'kyc', label: 'KYC' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'applications', label: 'Applications' },
  { id: 'collections', label: 'Collections' },
  { id: 'savings', label: 'Savings' },
  { id: 'groups', label: 'Groups' },
];

const MONEY_FIELDS = ['principalAmount', 'remainingBalance', 'amount', 'outstanding', 'outstandingBalance', 'totalGroupSavings', 'savingsBalance', 'totalSavings', 'total', 'deposits', 'withdrawals'];

const exportCsv = (report: ReportRow) => {
  if (!report.rows.length) return;
  const headers = Object.keys(report.rows[0]);
  const lines = report.rows.map((r) =>
    headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.type}-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const ReportsPage: React.FC = () => {
  const [type, setType] = useState('clients');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const fetcher = useCallback(() => reportsService.get(type, from || undefined, to || undefined), [type, from, to]);
  const { data, loading, error, reload } = useBranchData(fetcher);

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Branch operations reports"
        actions={
          data && data.rows.length > 0 && (
            <Button variant="outline" onClick={() => exportCsv(data)}>
              <Download className="h-4 w-4" /> Download CSV
            </Button>
          )
        }
      />

      <Card className="p-4">
        <Tabs tabs={REPORT_TYPES} active={type} onChange={(t) => setType(t)} />
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Button variant="brandOutline" onClick={reload}>
            <BarChart3 className="h-4 w-4" /> Generate
          </Button>
        </div>
      </Card>

      {loading ? (
        <LoadingState label={`Generating ${type} report…`} />
      ) : data ? (
        <Card>
          <ReportBody report={data} />
        </Card>
      ) : null}
    </div>
  );
};

const ReportBody: React.FC<{ report: ReportRow }> = ({ report }) => {
  const summaryEntries = Object.entries(report.summary || {});

  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span className="font-semibold uppercase tracking-wide text-slate-500">{report.type} report</span>
        <span>Generated {new Date(report.generatedAt).toLocaleString()}</span>
      </div>

      {summaryEntries.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryEntries.map(([k, v]) => (
            <div key={k} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs text-slate-400">{k}</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-slate-800">
                {typeof v === 'number' && MONEY_FIELDS.includes(k) ? <Amount value={v} /> : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}
              </p>
            </div>
          ))}
        </div>
      )}

      {report.rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No data for this report period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {Object.keys(report.rows[0]).map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.rows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {Object.entries(row).map(([k, v]) => (
                    <td key={k} className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-slate-700">
                      {typeof v === 'number' && MONEY_FIELDS.includes(k) ? <Amount value={v} /> : v === null || v === undefined ? '—' : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;