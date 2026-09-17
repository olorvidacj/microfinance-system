import React, { useState } from 'react';
import {
  SlidersHorizontal, Building2, Landmark, UserCog, Bell as BellIcon,
  ShieldCheck, ReceiptText, Coins, Check, ChevronRight, Database, Languages,
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Badge } from '../components/Badge';

type ToggleProps = { checked: boolean; onChange: (v: boolean) => void };
const Toggle: React.FC<ToggleProps> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-200'}`}
  >
    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
  </button>
);

const inputCls = "w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition";
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

const TABS = [
  { id: 'general', label: 'General Settings', icon: SlidersHorizontal },
  { id: 'coop', label: 'Cooperative Info', icon: Building2 },
  { id: 'lending', label: 'Loan & Interest', icon: Landmark },
  { id: 'savings', label: 'Savings & Interest', icon: Coins },
  { id: 'users', label: 'User Access & Roles', icon: UserCog },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
  { id: 'security', label: 'Security & KYC', icon: ShieldCheck },
  { id: 'fees', label: 'Fees & Charges', icon: ReceiptText },
];

export const SystemSettingsPage: React.FC = () => {
  const [tab, setTab] = useState('general');
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState('');

  // Simplified state for demo
  const [fees, setFees] = useState({
    membershipFee: 300,
    loanProcessing: 250,
    savingsWithdrawal: 0,
    latePenalty: 3,
    delinquencyFee: 2,
  });
  const [coopInfo, setCoopInfo] = useState({
    coopName: 'HOSCOMO Multi-Purpose Cooperative',
    acronym: 'HOSCOMO',
    address: 'Magallanes St., Tacloban City, Leyte 6500',
    contact: '+63 (053) 321-8765',
    email: 'info@hoscomo.coop',
    email2: 'credit@hoscomo.coop',
    website: 'www.hoscomo.coop',
    tin: '123-456-789-000',
    ceaLicense: 'CEA-003-TR-2023',
  });
  const [toggles, setToggles] = useState({
    autoKycReminder: true,
    kycSmsAlert: false,
    autoLoanInterest: true,
    allowEarlySettlement: true,
    timeDepositAutoRoll: true,
    savingsSmsAlert: true,
    withdrawalTwoFactor: true,
    requireAdminApproveLarge: true,
    dailyReportEmail: false,
    suspiciousLoginAlert: true,
  });

  const markDirty = () => setDirty(true);

  const save = () => {
    setDirty(false);
    setToast('Settings saved successfully.');
  };

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder?: string, type = 'text') => (
    <div>
      <label className={labelCls}>{label}</label>
      <input type={type} className={inputCls} value={value} placeholder={placeholder} onChange={(e) => { onChange(e.target.value); markDirty(); }} />
    </div>
  );

  const toggleRow = (label: string, description: string, key: keyof typeof toggles) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <Toggle checked={toggles[key]} onChange={(v) => { setToggles((p) => ({ ...p, [key]: v })); setDirty(true); }} />
    </div>
  );

  return (
    <div>
      <Breadcrumbs items={[{ label: 'System Settings' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
          <p className="mt-0.5 text-sm text-slate-500">Configure cooperative policies, lending rules, and system behavior.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={dirty ? 'warning' : 'success'} dot={dirty}>{dirty ? 'Unsaved changes' : 'All changes saved'}</Badge>
          <button onClick={save} disabled={!dirty} className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-white text-sm font-semibold rounded-xl transition shadow-md">
            <Check className="w-4 h-4" /> Save Changes
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left tabs */}
        <div className="lg:w-64 shrink-0">
          <nav className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-2 space-y-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setDirty(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition ${
                  tab === t.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <t.icon className={`w-4 h-4 ${tab === t.id ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="font-medium flex-1 text-left">{t.label}</span>
                <ChevronRight className={`w-4 h-4 ${tab === t.id ? 'text-slate-400' : 'text-slate-200'}`} />
              </button>
            ))}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          {tab === 'general' && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">General Settings</h3>
              <p className="text-sm text-slate-400 mb-5">Base system preferences and defaults.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {field('Cooperative Name', 'HOSCOMO Multi-Purpose Cooperative',() => {})}
                {field('System Language', 'English (default)',() => {})}
                {field('Default Currency', 'PHP — Philippine Peso',() => {})}
                {field('Fiscal Year Start', 'January 2026',() => {})}
              </div>
              <div className="mt-2 space-y-3">
                <h4 className="text-sm font-semibold text-slate-800 pt-3 border-t border-slate-100">Interface</h4>
                {toggleRow('Dark Mode Support', 'Allow admin to switch between light and dark themes.', 'suspiciousLoginAlert')}
                {toggleRow('Reduce Motion', 'Disable animations and transitions in the admin UI.', 'autoKycReminder')}
                {toggleRow('Daily Email Summary', 'Send a daily system summary to the administrator.', 'dailyReportEmail')}
              </div>
            </div>
          )}

          {tab === 'coop' && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Cooperative Information</h3>
              <p className="text-sm text-slate-400 mb-5">Official details shown across receipts and the member portal.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('Cooperative Full Name', coopInfo.coopName, (v) => { setCoopInfo((p) => ({ ...p, coopName: v })); markDirty(); })}
                {field('Acronym', coopInfo.acronym, (v) => { setCoopInfo((p) => ({ ...p, acronym: v })); markDirty(); })}
                <div className="md:col-span-2">{field('Registered Address', coopInfo.address, (v) => { setCoopInfo((p) => ({ ...p, address: v })); markDirty(); })}</div>
                {field('Contact Phone', coopInfo.contact, (v) => { setCoopInfo((p) => ({ ...p, contact: v })); markDirty(); })}
                {field('General Email', coopInfo.email, (v) => { setCoopInfo((p) => ({ ...p, email: v })); markDirty(); })}
                {field('Credit Department Email', coopInfo.email2, (v) => { setCoopInfo((p) => ({ ...p, email2: v })); markDirty(); })}
                {field('Website', coopInfo.website, (v) => { setCoopInfo((p) => ({ ...p, website: v })); markDirty(); })}
                {field('TIN Number', coopInfo.tin, (v) => { setCoopInfo((p) => ({ ...p, tin: v })); markDirty(); })}
                {field('CDA Registration No.', coopInfo.ceaLicense, (v) => { setCoopInfo((p) => ({ ...p, ceaLicense: v })); markDirty(); })}
              </div>
            </div>
          )}

          {tab === 'lending' && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Loan & Interest Configuration</h3>
              <p className="text-sm text-slate-400 mb-5">Policy limits applied to all lending activities.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('Maximum Loan Amount (P)', '100,000',() => {markDirty();})}
                {field('Maximum Loan Term (months)', '24',() => {markDirty();})}
                {field('Minimum Interest Rate (%)', '1.5',() => {markDirty();})}
                {field('Maximum Interest Rate (%)', '2.5',() => {markDirty();})}
                {field('Late Payment Penalty Rate (%)', `${fees.latePenalty}`, (v) => { setFees((p) => ({ ...p, latePenalty: Number(v) })); markDirty(); })}
              </div>
              <div className="mt-5 space-y-3">
                <h4 className="text-sm font-semibold text-slate-800 pt-3 border-t border-slate-100">Lending Rules</h4>
                {toggleRow('Auto-Compute Monthly Interest', 'Interest is computed automatically per amortization schedule.', 'autoLoanInterest')}
                {toggleRow('Allow Early Settlement', 'Clients may fully prepay loans at any time without penalty.', 'allowEarlySettlement')}
                {toggleRow('Grace Period for First Payment', 'First payment is due 30 days after loan disbursement.', 'withdrawalTwoFactor')}
              </div>
            </div>
          )}

          {tab === 'savings' && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Savings & Interest</h3>
              <p className="text-sm text-slate-400 mb-5">Settings for member savings products.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('Regular Savings Rate (% p.a.)', '1.0',() => {markDirty();})}
                {field('Time Deposit Rate (% p.a.)', '3.5',() => {markDirty();})}
                {field('Minimum Balance (P)', '500',() => {markDirty();})}
                {field('Minimum Time Deposit Term (months)', '3',() => {markDirty();})}
              </div>
              <div className="mt-5 space-y-3">
                <h4 className="text-sm font-semibold text-slate-800 pt-3 border-t border-slate-100">Savings Rules</h4>
                {toggleRow('Auto-Roll Time Deposits', 'Matured time deposits automatically renew for the same term.', 'timeDepositAutoRoll')}
                {toggleRow('SMS Alert on Deposits', 'Notify members via SMS for successful deposits.', 'savingsSmsAlert')}
                {toggleRow('Require 2FA for Withdrawals', 'Members must verify identity for any withdrawal.', 'withdrawalTwoFactor')}
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 mb-1">User Access & Roles</h3>
              <p className="text-sm text-slate-400 mb-4">Define role-based permissions across the system.</p>
              {[
                { role: 'Administrator', desc: 'Full access to all modules and system settings.', caps: 9, icon: ShieldCheck, color: 'text-amber-600 bg-amber-50' },
                { role: 'Manager', desc: 'Manage clients, loans, and approve disbursements.', caps: 7, icon: UserCog, color: 'text-blue-600 bg-blue-50' },
                { role: 'Loan Officer', desc: 'Process loan applications and KYC verification.', caps: 5, icon: Landmark, color: 'text-indigo-600 bg-indigo-50' },
                { role: 'Teller', desc: 'Process payments, deposits, and withdrawals.', caps: 4, icon: ReceiptText, color: 'text-emerald-600 bg-emerald-50' },
                { role: 'Auditor', desc: 'Read-only access to all modules and audit logs.', caps: 6, icon: Database, color: 'text-slate-600 bg-slate-100' },
              ].map((r, i) => (
                <div key={r.role} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition">
                  <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${r.color}`}>
                    <r.icon className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{r.role}</p>
                    <p className="text-xs text-slate-400 truncate">{r.desc}</p>
                  </div>
                  <Badge variant="info">{r.caps} of 9 modules</Badge>
                  <button onClick={() => setTab('security')} className="text-sm font-medium text-blue-600 hover:text-blue-700 shrink-0">Configure</button>
                </div>
              ))}
            </div>
          )}

          {tab === 'notifications' && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Notification Preferences</h3>
              <p className="text-sm text-slate-400 mb-5">Choose how and when system alerts are delivered.</p>
              <div className="space-y-3">
                {toggleRow('KYC Pending Reminders', 'Daily reminder for pending KYC verification requests.', 'autoKycReminder')}
                {toggleRow('KYC SMS Alerts', 'Notify clients via SMS when KYC is approved.', 'kycSmsAlert')}
                {toggleRow('Large Transaction Alert', 'Alert admins for transactions above P50,000.', 'requireAdminApproveLarge')}
                {toggleRow('Suspicious Login Alerts', 'Emails admin when unusual login activity is detected.', 'suspiciousLoginAlert')}
                {toggleRow('Daily System Report', 'Send a daily summary email at 6:00 AM.', 'dailyReportEmail')}
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Security & KYC Policy</h3>
              <p className="text-sm text-slate-400 mb-5">Password, login, and identity verification rules.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {field('Password Minimum Length', '8',() => {markDirty();})}
                {field('Password Expiry (days)', '90',() => {markDirty();})}
                {field('Max Failed Login Attempts', '5',() => {markDirty();})}
                {field('Session Timeout (minutes)', '15',() => {markDirty();})}
                {field('KYC Document Validity (months)', '12',() => {markDirty();})}
              </div>
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-sm font-semibold text-slate-800">Security Policies</h4>
                {toggleRow('Require Strong Passwords', 'Passwords must include numbers, symbols, and uppercase letters.', 'requireAdminApproveLarge')}
                {toggleRow('Two-Factor Authentication', 'Require 2FA for all administrator accounts.', 'withdrawalTwoFactor')}
                {toggleRow('Auto-Lock Suspicious Accounts', 'Automatically suspend accounts after failed login attempts.', 'suspiciousLoginAlert')}
                {toggleRow('Require KYC for All New Clients', 'Block lending products for unverified members.', 'autoKycReminder')}
              </div>
            </div>
          )}

          {tab === 'fees' && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Fees & Charges</h3>
              <p className="text-sm text-slate-400 mb-5">Service fees applied across cooperative transactions.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('Membership Fee (P)', `${fees.membershipFee}`, (v) => { setFees((p) => ({ ...p, membershipFee: Number(v) })); markDirty(); })}
                {field('Loan Processing Fee (P)', `${fees.loanProcessing}`, (v) => { setFees((p) => ({ ...p, loanProcessing: Number(v) })); markDirty(); })}
                {field('Savings Withdrawal Fee (P)', `${fees.savingsWithdrawal}`, (v) => { setFees((p) => ({ ...p, savingsWithdrawal: Number(v) })); markDirty(); })}
                {field('Late Payment Penalty (%)', `${fees.latePenalty}`, (v) => { setFees((p) => ({ ...p, latePenalty: Number(v) })); markDirty(); })}
                {field('Delinquency Fee (%)', `${fees.delinquencyFee}`, (v) => { setFees((p) => ({ ...p, delinquencyFee: Number(v) })); markDirty(); })}
              </div>
              <p className="text-xs text-slate-400 mt-4">All fees are denominated in Philippine Pesos unless otherwise stated.</p>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex justify-end mt-6 pt-5 border-t border-slate-100">
            <button onClick={() => { setDirty(false); setToast('Changes discarded.'); }} disabled={!dirty} className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-40 disabled:pointer-events-none mr-3 rounded-xl hover:bg-slate-50 transition">
              Discard
            </button>
            <button onClick={save} disabled={!dirty} className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-white text-sm font-semibold rounded-xl transition shadow-md">
              <Check className="w-4 h-4" /> Save Changes
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl animate-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
};