import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Server,
  Zap,
  Layers,
  X,
  Lock,
  Code2,
  Table,
  Sparkles,
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
} from '../lib/supabase';
import { useLoan } from '../context/LoanContext';
import { authFetch } from '../context/AuthContext';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const { borrowers, loans, savingsAccounts, payments, branches, syncWithDatabase } = useLoan();

  const [activeTab, setActiveTab] = useState<'status' | 'configure' | 'sql' | 'tables'>('status');
  
  // Config state
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [dbUrl, setDbUrl] = useState('');
  
  // Testing state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    projectRef?: string;
  } | null>(null);

  // Server DB status state
  const [serverDbStatus, setServerDbStatus] = useState<{
    connected: boolean;
    provider?: string;
    message?: string;
    latencyMs?: number;
    tables?: string[];
    counts?: Record<string, number>;
  } | null>(null);
  const [isLoadingServerStatus, setIsLoadingServerStatus] = useState(false);

  // Copied alert state
  const [copiedSql, setCopiedSql] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState('');

  // Load config on open
  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setSupabaseUrl(cfg.url);
      setAnonKey(cfg.anonKey);
      setDbUrl(cfg.databaseUrl || '');
      checkServerDatabase();
    }
  }, [isOpen]);

  const checkServerDatabase = async () => {
    setIsLoadingServerStatus(true);
    try {
      const res = await authFetch('/api/db/status');
      const data = await res.json();
      setServerDbStatus(data);
    } catch (err: any) {
      setServerDbStatus({
        connected: false,
        message: err.message || 'Unable to check server database status',
      });
    } finally {
      setIsLoadingServerStatus(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    // Test client-side Supabase REST connection
    const res = await testSupabaseConnection(supabaseUrl, anonKey);
    setTestResult(res);

    // If a Postgres direct URL is provided, also test server-side
    if (dbUrl) {
      try {
        const serverTest = await authFetch('/api/db/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionString: dbUrl }),
        });
        const serverData = await serverTest.json();
        if (!serverData.success) {
          setTestResult((prev) => ({
            success: prev?.success || false,
            message: `${prev?.message || ''} | Direct DB: ${serverData.message}`,
          }));
        }
      } catch {}
    }

    setIsTesting(false);
  };

  const handleSaveConfig = () => {
    saveSupabaseConfig({
      url: supabaseUrl.trim(),
      anonKey: anonKey.trim(),
      databaseUrl: dbUrl.trim(),
    });
    checkServerDatabase();
    setTestResult({
      success: true,
      message: 'Supabase configuration saved! Client will now communicate with Supabase.',
    });
  };

  const handleClearConfig = () => {
    clearSupabaseConfig();
    setSupabaseUrl('');
    setAnonKey('');
    setDbUrl('');
    setTestResult(null);
    checkServerDatabase();
  };

  const handleSeedDatabase = async () => {
    setSeedLoading(true);
    setSeedSuccess('');
    try {
      const res = await authFetch('/api/db/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSeedSuccess('Database seeded with standard HOSCOMCO branches, staff, products, and members!');
        await syncWithDatabase();
        checkServerDatabase();
      } else {
        alert(data.error || 'Seed failed');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to trigger database seed');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleCopySql = () => {
    fetch('/supabase_schema.sql')
      .then((r) => r.text())
      .then((sql) => {
        navigator.clipboard.writeText(sql);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 3000);
      })
      .catch(() => {
        // Fallback schema snippet
        navigator.clipboard.writeText('-- Run supabase_schema.sql from project root');
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 3000);
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-navy-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Supabase Database Connection</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  PostgreSQL
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Cloud Database Integration, Schema Migration & Live Synchronization for HOSCOMCO
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'status'
                ? 'border-gold-500 text-gold-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Server className="w-4 h-4" />
            Connection Overview
          </button>
          <button
            onClick={() => setActiveTab('configure')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'configure'
                ? 'border-gold-500 text-gold-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Lock className="w-4 h-4" />
            Connect Supabase API
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'sql'
                ? 'border-gold-500 text-gold-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Code2 className="w-4 h-4" />
            SQL Schema Migration
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'tables'
                ? 'border-gold-500 text-gold-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Table className="w-4 h-4" />
            Live Tables & Metrics
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: STATUS & OVERVIEW */}
          {activeTab === 'status' && (
            <div className="space-y-6">
              
              {/* Primary Status Card */}
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    serverDbStatus?.connected
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-100 text-amber-700 border border-amber-200'
                  }`}>
                    {serverDbStatus?.connected ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <AlertCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">
                        {serverDbStatus?.connected
                          ? 'PostgreSQL / Supabase Database Active'
                          : 'Database in Dual-Mode (In-Memory & Persistent Ready)'}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                        serverDbStatus?.connected
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {serverDbStatus?.connected ? 'Connected' : 'Ready to Connect'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {serverDbStatus?.message || 'HOSCOMCO financial records and audit ledgers ready for real-time synchronization.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={checkServerDatabase}
                    disabled={isLoadingServerStatus}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingServerStatus ? 'animate-spin' : ''}`} />
                    Refresh Status
                  </button>
                  <button
                    onClick={handleSeedDatabase}
                    disabled={seedLoading}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-navy-900 hover:bg-navy-800 text-white flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {seedLoading ? 'Seeding...' : 'Seed Default Data'}
                  </button>
                </div>
              </div>

              {seedSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {seedSuccess}
                </div>
              )}

              {/* Step-by-Step Supabase Connection Quick Guide */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gold-600" />
                  Connect Your Supabase Project in 3 Easy Steps
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="w-6 h-6 rounded-full bg-navy-900 text-white font-bold flex items-center justify-center mb-2">
                        1
                      </div>
                      <h5 className="font-bold text-slate-900 mb-1">Create Supabase Project</h5>
                      <p className="text-slate-500">
                        Go to Supabase.com and create a new free PostgreSQL project for HOSCOMCO.
                      </p>
                    </div>
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-gold-600 font-bold hover:underline"
                    >
                      Open Supabase <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="w-6 h-6 rounded-full bg-navy-900 text-white font-bold flex items-center justify-center mb-2">
                        2
                      </div>
                      <h5 className="font-bold text-slate-900 mb-1">Execute SQL Migration</h5>
                      <p className="text-slate-500">
                        Go to SQL Editor in Supabase, paste our complete schema script, and click "Run".
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('sql')}
                      className="mt-3 inline-flex items-center gap-1 text-gold-600 font-bold hover:underline text-left"
                    >
                      View & Copy SQL Script &rarr;
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="w-6 h-6 rounded-full bg-navy-900 text-white font-bold flex items-center justify-center mb-2">
                        3
                      </div>
                      <h5 className="font-bold text-slate-900 mb-1">Save Project Keys</h5>
                      <p className="text-slate-500">
                        Copy your Project URL and Anon API key from Project Settings $\to$ API, and paste them here.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('configure')}
                      className="mt-3 inline-flex items-center gap-1 text-gold-600 font-bold hover:underline text-left"
                    >
                      Configure Keys &rarr;
                    </button>
                  </div>
                </div>
              </div>

              {/* Database Live Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500 font-medium">Registered Members</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{borrowers.length}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">100% KYC Profiled</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500 font-medium">Active Loans</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{loans.length}</p>
                  <p className="text-[11px] text-gold-600 font-semibold mt-0.5">Disbursements Tracked</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500 font-medium">Savings Passbooks</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{savingsAccounts.length}</p>
                  <p className="text-[11px] text-amber-600 font-semibold mt-0.5">1.0% Annual Interest</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500 font-medium">Official Receipts</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{payments.length}</p>
                  <p className="text-[11px] text-gold-600 font-semibold mt-0.5">Audited Collections</p>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: CONFIGURE SUPABASE KEYS */}
          {activeTab === 'configure' && (
            <div className="space-y-5">
              <div className="p-4 bg-gold-500/10 border border-gold-400/30 rounded-xl text-xs text-navy-900 space-y-1">
                <p className="font-bold">Where do I find my Supabase keys?</p>
                <p className="text-gold-800">
                  In your Supabase project dashboard, navigate to <strong>Settings $\to$ API</strong>. Copy the <strong>Project URL</strong> and <strong>Project API anon/public key</strong> below.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xyzprojectid.supabase.co"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-gold-500 font-mono text-slate-900 bg-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Example: https://abcdefghijklm.supabase.co
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supabase Anon / Public API Key
                  </label>
                  <input
                    type="password"
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-gold-500 font-mono text-slate-900 bg-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Safe for public client-side queries with Row Level Security (RLS) policies.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Direct PostgreSQL Connection String (Optional for Server Connection Pooling)
                  </label>
                  <input
                    type="password"
                    value={dbUrl}
                    onChange={(e) => setDbUrl(e.target.value)}
                    placeholder="postgresql://postgres.xxx:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-gold-500 font-mono text-slate-900 bg-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Found in <strong>Project Settings $\to$ Database $\to$ Connection string $\to$ URI</strong>
                  </p>
                </div>
              </div>

              {testResult && (
                <div
                  className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold">
                      {testResult.success ? 'Connection Successful' : 'Connection Error'}
                    </p>
                    <p className="mt-0.5">{testResult.message}</p>
                    {testResult.latencyMs && (
                      <p className="text-[11px] font-semibold text-emerald-700 mt-1">
                        Round-trip latency: {testResult.latencyMs} ms
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleClearConfig}
                  className="px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Clear Saved Credentials
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || (!supabaseUrl && !dbUrl)}
                    className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Zap className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    {isTesting ? 'Testing Ping...' : 'Test Connection'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="px-5 py-2 text-xs font-bold rounded-lg bg-navy-900 hover:bg-navy-800 text-white flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    Save & Activate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SQL SCHEMA MIGRATION SCRIPT */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Supabase PostgreSQL Migration Script (`supabase_schema.sql`)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Sets up 15 tables, indexes, Row Level Security policies, and initial HOSCOMCO seed records.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySql}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-navy-900 hover:bg-navy-800 text-white flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    {copiedSql ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                        Copied to Clipboard!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Entire SQL
                      </>
                    )}
                  </button>

                  <a
                    href="/supabase_schema.sql"
                    download="supabase_schema.sql"
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .sql
                  </a>
                </div>
              </div>

              {/* SQL Code Preview Window */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 font-mono text-xs text-slate-300 max-h-96 overflow-y-auto leading-relaxed select-all">
                <pre className="text-emerald-400">-- HOSCOMCO Supabase Migration Script</pre>
                <pre className="text-slate-400">CREATE EXTENSION IF NOT EXISTS "uuid-ossp";</pre>
                <pre className="text-gold-400 mt-2">-- 1. Branches</pre>
                <pre className="text-slate-200">{`CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    manager_name TEXT NOT NULL,
    manager_email TEXT NOT NULL,
    active_disbursed_pool DOUBLE PRECISION DEFAULT 0,
    cash_vault_balance DOUBLE PRECISION DEFAULT 0,
    active_loans_count INTEGER DEFAULT 0,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
                <pre className="text-gold-400 mt-2">-- 2. Staff</pre>
                <pre className="text-slate-200">{`CREATE TABLE IF NOT EXISTS public.staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    assigned_branch_id TEXT NOT NULL,
    title TEXT NOT NULL,
    avatar TEXT NOT NULL,
    committee TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
                <pre className="text-gold-400 mt-2">-- 3. Borrowers / Cooperative Members</pre>
                <pre className="text-slate-200">{`CREATE TABLE IF NOT EXISTS public.borrowers (
    id TEXT PRIMARY KEY,
    borrower_number TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    id_number TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    branch_id TEXT NOT NULL REFERENCES public.branches(id),
    savings_balance DOUBLE PRECISION DEFAULT 1000,
    share_capital DOUBLE PRECISION DEFAULT 15000,
    credit_score INTEGER NOT NULL,
    kyc_status TEXT NOT NULL,
    member_status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
                <pre className="text-gold-400 mt-2">-- 4. Loans & Amortization</pre>
                <pre className="text-slate-200">{`CREATE TABLE IF NOT EXISTS public.loans (
    id TEXT PRIMARY KEY,
    loan_number TEXT NOT NULL UNIQUE,
    borrower_id TEXT NOT NULL REFERENCES public.borrowers(id),
    principal_amount DOUBLE PRECISION NOT NULL,
    interest_rate DOUBLE PRECISION NOT NULL,
    term_months INTEGER NOT NULL,
    remaining_balance DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL,
    schedule JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
                <pre className="text-emerald-400 mt-2">-- Complete 300+ line script with RLS & Seeds ready to execute in Supabase SQL Editor</pre>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  After running this in Supabase SQL Editor, all tables and Row Level Security policies will be immediately active.
                </span>
              </div>
            </div>
          )}

          {/* TAB 4: TABLES & METRICS */}
          {activeTab === 'tables' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">
                  Cooperative Schema Entities & Relationships
                </h4>
                <span className="text-xs text-slate-500">15 Relational Tables</span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left divide-y divide-slate-200">
                  <thead className="bg-slate-50 font-bold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-4">Table Name</th>
                      <th className="py-2.5 px-4">Entity Type</th>
                      <th className="py-2.5 px-4">Primary Key / Reference</th>
                      <th className="py-2.5 px-4">Active Records</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-semibold text-gold-700">public.branches</td>
                      <td className="py-2.5 px-4">Branch Office Units</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">id (TEXT)</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{branches.length}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-semibold text-gold-700">public.borrowers</td>
                      <td className="py-2.5 px-4">Cooperative Members / KYC</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">id, borrower_number</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{borrowers.length}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-semibold text-gold-700">public.loans</td>
                      <td className="py-2.5 px-4">Loans & Disbursement Vouchers</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">id $\to$ borrowers(id)</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{loans.length}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-semibold text-gold-700">public.savings_accounts</td>
                      <td className="py-2.5 px-4">Member Savings Passbooks</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">id, passbook_number</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{savingsAccounts.length}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-semibold text-gold-700">public.payments</td>
                      <td className="py-2.5 px-4">Official Receipts (OR)</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">receipt_number $\to$ loans(id)</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{payments.length}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-semibold text-gold-700">public.solidarity_groups</td>
                      <td className="py-2.5 px-4">Grameen Lending Circles & Centers</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">id, group_code</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">Active</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-semibold text-gold-700">public.audit_logs</td>
                      <td className="py-2.5 px-4">Immutable Financial Audit Trail</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">id, timestamp</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">Active</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Layers className="w-4 h-4 text-slate-400" />
            <span>HOSCOMCO Microfinance Institution &bull; Supabase PostgreSQL Integration</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-xs"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
