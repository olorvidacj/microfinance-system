import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, FileCheck, PackageCheck, ShieldCheck, Trash2, Upload, UserCheck } from 'lucide-react';
import { loanService } from '../services/loans';
import { profileService } from '../services/profile';
import { ApiError } from '../services/clientApi';
import { ClientProfile, KycStatusData } from '../types';
import {
  FREQUENCY_LABELS,
  LOAN_PURPOSES,
  LOAN_PURPOSE_LABELS,
  centsToDecimal,
  formatPeso,
  validateApplicationTerms,
  type LoanProduct,
  type LoanPurpose,
} from '../../../shared/lending';
import { UPLOAD_LIMITS, isKycVerified } from '../../../shared/kyc-core';
import { KycStatusPanel } from '../kyc/KycStatusPanel';
import { LoanQuoteView, ProductTerms, useLoanQuote } from '../../components/lending';
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorState, Field, Input, LoadingState, Select, Textarea } from '../components/ui';
import { InfoRow } from '../components/common';
import { useToast } from '../components/ui/Toast';

const STEPS = ['Choose product', 'Amount & purpose', 'Supporting documents', 'Review & declarations'];

interface UploadedDoc {
  docType: 'PROOF_OF_INCOME' | 'GUARANTOR_COLLATERAL';
  fileName: string;
  base64: string;
  fileSize: string;
}

const DOC_SLOTS: { docType: UploadedDoc['docType']; title: string; hint: string }[] = [
  { docType: 'PROOF_OF_INCOME', title: 'Proof of income / livelihood', hint: 'Recent payslip, ITR, certificate of employment, or business permit / receipts.' },
  { docType: 'GUARANTOR_COLLATERAL', title: 'Guarantor ID / collateral proof', hint: "Guarantor's valid ID, or proof of ownership of declared collateral." },
];

