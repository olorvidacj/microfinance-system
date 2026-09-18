import React, { useState } from 'react';
import {
  TrendingUp,
  PieChart,
  AlertTriangle,
  CheckCircle2,
  StickyNote,
  Plus,
  Wallet,
  FileSpreadsheet,
  Users2,
  Award,
  Compass,
  HelpCircle,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { useAccess } from '../hooks/useAccess';

interface AdvisoryNote {
  id: string;
  area: string;
  note: string;
  author: string;
  addedAt: string;
}

const INITIAL_NOTES: AdvisoryNote[] = [
  {
    id: 'adv-1',
    area: 'Portfolio Risk',
    note: 'PAR30 trending below 5% — recommend maintaining the intensified collection drive through Q4.',
    author: 'Adviser / Consultant',
    addedAt: '2026-08-28 09:20:00',
  },
  {
    id: 'adv-2',
    area: 'Branch Expansion',
    note: 'Assessment favors opening a satellite collection desk in Barangay San Isidro to reduce borrower travel.',
    author: 'Adviser / Consultant',
    addedAt: '2026-08-15 14:05:00',
  },
];

export const AnalyticsView: React.FC = () => {
  const { stats, filteredLoans, filteredBorrowers, savingsAccounts, filteredPayments, currentUser } = useLoan();
  const { hasPermission, roleDef } = useAccess();
  const canAdvise = hasPermission('add_advisory_notes');

  const [notes, setNotes] = useState<AdvisoryNote[]>(INITIAL_NOTES);
  const [area, setArea] = useState('Portfolio Risk');
  const [draft, setDraft] = useState('');
  const [showComposer, setShowComposer] = useState(false);

  const card = 'bg-white rounded-2xl border border-slate-200 shadow-sm p-5';
  const cardLabel = 'text-[10px] uppercase tracking-wider font-bold text-slate-400';

  const overdue = filteredLoans.filter(
    (l) => l.status === 'In Arrears' || l.status === 'Defaulted' || (l.daysInArrears && l.daysInArrears > 0)
  ).length;
  const avgLoanSize = filteredLoans.length
    ? Math.round(filteredLoans.reduce((a, l) => a + l.principalAmount, 0) / filteredLoans.length)
    : 0;
  const savingsRate = stats.totalSavingsPool && stats.totalPortfolio
    ? Math.min(100, Math.round((stats.totalSavingsPool / stats.totalPortfolio) * 100))
    : 0;

  const handleAddNote = () => {
    if (!draft.trim()) return;
    setNotes((prev) => [
      {
        id: `adv-${Date.now()}`,
        area,
        note: draft.trim(),
        author: currentUser.name,
        addedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      },
      ...prev,
    ]);
    setDraft('');
    setShowComposer(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Analytics &amp; Advisory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Portfolio performance, member insights, and advisory recommendations for institutional guidance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAdvise && (
            <button
              onClick={() => setShowComposer((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition"
            >
              <Plus className="w-4 h-4" /> New Advisory Note
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-100 text-xs font-semibold text-teal-700">
            <Compass className="w-4 h-4" /> {roleDef.name}
          </span>
        </div>
      </div>

      {/* Composer */}
      {showComposer && canAdvise && (
        <div className="bg-white rounded-2xl border border-teal-200 shadow-sm p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Advisory Area
              </label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              >
                {['Portfolio Risk', 'Loan Growth', 'Branch Expansion', 'Member Retention', 'Operational Efficiency', 'Financial Health'].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <span className="text-xs text-slate-400">Autosaved to advisory log when submitted.</span>
            </div>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Write your consultative recommendation or analysis note..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setShowComposer(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAddNote}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition"
            >
              Publish Note
            </button>
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={card}>
          <div className={`${cardLabel} flex items-center gap-1.5`}>
            <TrendingUp className="w-3.5 h-3.5 text-teal-600" /> Portfolio Health
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">₱{stats.totalPortfolio.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">{stats.activeLoansCount} active loans</div>
        </div>
        <div className={card}>
          <div className={`${cardLabel} flex items-center gap-1.5`}>
            <PieChart className="w-3.5 h-3.5 text-gold-600" /> Savings-to-Portfolio
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{savingsRate}%</div>
          <div className="text-xs text-slate-500 mt-1">₱{stats.totalSavingsPool.toLocaleString()} pooled</div>
        </div>
        <div className={card}>
          <div className={`${cardLabel} flex items-center gap-1.5`}>
            <Users2 className="w-3.5 h-3.5 text-gold-600" /> Average Loan Size
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">₱{avgLoanSize.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">{filteredBorrowers.length} members</div>
        </div>
        <div className={card}>
          <div className={`${cardLabel} flex items-center gap-1.5`}>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> PAR {'>'} 30
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.par30Ratio}%</div>
          <div className="text-xs text-slate-500 mt-1">{overdue} delinquent accounts</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Performance insight panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className={card}>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
              <FileSpreadsheet className="w-4 h-4 text-teal-600" /> Institutional Performance Snapshot
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              <MetricsRow label="Total Disbursed" value={`₱${stats.totalDisbursed.toLocaleString()}`} sub={`${filteredLoans.length} loan facilities`} color="text-gold-600" />
              <MetricsRow label="Total Collected" value={`₱${stats.totalCollected.toLocaleString()}`} sub={`${filteredPayments.length} payment transactions`} color="text-emerald-600" />
              <MetricsRow label="Collection Rate" value={`${stats.collectionRate}%`} sub="monthly repayment capture" color="text-teal-600" />
              <MetricsRow label="Collection Efficiency" value={`${stats.collectionEfficiency}%`} sub="collection-to-collectible index" color="text-gold-600" />
              <MetricsRow label="Savings Pool" value={`₱${stats.totalSavingsPool.toLocaleString()}`} sub={`${savingsAccounts.length} passbook accounts`} color="text-amber-600" />
              <MetricsRow label="Vault Cash" value={`₱${stats.totalVaultCash.toLocaleString()}`} sub="combined branch vault positions" color="text-rose-600" />
            </div>
          </div>

          {/* Trend bars (visual summary) */}
          <div className={card}>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-teal-600" /> Portfolio Composition
            </h3>
            <div className="space-y-4">
              <TrendBar label="Healthy / Current" value={Math.max(0, 100 - stats.par30Ratio)} color="bg-emerald-500" />
              <TrendBar label="At Risk (PAR {'>'} 30)" value={stats.par30Ratio} color="bg-rose-500" />
              <TrendBar label="Collection Efficiency" value={stats.collectionEfficiency} color="bg-teal-500" />
              <TrendBar label="Member Engagement (active borrowers)" value={filteredBorrowers.length ? Math.min(100, Math.round((stats.activeBorrowersCount / filteredBorrowers.length) * 100)) : 0} color="bg-gold-500" />
            </div>
          </div>
        </div>

        {/* Advisory notes column */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-teal-600" /> Advisory Notes
            </h3>
            <Award className="w-4 h-4 text-slate-300" />
          </div>
          <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
            {notes.length === 0 && <p className="text-sm text-slate-400">No advisory notes recorded.</p>}
            {notes.map((n) => (
              <div key={n.id} className="bg-teal-50/70 border border-teal-100 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-teal-700">{n.area}</span>
                  <span className="text-[10px] text-slate-400">{n.addedAt}</span>
                </div>
                <p className="text-xs text-slate-700 mt-1.5">{n.note}</p>
                <div className="text-[10px] text-slate-400 mt-2 uppercase tracking-wider">By {n.author}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-slate-400 px-1">
        <HelpCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          This workspace is read-consultative for the Adviser / Consultant role. Recommendations are recorded as advisory
          notes and do not change transactional records.
        </span>
      </div>
    </div>
  );
};

const MetricsRow: React.FC<{ label: string; value: string; sub: string; color: string }> = ({ label, value, sub, color }) => (
  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{label}</div>
    <div className={`text-xl font-bold ${color} mt-1`}>{value}</div>
    <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
  </div>
);

const TrendBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div>
    <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
      <span className="font-medium">{label}</span>
      <span className="font-bold text-slate-700">{value}%</span>
    </div>
    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  </div>
);