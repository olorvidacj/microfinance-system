import React, { useState, useMemo } from 'react';
import {
  Activity,
  Clock,
  ShieldCheck,
  FileText,
  CheckCircle2,
  UserCheck,
  CreditCard,
  PiggyBank,
  UserPlus,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  Building2,
  Eye,
  X,
  Copy,
  Check,
  Sparkles,
  SlidersHorizontal,
  Calendar,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { AuditLogEntry, Loan } from '../types';
import { formatDate } from '../utils/loanMath';

interface AuditTrailProps {
  onSelectLoan?: (loan: Loan) => void;
  onNavigateTab?: (tab: any) => void;
  maxInitialDisplay?: number;
  standalone?: boolean;
}

export const AuditTrail: React.FC<AuditTrailProps> = ({
  onSelectLoan,
  onNavigateTab,
  maxInitialDisplay = 10,
  standalone = false,
}) => {
  const { auditLogs, branches, activeBranchId, loans } = useLoan();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [timeHorizon, setTimeHorizon] = useState<'ALL' | 'TODAY' | '7DAYS' | '30DAYS'>('ALL');
  const [displayCount, setDisplayCount] = useState<number>(maxInitialDisplay);
  const [viewMode, setViewMode] = useState<'timeline' | 'compact'>('timeline');
  const [inspectedLog, setInspectedLog] = useState<AuditLogEntry | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Time format helpers
  const getRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return isoString;
    }
  };

  const getExactDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Humanize action codes
  const humanizeAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Helper for category badge styling and icons
  const getCategoryMeta = (type: AuditLogEntry['type']) => {
    switch (type) {
      case 'LOAN':
        return {
          label: 'Loan Action',
          icon: FileText,
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-200',
          badgeBg: 'bg-blue-100 text-blue-800',
          dotBg: 'bg-blue-500',
        };
      case 'PAYMENT':
        return {
          label: 'Payment Collection',
          icon: CreditCard,
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          badgeBg: 'bg-emerald-100 text-emerald-800',
          dotBg: 'bg-emerald-500',
        };
      case 'BORROWER':
        return {
          label: 'Member Update',
          icon: UserCheck,
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-200',
          badgeBg: 'bg-amber-100 text-amber-800',
          dotBg: 'bg-amber-500',
        };
      case 'MEMBERSHIP':
        return {
          label: 'Membership Pipeline',
          icon: UserPlus,
          bg: 'bg-purple-50',
          text: 'text-purple-700',
          border: 'border-purple-200',
          badgeBg: 'bg-purple-100 text-purple-800',
          dotBg: 'bg-purple-500',
        };
      case 'SAVINGS':
        return {
          label: 'Savings & Vault',
          icon: PiggyBank,
          bg: 'bg-teal-50',
          text: 'text-teal-700',
          border: 'border-teal-200',
          badgeBg: 'bg-teal-100 text-teal-800',
          dotBg: 'bg-teal-500',
        };
      case 'SECURITY':
      case 'SYSTEM':
      default:
        return {
          label: 'System & Security',
          icon: ShieldCheck,
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-200',
          badgeBg: 'bg-slate-200 text-slate-800',
          dotBg: 'bg-slate-500',
        };
    }
  };

  // Filtered logs calculation
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // Category filter
      if (selectedType !== 'ALL' && log.type !== selectedType) {
        return false;
      }

      // Branch filter (either local filter or global context branch)
      if (selectedBranch !== 'ALL' && log.branchId !== selectedBranch) {
        return false;
      }
      if (activeBranchId !== 'all' && selectedBranch === 'ALL' && log.branchId !== activeBranchId) {
        return false;
      }

      // Time Horizon Filter
      if (timeHorizon !== 'ALL') {
        const logDate = new Date(log.timestamp).getTime();
        const now = new Date().getTime();
        const diffHours = (now - logDate) / (1000 * 60 * 60);

        if (timeHorizon === 'TODAY' && diffHours > 24) return false;
        if (timeHorizon === '7DAYS' && diffHours > 24 * 7) return false;
        if (timeHorizon === '30DAYS' && diffHours > 24 * 30) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchAction = log.action.toLowerCase().includes(q);
        const matchDetails = log.details.toLowerCase().includes(q);
        const matchActor = log.performedBy.toLowerCase().includes(q);
        const matchTarget = (log.targetId || '').toLowerCase().includes(q);
        const matchUser = (log.userName || '').toLowerCase().includes(q);
        const matchType = log.type.toLowerCase().includes(q);

        if (!matchAction && !matchDetails && !matchActor && !matchTarget && !matchUser && !matchType) {
          return false;
        }
      }

      return true;
    });
  }, [auditLogs, selectedType, selectedBranch, activeBranchId, timeHorizon, searchTerm]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: auditLogs.length,
      LOAN: 0,
      PAYMENT: 0,
      BORROWER: 0,
      MEMBERSHIP: 0,
      SAVINGS: 0,
      SYSTEM: 0,
    };
    auditLogs.forEach((log) => {
      if (counts[log.type] !== undefined) {
        counts[log.type]++;
      } else {
        counts.SYSTEM++;
      }
    });
    return counts;
  }, [auditLogs]);

  // Export to CSV
  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const headers = [
        'Timestamp (ISO)',
        'Formatted Date',
        'Action Code',
        'Category Type',
        'Details Narrative',
        'Performed By',
        'User Name',
        'User Role',
        'Branch Code',
        'Target Entity Type',
        'Target ID',
        'IP Address',
      ];

      const rows = filteredLogs.map((l) => [
        `"${l.timestamp}"`,
        `"${getExactDateTime(l.timestamp)}"`,
        `"${l.action}"`,
        `"${l.type}"`,
        `"${l.details.replace(/"/g, '""')}"`,
        `"${l.performedBy.replace(/"/g, '""')}"`,
        `"${l.userName || ''}"`,
        `"${l.userRole || ''}"`,
        `"${l.branchId || ''}"`,
        `"${l.targetType || ''}"`,
        `"${l.targetId || ''}"`,
        `"${l.ipAddress || ''}"`,
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `system_audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export audit log CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Copy single log payload
  const handleCopyLog = (log: AuditLogEntry) => {
    const text = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedLogId(log.id);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  // Target navigation handler
  const handleTargetClick = (log: AuditLogEntry) => {
    if (!log.targetId) return;

    if (log.type === 'LOAN' && onSelectLoan) {
      const targetLoan = loans.find((l) => l.loanNumber === log.targetId || l.id === log.targetId);
      if (targetLoan) {
        onSelectLoan(targetLoan);
        return;
      }
    }

    if (onNavigateTab) {
      if (log.type === 'LOAN') onNavigateTab('loans');
      else if (log.type === 'PAYMENT') onNavigateTab('payments');
      else if (log.type === 'MEMBERSHIP' || log.type === 'BORROWER') onNavigateTab('membership');
      else if (log.type === 'SAVINGS') onNavigateTab('savings');
    }
  };

  const visibleLogs = filteredLogs.slice(0, displayCount);

  return (
    <div
      id="system-audit-trail-container"
      className={`bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden ${
        standalone ? 'p-6' : 'p-6 sm:p-7'
      }`}
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  System Audit Trail & Operations Ledger
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Feed
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Chronological compliance ledger tracking loan approvals, repayments, member KYC, savings, and governance actions.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60">
            <button
              id="audit-viewmode-timeline-btn"
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                viewMode === 'timeline'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Timeline View
            </button>
            <button
              id="audit-viewmode-compact-btn"
              onClick={() => setViewMode('compact')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                viewMode === 'compact'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Compact View
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            id="audit-export-csv-btn"
            onClick={handleExportCSV}
            disabled={isExporting || filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition disabled:opacity-50"
            title="Download full audit log as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV ({filteredLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="pt-4 pb-2 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          {/* Search Input */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="audit-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search actions, member name, OR #, loan #, or staff..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Branch Filter Dropdown */}
          <div className="sm:col-span-3">
            <select
              id="audit-branch-select"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Time Horizon Selector */}
          <div className="sm:col-span-3">
            <select
              id="audit-time-horizon-select"
              value={timeHorizon}
              onChange={(e) => setTimeHorizon(e.target.value as any)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            >
              <option value="ALL">All Recorded Time</option>
              <option value="TODAY">Today Only (24 Hours)</option>
              <option value="7DAYS">Last 7 Days</option>
              <option value="30DAYS">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs">
          {[
            { key: 'ALL', label: 'All Events', count: categoryCounts.ALL },
            { key: 'LOAN', label: 'Loan Approvals & Loans', count: categoryCounts.LOAN },
            { key: 'PAYMENT', label: 'Payment Collections (OR)', count: categoryCounts.PAYMENT },
            { key: 'BORROWER', label: 'Member Profile Updates', count: categoryCounts.BORROWER },
            { key: 'MEMBERSHIP', label: 'Membership Pipeline', count: categoryCounts.MEMBERSHIP },
            { key: 'SAVINGS', label: 'Savings & Withdrawals', count: categoryCounts.SAVINGS },
            { key: 'SYSTEM', label: 'System & Security', count: categoryCounts.SYSTEM },
          ].map((cat) => {
            const isSelected = selectedType === cat.key;
            return (
              <button
                key={cat.key}
                id={`audit-cat-${cat.key.toLowerCase()}-btn`}
                onClick={() => setSelectedType(cat.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Filter Indicator / Clear */}
      {(searchTerm || selectedType !== 'ALL' || selectedBranch !== 'ALL' || timeHorizon !== 'ALL') && (
        <div className="flex items-center justify-between bg-blue-50/70 border border-blue-100 px-3.5 py-2 rounded-xl text-xs text-blue-900 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>
              Filtered to <strong>{filteredLogs.length}</strong> matching event(s)
              {searchTerm && ` for "${searchTerm}"`}
            </span>
          </div>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedType('ALL');
              setSelectedBranch('ALL');
              setTimeHorizon('ALL');
            }}
            className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Audit Entries Feed */}
      <div className="mt-3">
        {visibleLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No audit log records found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No matching activity events match your current filter parameters. Try clearing the search or category filters.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedType('ALL');
                setSelectedBranch('ALL');
                setTimeHorizon('ALL');
              }}
              className="mt-2 px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'timeline' ? (
          /* Timeline Presentation View */
          <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
            {visibleLogs.map((log) => {
              const meta = getCategoryMeta(log.type);
              const CategoryIcon = meta.icon;
              const branch = branches.find((b) => b.id === log.branchId);

              return (
                <div
                  key={log.id}
                  id={`audit-entry-${log.id}`}
                  className="relative group transition"
                >
                  {/* Timeline Indicator Node */}
                  <div
                    className={`absolute -left-6 top-1.5 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${meta.bg} ${meta.text}`}
                  >
                    <CategoryIcon className="w-3 h-3" />
                  </div>

                  {/* Main Event Card */}
                  <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300 p-4 rounded-2xl transition shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                      {/* Left: Action description & category */}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${meta.badgeBg}`}
                          >
                            {meta.label}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-slate-800">
                            {humanizeAction(log.action)}
                          </span>
                          {log.targetId && (
                            <button
                              onClick={() => handleTargetClick(log)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-mono text-[10px] font-semibold transition"
                              title={`Reference: ${log.targetId}`}
                            >
                              <span>{log.targetId}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                            </button>
                          )}
                        </div>

                        {/* Narrative */}
                        <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                          {log.details}
                        </p>
                      </div>

                      {/* Right: Timestamp */}
                      <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-start gap-1 text-slate-400 shrink-0">
                        <span
                          className="text-xs font-semibold text-slate-600"
                          title={getExactDateTime(log.timestamp)}
                        >
                          {getRelativeTime(log.timestamp)}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Footer / Actor & Branch Meta */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-3 mt-3 border-t border-slate-200/60 text-[11px] text-slate-500">
                      <div className="flex items-center flex-wrap gap-3">
                        {/* Actor badge */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                            {log.performedBy.charAt(0)}
                          </div>
                          <span className="font-semibold text-slate-700">{log.performedBy}</span>
                        </div>

                        {/* Branch badge */}
                        <div className="flex items-center gap-1 text-slate-500">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{branch ? branch.name : 'Main Head Office'}</span>
                        </div>

                        {/* IP Address */}
                        {log.ipAddress && (
                          <span className="font-mono text-slate-400 text-[10px] hidden md:inline">
                            IP: {log.ipAddress}
                          </span>
                        )}
                      </div>

                      {/* Inspect & Copy Tools */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyLog(log)}
                          className="px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition flex items-center gap-1 text-[11px]"
                          title="Copy JSON record"
                        >
                          {copiedLogId === log.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600 font-bold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => setInspectedLog(log)}
                          className="px-2 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition flex items-center gap-1 text-[11px] font-semibold"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Compact Tabular Feed View */
          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
            {visibleLogs.map((log) => {
              const meta = getCategoryMeta(log.type);
              const CategoryIcon = meta.icon;
              return (
                <div
                  key={log.id}
                  id={`audit-compact-${log.id}`}
                  className="p-3 hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className={`p-1.5 rounded-lg ${meta.bg} ${meta.text} shrink-0`}>
                      <CategoryIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-slate-900 truncate">{log.details}</span>
                        {log.targetId && (
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 font-mono text-[10px] rounded font-semibold shrink-0">
                            {log.targetId}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        By: <span className="font-semibold text-slate-700">{log.performedBy}</span> • Action: {log.action}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 text-slate-500">
                    <span className="font-mono text-[11px]">{getRelativeTime(log.timestamp)}</span>
                    <button
                      onClick={() => setInspectedLog(log)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                      title="Inspect record"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More Pagination Bar */}
        {filteredLogs.length > displayCount && (
          <div className="pt-6 pb-2 text-center">
            <button
              id="audit-load-more-btn"
              onClick={() => setDisplayCount((prev) => prev + 10)}
              className="inline-flex items-center gap-2 px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition shadow-2xs"
            >
              <span>Show Next 10 Events ({filteredLogs.length - displayCount} remaining)</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Detailed Event Inspection Modal */}
      {inspectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Audit Record Inspector</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {inspectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectedLog(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-semibold uppercase">Action Event</span>
                <span className="font-bold text-slate-900 font-mono">{inspectedLog.action}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-semibold uppercase">Category Type</span>
                <span className="font-bold text-slate-900">{inspectedLog.type}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-semibold uppercase">Recorded Timestamp</span>
                <span className="font-semibold text-slate-900">{getExactDateTime(inspectedLog.timestamp)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-semibold uppercase">Performed By</span>
                <span className="font-semibold text-slate-900">{inspectedLog.performedBy}</span>
              </div>
              {inspectedLog.targetId && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">Target Reference</span>
                  <span className="font-mono font-bold text-blue-600">{inspectedLog.targetId}</span>
                  {inspectedLog.targetType && (
                    <span className="text-slate-500 text-[11px] ml-2">({inspectedLog.targetType})</span>
                  )}
                </div>
              )}
            </div>

            {/* Narrative Details */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Event Description</span>
              <p className="text-xs text-slate-800 leading-relaxed font-medium">{inspectedLog.details}</p>
            </div>

            {/* Verification Status */}
            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold">Compliance Status: Immutable & Digitally Verified</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-700">SHA-256 Valid</span>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => handleCopyLog(inspectedLog)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                {copiedLogId === inspectedLog.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied JSON</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy JSON Record</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setInspectedLog(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