const ApplyLoanPage: React.FC = () => {
  const toast = useToast();
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [kyc, setKyc] = useState<KycStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [step, setStep] = useState(0);
  const [productId, setProductId] = useState('');
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('');
  const [purpose, setPurpose] = useState<LoanPurpose>('BUSINESS');
  const [explanation, setExplanation] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessYears, setBusinessYears] = useState('');
  const [businessMonthlySales, setBusinessMonthlySales] = useState('');
  const [studentName, setStudentName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [farmType, setFarmType] = useState('');
  const [farmLocation, setFarmLocation] = useState('');
  const [medicalPatient, setMedicalPatient] = useState('');
  const [medicalFacility, setMedicalFacility] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [guarantorRelationship, setGuarantorRelationship] = useState('');
  const [collateral, setCollateral] = useState('');
  const [collateralValue, setCollateralValue] = useState('');
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [decTruth, setDecTruth] = useState(false);
  const [decInvestigation, setDecInvestigation] = useState(false);
  const [decTerms, setDecTerms] = useState(false);

  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ loanNumber: string; status: string } | null>(null);
  // One key per attempt: a double click or a retry after a lost response returns the same application.
  const [requestKey] = useState(() => loanService.newRequestKey());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [k, p] = await Promise.all([profileService.kycStatus(), profileService.get()]);
        setKyc(k);
        setProfile(p);
        if (!isKycVerified(k.kycStatus)) return;
        const prods = await loanService.products();
        setProducts(prods);
        if (prods.length > 0) {
          setProductId(prods[0].id);
          setAmount(centsToDecimal(prods[0].minAmount));
          setTerm(String(prods[0].minTermMonths));
        }
      } catch (err: any) {
        setError(err.message || 'Loan products could not be loaded.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const product = useMemo(() => products.find((p) => p.id === productId) ?? null, [products, productId]);
  const { quote, errors: termErrors, error: quoteError } = useLoanQuote(product, amount, term);

  const purposeDetails = useMemo((): Record<string, string> => {
    const pick = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v.trim()));
    switch (purpose) {
      case 'BUSINESS':
        return pick({ businessName, businessType, yearsInOperation: businessYears, estimatedMonthlySales: businessMonthlySales });
      case 'EDUCATION':
        return pick({ studentName, schoolName, gradeOrLevel: gradeLevel });
      case 'AGRICULTURE':
        return pick({ farmType, farmLocation });
      case 'MEDICAL':
        return pick({ patientName: medicalPatient, medicalFacility });
      case 'OTHER':
        return pick({ explanation });
      default:
        return {};
    }
  }, [purpose, businessName, businessType, businessYears, businessMonthlySales, studentName, schoolName, gradeLevel, farmType, farmLocation, medicalPatient, medicalFacility, explanation]);

  const validation = useMemo(() => validateApplicationTerms(product, { amount, termMonths: term, purpose, purposeDetails }), [product, amount, term, purpose, purposeDetails]);
  const errors: Record<string, string> = { ...(touched ? { ...(validation.errors as Record<string, string>), ...termErrors } : {}), ...serverErrors };

  const handleFileUpload = (docType: UploadedDoc['docType']) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > UPLOAD_LIMITS.maxBytes) {
      toast.error('Files must be 10 MB or smaller.');
      return;
    }
    if (!UPLOAD_LIMITS.mimeTypes.includes(file.type)) {
      toast.error('Attach a JPEG, PNG, WebP or PDF file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDocuments((prev) => [...prev.filter((d) => d.docType !== docType), { docType, fileName: file.name, base64: reader.result as string, fileSize: `${Math.ceil(file.size / 1024)} KB` }]);
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <LoadingState label="Loading loan products…" />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  // The server refuses loan applications until KYC is approved; this explains why, and what to do next.
  if (!kyc || !isKycVerified(kyc.kycStatus)) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-navy-950">Verify your identity to apply for a loan</h1>
          <p className="mt-1 text-sm text-slate-600">Loans are open to members whose identity has been verified by their branch.</p>
        </div>
        {kyc && <KycStatusPanel status={kyc} />}
        <div className="text-center">
          <Link to="/portal" className="text-sm font-semibold text-navy-900 underline">
            Back to my dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <BadgeCheck className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-slate-900">Application submitted</h2>
        <p className="mt-1 text-sm font-semibold text-emerald-800">Application {submitted.loanNumber}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Your {product?.name} application for <span className="font-bold text-slate-900">{quote ? formatPeso(quote.principal) : ''}</span> is waiting for review at your branch. You will be notified of the
          decision.
        </p>
        <div className="mt-6 flex gap-3">
          <Link to="/portal/loans?tab=applications">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> My applications
            </Button>
          </Link>
          <Link to="/portal">
            <Button variant="brand">Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return <ErrorState message="No loan products are open for applications right now. Please check again later or ask your branch." />;
  }

  const declarationsOk = decTruth && decInvestigation && decTerms;

  const handleNext = () => {
    if (step === 0 && !product) {
      toast.error('Choose a loan product.');
      return;
    }
    if (step === 1) {
      setTouched(true);
      if (!validation.ok) {
        toast.error('Check the amount, term and purpose.');
        return;
      }
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = async () => {
    if (!product || !declarationsOk) {
      toast.error('Tick all three declarations to continue.');
      return;
    }
    setTouched(true);
    if (!validation.ok) {
      setStep(1);
      return;
    }
    setSubmitting(true);
    setServerErrors({});
    try {
      const res = await loanService.apply(
        {
          productId: product.id,
          amount,
          termMonths: term,
          purpose,
          purposeDetails,
          guarantors: guarantorName.trim() ? [{ name: guarantorName.trim(), phone: guarantorPhone.trim(), relationship: guarantorRelationship.trim() }] : undefined,
          collateral: collateral.trim() ? { description: collateral.trim(), estimatedValue: collateralValue.trim() || undefined } : undefined,
          documents: documents.map((d) => ({ docType: d.docType, fileName: d.fileName, base64: d.base64 })),
        },
        requestKey,
      );
      setSubmitted({ loanNumber: res.application.loanNumber, status: res.application.status });
      toast.success('Application submitted.');
    } catch (err) {
      const fields = err instanceof ApiError ? ((err.details?.fields as Record<string, string>) ?? {}) : {};
      setServerErrors(fields);
      if (fields.amount || fields.termMonths || fields.purpose || fields.purposeDetails) setStep(1);
      toast.error(err instanceof Error ? err.message : 'The application could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Apply for a loan</h1>
        <p className="text-sm text-slate-500">The schedule below is the one your branch will see and store when the loan is released.</p>
      </div>

      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i < step ? 'bg-emerald-600 text-white' : i === step ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500' : 'bg-slate-100 text-slate-400'
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
                className={`cursor-pointer p-5 transition-all ${selected ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20' : 'hover:border-emerald-300 hover:shadow-sm'}`}
                onClick={() => {
                  setProductId(p.id);
                  setAmount(centsToDecimal(p.minAmount));
                  setTerm(String(p.minTermMonths));
                  setServerErrors({});
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <PackageCheck className="h-5 w-5" />
                  </div>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-900">{p.name}</h3>
                {p.description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{p.description}</p>}
                <div className="mt-4 rounded-xl bg-slate-50 p-3">
                  <ProductTerms product={p} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {step === 1 && product && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Amount and term</CardTitle>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{product.name}</span>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <Field label="Amount (₱)" required error={errors.amount} hint={`${formatPeso(product.minAmount)} to ${formatPeso(product.maxAmount)}`}>
                  <Input id="apply-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </Field>
                <Field label="Term (months)" required error={errors.termMonths} hint={`${product.minTermMonths} to ${product.maxTermMonths} months`}>
                  <Input id="apply-term" inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} />
                </Field>
                <Field label="Payments" hint="Set by the product">
                  <Input value={FREQUENCY_LABELS[product.frequency]} disabled />
                </Field>
              </div>
              <LoanQuoteView quote={quote} error={quoteError} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purpose</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Field label="What is the loan for?" required error={errors.purpose}>
                <Select value={purpose} onChange={(e) => setPurpose(e.target.value as LoanPurpose)}>
                  {LOAN_PURPOSES.map((p) => (
                    <option key={p} value={p}>
                      {LOAN_PURPOSE_LABELS[p]}
                    </option>
                  ))}
                </Select>
              </Field>
              {purpose === 'BUSINESS' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Business name">
                    <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                  </Field>
                  <Field label="Type of business">
                    <Input value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="Retail, food stall, tailoring…" />
                  </Field>
                  <Field label="Years in operation">
                    <Input inputMode="numeric" value={businessYears} onChange={(e) => setBusinessYears(e.target.value)} />
                  </Field>
                  <Field label="Estimated monthly sales (₱)">
                    <Input inputMode="decimal" value={businessMonthlySales} onChange={(e) => setBusinessMonthlySales(e.target.value)} />
                  </Field>
                </div>
              )}
              {purpose === 'EDUCATION' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="Student name">
                    <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} />
                  </Field>
                  <Field label="School">
                    <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
                  </Field>
                  <Field label="Year level / course">
                    <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
                  </Field>
                </div>
              )}
              {purpose === 'AGRICULTURE' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Crop / livestock">
                    <Input value={farmType} onChange={(e) => setFarmType(e.target.value)} />
                  </Field>
                  <Field label="Farm location">
                    <Input value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)} />
                  </Field>
                </div>
              )}
              {purpose === 'MEDICAL' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Patient name">
                    <Input value={medicalPatient} onChange={(e) => setMedicalPatient(e.target.value)} />
                  </Field>
                  <Field label="Hospital / clinic">
                    <Input value={medicalFacility} onChange={(e) => setMedicalFacility(e.target.value)} />
                  </Field>
                </div>
              )}
              {purpose === 'OTHER' && (
                <Field label="Explain what the loan is for" required error={errors.purposeDetails}>
                  <Textarea rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
                </Field>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Guarantor and collateral {product.requiresGuarantor || product.requiresCollateral ? '' : '(optional)'}</CardTitle>
            </CardHeader>
            <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Guarantor name">
                <Input value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} />
              </Field>
              <Field label="Guarantor phone">
                <Input value={guarantorPhone} onChange={(e) => setGuarantorPhone(e.target.value)} />
              </Field>
              <Field label="Relationship">
                <Input value={guarantorRelationship} onChange={(e) => setGuarantorRelationship(e.target.value)} placeholder="Spouse, sibling, co-member…" />
              </Field>
              <Field label="Collateral value (₱)">
                <Input inputMode="decimal" value={collateralValue} onChange={(e) => setCollateralValue(e.target.value)} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Collateral description">
                  <Textarea rows={2} value={collateral} onChange={(e) => setCollateral(e.target.value)} />
                </Field>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Supporting documents (optional)</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-xs text-slate-500">Documents help the review go faster. They are stored privately. Your verified KYC documents are already on file.</p>
            {DOC_SLOTS.map((slot) => {
              const doc = documents.find((d) => d.docType === slot.docType);
              return (
                <div key={slot.docType} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">{slot.title}</h4>
                    <p className="text-xs text-slate-500">{doc ? `${doc.fileName} · ${doc.fileSize}` : slot.hint}</p>
                  </div>
                  {doc ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <FileCheck className="h-3.5 w-3.5" /> Attached
                      </span>
                      <button type="button" aria-label={`Remove ${slot.title}`} onClick={() => setDocuments((prev) => prev.filter((d) => d.docType !== slot.docType))} className="text-slate-400 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <span className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                        <Upload className="h-3.5 w-3.5" /> Attach file
                      </span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileUpload(slot.docType)} />
                    </label>
                  )}
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      {step === 3 && product && (
        <div className="space-y-5">
          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-900">
                <UserCheck className="h-5 w-5 text-emerald-700" /> Applicant
              </CardTitle>
              <span className="flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" /> KYC verified
              </span>
            </CardHeader>
            <CardBody className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
              <InfoRow label="Name" value={profile?.fullName || '—'} />
              <InfoRow label="Member number" value={profile?.memberNumber || '—'} />
              <InfoRow label="Mobile" value={profile?.phone || '—'} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loan summary</CardTitle>
              <span className="text-xs text-slate-500">{product.name}</span>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <InfoRow label="Amount" value={quote ? formatPeso(quote.principal) : amount} />
                <InfoRow label="Term" value={`${term} months, ${FREQUENCY_LABELS[product.frequency].toLowerCase()} payments`} />
                <InfoRow label="Purpose" value={LOAN_PURPOSE_LABELS[purpose]} />
                {guarantorName && <InfoRow label="Guarantor" value={`${guarantorName}${guarantorRelationship ? ` (${guarantorRelationship})` : ''}`} />}
                {collateral && <InfoRow label="Collateral" value={collateral} />}
                <InfoRow label="Documents" value={documents.length ? documents.map((d) => d.fileName).join(', ') : 'None attached'} />
              </div>
              <LoanQuoteView quote={quote} error={quoteError} initiallyOpen />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" /> Declarations
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {[
                { checked: decTruth, set: setDecTruth, title: 'Truthful information', text: 'The information and attachments in this application are true and correct.' },
                { checked: decInvestigation, set: setDecInvestigation, title: 'Credit investigation', text: 'I authorise the cooperative to verify this information, contact my references and guarantor, and inspect declared collateral.' },
                { checked: decTerms, set: setDecTerms, title: 'Loan terms', text: 'I understand the schedule, interest and fees shown above and will pay each installment on time once the loan is released.' },
              ].map((d) => (
                <label key={d.title} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" checked={d.checked} onChange={(e) => d.set(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600" />
                  <span className="leading-relaxed">
                    <strong className="font-semibold text-slate-900">{d.title}:</strong> {d.text}
                  </span>
                </label>
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="brand" onClick={handleNext}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="brand" onClick={submit} loading={submitting} disabled={!declarationsOk}>
            <Building2 className="h-4 w-4" /> Submit application
          </Button>
        )}
      </div>
    </div>
  );
};

export default ApplyLoanPage;
