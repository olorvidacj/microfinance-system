import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  ShieldCheck,
  Filter,
  Search,
  Calendar,
  AlertTriangle,
  Clock,
  User,
  Building2,
  DollarSign,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { formatCurrency, formatDate } from '../utils/loanMath';

export const ReportsView: React.FC = () => {
  const { filteredLoans, filteredPayments, branches, auditLogs, stats } = useLoan();

  const [activeReportTab, setActiveReportTab] = useState<'aging' | 'disbursement' | 'audit'>('aging');
  const [auditFilter, setAuditFilter] = useState<string>('ALL');

  // Delinquency Aging Buckets calculation
  const agingAnalysis = useMemo(() => {
    const buckets = {
      current: { count: 0, balance: 0, loans: [] as any[] },
      days1_30: { count: 0, balance: 0, loans: [] as any[] },
      days31_60: { count: 0, balance: 0, loans: [] as any[] },
      days61_90: { count: 0, balance: 0, loans: [] as any[] },
      days90_plus: { count: 0, balance: 0, loans: [] as any[] },
    };

    filteredLoans.forEach((loan) => {
      if (loan.status === 'Disbursed' || loan.status === 'In Arrears') {
        const days = loan.daysInArrears || 0;
        if (days === 0) {
          buckets.current.count++;
          buckets.current.balance += loan.remainingBalance;
          buckets.current.loans.push(loan);
        } else if (days <= 30) {
          buckets.days1_30.count++;
          buckets.days1_30.balance += loan.remainingBalance;
          buckets.days1_30.loans.push(loan);
        } else if (days <= 60) {
          buckets.days31_60.count++;
          buckets.days31_60.balance += loan.remainingBalance;
          buckets.days31_60.loans.push(loan);
        } else if (days <= 90) {
          buckets.days61_90.count++;
          buckets.days61_90.balance += loan.remainingBalance;
          buckets.days61_90.loans.push(loan);
        } else {
          buckets.days90_plus.count++;
          buckets.days90_plus.balance += loan.remainingBalance;
          buckets.days90_plus.loans.push(loan);
        }
      }
    });

    return buckets;
  }, [filteredLoans]);

  const filteredAudits = auditLogs.filter((log) => {
    if (auditFilter === 'ALL') return true;
    return log.action === auditFilter;
  });

  const exportAgingCSV = () => {
    const headers = ['Category', 'Bucket Range', 'Active Loans Count', 'Outstanding Portfolio ($)', 'Risk Level'];
    const rows = [
      ['Current (Performing)', '0 Days', agingAnalysis.current.count, agingAnalysis.current.balance, 'Low Risk (Healthy)'],
      ['Watchlist / Grace', '1 - 30 Days', agingAnalysis.days1_30.count, agingAnalysis.days1_30.balance, 'Moderate Risk'],
      ['Substandard (PAR30)', '31 - 60 Days', agingAnalysis.days31_60.count, agingAnalysis.days31_60.balance, 'High Risk'],
      ['Doubtful', '61 - 90 Days', agingAnalysis.days61_90.count, agingAnalysis.days61_90.balance, 'Severe Risk'],
      ['Loss / Default', '90+ Days', agingAnalysis.days90_plus.count, agingAnalysis.days90_plus.balance, 'Default / Write-off'],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `aging_delinquency_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Financial Statements & Regulatory Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Portfolio aging schedules, delinquency provisions, and immutable system audit trail.
          </p>
        </div>
        <button
          onClick={exportAgingCSV}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-sm font-medium transition shadow-2xs"
        >
          <Download className="w-4 h-4 text-gray-500" />
          <span>Export Current Report</span>
        </button>
      </div>

      {/* Sub-Tab navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 text-sm font-medium">
        <button
          onClick={() => setActiveReportTab('aging')}
          className={`pb-3 px-3 transition border-b-2 flex items-center gap-2 ${
            activeReportTab === 'aging'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Portfolio Aging & PAR Analysis</span>
        </button>

        <button
          onClick={() => setActiveReportTab('disbursement')}
          className={`pb-3 px-3 transition border-b-2 flex items-center gap-2 ${
            activeReportTab === 'disbursement'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Disbursement & Cashflow Ledger</span>
        </button>

        <button
          onClick={() => setActiveReportTab('audit')}
          className={`pb-3 px-3 transition border-b-2 flex items-center gap-2 ${
            activeReportTab === 'audit'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Immutable Audit Trail ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: Aging Analysis */}
      {activeReportTab === 'aging' && (
        <div className="space-y-6">
          {/* Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <div className="text-xs font-semibold text-gray-500 uppercase">Performing Portfolio</div>
              <div className="text-2xl font-bold text-emerald-600 font-mono mt-1">
                {formatCurrency(agingAnalysis.current.balance)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {agingAnalysis.current.count} On-Time Performing Contracts
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <div className="text-xs font-semibold text-gray-500 uppercase">Portfolio at Risk (PAR30)</div>
              <div className="text-2xl font-bold text-rose-600 font-mono mt-1">
                {formatCurrency(
                  agingAnalysis.days31_60.balance +
                    agingAnalysis.days61_90.balance +
                    agingAnalysis.days90_plus.balance
                )}
              </div>
              <div className="text-xs text-rose-600 font-medium mt-1">
                {stats.par30Ratio}% of total loan assets
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <div className="text-xs font-semibold text-gray-500 uppercase">Total Supervised Asset Base</div>
              <div className="text-2xl font-bold text-gray-900 font-mono mt-1">
                {formatCurrency(stats.totalPortfolio)}
              </div>
              <div className="text-xs text-blue-600 font-medium mt-1">{stats.activeLoansCount} Total Active Loans</div>
            </div>
          </div>

          {/* Aging Matrix Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Standard Portfolio Aging Schedule (PAR Matrix)</h3>
                <p className="text-xs text-gray-500">Categorized according to Basel / Microfinance prudential guidelines</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="py-3 px-4 sm:px-6">Aging Bucket</th>
                    <th className="py-3 px-4">Days in Arrears</th>
                    <th className="py-3 px-4">Loan Contracts</th>
                    <th className="py-3 px-4">Outstanding Balance ($)</th>
                    <th className="py-3 px-4">% of Portfolio</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Required Loss Provision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50">
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-emerald-700">Current (Performing)</td>
                    <td className="py-3.5 px-4 text-gray-600">0 Days</td>
                    <td className="py-3.5 px-4 font-mono font-medium">{agingAnalysis.current.count}</td>
                    <td className="py-3.5 px-4 font-mono font-bold">{formatCurrency(agingAnalysis.current.balance)}</td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {stats.totalPortfolio > 0
                        ? ((agingAnalysis.current.balance / stats.totalPortfolio) * 100).toFixed(1)
                        : 0}
                      %
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right font-mono text-gray-500">
                      1.0% ({formatCurrency(agingAnalysis.current.balance * 0.01)})
                    </td>
                  </tr>

                  <tr className="hover:bg-gray-50">
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-amber-700">Special Mention</td>
                    <td className="py-3.5 px-4 text-gray-600">1 – 30 Days</td>
                    <td className="py-3.5 px-4 font-mono font-medium">{agingAnalysis.days1_30.count}</td>
                    <td className="py-3.5 px-4 font-mono font-bold">{formatCurrency(agingAnalysis.days1_30.balance)}</td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {stats.totalPortfolio > 0
                        ? ((agingAnalysis.days1_30.balance / stats.totalPortfolio) * 100).toFixed(1)
                        : 0}
                      %
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right font-mono text-gray-500">
                      5.0% ({formatCurrency(agingAnalysis.days1_30.balance * 0.05)})
                    </td>
                  </tr>

                  <tr className="hover:bg-gray-50">
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-orange-700">Substandard (PAR 30)</td>
                    <td className="py-3.5 px-4 text-gray-600">31 – 60 Days</td>
                    <td className="py-3.5 px-4 font-mono font-medium">{agingAnalysis.days31_60.count}</td>
                    <td className="py-3.5 px-4 font-mono font-bold">{formatCurrency(agingAnalysis.days31_60.balance)}</td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {stats.totalPortfolio > 0
                        ? ((agingAnalysis.days31_60.balance / stats.totalPortfolio) * 100).toFixed(1)
                        : 0}
                      %
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right font-mono text-gray-500">
                      25.0% ({formatCurrency(agingAnalysis.days31_60.balance * 0.25)})
                    </td>
                  </tr>

                  <tr className="hover:bg-gray-50">
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-rose-700">Doubtful</td>
                    <td className="py-3.5 px-4 text-gray-600">61 – 90 Days</td>
                    <td className="py-3.5 px-4 font-mono font-medium">{agingAnalysis.days61_90.count}</td>
                    <td className="py-3.5 px-4 font-mono font-bold">{formatCurrency(agingAnalysis.days61_90.balance)}</td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {stats.totalPortfolio > 0
                        ? ((agingAnalysis.days61_90.balance / stats.totalPortfolio) * 100).toFixed(1)
                        : 0}
                      %
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right font-mono text-gray-500">
                      50.0% ({formatCurrency(agingAnalysis.days61_90.balance * 0.5)})
                    </td>
                  </tr>

                  <tr className="hover:bg-gray-50 bg-rose-50/30">
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-red-800">Loss / Default</td>
                    <td className="py-3.5 px-4 text-gray-600">90+ Days</td>
                    <td className="py-3.5 px-4 font-mono font-medium">{agingAnalysis.days90_plus.count}</td>
                    <td className="py-3.5 px-4 font-mono font-bold">{formatCurrency(agingAnalysis.days90_plus.balance)}</td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {stats.totalPortfolio > 0
                        ? ((agingAnalysis.days90_plus.balance / stats.totalPortfolio) * 100).toFixed(1)
                        : 0}
                      %
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right font-mono text-red-700 font-bold">
                      100% ({formatCurrency(agingAnalysis.days90_plus.balance * 1.0)})
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Disbursement Statement */}
      {activeReportTab === 'disbursement' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Loan Disbursals vs Recovery Summary</h3>
              <p className="text-xs text-gray-500">Consolidated cash balance & interest margins</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500">Gross Principal Disbursed</div>
              <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                {formatCurrency(stats.totalDisbursed)}
              </div>
            </div>
            <div className="p-4 bg-emerald-50/60 rounded-xl">
              <div className="text-xs text-emerald-800 font-semibold">Total Recovered Cash</div>
              <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                {formatCurrency(stats.totalCollected)}
              </div>
            </div>
            <div className="p-4 bg-blue-50/60 rounded-xl">
              <div className="text-xs text-blue-800 font-semibold">Outstanding Loan Balance</div>
              <div className="text-xl font-bold font-mono text-blue-700 mt-1">
                {formatCurrency(stats.totalPortfolio)}
              </div>
            </div>
            <div className="p-4 bg-purple-50/60 rounded-xl">
              <div className="text-xs text-purple-800 font-semibold">Aggregate Vault Cash</div>
              <div className="text-xl font-bold font-mono text-purple-700 mt-1">
                {formatCurrency(stats.totalVaultCash)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Audit Trail */}
      {activeReportTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Security & Compliance Audit Trail</h3>
              <p className="text-xs text-gray-500">Chronological logging of transactions and staff operations</p>
            </div>

            <div className="sm:w-60">
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="w-full p-2 text-xs bg-gray-50 border border-gray-200 rounded-xl"
              >
                <option value="ALL">All Audit Event Actions</option>
                <option value="PAYMENT_RECORDED">PAYMENT_RECORDED</option>
                <option value="LOAN_CREATED">LOAN_CREATED</option>
                <option value="LOAN_APPROVED">LOAN_APPROVED</option>
                <option value="LOAN_DISBURSED">LOAN_DISBURSED</option>
                <option value="REMINDER_SENT">REMINDER_SENT</option>
                <option value="BORROWER_CREATED">BORROWER_CREATED</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {filteredAudits.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">No matching audit events found.</div>
            ) : (
              filteredAudits.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50/80 transition text-xs flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[11px]">
                        {log.action}
                      </span>
                      <span className="font-semibold text-gray-900">{log.userName}</span>
                      <span className="text-gray-400">({log.userRole})</span>
                    </div>
                    <p className="text-gray-600 font-sans">{log.details}</p>
                    <div className="text-[11px] text-gray-400 font-mono">
                      Target: {log.targetType} #{log.targetId} • IP: {log.ipAddress}
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-gray-400 font-mono shrink-0">
                    <Clock className="w-3 h-3 inline mr-1 text-gray-400" />
                    {log.timestamp}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
