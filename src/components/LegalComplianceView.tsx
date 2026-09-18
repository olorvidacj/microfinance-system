import React, { useState } from 'react';
import {
  Scale,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Search,
  StickyNote,
  Plus,
  Landmark,
  CheckCircle2,
  Gavel,
  BadgeCheck,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { useAccess } from '../hooks/useAccess';

interface LegalNote {
  id: string;
  loanId: string;
  loanNumber: string;
  borrowerName: string;
  note: string;
  addedBy: string;
  addedAt: string;
}

const INITIAL_NOTES: LegalNote[] = [];

export const LegalComplianceView: React.FC = () => {
  const { filteredLoans, filteredBorrowers, currentUser } = useLoan();
  const { hasPermission } = useAccess();
  const canManage = hasPermission('manage_legal_records');

  const [searchQuery, setSearchQuery] = useState('');
  const [reviewMode, setReviewMode] = useState<'all' | 'overdue' | 'collateral'>('all');
  const [legalNotes, setLegalNotes] = useState<LegalNote[]>(INITIAL_NOTES);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteTarget, setNoteTarget] = useState<string | null>(null);

  const overdue = filteredLoans.filter(
    (l) => l.status === 'In Arrears' || l.status === 'Defaulted' || (l.daysInArrears && l.daysInArrears > 0)
  );
  const withCollateral = filteredLoans.filter((l) => (l.collaterals || []).length > 0);

  const filtered = filteredLoans.filter((l) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const haystack = `${l.loanNumber} ${l.borrowerName}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (reviewMode === 'overdue' && l.status !== 'In Arrears' && l.status !== 'Defaulted') return false;
    if (reviewMode === 'collateral' && (l.collaterals || []).length === 0) return false;
    return true;
  });

  const handleAddNote = (loanId: string, loanNumber: string, borrowerName: string) => {
    if (!noteDraft.trim()) return;
    setLegalNotes((prev) => [
      {
        id: `leg-note-${Date.now()}`,
        loanId,
        loanNumber,
        borrowerName,
        note: noteDraft.trim(),
        addedBy: currentUser.name,
        addedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      },
      ...prev,
    ]);
    setNoteDraft('');
    setNoteTarget(null);
  };

  const kpiCard = 'bg-white rounded-2xl border border-slate-200 shadow-sm p-5';
  const kpiLabel = 'text-[10px] uppercase tracking-wider font-bold text-slate-400';
  const kpiValue = 'text-2xl font-bold text-slate-900 mt-1';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Legal &amp; Compliance</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Loan agreements, collateral documentation, delinquency tracking, and compliance coverage.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-700">
          <Scale className="w-4 h-4" /> Legal Office Workspace
        </span>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={kpiCard}>
          <div className={`${kpiLabel} flex items-center gap-1.5`}>
            <FileText className="w-3.5 h-3.5 text-rose-600" /> Loan Records
          </div>
          <div className={kpiValue}>{filteredLoans.length}</div>
          <div className="text-xs text-slate-500 mt-1">agreements on file</div>
        </div>
        <div className={kpiCard}>
          <div className={`${kpiLabel} flex items-center gap-1.5`}>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Delinquent Accounts
          </div>
          <div className={kpiValue}>{overdue.length}</div>
          <div className="text-xs text-slate-500 mt-1">potentially actionable</div>
        </div>
        <div className={kpiCard}>
          <div className={`${kpiLabel} flex items-center gap-1.5`}>
            <Landmark className="w-3.5 h-3.5 text-gold-600" /> Collateralized Loans
          </div>
          <div className={kpiValue}>{withCollateral.length}</div>
          <div className="text-xs text-slate-500 mt-1">secured documents</div>
        </div>
        <div className={kpiCard}>
          <div className={`${kpiLabel} flex items-center gap-1.5`}>
            <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" /> Compliance Coverage
          </div>
          <div className={kpiValue}>
            {Math.round((filteredLoans.filter((l) => (l.collaterals || []).length > 0 && l.guarantors?.length).length / Math.max(filteredLoans.length, 1)) * 100)}%
          </div>
          <div className="text-xs text-slate-500 mt-1">documented &amp; secured</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by loan number or borrower..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'overdue', 'collateral'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setReviewMode(mode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition capitalize ${
                  reviewMode === mode
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mode === 'all' ? 'All' : mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Legal records table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Gavel className="w-4 h-4 text-rose-600" /> Legal Review Records
            </h3>
            <span className="text-xs text-slate-400">{filtered.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-left font-semibold">Borrower</th>
                  <th className="px-4 py-3 text-left font-semibold">Loan #</th>
                  <th className="px-4 py-3 text-left font-semibold">Amount</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Secured</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No records match your filter.
                    </td>
                  </tr>
                )}
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{l.borrowerName}</div>
                      <div className="text-xs text-slate-400">{l.purpose}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{l.loanNumber}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      ₱{l.principalAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          l.status === 'In Arrears' || l.status === 'Defaulted'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(l.collaterals || []).length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-600">
                          <ShieldCheck className="w-3.5 h-3.5" /> {(l.collaterals || []).length}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setNoteTarget(noteTarget === l.id ? null : l.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
                      >
                        <StickyNote className="w-3.5 h-3.5" /> Legal Note
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Inline note composer */}
          {noteTarget && (() => {
            const target = filteredLoans.find((l) => l.id === noteTarget);
            if (!target) return null;
            return (
              <div className="border-t border-slate-100 p-4 bg-rose-50/50 space-y-2">
                <div className="text-xs font-semibold text-rose-700">
                  Legal note for {target.loanNumber} — {target.borrowerName}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Enter legal annotation, case note, or compliance remark..."
                    className="flex-1 px-3 py-2 rounded-xl border border-rose-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                  />
                  {canManage && (
                    <button
                      onClick={() => handleAddNote(target.id, target.loanNumber, target.borrowerName)}
                      className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition"
                    >
                      <Plus className="w-4 h-4" /> Save
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Legal notes sidebar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-rose-600" /> Legal Notes &amp; Annotations
            </h3>
          </div>
          <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
            {legalNotes.length === 0 && (
              <p className="text-sm text-slate-400">No legal notes recorded yet.</p>
            )}
            {legalNotes.map((n) => (
              <div key={n.id} className="bg-rose-50/70 border border-rose-100 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-rose-600 font-semibold">{n.loanNumber}</span>
                  <span className="text-[10px] text-slate-400">{n.addedAt}</span>
                </div>
                <div className="text-sm font-semibold text-slate-800 mt-1">{n.borrowerName}</div>
                <p className="text-xs text-slate-600 mt-1">{n.note}</p>
                <div className="text-[10px] text-slate-400 mt-2 uppercase tracking-wider">By {n.addedBy}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
        <ShieldCheck className="w-4 h-4" />
        <span>
          Legal annotations are appended to the audit trail. Compliance monitoring covers outstanding loan contracts,
          collateral registrations, and delinquency exposure.
        </span>
      </div>
    </div>
  );
};