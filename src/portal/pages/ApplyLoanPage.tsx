import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Info,
  PackageCheck,
  ShieldCheck,
  Clock,
  Eye,
  AlertTriangle,
  XCircle,
  Upload,
  FileCheck,
  Trash2,
  UserCheck,
  Calculator,
} from 'lucide-react';
import { loanService } from '../services/loans';
import { profileService } from '../services/profile';
import { ClientProfile, KYCStatus, KycStatusData, LoanCalculation, LoanProduct } from '../types';
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

const STEPS = ['Choose product', 'Loan setup & purpose', 'Supporting documents', 'Review & declarations'];

interface UploadedDoc {
  docName: string;
  docType: string;
  fileName: string;
  base64?: string;
  mimeType?: string;
  fileSize?: string;
}

const ApplyLoanPage: React.FC = () => {
  const toast = useToast();
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [kyc, setKyc] = useState<KycStatusData | null>(null);

  const [step, setStep] = useState(0);
  const [productId, setProductId] = useState('');
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('');
  const [frequency, setFrequency] = useState('Monthly');
  const [purposeCategory, setPurposeCategory] = useState('Business');
  const [purposeOtherExplanation, setPurposeOtherExplanation] = useState('');

  // Contextual Purpose Fields
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

  // Guarantor & Collateral
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [guarantorRelationship, setGuarantorRelationship] = useState('');
  const [collateral, setCollateral] = useState('');
  const [collateralValue, setCollateralValue] = useState('');

  // Documents
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);

  // Legal Declarations
  const [decTruth, setDecTruth] = useState(false);
  const [decInvestigation, setDecInvestigation] = useState(false);
  const [decTerms, setDecTerms] = useState(false);

  // Calculation & submission state
  const [calc, setCalc] = useState<LoanCalculation | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedLoanId, setSubmittedLoanId] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [k, p] = await Promise.all([profileService.kycStatus(), profileService.get()]);
        setKyc(k);
        setProfile(p);
        const normKyc = (k.kycStatus || 'NOT_STARTED').toUpperCase();
        if (normKyc !== 'VERIFIED' && normKyc !== 'APPROVED') {
          setKycStatus(normKyc as KYCStatus);
          return;
        }
        const prods = await loanService.products();
        setProducts(prods);
        if (prods.length > 0) {
          setProductId(prods[0].id);
          setAmount(String(prods[0].minAmount || 10000));
          setTerm(String(prods[0].minTermMonths || 6));
        }
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

  const handleFileUpload = (docType: string, docName: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const sizeStr = `${(file.size / 1024).toFixed(0)} KB`;
      setDocuments((prev) => [
        ...prev.filter((d) => d.docType !== docType),
        { docType, docName, fileName: file.name, base64, mimeType: file.type, fileSize: sizeStr },
      ]);
      toast.success(`Attached ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const removeDoc = (docType: string) => {
    setDocuments((prev) => prev.filter((d) => d.docType !== docType));
  };

  if (loading) return <LoadingState label="Loading loan application system…" />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  // KYC GATE ENFORCEMENT
  const isKycApproved = kycStatus === 'VERIFIED' || kycStatus === 'APPROVED' || (!kycStatus && (kyc?.kycStatus === 'VERIFIED' || kyc?.kycStatus === 'APPROVED'));
  if (!isKycApproved && kycStatus) {
    const cfg: Record<string, { icon: React.ElementType; title: string; desc: string; cls: string }> = {
      NOT_STARTED: {
        icon: ShieldCheck,
        title: 'KYC Verification Required',
        desc: 'Please complete and receive KYC verification approval before submitting a microloan application.',
        cls: 'border-amber-200 bg-amber-50 text-amber-700',
      },
      IN_PROGRESS: {
        icon: Clock,
        title: 'KYC Verification In Progress',
        desc: 'Please finish and submit your KYC verification. Once approved, you can apply for loans.',
        cls: 'border-blue-200 bg-blue-50 text-blue-700',
      },
      SUBMITTED: {
        icon: Eye,
        title: 'KYC Under Review',
        desc: 'Your KYC submission is currently being reviewed by our compliance team. You will be able to apply once approved.',
        cls: 'border-blue-200 bg-blue-50 text-blue-700',
      },
      PENDING: {
        icon: Eye,
        title: 'KYC Under Review',
        desc: 'Your KYC submission is currently being reviewed by our compliance team. You will be able to apply once approved.',
        cls: 'border-blue-200 bg-blue-50 text-blue-700',
      },
      UNDER_REVIEW: {
        icon: Eye,
        title: 'KYC Under Compliance Review',
        desc: 'Our staff is verifying your submitted documents. You will be notified once approved.',
        cls: 'border-blue-200 bg-blue-50 text-blue-700',
      },
      CORRECTION_REQUIRED: {
        icon: AlertTriangle,
        title: 'KYC Correction Required',
        desc: kyc?.correctionReason
          ? `Correction required: ${kyc.correctionReason}`
          : 'Staff requested updates to your KYC details. Please update and resubmit.',
        cls: 'border-amber-200 bg-amber-50 text-amber-700',
      },
      REJECTED: {
        icon: XCircle,
        title: 'KYC Not Approved',
        desc: kyc?.rejectionReason
          ? `Reason: ${kyc.rejectionReason}`
          : 'Your KYC verification was rejected. Please review branch notes and resubmit.',
        cls: 'border-rose-200 bg-rose-50 text-rose-700',
      },
      SUSPENDED: {
        icon: XCircle,
        title: 'Account Suspended',
        desc: 'Your account KYC is currently suspended. Please visit your branch personnel for assistance.',
        cls: 'border-rose-200 bg-rose-50 text-rose-700',
      },
    };
    const c = cfg[kycStatus] || cfg.NOT_STARTED;
    const Icon = c.icon;

    return (
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${c.cls}`}>
          <Icon className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">{c.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.desc}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {['NOT_STARTED', 'IN_PROGRESS', 'CORRECTION_REQUIRED', 'REJECTED'].includes(kycStatus) ? (
            <Link to="/portal/kyc">
              <Button variant="brand">
                <ShieldCheck className="h-4 w-4" /> Complete KYC
              </Button>
            </Link>
          ) : null}
          <Link to="/portal">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="space-y-5">
        <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <BadgeCheck className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">Application Submitted!</h2>
          <p className="mt-1 text-sm font-semibold text-emerald-800">Application #{submittedLoanId}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Your <span className="font-semibold">{product?.name}</span> application for{' '}
            <span className="font-bold text-slate-900">{formatCurrency(amountNum)}</span> has been securely routed to the
            Credit Committee and branch loan officers.
          </p>
          <div className="mt-6 flex gap-3">
            <Link to="/portal/loans">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" /> View My Loans
              </Button>
            </Link>
            <Link to="/portal">
              <Button variant="brand">Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Step Validations
  const isStep0Valid = !!productId;
  const isStep1Valid =
    amountNum >= (product?.minAmount || 0) &&
    amountNum <= (product?.maxAmount || 0) &&
    termNum >= (product?.minTermMonths || 0) &&
    termNum <= (product?.maxTermMonths || 0) &&
    (purposeCategory !== 'Other' || !!purposeOtherExplanation.trim());
  const isStep2Valid = true; // supporting docs can be optional or uploaded
  const isStep3Valid = decTruth && decInvestigation && decTerms;

  const handleNext = () => {
    if (step === 0 && !isStep0Valid) {
      toast.error('Please select a loan product.');
      return;
    }
    if (step === 1 && !isStep1Valid) {
      toast.error('Please verify amount, term, and required purpose details.');
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const getFullPurposeDetails = () => {
    if (purposeCategory === 'Business') {
      return {
        businessName: businessName || 'Small Enterprise',
        businessType: businessType || 'General Retail / Trading',
        yearsInOperation: businessYears || '1',
        estimatedMonthlySales: businessMonthlySales || '0',
      };
    }
    if (purposeCategory === 'Education') {
      return {
        studentName: studentName || profile?.fullName,
        schoolName: schoolName || 'Educational Institution',
        gradeOrLevel: gradeLevel || 'College',
      };
    }
    if (purposeCategory === 'Agriculture') {
      return {
        farmType: farmType || 'Crops / Farming',
        farmLocation: farmLocation || profile?.address,
      };
    }
    if (purposeCategory === 'Medical') {
      return {
        patientName: medicalPatient || profile?.fullName,
        medicalFacility: medicalFacility || 'Hospital / Clinic',
      };
    }
    if (purposeCategory === 'Other') {
      return { explanation: purposeOtherExplanation };
    }
    return { category: purposeCategory };
  };

  const submit = async () => {
    if (!product) return;
    if (!isStep3Valid) {
      toast.error('Please check all three legal declarations to proceed.');
      return;
    }
    setSubmitting(true);
    try {
      const purposeDetails = getFullPurposeDetails();
      const res = await loanService.apply({
        productId: product.id,
        productName: product.name,
        amount: amountNum,
        termMonths: termNum,
        repaymentFrequency: frequency,
        purpose: purposeCategory,
        purposeDetails,
        guarantorName,
        guarantorPhone,
        guarantorRelationship,
        collateralDescription: collateral,
        collateralValue: Number(collateralValue) || 0,
        documents: documents.map((d) => ({
          docName: d.docName,
          docType: d.docType,
          fileName: d.fileName,
          base64: d.base64,
          mimeType: d.mimeType,
        })),
        declarations: true,
      });
      setSubmittedLoanId(res.application?.loanNumber || res.application?.id || 'LA-SUBMITTED');
      setSubmitted(true);
      toast.success('Loan application successfully submitted!');
    } catch (err: any) {
      toast.error(err.message || 'Unable to submit loan application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Apply for a Microloan</h1>
        <p className="text-sm text-slate-500">
          Fast, transparent microfinance financing tailored for cooperative members.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                i < step
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : i === step
                    ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`hidden text-sm font-medium sm:block ${i <= step ? 'text-slate-800' : 'text-slate-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 rounded ${i < step ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* STEP 0: Product Selection */}
      {step === 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {products.map((p) => {
            const selected = p.id === productId;
            return (
              <Card
                key={p.id}
                className={`cursor-pointer p-5 transition-all ${
                  selected
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                    : 'hover:border-emerald-300 hover:shadow-sm'
                }`}
                onClick={() => {
                  setProductId(p.id);
                  if (amountNum < p.minAmount || amountNum > p.maxAmount) {
                    setAmount(String(p.minAmount));
                  }
                  if (termNum < p.minTermMonths || termNum > p.maxTermMonths) {
                    setTerm(String(p.minTermMonths));
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <PackageCheck className="h-5 w-5" />
                  </div>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                      selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-900">{p.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{p.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                  <div>
                    <p className="text-slate-400 font-medium">Loan Limits</p>
                    <p className="font-bold text-slate-800">
                      {formatCurrency(p.minAmount)} – {formatCurrency(p.maxAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Monthly Interest</p>
                    <p className="font-bold text-slate-800">{p.interestRatePerMonth}% / mo</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Available Terms</p>
                    <p className="font-bold text-slate-800">
                      {p.minTermMonths}–{p.maxTermMonths} months
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Processing Fee</p>
                    <p className="font-bold text-slate-800">{p.processingFeePercentage}%</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* STEP 1: Loan Setup & Purpose */}
      {step === 1 && product && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Loan Specifications</CardTitle>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                {product.name}
              </span>
            </CardHeader>
            <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field
                label="Requested Amount (₱)"
                required
                hint={`Min: ${formatCurrency(product.minAmount)} · Max: ${formatCurrency(product.maxAmount)}`}
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

              <Field
                label="Loan Term (Months)"
                required
                hint={`Min: ${product.minTermMonths} · Max: ${product.maxTermMonths} months`}
              >
                <Input
                  type="number"
                  min={product.minTermMonths}
                  max={product.maxTermMonths}
                  placeholder={String(product.minTermMonths)}
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                />
              </Field>

              <Field label="Repayment Frequency" required>
                <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  <option value="Monthly">Monthly</option>
                  <option value="Semi-Monthly">Semi-Monthly (Bi-Weekly)</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Daily">Daily</option>
                </Select>
              </Field>

              <Field label="Primary Loan Purpose" required>
                <Select value={purposeCategory} onChange={(e) => setPurposeCategory(e.target.value)}>
                  <option value="Business">Business Capital / Inventory</option>
                  <option value="Education">Education / Tuition Assistance</option>
                  <option value="Agriculture">Agriculture / Farming / Livestock</option>
                  <option value="Medical">Medical / Emergency Healthcare</option>
                  <option value="Household">Household Improvement</option>
                  <option value="Other">Other Purpose (Specify)</option>
                </Select>
              </Field>
            </CardBody>
          </Card>

          {/* Contextual Purpose Fields */}
          <Card>
            <CardHeader>
              <CardTitle>Purpose Details</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {purposeCategory === 'Business' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Business / Enterprise Name" required>
                    <Input
                      placeholder="e.g. Santos Sari-Sari Store"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                    />
                  </Field>
                  <Field label="Nature of Business / Industry">
                    <Input
                      placeholder="e.g. Retail, Food Stall, Tailoring"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                    />
                  </Field>
                  <Field label="Years in Operation">
                    <Input
                      type="number"
                      placeholder="e.g. 2"
                      value={businessYears}
                      onChange={(e) => setBusinessYears(e.target.value)}
                    />
                  </Field>
                  <Field label="Estimated Monthly Revenue (₱)">
                    <Input
                      type="number"
                      placeholder="e.g. 25000"
                      value={businessMonthlySales}
                      onChange={(e) => setBusinessMonthlySales(e.target.value)}
                    />
                  </Field>
                </div>
              )}

              {purposeCategory === 'Education' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Student Full Name" required>
                    <Input
                      placeholder="Student Name"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                    />
                  </Field>
                  <Field label="School / University" required>
                    <Input
                      placeholder="e.g. State University"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Year Level / Course">
                      <Input
                        placeholder="e.g. 3rd Year BS Nursing"
                        value={gradeLevel}
                        onChange={(e) => setGradeLevel(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              )}

              {purposeCategory === 'Agriculture' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Crop / Livestock Type" required>
                    <Input
                      placeholder="e.g. Rice farming, Poultry"
                      value={farmType}
                      onChange={(e) => setFarmType(e.target.value)}
                    />
                  </Field>
                  <Field label="Farm Location / Barangay" required>
                    <Input
                      placeholder="e.g. Barangay San Jose"
                      value={farmLocation}
                      onChange={(e) => setFarmLocation(e.target.value)}
                    />
                  </Field>
                </div>
              )}

              {purposeCategory === 'Medical' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Patient Name" required>
                    <Input
                      placeholder="Patient Full Name"
                      value={medicalPatient}
                      onChange={(e) => setMedicalPatient(e.target.value)}
                    />
                  </Field>
                  <Field label="Medical Facility / Hospital">
                    <Input
                      placeholder="e.g. Provincial General Hospital"
                      value={medicalFacility}
                      onChange={(e) => setMedicalFacility(e.target.value)}
                    />
                  </Field>
                </div>
              )}

              {purposeCategory === 'Other' && (
                <Field label="Detailed Explanation of Loan Purpose" required>
                  <Textarea
                    rows={3}
                    placeholder="Please provide a clear description of the intended purpose for these loan funds..."
                    value={purposeOtherExplanation}
                    onChange={(e) => setPurposeOtherExplanation(e.target.value)}
                  />
                </Field>
              )}

              {purposeCategory === 'Household' && (
                <p className="text-xs text-slate-500 italic">
                  Household improvement loans support family asset upgrades, basic repairs, and household essential utility needs.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Guarantor & Collateral */}
          <Card>
            <CardHeader>
              <CardTitle>Guarantor & Security (Optional)</CardTitle>
            </CardHeader>
            <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Guarantor Name" hint="Optional co-maker / personal guarantor">
                <Input
                  placeholder="Full name of guarantor"
                  value={guarantorName}
                  onChange={(e) => setGuarantorName(e.target.value)}
                />
              </Field>
              <Field label="Guarantor Phone Number">
                <Input
                  placeholder="0917-000-0000"
                  value={guarantorPhone}
                  onChange={(e) => setGuarantorPhone(e.target.value)}
                />
              </Field>
              <Field label="Relationship to Borrower">
                <Input
                  placeholder="e.g. Spouse, Sibling, Co-member"
                  value={guarantorRelationship}
                  onChange={(e) => setGuarantorRelationship(e.target.value)}
                />
              </Field>
              <Field label="Estimated Collateral Value (₱)" hint="If pledging physical collateral">
                <Input
                  type="number"
                  placeholder="0"
                  value={collateralValue}
                  onChange={(e) => setCollateralValue(e.target.value)}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Collateral Description">
                  <Textarea
                    rows={2}
                    placeholder="None / Personal Guarantee / Chattel description"
                    value={collateral}
                    onChange={(e) => setCollateral(e.target.value)}
                  />
                </Field>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* STEP 2: Supporting Documents */}
      {step === 2 && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Supporting Documents Attachment</CardTitle>
            </CardHeader>
            <CardBody className="space-y-5">
              <p className="text-xs text-slate-500">
                Attaching updated proof of income or business documents speeds up Credit Committee verification.
                Your previously verified KYC identification documents are already on file with HOSCOMO.
              </p>

              {/* Doc 1: Proof of Income */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Proof of Income / Livelihood</h4>
                    <p className="text-xs text-slate-500">
                      Recent payslip, ITR, Certificate of Employment, or Business Permit / Receipts.
                    </p>
                  </div>
                  {documents.some((d) => d.docType === 'PROOF_OF_INCOME') ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        <FileCheck className="h-3.5 w-3.5" /> Attached
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDoc('PROOF_OF_INCOME')}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <span className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                        <Upload className="h-3.5 w-3.5" /> Attach File
                      </span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={handleFileUpload('PROOF_OF_INCOME', 'Proof of Income')}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Doc 2: Additional Supporting Doc / Collateral */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Guarantor ID / Collateral Proof</h4>
                    <p className="text-xs text-slate-500">
                      Valid ID of guarantor or certificate of ownership if declaring physical collateral.
                    </p>
                  </div>
                  {documents.some((d) => d.docType === 'GUARANTOR_COLLATERAL') ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        <FileCheck className="h-3.5 w-3.5" /> Attached
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDoc('GUARANTOR_COLLATERAL')}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <span className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                        <Upload className="h-3.5 w-3.5" /> Attach File
                      </span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={handleFileUpload('GUARANTOR_COLLATERAL', 'Guarantor / Collateral Document')}
                      />
                    </label>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* STEP 3: Review & Declarations */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Verified Profile Card */}
          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-900">
                <UserCheck className="h-5 w-5 text-emerald-700" /> Verified Member Snapshot
              </CardTitle>
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                <BadgeCheck className="h-3.5 w-3.5" /> KYC Verified
              </span>
            </CardHeader>
            <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
              <div>
                <p className="text-slate-500 font-medium">Borrower Name</p>
                <p className="font-bold text-slate-800">{profile?.fullName || 'Member'}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Borrower Number</p>
                <p className="font-bold text-slate-800">{profile?.borrowerNumber || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Registered Phone</p>
                <p className="font-bold text-slate-800">{profile?.phone || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Assigned Branch</p>
                <p className="font-bold text-slate-800">{profile?.branchId || 'Main Branch'}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Declared Monthly Income</p>
                <p className="font-bold text-slate-800">{formatCurrency(profile?.monthlyIncome || 0)}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Member Status</p>
                <p className="font-bold text-emerald-700">{profile?.memberStatus || 'Active'}</p>
              </div>
            </CardBody>
          </Card>

          {/* Loan Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Loan Summary</CardTitle>
              <span className="text-xs text-slate-500">{product?.name}</span>
            </CardHeader>
            <CardBody>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <InfoRow label="Product" value={product?.name} />
                <InfoRow label="Principal Amount" value={formatCurrency(amountNum)} />
                <InfoRow label="Term" value={`${termNum} months`} />
                <InfoRow label="Repayment Frequency" value={frequency} />
                <InfoRow label="Purpose" value={purposeCategory} />
                {guarantorName && <InfoRow label="Guarantor" value={`${guarantorName} (${guarantorRelationship || 'Co-maker'})`} />}
                {collateral && <InfoRow label="Collateral" value={collateral} />}
              </div>

              {calc ? (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <EstimateBox label="Estimated Installment" value={formatCurrency(calc.estimatedMonthlyPayment)} highlight />
                  <EstimateBox label="Total Interest" value={formatCurrency(calc.estimatedTotalInterest)} />
                  <EstimateBox label="Total Repayable" value={formatCurrency(calc.totalRepayable)} />
                  <EstimateBox label="Processing Fee" value={formatCurrency(calc.processingFee)} />
                  <EstimateBox label="Estimated Net Proceeds" value={formatCurrency(calc.estimatedNetProceeds)} />
                  <EstimateBox label="Repayment Schedule" value={`${calc.totalInstallments} payments`} />
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <Info className="h-4 w-4" /> Computing amortization schedule...
                </div>
              )}
            </CardBody>
          </Card>

          {/* Legal Declarations */}
          <Card className="border-slate-300 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" /> Mandatory Legal Declarations
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={decTruth}
                  onChange={(e) => setDecTruth(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="leading-relaxed">
                  <strong className="text-slate-900 font-semibold">Truthfulness & Accuracy:</strong> I certify that all
                  information, statements, and attachments provided in this loan application are true, correct, and
                  accurately describe my current financial standing.
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={decInvestigation}
                  onChange={(e) => setDecInvestigation(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="leading-relaxed">
                  <strong className="text-slate-900 font-semibold">Credit Investigation Authorization:</strong> I authorize
                  HOSCOMO Microfinance and its designated Credit Committee officers to verify the information given,
                  contact references/guarantors, and inspect my business premises or declared collateral.
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={decTerms}
                  onChange={(e) => setDecTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="leading-relaxed">
                  <strong className="text-slate-900 font-semibold">Cooperative Loan Terms Agreement:</strong> I understand
                  and agree to the repayment schedule, interest charges, processing fees, and agree to make timely
                  installments upon approval and disbursement of loan proceeds.
                </span>
              </label>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Navigation Controls */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="brand" onClick={handleNext}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="brand" onClick={submit} loading={submitting} disabled={!isStep3Valid}>
            <Building2 className="h-4 w-4" /> Submit Application
          </Button>
        )}
      </div>
    </div>
  );
};

const EstimateBox: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => (
  <div
    className={`rounded-xl border p-4 ${
      highlight ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
    }`}
  >
    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
    <p className={`mt-1 text-base font-bold tabular-nums ${highlight ? 'text-emerald-700' : 'text-slate-800'}`}>
      {value}
    </p>
  </div>
);

export default ApplyLoanPage;