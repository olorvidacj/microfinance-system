import React, { useState } from 'react';
import {
  SlidersHorizontal, Building2, Landmark, UserCog, Bell as BellIcon,
  ShieldCheck, ReceiptText, Coins, Check, ChevronRight, Database, Languages, Lock, Shield,
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Badge } from '../components/Badge';

type ToggleProps = { checked: boolean; onChange: (v: boolean) => void };
const Toggle: React.FC<ToggleProps> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-10 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${
      checked ? 'bg-[#091527] border border-amber-400/50' : 'bg-slate-200'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full transition ${
        checked ? 'translate-x-5 bg-amber-400' : 'translate-x-0.5 bg-white shadow-xs'
      }`}
    />
  </button>
);

const inputCls = "w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition text-slate-800";
const labelCls = "block text-xs font-bold text-slate-700 mb-1.5";

const TABS = [
  { id: 'general', label: 'General Parameters', icon: SlidersHorizontal },
  { id: 'coop', label: 'Cooperative Charter', icon: Building2 },
  { id: 'lending', label: 'Credit & Interest Rules', icon: Landmark },
  { id: 'savings', label: 'Savings & CBU Equity', icon: Coins },
  { id: 'users', label: 'RBAC Access Matrix', icon: UserCog },
  { id: 'notifications', label: 'System Alert Dispatches', icon: BellIcon },
  { id: 'security', label: 'Security & KYC Policies', icon: ShieldCheck },
  { id: 'fees', label: 'Coop Tariffs & Fees', icon: ReceiptText },
];

export const SystemSettingsPage: React.FC = () => {
  const [tab, setTab] = useState('general');
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState('');

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
    ceaLicense: 'CDA-003-TR-2023',
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
    setToast('Institutional parameters saved successfully.');
  };

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder?: string, type = 'text') => (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type={type}
        className={inputCls}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); markDirty(); }}
      />
    </div>
  );

  const toggleRow = (label: string, description: string, key: keyof typeof toggles) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div className="pr-4">
        <p className="text-xs font-bold text-slate-800">{label}</p>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <Toggle
        checked={toggles[key]}
        onChange={(v) => { setToggles((p) => ({ ...p, [key]: v })); setDirty(true); }}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Institutional Policies & System Settings' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">System & Policy Settings</h1>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Cooperative Governance
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Configure lending caps, member share capital rules, statutory penalties, and compliance parameters.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge variant={dirty ? 'warning' : 'success'} dot={dirty}>
            {dirty ? 'Unsaved modifications' : 'Synced with core'}
          </Badge>
          <button
            onClick={save}
            disabled={!dirty}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#091527] hover:bg-[#132c52] disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold rounded-xl transition shadow-sm border border-slate-800"
          >
            <Check className="w-3.5 h-3.5 text-amber-400" /> Save Changes
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left Navigation Tabs */}
        <div className="lg:w-64 shrink-0">
          <nav className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-1.5 space-y-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setDirty(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                  tab === t.id
                    ? 'bg-[#091527] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <t.icon className={`w-4 h-4 shrink-0 ${tab === t.id ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="flex-1 text-left truncate">{t.label}</span>
                <ChevronRight className={`w-3.5 h-3.5 ${tab === t.id ? 'text-amber-400' : 'text-slate-300'}`} />
              </button>
            ))}
          </nav>
        </div>

        {/* Right Settings Form Container */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
          {tab === 'general' && (
            <div>
              <div className="mb-5 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">General System Baseline</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Core localization, reporting currency, and administrative defaults.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {field('Registered Cooperative Name', 'HOSCOMO Multi-Purpose Cooperative', () => {})}
                {field('System Administrative Language', 'English (PH Banking Standard)', () => {})}
                {field('Operating Currency Code', 'PHP (Philippine Peso, ₱)', () => {})}
                {field('Fiscal Accounting Cycle Start', 'January 1, 2026', () => {})}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Interface & Audit Preferences</h4>
                {toggleRow('Audit Activity Highlighting', 'Visually flag administrative modifications with amber tags.', 'suspiciousLoginAlert')}
                {toggleRow('Consolidated Daily Executive Digest', 'Forward daily automated portfolio balance report to admin mailbox.', 'dailyReportEmail')}
                {toggleRow('Strict Single Session Per Operator', 'Disallow concurrent admin sign-ins on different workstations.', 'withdrawalTwoFactor')}
              </div>
            </div>
          )}

          {tab === 'coop' && (
            <div>
              <div className="mb-5 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Cooperative Legal Charter</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Statutory accreditation details displayed on official passbooks and receipts.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('Cooperative Full Name', coopInfo.coopName, (v) => { setCoopInfo((p) => ({ ...p, coopName: v })); markDirty(); })}
                {field('Registered Acronym', coopInfo.acronym, (v) => { setCoopInfo((p) => ({ ...p, acronym: v })); markDirty(); })}
                <div className="md:col-span-2">
                  {field('Principal Corporate Address', coopInfo.address, (v) => { setCoopInfo((p) => ({ ...p, address: v })); markDirty(); })}
                </div>
                {field('Official Landline Phone', coopInfo.contact, (v) => { setCoopInfo((p) => ({ ...p, contact: v })); markDirty(); })}
                {field('Public Inquiries Email', coopInfo.email, (v) => { setCoopInfo((p) => ({ ...p, email: v })); markDirty(); })}
                {field('Credit Division Email', coopInfo.email2, (v) => { setCoopInfo((p) => ({ ...p, email2: v })); markDirty(); })}
                {field('Institutional Web Portal', coopInfo.website, (v) => { setCoopInfo((p) => ({ ...p, website: v })); markDirty(); })}
                {field('BIR Tax Identification No. (TIN)', coopInfo.tin, (v) => { setCoopInfo((p) => ({ ...p, tin: v })); markDirty(); })}
                {field('Cooperative Development Authority (CDA) Reg.', coopInfo.ceaLicense, (v) => { setCoopInfo((p) => ({ ...p, ceaLicense: v })); markDirty(); })}
              </div>
            </div>
          )}

          {tab === 'lending' && (
            <div>
              <div className="mb-5 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Credit Underwriting & Amortization Rules</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Statutory credit ceilings, interest guidelines, and default procedures.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('Maximum Standard Micro-Loan Ceiling (PHP)', '100,000', () => { markDirty(); })}
                {field('Maximum Repayment Term (Months)', '24', () => { markDirty(); })}
                {field('Standard Interest Rate Floor (% per month)', '1.5', () => { markDirty(); })}
                {field('Maximum Allowable Interest Cap (% per month)', '2.5', () => { markDirty(); })}
                {field('Delinquent Amortization Penalty Rate (%)', `${fees.latePenalty}`, (v) => { setFees((p) => ({ ...p, latePenalty: Number(v) })); markDirty(); })}
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Automated Underwriting Policies</h4>
                {toggleRow('Automatic Monthly Interest Calculation', 'Diminishing balance interest is automatically scheduled per amortization table.', 'autoLoanInterest')}
                {toggleRow('Unrestricted Early Loan Prepayment', 'Borrowers can prepay balance at zero additional termination penalty.', 'allowEarlySettlement')}
                {toggleRow('Mandatory 30-Day First Payment Grace Period', 'Schedule first installment due 30 days after loan disbursement.', 'withdrawalTwoFactor')}
              </div>
            </div>
          )}

          {tab === 'savings' && (
            <div>
              <div className="mb-5 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Savings Ledger & Member Capital Build-Up</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Interest dividend rates for regular passbook and fixed time deposit products.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('Regular Savings Dividend (% p.a.)', '1.0', () => { markDirty(); })}
                {field('Fixed Time Deposit Yield (% p.a.)', '3.5', () => { markDirty(); })}
                {field('Minimum Maintaining Passbook Balance (PHP)', '500', () => { markDirty(); })}
                {field('Minimum Time Deposit Lock-in Period (Months)', '3', () => { markDirty(); })}
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Savings Execution Safeguards</h4>
                {toggleRow('Automatic Time Deposit Rollover', 'Renew matured time deposits into equal subsequent tenures upon expiration.', 'timeDepositAutoRoll')}
                {toggleRow('Immediate SMS Dispatch on Deposit', 'Dispatch real-time SMS to registered member phone upon teller counter deposit.', 'savingsSmsAlert')}
                {toggleRow('Two-Factor Passcode for Counter Withdrawals', 'Require OTP or biometric confirmation for withdrawals over PHP 10,000.', 'withdrawalTwoFactor')}
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-4">
              <div className="mb-4 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Role-Based Access Control (RBAC)</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Active institutional roles and subsystem module permissions.</p>
              </div>
              {[
                { role: 'System Administrator', desc: 'Full sovereign read/write authority across all modules and audit log purging.', caps: 9, icon: ShieldCheck, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                { role: 'Branch General Manager', desc: 'Supervise territorial loans, approve disbursements up to PHP 500,000.', caps: 7, icon: UserCog, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                { role: 'Credit / Loan Officer', desc: 'Process client origination, loan appraisals, and solidarity cell monitoring.', caps: 5, icon: Landmark, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                { role: 'Cashier / Teller', desc: 'Receive cash/digital amortizations, post savings deposits, and issue receipts.', caps: 4, icon: ReceiptText, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                { role: 'Internal Compliance Auditor', desc: 'Read-only access across all general ledgers, transactions, and audit records.', caps: 6, icon: Database, color: 'text-slate-700 bg-slate-100 border-slate-200' },
              ].map((r) => (
                <div key={r.role} className="flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-200/70 hover:border-amber-400/50 transition">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${r.color}`}>
                    <r.icon className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-xs">{r.role}</p>
                    <p className="text-[11px] text-slate-500 truncate">{r.desc}</p>
                  </div>
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                    {r.caps} of 9 Subsystems
                  </span>
                  <button
                    onClick={() => setTab('security')}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition"
                  >
                    Policies
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'notifications' && (
            <div>
              <div className="mb-5 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">System Alert Dispatches</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Automated push, SMS, and email triggers for critical operational events.</p>
              </div>
              <div className="space-y-1">
                {toggleRow('Daily KYC Queue Reminders', 'Notify compliance officers of unreviewed member dossiers at 8:00 AM.', 'autoKycReminder')}
                {toggleRow('Member SMS Dispatch on KYC Approval', 'Send automated welcome SMS upon verification approval.', 'kycSmsAlert')}
                {toggleRow('High-Exposure Transaction Escalations', 'Immediate dashboard banner for single transactions exceeding PHP 50,000.', 'requireAdminApproveLarge')}
                {toggleRow('Suspicious Network Login Alerts', 'Alert security team upon anomalous IP or off-hours sign-in.', 'suspiciousLoginAlert')}
                {toggleRow('Consolidated Morning Summary Email', 'Dispatch daily operational overview to general manager at 6:00 AM.', 'dailyReportEmail')}
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div>
              <div className="mb-5 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Security & KYC Compliance Policy</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Cryptographic thresholds, session idle timers, and identity verification mandates.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {field('Minimum Password Complexity (Chars)', '8', () => { markDirty(); })}
                {field('Mandatory Password Rotation Cycle (Days)', '90', () => { markDirty(); })}
                {field('Failed Authentication Lockout Limit', '5 Attempts', () => { markDirty(); })}
                {field('Idle Session Inactivity Expiry (Minutes)', '15 Minutes', () => { markDirty(); })}
                {field('KYC Identity Document Validity Period', '12 Months', () => { markDirty(); })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Hardened Security Enforcement</h4>
                {toggleRow('Enforce Enterprise Password Complexity', 'Require mixed case, numbers, and special symbols for all staff accounts.', 'requireAdminApproveLarge')}
                {toggleRow('Mandatory Two-Factor Auth (2FA) for Admins', 'Require authenticator app code on every administrative sign-in.', 'withdrawalTwoFactor')}
                {toggleRow('Automated Lockout on Repeated Failures', 'Temporarily disable operator credentials after 5 consecutive bad passcodes.', 'suspiciousLoginAlert')}
                {toggleRow('Strict Pre-Loan KYC Requirement', 'Prevent credit disbursements until KYC dossier is formally validated.', 'autoKycReminder')}
              </div>
            </div>
          )}

          {tab === 'fees' && (
            <div>
              <div className="mb-5 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Cooperative Tariffs & Service Fees</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Approved fee schedule applied across teller and loan operations.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('Member Onboarding / Membership Fee (PHP)', `${fees.membershipFee}`, (v) => { setFees((p) => ({ ...p, membershipFee: Number(v) })); markDirty(); })}
                {field('Credit Application Processing Fee (PHP)', `${fees.loanProcessing}`, (v) => { setFees((p) => ({ ...p, loanProcessing: Number(v) })); markDirty(); })}
                {field('Over-the-Counter Withdrawal Fee (PHP)', `${fees.savingsWithdrawal}`, (v) => { setFees((p) => ({ ...p, savingsWithdrawal: Number(v) })); markDirty(); })}
                {field('Late Installment Penalty Surcharge (%)', `${fees.latePenalty}`, (v) => { setFees((p) => ({ ...p, latePenalty: Number(v) })); markDirty(); })}
                {field('30+ Days Delinquency Administrative Fee (%)', `${fees.delinquencyFee}`, (v) => { setFees((p) => ({ ...p, delinquencyFee: Number(v) })); markDirty(); })}
              </div>
              <p className="text-[11px] text-slate-400 mt-4 italic">
                * All tariffs are officially enacted under HOSCOMO General Assembly Resolution 2024-B and BSP circular guidelines.
              </p>
            </div>
          )}

          {/* Footer Save / Discard Bar */}
          <div className="flex justify-end gap-2.5 mt-8 pt-4 border-t border-slate-100">
            <button
              onClick={() => { setDirty(false); setToast('Modifications discarded.'); }}
              disabled={!dirty}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none rounded-xl hover:bg-slate-100 transition"
            >
              Discard Changes
            </button>
            <button
              onClick={save}
              disabled={!dirty}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#091527] hover:bg-[#132c52] disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold rounded-xl transition shadow-sm border border-slate-800"
            >
              <Check className="w-3.5 h-3.5 text-amber-400" /> Save Changes
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#091527] border border-amber-500/40 text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {toast}
        </div>
      )}
    </div>
  );
};
