import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FileText, PiggyBank, ShieldCheck, Users } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { adminApi } from '../services/adminApi';

/**
 * Where the cooperative's configuration actually lives. Every rule the system
 * applies is stored with the thing it governs (loan products carry rates, fees
 * and penalties; savings products carry interest and limits; and so on), so
 * this page points to those screens instead of keeping a second, unused copy.
 */
const PLACES = [
  { to: '/admin/loan-products', icon: FileText, title: 'Loan products', body: 'Interest method and rate, amount and term limits, fees, late penalty, and group or individual lending.' },
  { to: '/admin/savings', icon: PiggyBank, title: 'Savings products', body: 'Interest rate and method, minimum and opening balances, withdrawal limits and terms.' },
  { to: '/admin/branches', icon: Building2, title: 'Branches', body: 'Branch names, addresses and phone numbers members see on receipts and in the portal.' },
  { to: '/admin/users', icon: Users, title: 'Users and roles', body: 'Staff accounts, their roles and branches. Roles decide what each person can do.' },
];

interface RequiredDocument {
  id: string;
  documentType: string;
  documentName: string;
  description: string | null;
  isActive: boolean;
}

export const SystemSettingsPage: React.FC = () => {
  const [docs, setDocs] = useState<RequiredDocument[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setDocs(await adminApi.kycRequiredDocuments());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The KYC requirements could not be loaded.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Settings' }]} />
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Settings</h1>
        <p className="text-xs sm:text-sm text-slate-500">Each rule is kept with what it governs. Change it there and it applies everywhere at once.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PLACES.map((p) => (
          <Link key={p.to} to={p.to} className="flex gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#091527]">
              <p.icon className="h-5 w-5 text-amber-400" />
            </span>
            <span>
              <span className="block text-sm font-bold text-slate-900">{p.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{p.body}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-bold text-slate-900">KYC documents members must provide</h2>
        </div>
        {error ? (
          <p className="text-sm text-rose-700">
            {error} <button onClick={load} className="font-bold underline">Try again</button>
          </p>
        ) : docs === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-slate-500">No documents are configured. The ID (front) and a selfie are always required.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {docs.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-3 py-2">
                <span>
                  <span className="font-medium text-slate-800">{d.documentName}</span>
                  {d.description && <span className="block text-xs text-slate-500">{d.description}</span>}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${d.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{d.isActive ? 'Required' : 'Not required'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SystemSettingsPage;
