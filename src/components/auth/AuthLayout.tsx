import React from 'react';
import {
  Building2,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerNote?: React.ReactNode;
}

const FEATURES = [
  {
    icon: ShieldCheck,
    color: 'text-emerald-300',
    text: 'Bank-grade encrypted passwords & signed sessions',
  },
  {
    icon: Smartphone,
    color: 'text-slate-300',
    text: 'Members: check balances, pay loans & request withdrawals',
  },
  {
    icon: Sparkles,
    color: 'text-amber-300',
    text: 'Staff: full origination, collections & AI underwriting suite',
  },
];

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  children,
  footerNote,
}) => {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-5xl bg-white rounded-[32px] shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-slate-200">

        {/* Left Branding Panel */}
        <div className="relative bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-8 sm:p-10 text-white hidden lg:flex lg:col-span-5 flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gold-400 text-navy-950 flex items-center justify-center shadow-lg shadow-gold-500/20">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-xl tracking-tight">HOSCOMO</span>
                <p className="text-[11px] text-gold-300 uppercase tracking-widest font-semibold">Microfinance Cooperative</p>
              </div>
            </div>

            <h1 className="mt-12 text-2xl sm:text-3xl font-extrabold leading-snug">{title}</h1>
            <p className="mt-3 text-xs sm:text-sm text-slate-200/90 leading-relaxed">{subtitle}</p>

            <div className="mt-8 space-y-3 text-xs">
              {FEATURES.map(({ icon: Icon, color, text }) => (
                <div key={text} className="flex items-center gap-3 bg-white/10 rounded-xl px-3.5 py-2.5 border border-white/15">
                  <Icon className={`w-4 h-4 ${color} shrink-0`} />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400/70">
            <span>© 2026 HOSCOMO Cooperative</span>
            <span>Tacloban, Leyte</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="p-6 sm:p-10 lg:col-span-7 flex flex-col justify-center max-h-[90vh] overflow-y-auto">
          {children}
        </div>
      </div>

      {footerNote}
    </div>
  );
};
