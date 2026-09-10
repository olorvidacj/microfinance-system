import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, Info, PackageCheck, ShieldCheck } from 'lucide-react';
import { loanService } from '../services/loans';
import { LoanCalculation, LoanProduct } from '../types';
import { formatCurrency } from '../../utils/loanMath';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Select,
  Textarea,
} from '../components/ui';
import { InfoRow } from '../components/common';
import { useToast } from '../components/ui/Toast';

const STEPS = ['Choose product', 'Loan setup', 'Review & submit'];

const ApplyLoanPage: React.FC = () => {
  const toast = useToast();
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [step, setStep] = useState(0);
  const [productId, setProductId] = useState('');
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('');
  const [frequency, setFrequency] = useState('Monthly');
  const [purpose, setPurpose] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [collateral, setCollateral] = useState('');
  const [calc, setCalc] = useState<LoanCalculation | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const prods = await loanService.products();
        setProducts(prods);
        if (prods.length > 0) setProductId(prods[0].id);
      } catch (err: any) {
        setError(err.message || 'Unable to load loan products.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const product = useMemo(() => products.find((p) => p.id === productId) || products[0], [products, productId]);

  const amountNum = Number(amount) || 0;
  const termNum = Number(term) || 0;

  const refreshCalc = async (amt: number, t: number) => {
    if (!product || amt <= 0 || t <= 0) return;
    setCalculating(true);
    try {
      const c = await loanService.calculate({
        amount: amt,
        termMonths: t,
        interestRatePerMonth: product.interestRatePerMonth,
        interestType: product.interestType,
      });
      setCalc(c);
    } catch {
      /* keep previous calc */
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    if (!product || amountNum <= 0 || termNum <= 0) {
      setCalc(null);
      return;
    }
    const t = setTimeout(() => refreshCalc(amountNum, termNum), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountNum, termNum, productId, products.length]);

  if (loading) return <LoadingState label="Loading loan products…" />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  if (submitted) {
    return (
      <div className="space-y-5">
        <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
          <BadgeCheck className="h-12 w-12 text-emerald-600" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">Application submitted!</h2>
          <p className="mt-2 text-sm text-slate-600">
            Your {product?.name} application for <span className="font-semibold">{formatCurrency(amountNum)}</span> has been
            routed to the Credit Committee. You can track its status under My Loans.
          </p>
          <div className="mt-6 flex gap-2">
            <Link to="/portal/loans">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" /> Track application
              </Button>
            </Link>
            <Link to="/portal">
              <Button>Go to dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const canNext = step === 0 ? !!productId : amountNum >= (product?.minAmount || 0) && amountNum <= (product?.maxAmount || 0) && termNum >= (product?.minTermMonths || 0) && termNum <= (product?.maxTermMonths || 0) && !!purpose.trim();

  const next = () => {
    if (!canNext) {
      toast.error('Please complete this step before continuing.');
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = async () => {
    if (!product) return;
    setSubmitting(true);
    try {
      await loanService.apply({
        productId: product.id,
        productName: product.name,
        amount: amountNum,
        termMonths: termNum,
        repaymentFrequency: frequency,
        purpose,
        guarantorName,
        guarantorPhone,
        collateralDescription: collateral,
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || 'Unable to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Apply for a loan</h1>
        <p className="text-sm text-slate-500">Choose a product that fits your needs and get a fast estimate.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i < step
                  ? 'bg-emerald-600 text-white'
                  : i === step
                    ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`hidden text-sm font-medium sm:block ${i <= step ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
            {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 rounded ${i < step ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {products.map((p) => {
            const selected = p.id === productId;
            return (
              <Card
                key={p.id}
                className={`cursor-pointer p-5 transition-all ${selected ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'hover:border-emerald-200'}`}
                onClick={() => setProductId(p.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <PackageCheck className="h-5 w-5" />
                  </div>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-800">{p.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{p.description}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-400">Amount</p>
                    <p className="font-semibold text-slate-700">{formatCurrency(p.minAmount)} – {formatCurrency(p.maxAmount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Interest</p>
                    <p className="font-semibold text-slate-700">{p.interestRatePerMonth}% / mo</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Term</p>
                    <p className="font-semibold text-slate-700">{p.minTermMonths}–{p.maxTermMonths} mo</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Processing</p>
                    <p className="font-semibold text-slate-700">{p.processingFeePercentage}%</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {step === 1 && product && (
        <Card>
          <CardHeader>
            <CardTitle>Loan setup</CardTitle>
            <span className="text-xs text-slate-400">{product.name}</span>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field
              label="Amount (₱)"
              required
              hint={`Allowed: ${formatCurrency(product.minAmount)} – ${formatCurrency(product.maxAmount)}`}
            >
              <Input
                type="number"
                min={product.minAmount}
                max={product.maxAmount}
                placeholder={String(product.minAmount)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Term (months)" required hint={`Allowed: ${product.minTermMonths} – ${product.maxTermMonths} months`}>
              <Input
                type="number"
                min={product.minTermMonths}
                max={product.maxTermMonths}
                placeholder={String(product.minTermMonths)}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </Field>
            <Field label="Repayment frequency">
              <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option>Monthly</option>
                <option>Weekly</option>
                <option>Daily</option>
              </Select>
            </Field>
            <Field label="Loan purpose" required>
              <Input
                placeholder="e.g. Inventory replenishment, capital for store"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </Field>
            <Field label="Guarantor name" hint="Optional personal guarantor">
              <Input value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} />
            </Field>
            <Field label="Guarantor phone">
              <Input value={guarantorPhone} onChange={(e) => setGuarantorPhone(e.target.value)} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Collateral description" hint="Optional — not required for most products.">
                <Textarea
                  rows={2}
                  placeholder="None / Personal Guarantee"
                  value={collateral}
                  onChange={(e) => setCollateral(e.target.value)}
                />
              </Field>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Review your application</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <InfoRow label="Product" value={product?.name} />
              <InfoRow label="Amount" value={formatCurrency(amountNum)} />
              <InfoRow label="Term" value={`${termNum} months`} />
              <InfoRow label="Frequency" value={frequency} />
              <InfoRow label="Purpose" value={purpose} />
              {guarantorName && <InfoRow label="Guarantor" value={guarantorName} />}
            </div>

            {calc ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <EstimateBox label="Estimated monthly payment" value={formatCurrency(calc.estimatedMonthlyPayment)} highlight />
                <EstimateBox label="Total interest" value={formatCurrency(calc.estimatedTotalInterest)} />
                <EstimateBox label="Total repayable" value={formatCurrency(calc.totalRepayable)} />
                <EstimateBox label="Processing fee" value={formatCurrency(calc.processingFee)} />
                <EstimateBox label="Estimated net proceeds" value={formatCurrency(calc.estimatedNetProceeds)} />
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <Info className="h-4 w-4" /> Complete the amount and term fields to see an estimate.
              </div>
            )}

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-xs text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                By submitting you agree that the details provided are accurate and authorize HOSCOMO to conduct a
                credit investigation. Final approval is subject to the Credit Committee.
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} loading={submitting}>
            <Building2 className="h-4 w-4" /> Submit application
          </Button>
        )}
      </div>
    </div>
  );
};

const EstimateBox: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`rounded-xl border p-4 ${highlight ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
    <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`mt-1 text-base font-bold tabular-nums ${highlight ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</p>
  </div>
);

export default ApplyLoanPage;