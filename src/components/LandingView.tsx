import React from 'react';
import {
  Building2,
  ArrowRight,
  Wallet,
  HandCoins,
  Users,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Landmark,
  BadgePercent,
  Clock,
  CheckCircle2,
  Star,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';

interface LandingViewProps {
  onSignIn: () => void;
}

const NAV_LINKS = [
  { label: 'Products', href: '#products' },
  { label: 'Savings', href: '#savings' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Why HOSCOMO', href: '#why-us' },
];

const PRODUCTS = [
  {
    icon: HandCoins,
    title: 'Personal Loans',
    desc: 'Quick salary and multi-purpose loans with flexible terms from 3 to 36 months and same-week release.',
    tag: 'From 1.25% / mo',
  },
  {
    icon: TrendingUp,
    title: 'Business Capital',
    desc: 'Grow your sari-sari store, market stall, or enterprise with working capital tailored to your cash flow.',
    tag: 'Up to ₱500,000',
  },
  {
    icon: Users,
    title: 'Solidarity Group Lending',
    desc: 'No collateral needed — borrow together with your community through trusted group circles.',
    tag: 'Zero collateral',
  },
];

const SAVINGS_FEATURES = [
  {
    icon: Wallet,
    title: 'Passbook & Time Deposits',
    desc: 'Earn competitive dividends on regular savings and locked-in time deposit accounts.',
  },
  {
    icon: Smartphone,
    title: 'Mobile Self-Service',
    desc: 'Check balances, track loan amortization, and request withdrawals from the client portal.',
  },
  {
    icon: ShieldCheck,
    title: 'Insured & Regulated',
    desc: 'Deposits protected under cooperative standards with full audit trails and transparent reporting.',
  },
];

const WHY_US = [
  {
    icon: BadgePercent,
    title: 'Fair, Transparent Rates',
    desc: 'Reducing-balance interest with zero hidden charges. See your exact installment before you sign.',
  },
  {
    icon: Clock,
    title: 'Fast Approvals',
    desc: 'AI-assisted underwriting reviews your application in minutes, not weeks.',
  },
  {
    icon: ShieldCheck,
    title: 'Bank-Grade Security',
    desc: 'Encrypted passwords, signed sessions, and a complete audit trail on every transaction.',
  },
  {
    icon: Landmark,
    title: 'Community Owned',
    desc: 'Members share in the cooperative’s success through annual patronage refunds.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Become a Member',
    desc: 'Register online or visit any branch with a valid ID. Existing members are auto-linked by member number.',
  },
  {
    step: '02',
    title: 'Apply for a Loan',
    desc: 'Choose a product, compute your installment instantly, and submit your application digitally.',
  },
  {
    step: '03',
    title: 'Grow & Repay',
    desc: 'Receive funds fast, repay at your pace, and build a stronger credit standing with every cycle.',
  },
];

const STATS = [
  { value: '12,400+', label: 'Active Members' },
  { value: '₱380M', label: 'Loans Released' },
  { value: '8', label: 'Branches in Leyte' },
  { value: '97%', label: 'Repayment Rate' },
];

export const LandingView: React.FC<LandingViewProps> = ({ onSignIn }) => {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <span className="font-bold text-slate-900 tracking-tight">HOSCOMO</span>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Microfinance Cooperative</p>
            </div>
          </a>
          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-500 hover:text-blue-700 transition"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={onSignIn}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700 text-sm font-semibold transition"
            >
              Sign In
            </button>
            <button
              onClick={onSignIn}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 transition"
            >
              Join Now
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 text-white">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-blue-100 mb-6">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              SEC-registered cooperative • Serving Leyte since 2009
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
              Financial growth,{' '}
              <span className="bg-gradient-to-r from-sky-300 to-emerald-300 bg-clip-text text-transparent">
                built together.
              </span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-blue-100/90 leading-relaxed max-w-xl">
              HOSCOMO gives families and small entrepreneurs access to fair loans,
              secure savings, and a community that invests in your success.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={onSignIn}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-blue-700 font-semibold text-sm shadow-lg hover:bg-blue-50 transition"
              >
                Open Member Portal
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#products"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/25 text-white font-semibold text-sm backdrop-blur-sm transition"
              >
                Explore Loan Products
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-blue-200">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> No hidden fees
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> Same-week loan release
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> Free financial counseling
              </span>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative border-t border-white/15 bg-white/5 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 grid grid-cols-2 lg:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.label} className="text-center lg:text-left">
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">{s.value}</div>
                <div className="text-[11px] uppercase tracking-widest text-blue-200 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="py-20 lg:py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Loan Products</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              The right loan for every goal
            </h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Transparent reducing-balance rates, flexible repayment schedules, and terms matched to how you earn.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRODUCTS.map((p) => (
              <div
                key={p.title}
                className="group relative bg-white rounded-3xl border border-slate-200 p-7 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-600/5 transition"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-600 transition">
                  <p.icon className="w-6 h-6 text-blue-600 group-hover:text-white transition" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{p.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{p.desc}</p>
                <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700">
                  <BadgePercent className="w-3.5 h-3.5" />
                  {p.tag}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Savings */}
      <section id="savings" className="py-20 lg:py-24 bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Savings & Services</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Your money, safe and working for you
            </h2>
            <p className="mt-4 text-sm text-slate-500 leading-relaxed max-w-lg">
              Every deposit strengthens the cooperative — and earns you dividends. Manage it all
              from the self-service portal, wherever you are.
            </p>
            <button
              onClick={onSignIn}
              className="mt-7 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 transition"
            >
              Access Your Account
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            {SAVINGS_FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-blue-200 transition"
              >
                <div className="shrink-0 w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                  <f.icon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 lg:py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">How It Works</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Three steps to your first loan
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.step} className="relative bg-white rounded-3xl border border-slate-200 p-7">
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                    {s.step}
                  </span>
                  {i < STEPS.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-slate-300 hidden md:block" />
                  )}
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Us + Testimonial */}
      <section id="why-us" className="py-20 lg:py-24 bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-14">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Why HOSCOMO</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              A cooperative you can trust
            </h2>
            <div className="mt-8 space-y-6">
              {WHY_US.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <f.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{f.title}</h3>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-md">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-center gap-6">
            <figure className="relative bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 text-white rounded-3xl p-8 overflow-hidden">
              <Star className="absolute -top-4 -right-4 w-28 h-28 text-white/10 rotate-12" />
              <div className="flex gap-1 text-amber-300">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-5 text-lg font-medium leading-relaxed">
                “HOSCOMO believed in my small eatery when banks wouldn’t. Three loan cycles later,
                I employ six people from my barangay.”
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-white text-blue-700 flex items-center justify-center text-xs font-bold border-2 border-white/30 shrink-0">
                  MS
                </div>
                <div>
                  <div className="text-sm font-bold">Maria Santos</div>
                  <div className="text-xs text-blue-200">Member since 2018 • Carigara Branch</div>
                </div>
              </figcaption>
            </figure>
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex items-start gap-4">
              <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Visit us at our main office in Tacloban City or any of our 8 branches across Leyte.
                Member service desks are open Monday–Saturday, 8:00 AM – 5:00 PM.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-blue-700 to-indigo-600 px-8 py-12 sm:px-14 text-center text-white shadow-xl shadow-blue-600/20">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Ready to start your journey?
              </h2>
              <p className="mt-3 text-sm text-blue-100 max-w-xl mx-auto leading-relaxed">
                Sign in to the portal or create your client account today — membership takes less than 10 minutes.
              </p>
              <button
                onClick={onSignIn}
                className="mt-7 inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-white text-blue-700 font-semibold text-sm shadow-lg hover:bg-blue-50 transition"
              >
                Get Started Now
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <span className="font-bold text-white tracking-tight">HOSCOMO</span>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Microfinance Cooperative</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed max-w-sm">
              A member-owned cooperative providing fair loans, secure savings, and financial
              education to communities across Leyte since 2009.
            </p>
            <div className="mt-5 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-blue-400" /> Real St., Tacloban City, Leyte
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-blue-400" /> (053) 555-0134
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-blue-400" /> hello@hoscomo.coop
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white mb-4">Services</h4>
            <ul className="space-y-2.5 text-xs">
              {['Personal Loans', 'Business Capital', 'Group Lending', 'Savings Accounts', 'Time Deposits'].map((item) => (
                <li key={item}>
                  <a href="#products" className="hover:text-blue-400 transition">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white mb-4">Portal</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={onSignIn} className="hover:text-blue-400 transition">
                  Member Sign In
                </button>
              </li>
              <li>
                <button onClick={onSignIn} className="hover:text-blue-400 transition">
                  Staff Console
                </button>
              </li>
              <li>
                <button onClick={onSignIn} className="hover:text-blue-400 transition">
                  Create Account
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
            <span>© 2026 HOSCOMO Microfinance Cooperative • Tacloban, Leyte</span>
            <span>All deposits are member share-backed and audited annually.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
