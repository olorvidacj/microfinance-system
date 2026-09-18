import React from 'react';
import { Outlet } from 'react-router-dom';
import { Building2, HandCoins, PiggyBank, ShieldCheck } from 'lucide-react';

export const PublicPortalLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="grid min-h-screen bg-slate-50 font-sans text-slate-800 antialiased lg:grid-cols-2">
    {/* Left brand panel */}
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-gold-400/10 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400 text-navy-950 shadow-lg shadow-gold-500/20">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <span className="block text-xl font-bold leading-none text-white">HOSCOMO</span>
          <span className="text-[11px] uppercase tracking-widest text-gold-300">Microfinance Cooperative</span>
        </div>
      </div>

      <div className="relative">
        <h1 className="max-w-md text-4xl font-bold leading-tight text-white">
          Your cooperative, <span className="text-gold-300">in your pocket.</span>
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-200/90">
          Apply for loans, track repayments, build your savings, and reach your goals — all from the HOSCOMO Client Portal.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: HandCoins, label: 'Micro-loans', desc: 'Fast, fair financing' },
            { icon: PiggyBank, label: 'Savings', desc: 'Grow your emergency fund' },
            { icon: ShieldCheck, label: 'Secure', desc: 'Protected & confidential' },
          ].map((f) => (
            <div key={f.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <f.icon className="h-6 w-6 text-gold-300" />
              <div className="mt-2 text-sm font-semibold text-white">{f.label}</div>
              <div className="text-xs text-slate-300/70">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="relative text-xs text-slate-400/60">© {new Date().getFullYear()} HOSCOMO Microfinance Cooperative. All rights reserved.</p>
    </div>

    {/* Right content panel */}
    <div className="flex items-center justify-center px-4 py-10 sm:px-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-gold-500 to-gold-400 text-navy-950 shadow-md">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-lg font-bold leading-none text-slate-900">HOSCOMO</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Client Portal</span>
          </div>
        </div>

        {children || <Outlet />}
      </div>
    </div>
  </div>
);