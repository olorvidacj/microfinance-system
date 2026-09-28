import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  FileCheck2,
  Home,
  Info,
  UserRound,
  Briefcase,
  ShieldCheck,
  Upload,
  XCircle,
  Clock,
  Phone,
  Mail,
  CreditCard,
  FileText,
  AlertCircle,
  Save,
  Camera,
  RotateCcw,
} from 'lucide-react';
import { profileService } from '../services/profile';
import { KycDocumentItem, KycStatusData } from '../types';
import { formatDate } from '../../utils/loanMath';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Field,
  FormSection,
  Input,
  LoadingState,
  Select,
  StatusBadge,
} from '../components/ui';
import { InfoRow, SectionDivider } from '../components/common';
import { useToast } from '../components/ui/Toast';

const STEPS = [
  'Personal Info',
  'Address',
  'Contact Info',
  'Employment & Finance',
  'Government ID',
  'Document Upload',
  'Review & Declarations',
] as const;

const GENDERS = ['Male', 'Female', 'Prefer not to say'];
const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'];
const SUFFIXES = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'];
const EMPLOYMENT_STATUSES = [
  'Employed',
  'Private Employee',
  'Government Employee',
  'Self-Employed',
  'Business Owner',
  'Student',
  'Retired',
  'Unemployed',
  'Other',
];
const EMPLOYMENT_TYPES = ['Regular / Permanent', 'Contractual', 'Probationary', 'Part-time', 'Seasonal'];
const SOURCES_OF_INCOME = [
  'Salary / Wages',
  'Business Income',
  'Remittances',
  'Pension',
  'Livestock / Farming',
  'Rental Income',
  'Investments',
  'Other',
];
const SOURCES_OF_FUNDS = [
  'Employment',
  'Business Operations',
  'Personal Savings',
  'Family Support',
  'Inheritance / Investments',
  'Other',
];
const GOV_ID_TYPES = [
  { code: 'PHILSYS_ID', label: 'Philippine National ID (PhilSys / PhilID)', hint: '12-digit number (e.g. 1234-5678-9012)' },
  { code: 'PASSPORT', label: 'Philippine Passport', hint: 'e.g. P1234567A' },
  { code: 'DRIVERS_LICENSE', label: "Driver's License (LTO)", hint: 'e.g. N01-12-345678' },
  { code: 'UMID', label: 'Unified Multi-Purpose ID (UMID / SSS)', hint: '14-digit number' },
  { code: 'POSTAL_ID', label: 'Postal ID (Digitized)', hint: 'e.g. PRN 123456789' },
  { code: 'VOTERS_ID', label: "Voter's ID / COMELEC Certificate", hint: 'Enter VIN number' },
  { code: 'PRC_ID', label: 'PRC ID (Professional Regulation Commission)', hint: '7-digit license number' },
  { code: 'OTHER_GOVT_ID', label: 'Other Government-Issued Photo ID', hint: 'Enter ID number exactly as printed' },
];

interface FormState {
  // 1. Personal Info
  firstName: string;
  middleName: string;
  hasNoMiddleName: boolean;
  lastName: string;
  suffix: string;
  dateOfBirth: string;
  placeOfBirth: string;
  gender: string;
  civilStatus: string;
  nationality: string;
  citizenship: string;

  // 2. Current Address
  currentRegionCode: string;
  currentRegionName: string;
  currentProvinceCode: string;
  currentProvinceName: string;
  currentCityCode: string;
  currentCityName: string;
  currentBarangayCode: string;
  currentBarangayName: string;
  currentPostalCode: string;
  currentHouseNumber: string;
  currentStreet: string;
  currentSubdivision: string;
  currentLandmark: string;
  currentAdditionalDetails: string;

  // 2. Permanent Address
  isPermanentSameAsCurrent: boolean;
  permRegionCode: string;
  permRegionName: string;
  permProvinceCode: string;
  permProvinceName: string;
  permCityCode: string;
  permCityName: string;
  permBarangayCode: string;
  permBarangayName: string;
  permPostalCode: string;
  permHouseNumber: string;
  permStreet: string;
  permSubdivision: string;
  permLandmark: string;
  permAdditionalDetails: string;

  // 3. Contact Info
  mobileNumber: string;
  email: string;
  alternativeMobile: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;

  // 4. Employment & Financials
  employmentStatus: string;
  otherStatusExplanation: string;
  employerName: string;
  jobPosition: string;
  employmentType: string;
  yearsOfEmployment: number;
  employerAddress: string;
  businessName: string;
  natureOfBusiness: string;
  yearsInBusiness: number;
  businessAddress: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  sourceOfIncome: string;
  sourceOfFunds: string;

  // 5. Government ID
  idType: string;
  idTypeName: string;
  idNumber: string;
  nameOnId: string;
  idDateOfBirth: string;
  idIssueDate: string;
  idExpiryDate: string;

  // 6. Declarations
  truthfulInformation: boolean;
  documentOwnership: boolean;
  authorizedReview: boolean;
  privacyNotice: boolean;
  penaltyAcknowledgment: boolean;
}

const initialFormState: FormState = {
  firstName: '',
  middleName: '',
  hasNoMiddleName: false,
  lastName: '',
  suffix: '',
  dateOfBirth: '',
  placeOfBirth: '',
  gender: '',
  civilStatus: '',
  nationality: 'Filipino',
  citizenship: 'Filipino',

  currentRegionCode: '',
  currentRegionName: '',
  currentProvinceCode: '',
  currentProvinceName: '',
  currentCityCode: '',
  currentCityName: '',
  currentBarangayCode: '',
  currentBarangayName: '',
  currentPostalCode: '',
  currentHouseNumber: '',
  currentStreet: '',
  currentSubdivision: '',
  currentLandmark: '',
  currentAdditionalDetails: '',

  isPermanentSameAsCurrent: true,
  permRegionCode: '',
  permRegionName: '',
  permProvinceCode: '',
  permProvinceName: '',
  permCityCode: '',
  permCityName: '',
  permBarangayCode: '',
  permBarangayName: '',
  permPostalCode: '',
  permHouseNumber: '',
  permStreet: '',
  permSubdivision: '',
  permLandmark: '',
  permAdditionalDetails: '',

  mobileNumber: '',
  email: '',
  alternativeMobile: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',

  employmentStatus: '',
  otherStatusExplanation: '',
  employerName: '',
  jobPosition: '',
  employmentType: 'Regular / Permanent',
  yearsOfEmployment: 1,
  employerAddress: '',
  businessName: '',
  natureOfBusiness: '',
  yearsInBusiness: 1,
  businessAddress: '',
  monthlyIncome: 0,
  monthlyExpenses: 0,
  sourceOfIncome: '',
  sourceOfFunds: 'Employment',

  idType: 'PHILSYS_ID',
  idTypeName: 'Philippine National ID (PhilSys / PhilID)',
  idNumber: '',
  nameOnId: '',
  idDateOfBirth: '',
  idIssueDate: '',
  idExpiryDate: '',

  truthfulInformation: false,
  documentOwnership: false,
  authorizedReview: false,
  privacyNotice: false,
  penaltyAcknowledgment: false,
};

export const KycPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [kyc, setKyc] = useState<KycStatusData | null>(null);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  // PSGC Dropdown Lists
  const [regions, setRegions] = useState<Array<{ code: string; name: string }>>([]);
  const [currentProvinces, setCurrentProvinces] = useState<Array<{ code: string; name: string }>>([]);
  const [currentCities, setCurrentCities] = useState<Array<{ code: string; name: string; isRegionalDistrict?: boolean }>>([]);
  const [currentBarangays, setCurrentBarangays] = useState<Array<{ code: string; name: string }>>([]);

  const [permProvinces, setPermProvinces] = useState<Array<{ code: string; name: string }>>([]);
  const [permCities, setPermCities] = useState<Array<{ code: string; name: string; isRegionalDistrict?: boolean }>>([]);
  const [permBarangays, setPermBarangays] = useState<Array<{ code: string; name: string }>>([]);

  // Form State
  const [form, setForm] = useState<FormState>(initialFormState);
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Load Regions on Mount
  useEffect(() => {
    profileService.getRegions().then(setRegions).catch(console.error);
  }, []);

  // Load Initial KYC / Profile Data
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [p, k] = await Promise.all([profileService.get(), profileService.kycStatus()]);
      setKyc(k);
      setDocuments(k.uploadedDocuments || []);

      if (k.kycStatus === 'SUBMITTED' || k.kycStatus === 'UNDER_REVIEW') {
        setSubmitted(true);
      }

      // Populate form state from saved submission or profile
      const sub = (k as any).submission || {};
      const pi = sub.personalInfo || {};
      const addr = sub.address || {};
      const cur = addr.current || {};
      const perm = addr.permanent || {};
      const ci = sub.contactInfo || {};
      const emp = sub.employment || {};
      const gid = sub.governmentId || {};
      const dec = sub.declarations || {};

      setForm({
        firstName: pi.firstName || p.firstName || (p.fullName ? p.fullName.split(' ')[0] : ''),
        middleName: pi.middleName || p.middleName || '',
        hasNoMiddleName: Boolean(pi.hasNoMiddleName),
        lastName: pi.lastName || p.lastName || (p.fullName ? p.fullName.split(' ').slice(1).join(' ') : ''),
        suffix: pi.suffix || '',
        dateOfBirth: pi.dateOfBirth || p.dateOfBirth || '',
        placeOfBirth: pi.placeOfBirth || '',
        gender: pi.gender || p.gender || '',
        civilStatus: pi.civilStatus || p.civilStatus || '',
        nationality: pi.nationality || 'Filipino',
        citizenship: pi.citizenship || 'Filipino',

        currentRegionCode: cur.regionCode || '',
        currentRegionName: cur.region || '',
        currentProvinceCode: cur.provinceCode || '',
        currentProvinceName: cur.province || p.province || '',
        currentCityCode: cur.cityCode || '',
        currentCityName: cur.city || p.city || '',
        currentBarangayCode: cur.barangayCode || '',
        currentBarangayName: cur.barangay || p.barangay || '',
        currentPostalCode: cur.postalCode || p.postalCode || '',
        currentHouseNumber: cur.houseNumber || p.houseUnit || '',
        currentStreet: cur.street || p.street || p.address || '',
        currentSubdivision: cur.subdivision || '',
        currentLandmark: cur.landmark || '',
        currentAdditionalDetails: cur.additionalDetails || '',

        isPermanentSameAsCurrent: addr.isPermanentSameAsCurrent !== false,
        permRegionCode: perm.regionCode || '',
        permRegionName: perm.region || '',
        permProvinceCode: perm.provinceCode || '',
        permProvinceName: perm.province || '',
        permCityCode: perm.cityCode || '',
        permCityName: perm.city || '',
        permBarangayCode: perm.barangayCode || '',
        permBarangayName: perm.barangay || '',
        permPostalCode: perm.postalCode || '',
        permHouseNumber: perm.houseNumber || '',
        permStreet: perm.street || '',
        permSubdivision: perm.subdivision || '',
        permLandmark: perm.landmark || '',
        permAdditionalDetails: perm.additionalDetails || '',

        mobileNumber: ci.mobileNumber || p.phone || '',
        email: ci.email || p.email || '',
        alternativeMobile: ci.alternativeMobile || p.secondaryPhone || '',
        emergencyContactName: ci.emergencyContactName || '',
        emergencyContactRelationship: ci.emergencyContactRelationship || '',

        employmentStatus: emp.employmentStatus || p.employmentStatus || '',
        otherStatusExplanation: emp.otherStatusExplanation || '',
        employerName: emp.employerName || p.employer || '',
        jobPosition: emp.jobPosition || p.occupation || '',
        employmentType: emp.employmentType || 'Regular / Permanent',
        yearsOfEmployment: emp.yearsOfEmployment || 1,
        employerAddress: emp.employerAddress || '',
        businessName: emp.businessName || p.employer || '',
        natureOfBusiness: emp.natureOfBusiness || p.occupation || '',
        yearsInBusiness: emp.yearsInBusiness || 1,
        businessAddress: emp.businessAddress || '',
        monthlyIncome: emp.monthlyIncome || p.monthlyIncome || 0,
        monthlyExpenses: emp.monthlyExpenses || 0,
        sourceOfIncome: emp.sourceOfIncome || '',
        sourceOfFunds: emp.sourceOfFunds || 'Employment',

        idType: gid.idType || 'PHILSYS_ID',
        idTypeName: gid.idTypeName || 'Philippine National ID (PhilSys / PhilID)',
        idNumber: gid.idNumber || '',
        nameOnId: gid.nameOnId || (p.fullName || ''),
        idDateOfBirth: gid.dateOfBirth || pi.dateOfBirth || p.dateOfBirth || '',
        idIssueDate: gid.issueDate || '',
        idExpiryDate: gid.expiryDate || '',

        truthfulInformation: Boolean(dec.truthfulInformation),
        documentOwnership: Boolean(dec.documentOwnership),
        authorizedReview: Boolean(dec.authorizedReview),
        privacyNotice: Boolean(dec.privacyNotice),
        penaltyAcknowledgment: Boolean(dec.penaltyAcknowledgment),
      });

      if ((k as any).currentStep && (k as any).currentStep < STEPS.length) {
        setStep((k as any).currentStep);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load KYC data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Cascade PSGC lookups for Current Address
  useEffect(() => {
    if (form.currentRegionCode) {
      profileService.getProvinces(form.currentRegionCode).then(setCurrentProvinces);
      profileService.getCities(form.currentRegionCode).then(setCurrentCities);
    } else {
      setCurrentProvinces([]);
      setCurrentCities([]);
    }
  }, [form.currentRegionCode]);

  useEffect(() => {
    if (form.currentProvinceCode) {
      profileService.getCities(form.currentRegionCode, form.currentProvinceCode).then(setCurrentCities);
    }
  }, [form.currentProvinceCode]);

  useEffect(() => {
    if (form.currentCityCode) {
      profileService.getBarangays(form.currentCityCode).then(setCurrentBarangays);
      profileService.getPostalCode(form.currentCityCode).then((zip) => {
        if (zip && !form.currentPostalCode) update('currentPostalCode', zip);
      });
    } else {
      setCurrentBarangays([]);
    }
  }, [form.currentCityCode]);

  // Cascade PSGC lookups for Permanent Address
  useEffect(() => {
    if (form.permRegionCode) {
      profileService.getProvinces(form.permRegionCode).then(setPermProvinces);
      profileService.getCities(form.permRegionCode).then(setPermCities);
    } else {
      setPermProvinces([]);
      setPermCities([]);
    }
  }, [form.permRegionCode]);

  useEffect(() => {
    if (form.permProvinceCode) {
      profileService.getCities(form.permRegionCode, form.permProvinceCode).then(setPermCities);
    }
  }, [form.permProvinceCode]);

  useEffect(() => {
    if (form.permCityCode) {
      profileService.getBarangays(form.permCityCode).then(setPermBarangays);
      profileService.getPostalCode(form.permCityCode).then((zip) => {
        if (zip && !form.permPostalCode) update('permPostalCode', zip);
      });
    } else {
      setPermBarangays([]);
    }
  }, [form.permCityCode]);

  // Construct payload from current form state
  const buildPayload = () => ({
    personalInfo: {
      firstName: form.firstName.trim(),
      middleName: (!form.hasNoMiddleName && form.middleName.trim()) ? form.middleName.trim() : '',
      hasNoMiddleName: form.hasNoMiddleName,
      lastName: form.lastName.trim(),
      suffix: form.suffix.trim(),
      dateOfBirth: form.dateOfBirth,
      placeOfBirth: form.placeOfBirth.trim(),
      gender: form.gender,
      civilStatus: form.civilStatus,
      nationality: form.nationality.trim() || 'Filipino',
      citizenship: form.citizenship.trim() || 'Filipino',
    },
    address: {
      current: {
        region: form.currentRegionName,
        regionCode: form.currentRegionCode,
        province: form.currentProvinceName,
        provinceCode: form.currentProvinceCode,
        city: form.currentCityName,
        cityCode: form.currentCityCode,
        barangay: form.currentBarangayName,
        barangayCode: form.currentBarangayCode,
        postalCode: form.currentPostalCode,
        houseNumber: form.currentHouseNumber.trim(),
        street: form.currentStreet.trim(),
        subdivision: form.currentSubdivision.trim(),
        landmark: form.currentLandmark.trim(),
        additionalDetails: form.currentAdditionalDetails.trim(),
      },
      isPermanentSameAsCurrent: form.isPermanentSameAsCurrent,
      permanent: form.isPermanentSameAsCurrent
        ? null
        : {
            region: form.permRegionName,
            regionCode: form.permRegionCode,
            province: form.permProvinceName,
            provinceCode: form.permProvinceCode,
            city: form.permCityName,
            cityCode: form.permCityCode,
            barangay: form.permBarangayName,
            barangayCode: form.permBarangayCode,
            postalCode: form.permPostalCode,
            houseNumber: form.permHouseNumber.trim(),
            street: form.permStreet.trim(),
            subdivision: form.permSubdivision.trim(),
            landmark: form.permLandmark.trim(),
            additionalDetails: form.permAdditionalDetails.trim(),
          },
    },
    contactInfo: {
      mobileNumber: form.mobileNumber.trim(),
      mobileVerified: true,
      email: form.email.trim(),
      emailVerified: Boolean(kyc?.isVerified),
      alternativeMobile: form.alternativeMobile.trim(),
      emergencyContactName: form.emergencyContactName.trim(),
      emergencyContactRelationship: form.emergencyContactRelationship.trim(),
    },
    employment: {
      employmentStatus: form.employmentStatus,
      otherStatusExplanation: form.otherStatusExplanation.trim(),
      employerName: form.employerName.trim(),
      jobPosition: form.jobPosition.trim(),
      employmentType: form.employmentType,
      yearsOfEmployment: form.yearsOfEmployment,
      employerAddress: form.employerAddress.trim(),
      businessName: form.businessName.trim(),
      natureOfBusiness: form.natureOfBusiness.trim(),
      yearsInBusiness: form.yearsInBusiness,
      businessAddress: form.businessAddress.trim(),
      monthlyIncome: Number(form.monthlyIncome) || 0,
      monthlyExpenses: Number(form.monthlyExpenses) || 0,
      sourceOfIncome: form.sourceOfIncome,
      sourceOfFunds: form.sourceOfFunds,
    },
    governmentId: {
      idType: form.idType,
      idTypeName: GOV_ID_TYPES.find((g) => g.code === form.idType)?.label || form.idType,
      idNumber: form.idNumber.trim(),
      nameOnId: form.nameOnId.trim(),
      dateOfBirth: form.idDateOfBirth,
      issueDate: form.idIssueDate,
      expiryDate: form.idExpiryDate,
    },
    declarations: {
      truthfulInformation: form.truthfulInformation,
      documentOwnership: form.documentOwnership,
      authorizedReview: form.authorizedReview,
      privacyNotice: form.privacyNotice,
      penaltyAcknowledgment: form.penaltyAcknowledgment,
    },
    currentStep: step,
  });

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await profileService.saveDraft(buildPayload());
      toast.success('KYC progress saved successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save progress.');
    } finally {
      setSaving(false);
    }
  };

  const hasUploadedDoc = (type: string) => {
    return documents.some(
      (d: any) =>
        (d.type === type ||
          (type === 'GOVERNMENT_ID' && ['VALID_ID', 'ID_FRONT', 'GOVERNMENT_ID'].includes(d.type)) ||
          (type === 'SELFIE_WITH_ID' && ['SELFIE', 'PHOTO_2X2', 'SELFIE_WITH_ID'].includes(d.type))) &&
        (d.submitted || d.fileUrl || d.fileName)
    );
  };

  const canContinue = () => {
    if (step === 0) {
      // Step 1: Personal Info
      return (
        form.firstName.trim().length >= 2 &&
        form.lastName.trim().length >= 2 &&
        form.dateOfBirth &&
        form.placeOfBirth.trim() &&
        form.gender &&
        form.civilStatus &&
        form.nationality.trim()
      );
    }
    if (step === 1) {
      // Step 2: Address
      const curOk =
        (form.currentRegionCode || form.currentRegionName) &&
        (form.currentCityCode || form.currentCityName) &&
        (form.currentBarangayCode || form.currentBarangayName) &&
        form.currentStreet.trim() &&
        form.currentPostalCode.trim();
      if (!curOk) return false;
      if (!form.isPermanentSameAsCurrent) {
        return (
          (form.permRegionCode || form.permRegionName) &&
          (form.permCityCode || form.permCityName) &&
          (form.permBarangayCode || form.permBarangayName) &&
          form.permStreet.trim() &&
          form.permPostalCode.trim()
        );
      }
      return true;
    }
    if (step === 2) {
      // Step 3: Contact Info
      return form.mobileNumber.trim().length >= 10;
    }
    if (step === 3) {
      // Step 4: Employment & Financials
      if (!form.employmentStatus) return false;
      if (form.employmentStatus === 'Other' && !form.otherStatusExplanation.trim()) return false;
      const isEmp = ['Employed', 'Private Employee', 'Government Employee'].includes(form.employmentStatus);
      if (isEmp && !form.employerName.trim()) return false;
      const isBiz = ['Self-Employed', 'Business Owner'].includes(form.employmentStatus);
      if (isBiz && !form.businessName.trim()) return false;
      return form.monthlyIncome >= 0 && form.monthlyExpenses >= 0 && Boolean(form.sourceOfIncome);
    }
    if (step === 4) {
      // Step 5: Government ID
      return form.idType && form.idNumber.trim() && form.nameOnId.trim();
    }
    if (step === 5) {
      // Step 6: Documents
      return (
        hasUploadedDoc('GOVERNMENT_ID') &&
        hasUploadedDoc('PROOF_OF_ADDRESS') &&
        hasUploadedDoc('PROOF_OF_INCOME') &&
        hasUploadedDoc('SELFIE_WITH_ID')
      );
    }
    if (step === 6) {
      // Step 7: Review & Declarations
      return (
        form.truthfulInformation &&
        form.documentOwnership &&
        form.authorizedReview &&
        form.privacyNotice &&
        form.penaltyAcknowledgment
      );
    }
    return true;
  };

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      // Auto-save draft on step progression
      profileService.saveDraft({ ...buildPayload(), currentStep: step + 1 }).catch(() => {});
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await profileService.submitKyc(buildPayload());
      setSubmitted(true);
      toast.success('KYC application submitted successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Unable to submit KYC. Please ensure all required fields and documents are complete.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (docType: string, docName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.');
      return;
    }

    const reader = new FileReader();
    setUploadingDocType(docType);
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const uploaded = await profileService.uploadKycDocument({
          documentType: docType,
          documentName: docName,
          fileName: file.name,
          imageBase64: base64,
          mime: file.type,
        });

        setDocuments((prev) => {
          const filtered = prev.filter((d: any) => d.type !== docType);
          return [
            ...filtered,
            {
              id: uploaded?.id || `DOC-${Date.now()}`,
              type: docType,
              name: docName,
              submitted: true,
              status: 'UPLOADED',
              fileName: file.name,
              fileUrl: uploaded?.fileUrl,
            },
          ];
        });

        toast.success(`"${docName}" uploaded successfully.`);
      } catch (err: any) {
        toast.error(err.message || 'Document upload failed.');
      } finally {
        setUploadingDocType(null);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <LoadingState label="Loading KYC verification dossier…" />;
  if (error || !kyc) return <ErrorState message={error || 'No KYC data.'} onRetry={load} />;

  // 1. APPROVED VIEW
  if (kyc.isVerified || kyc.kycStatus === 'APPROVED' || kyc.kycStatus === 'VERIFIED') {
    return (
      <div id="kyc-approved-view" className="space-y-6 animate-fade-in max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">KYC Verification</h1>
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardBody>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
                <BadgeCheck className="h-9 w-9" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Identity Verified & Approved</h2>
              <p className="max-w-md text-sm text-slate-600">
                Your KYC application has been reviewed and approved by HOSCOMO Cooperative staff. You now have full access to loan applications, savings passbooks, and microfinance services.
              </p>
              {kyc.verifiedAt && (
                <div className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs text-slate-500 border border-emerald-100 shadow-2xs">
                  Verified on <strong>{formatDate(kyc.verifiedAt)}</strong>
                  {kyc.reviewedByName ? ` by ${kyc.reviewedByName}` : ''}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-3 justify-center">
                <Button onClick={() => navigate('/portal/apply')} className="shadow-md shadow-emerald-600/10">
                  <CreditCard className="h-4 w-4 mr-1.5" /> Apply for a Loan
                </Button>
                <Button variant="outline" onClick={() => navigate('/portal')}>
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // 2. SUBMITTED / UNDER REVIEW VIEW
  if (submitted || kyc.kycStatus === 'SUBMITTED' || kyc.kycStatus === 'UNDER_REVIEW') {
    return (
      <div id="kyc-submitted-view" className="space-y-6 animate-fade-in max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">KYC Verification</h1>
        <Card className="border-amber-200 bg-amber-50/30">
          <CardBody>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-8 ring-amber-50/50">
                <Clock className="h-9 w-9" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">KYC Verification Under Review</h2>
              <p className="max-w-md text-sm text-slate-600">
                Your KYC dossier has been submitted and is currently being verified by authorized HOSCOMO Compliance & Loan Officers.
              </p>
              <div className="mt-2 rounded-xl bg-white p-3.5 text-xs text-slate-600 border border-amber-200 text-left max-w-md w-full shadow-2xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Current Status</span>
                  <span className="font-semibold text-amber-700">Under Review</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Submission Reference</span>
                  <span className="font-mono font-medium text-slate-800">{kyc.submissionId || 'KYC-ONLINE'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Target Resolution</span>
                  <span className="text-slate-700">Within 1-2 Business Days</span>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <Button onClick={() => navigate('/portal')}>
                  Back to Member Dashboard
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div id="kyc-flow-container" className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">KYC Verification</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Complete your full member identity verification to unlock loan applications and financial products.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveDraft}
            loading={saving}
            className="text-xs font-semibold"
          >
            <Save className="h-3.5 w-3.5 mr-1" /> Save Progress
          </Button>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-2xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => i <= step && setStep(i)}
              disabled={i > step}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                i === step
                  ? 'bg-slate-900 text-white shadow-xs'
                  : i < step
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
                  : 'text-slate-400 opacity-60 cursor-not-allowed'
              }`}
            >
              {i < step ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">
                  {i + 1}
                </span>
              )}
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">Step {i + 1}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Correction Notice Banner */}
      {kyc.correctionReason && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-amber-900">Correction Required by Reviewer</p>
              <p className="text-xs text-amber-800 leading-relaxed">{kyc.correctionReason}</p>
              <p className="text-[11px] text-amber-700 pt-1">
                Please update the flagged information or replace the requested documents, then submit your changes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Notice Banner */}
      {kyc.rejectionReason && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-rose-900">Previous Application Rejected</p>
              <p className="text-xs text-rose-800 leading-relaxed">{kyc.rejectionReason}</p>
              <p className="text-[11px] text-rose-700 pt-1">
                You may correct your application details and upload fresh supporting documents for re-evaluation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step Form Card */}
      <Card className="shadow-xs">
        <CardBody className="p-6">
          {/* STEP 1: PERSONAL INFORMATION */}
          {step === 0 && (
            <FormSection
              title="1. Personal Information"
              description="Enter your legal name, birth details, and citizenship exactly as shown on your government ID."
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Legal First Name" required>
                  <Input
                    value={form.firstName}
                    onChange={(e) => update('firstName', e.target.value)}
                    placeholder="e.g. Maria Teresa"
                  />
                </Field>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Middle Name</label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.hasNoMiddleName}
                        onChange={(e) => {
                          update('hasNoMiddleName', e.target.checked);
                          if (e.target.checked) update('middleName', '');
                        }}
                        className="h-3 w-3 rounded border-slate-300 text-gold-600 focus:ring-gold-500"
                      />
                      <span>No middle name</span>
                    </label>
                  </div>
                  <Input
                    disabled={form.hasNoMiddleName}
                    value={form.middleName}
                    onChange={(e) => update('middleName', e.target.value)}
                    placeholder={form.hasNoMiddleName ? 'None' : 'e.g. Reyes'}
                  />
                </div>

                <Field label="Legal Last Name" required>
                  <Input
                    value={form.lastName}
                    onChange={(e) => update('lastName', e.target.value)}
                    placeholder="e.g. Santos"
                  />
                </Field>

                <Field label="Suffix (Optional)">
                  <Select value={form.suffix} onChange={(e) => update('suffix', e.target.value)}>
                    {SUFFIXES.map((s) => (
                      <option key={s} value={s}>
                        {s || 'None'}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Date of Birth" required>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => update('dateOfBirth', e.target.value)}
                  />
                </Field>

                <Field label="Place of Birth" required>
                  <Input
                    value={form.placeOfBirth}
                    onChange={(e) => update('placeOfBirth', e.target.value)}
                    placeholder="City / Municipality, Province"
                  />
                </Field>

                <Field label="Sex / Gender" required>
                  <Select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                    <option value="">Select gender…</option>
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Civil Status" required>
                  <Select value={form.civilStatus} onChange={(e) => update('civilStatus', e.target.value)}>
                    <option value="">Select status…</option>
                    {CIVIL_STATUSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Nationality" required>
                  <Input
                    value={form.nationality}
                    onChange={(e) => update('nationality', e.target.value)}
                    placeholder="Filipino"
                  />
                </Field>
              </div>
            </FormSection>
          )}

          {/* STEP 2: COMPLETE PHILIPPINE ADDRESS */}
          {step === 1 && (
            <div className="space-y-6">
              <FormSection
                title="2. Current Residential Address"
                description="Select your Philippine region, province, city/municipality, and barangay. Proof-of-address documents must reflect this."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Region" required>
                    <Select
                      value={form.currentRegionCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const name = regions.find((r) => r.code === code)?.name || '';
                        update('currentRegionCode', code);
                        update('currentRegionName', name);
                        update('currentProvinceCode', '');
                        update('currentProvinceName', '');
                        update('currentCityCode', '');
                        update('currentCityName', '');
                        update('currentBarangayCode', '');
                        update('currentBarangayName', '');
                      }}
                    >
                      <option value="">Select region…</option>
                      {regions.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {currentProvinces.length > 0 && (
                    <Field label="Province" required>
                      <Select
                        value={form.currentProvinceCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          const name = currentProvinces.find((p) => p.code === code)?.name || '';
                          update('currentProvinceCode', code);
                          update('currentProvinceName', name);
                          update('currentCityCode', '');
                          update('currentCityName', '');
                          update('currentBarangayCode', '');
                          update('currentBarangayName', '');
                        }}
                      >
                        <option value="">Select province…</option>
                        {currentProvinces.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}

                  <Field label="City / Municipality" required>
                    <Select
                      value={form.currentCityCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const name = currentCities.find((c) => c.code === code)?.name || '';
                        update('currentCityCode', code);
                        update('currentCityName', name);
                        update('currentBarangayCode', '');
                        update('currentBarangayName', '');
                      }}
                    >
                      <option value="">Select city/municipality…</option>
                      {currentCities.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Barangay" required>
                    <Select
                      value={form.currentBarangayCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const name = currentBarangays.find((b) => b.code === code)?.name || '';
                        update('currentBarangayCode', code);
                        update('currentBarangayName', name);
                        profileService.getPostalCode(form.currentCityCode, code).then((zip) => {
                          if (zip) update('currentPostalCode', zip);
                        });
                      }}
                    >
                      <option value="">Select barangay…</option>
                      {currentBarangays.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="ZIP / Postal Code" required>
                    <Input
                      value={form.currentPostalCode}
                      onChange={(e) => update('currentPostalCode', e.target.value)}
                      placeholder="e.g. 6500"
                    />
                  </Field>

                  <Field label="House / Unit / Bldg Number" required>
                    <Input
                      value={form.currentHouseNumber}
                      onChange={(e) => update('currentHouseNumber', e.target.value)}
                      placeholder="e.g. Blk 12 Lot 4 / #45"
                    />
                  </Field>

                  <Field label="Street Name" required>
                    <Input
                      value={form.currentStreet}
                      onChange={(e) => update('currentStreet', e.target.value)}
                      placeholder="e.g. Rizal Street"
                    />
                  </Field>

                  <Field label="Subdivision / Village (Optional)">
                    <Input
                      value={form.currentSubdivision}
                      onChange={(e) => update('currentSubdivision', e.target.value)}
                      placeholder="e.g. San Pedro Village"
                    />
                  </Field>

                  <Field label="Landmark (Optional)">
                    <Input
                      value={form.currentLandmark}
                      onChange={(e) => update('currentLandmark', e.target.value)}
                      placeholder="e.g. Near Barangay Hall"
                    />
                  </Field>
                </div>
              </FormSection>

              {/* Permanent Address Toggle */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Permanent Address</h4>
                    <p className="text-xs text-slate-500">Is your permanent address the same as your current address?</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => update('isPermanentSameAsCurrent', true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        form.isPermanentSameAsCurrent
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Yes (Same)
                    </button>
                    <button
                      type="button"
                      onClick={() => update('isPermanentSameAsCurrent', false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        !form.isPermanentSameAsCurrent
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      No (Different)
                    </button>
                  </div>
                </div>

                {!form.isPermanentSameAsCurrent && (
                  <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Permanent Region" required>
                      <Select
                        value={form.permRegionCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          const name = regions.find((r) => r.code === code)?.name || '';
                          update('permRegionCode', code);
                          update('permRegionName', name);
                          update('permProvinceCode', '');
                          update('permProvinceName', '');
                          update('permCityCode', '');
                          update('permCityName', '');
                          update('permBarangayCode', '');
                          update('permBarangayName', '');
                        }}
                      >
                        <option value="">Select region…</option>
                        {regions.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.name}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    {permProvinces.length > 0 && (
                      <Field label="Permanent Province" required>
                        <Select
                          value={form.permProvinceCode}
                          onChange={(e) => {
                            const code = e.target.value;
                            const name = permProvinces.find((p) => p.code === code)?.name || '';
                            update('permProvinceCode', code);
                            update('permProvinceName', name);
                            update('permCityCode', '');
                            update('permCityName', '');
                            update('permBarangayCode', '');
                            update('permBarangayName', '');
                          }}
                        >
                          <option value="">Select province…</option>
                          {permProvinces.map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    )}

                    <Field label="Permanent City / Municipality" required>
                      <Select
                        value={form.permCityCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          const name = permCities.find((c) => c.code === code)?.name || '';
                          update('permCityCode', code);
                          update('permCityName', name);
                          update('permBarangayCode', '');
                          update('permBarangayName', '');
                        }}
                      >
                        <option value="">Select city/municipality…</option>
                        {permCities.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Permanent Barangay" required>
                      <Select
                        value={form.permBarangayCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          const name = permBarangays.find((b) => b.code === code)?.name || '';
                          update('permBarangayCode', code);
                          update('permBarangayName', name);
                          profileService.getPostalCode(form.permCityCode, code).then((zip) => {
                            if (zip) update('permPostalCode', zip);
                          });
                        }}
                      >
                        <option value="">Select barangay…</option>
                        {permBarangays.map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.name}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="ZIP Code" required>
                      <Input
                        value={form.permPostalCode}
                        onChange={(e) => update('permPostalCode', e.target.value)}
                        placeholder="e.g. 1000"
                      />
                    </Field>

                    <Field label="House / Street details" required>
                      <Input
                        value={form.permStreet}
                        onChange={(e) => update('permStreet', e.target.value)}
                        placeholder="House / Bldg #, Street"
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: CONTACT INFORMATION */}
          {step === 2 && (
            <FormSection
              title="3. Contact Information"
              description="Verify your primary contact channels and provide emergency contact references."
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Registered Mobile Number" required>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      disabled
                      value={form.mobileNumber}
                      className="pl-9 bg-slate-100 cursor-not-allowed font-medium text-slate-800"
                    />
                  </div>
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                    <CheckCircle2 className="h-3 w-3" /> Registered mobile number
                  </span>
                </Field>

                <Field label="Registered Email Address">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      disabled={Boolean(form.email)}
                      value={form.email || 'None on file'}
                      onChange={(e) => update('email', e.target.value)}
                      className="pl-9 bg-slate-100"
                    />
                  </div>
                </Field>

                <Field label="Alternative Contact Number (Optional)">
                  <Input
                    value={form.alternativeMobile}
                    onChange={(e) => update('alternativeMobile', e.target.value)}
                    placeholder="e.g. 0918 123 4567"
                  />
                </Field>

                <Field label="Emergency Contact Person">
                  <Input
                    value={form.emergencyContactName}
                    onChange={(e) => update('emergencyContactName', e.target.value)}
                    placeholder="e.g. Juan Santos (Spouse / Parent)"
                  />
                </Field>
              </div>
            </FormSection>
          )}

          {/* STEP 4: EMPLOYMENT AND FINANCIAL INFORMATION */}
          {step === 3 && (
            <FormSection
              title="4. Employment & Financial Information"
              description="Provide your source of livelihood and financial capacity for cooperative assessment."
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Employment Status" required>
                  <Select
                    value={form.employmentStatus}
                    onChange={(e) => update('employmentStatus', e.target.value)}
                  >
                    <option value="">Select employment status…</option>
                    {EMPLOYMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>

                {form.employmentStatus === 'Other' && (
                  <Field label="Please explain employment status" required>
                    <Input
                      value={form.otherStatusExplanation}
                      onChange={(e) => update('otherStatusExplanation', e.target.value)}
                      placeholder="Describe your livelihood"
                    />
                  </Field>
                )}

                {['Employed', 'Private Employee', 'Government Employee'].includes(form.employmentStatus) && (
                  <>
                    <Field label="Employer / Company Name" required>
                      <Input
                        value={form.employerName}
                        onChange={(e) => update('employerName', e.target.value)}
                        placeholder="Company name"
                      />
                    </Field>
                    <Field label="Job Position / Title" required>
                      <Input
                        value={form.jobPosition}
                        onChange={(e) => update('jobPosition', e.target.value)}
                        placeholder="e.g. Admin Specialist"
                      />
                    </Field>
                    <Field label="Employment Type">
                      <Select
                        value={form.employmentType}
                        onChange={(e) => update('employmentType', e.target.value)}
                      >
                        {EMPLOYMENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </>
                )}

                {['Self-Employed', 'Business Owner'].includes(form.employmentStatus) && (
                  <>
                    <Field label="Business Name" required>
                      <Input
                        value={form.businessName}
                        onChange={(e) => update('businessName', e.target.value)}
                        placeholder="Store or trade name"
                      />
                    </Field>
                    <Field label="Nature of Business" required>
                      <Input
                        value={form.natureOfBusiness}
                        onChange={(e) => update('natureOfBusiness', e.target.value)}
                        placeholder="e.g. Retail / Sari-Sari / Agriculture"
                      />
                    </Field>
                  </>
                )}

                <Field label="Monthly Gross Income (₱)" required>
                  <Input
                    type="number"
                    min={0}
                    value={form.monthlyIncome || ''}
                    onChange={(e) => update('monthlyIncome', Math.max(0, Number(e.target.value) || 0))}
                    placeholder="e.g. 25000"
                  />
                </Field>

                <Field label="Estimated Monthly Expenses (₱)" required>
                  <Input
                    type="number"
                    min={0}
                    value={form.monthlyExpenses || ''}
                    onChange={(e) => update('monthlyExpenses', Math.max(0, Number(e.target.value) || 0))}
                    placeholder="e.g. 15000"
                  />
                </Field>

                <Field label="Primary Source of Income" required>
                  <Select
                    value={form.sourceOfIncome}
                    onChange={(e) => update('sourceOfIncome', e.target.value)}
                  >
                    <option value="">Select source of income…</option>
                    {SOURCES_OF_INCOME.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Source of Funds">
                  <Select
                    value={form.sourceOfFunds}
                    onChange={(e) => update('sourceOfFunds', e.target.value)}
                  >
                    {SOURCES_OF_FUNDS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </FormSection>
          )}

          {/* STEP 5: GOVERNMENT ID */}
          {step === 4 && (
            <FormSection
              title="5. Government Identification Details"
              description="Provide the details of the primary government-issued ID you will present."
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Select Government ID Type" required>
                  <Select
                    value={form.idType}
                    onChange={(e) => {
                      const t = e.target.value;
                      update('idType', t);
                      update('idTypeName', GOV_ID_TYPES.find((g) => g.code === t)?.label || t);
                    }}
                  >
                    {GOV_ID_TYPES.map((g) => (
                      <option key={g.code} value={g.code}>
                        {g.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="ID Number"
                  required
                  error={
                    form.idNumber && form.idNumber.length < 4
                      ? 'Please enter a complete ID number.'
                      : undefined
                  }
                >
                  <Input
                    value={form.idNumber}
                    onChange={(e) => update('idNumber', e.target.value)}
                    placeholder={GOV_ID_TYPES.find((g) => g.code === form.idType)?.hint || 'Enter ID number'}
                  />
                </Field>

                <Field label="Full Name as Printed on ID" required>
                  <Input
                    value={form.nameOnId}
                    onChange={(e) => update('nameOnId', e.target.value)}
                    placeholder="e.g. Maria Teresa Reyes Santos"
                  />
                </Field>

                <Field label="Date of Birth on ID">
                  <Input
                    type="date"
                    value={form.idDateOfBirth || form.dateOfBirth}
                    onChange={(e) => update('idDateOfBirth', e.target.value)}
                  />
                </Field>

                <Field label="Issue Date (If Applicable)">
                  <Input
                    type="date"
                    value={form.idIssueDate}
                    onChange={(e) => update('idIssueDate', e.target.value)}
                  />
                </Field>

                <Field label="Expiration Date (If Applicable)">
                  <Input
                    type="date"
                    value={form.idExpiryDate}
                    onChange={(e) => update('idExpiryDate', e.target.value)}
                  />
                </Field>
              </div>
            </FormSection>
          )}

          {/* STEP 6: DOCUMENT UPLOAD */}
          {step === 5 && (
            <FormSection
              title="6. Document Uploads"
              description="Attach clear photographs or scans of your required identification, proof of address, proof of income, and selfie."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  {
                    type: 'GOVERNMENT_ID',
                    name: 'Government-Issued Photo ID',
                    desc: 'PhilSys, Passport, Driver License, or UMID with clear photo and signature.',
                    icon: CreditCard,
                  },
                  {
                    type: 'PROOF_OF_ADDRESS',
                    name: 'Proof of Address',
                    desc: 'Barangay clearance, electricity/water bill dated within last 3 months.',
                    icon: Home,
                  },
                  {
                    type: 'PROOF_OF_INCOME',
                    name: 'Proof of Income',
                    desc: 'Payslip, Certificate of Employment, ITR, or Business Permit.',
                    icon: FileText,
                  },
                  {
                    type: 'SELFIE_WITH_ID',
                    name: 'Selfie Holding Government ID',
                    desc: 'Clear, well-lit photo of your face holding your ID beside you.',
                    icon: Camera,
                  },
                ].map((item) => {
                  const isUploaded = hasUploadedDoc(item.type);
                  const matched = documents.find((d: any) => d.type === item.type);
                  const isCurrentlyUploading = uploadingDocType === item.type;
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.type}
                      className={`rounded-2xl border p-4 transition ${
                        isUploaded
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                              isUploaded
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{item.name}</h4>
                            <p className="text-xs text-slate-500 line-clamp-2">{item.desc}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          {isUploaded ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded ({matched?.fileName || 'file on file'})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full">
                              <AlertCircle className="h-3.5 w-3.5" /> Required
                            </span>
                          )}
                        </div>

                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="hidden"
                            disabled={isCurrentlyUploading}
                            onChange={(e) => handleFileUpload(item.type, item.name, e)}
                          />
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                              isCurrentlyUploading
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : isUploaded
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-2xs'
                            }`}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {isCurrentlyUploading ? 'Uploading…' : isUploaded ? 'Replace' : 'Upload File'}
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </FormSection>
          )}

          {/* STEP 7: REVIEW & REQUIRED DECLARATIONS */}
          {step === 6 && (
            <div className="space-y-6">
              <FormSection
                title="7. Review Information & Mandatory Declarations"
                description="Verify all details below before final submission. Click Edit on any section to make corrections."
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Personal Summary */}
                  <Card className="border-slate-200">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between bg-slate-50/50">
                      <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5" /> Personal Information
                      </CardTitle>
                      <button
                        type="button"
                        onClick={() => setStep(0)}
                        className="text-xs font-semibold text-gold-700 hover:text-gold-800 underline"
                      >
                        Edit
                      </button>
                    </CardHeader>
                    <CardBody className="p-4 text-xs space-y-2">
                      <InfoRow
                        label="Full Name"
                        value={`${form.firstName} ${form.middleName} ${form.lastName} ${form.suffix}`.replace(/\s+/g, ' ').trim()}
                      />
                      <InfoRow label="Date of Birth" value={form.dateOfBirth ? formatDate(form.dateOfBirth) : '—'} />
                      <InfoRow label="Place of Birth" value={form.placeOfBirth || '—'} />
                      <InfoRow label="Gender" value={form.gender || '—'} />
                      <InfoRow label="Civil Status" value={form.civilStatus || '—'} />
                      <InfoRow label="Nationality" value={form.nationality || '—'} />
                    </CardBody>
                  </Card>

                  {/* Address Summary */}
                  <Card className="border-slate-200">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between bg-slate-50/50">
                      <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Home className="h-3.5 w-3.5" /> Addresses
                      </CardTitle>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-xs font-semibold text-gold-700 hover:text-gold-800 underline"
                      >
                        Edit
                      </button>
                    </CardHeader>
                    <CardBody className="p-4 text-xs space-y-2">
                      <InfoRow
                        label="Current Address"
                        value={[
                          form.currentHouseNumber,
                          form.currentStreet,
                          form.currentSubdivision,
                          form.currentBarangayName ? `Brgy. ${form.currentBarangayName}` : '',
                          form.currentCityName,
                          form.currentProvinceName,
                          form.currentPostalCode,
                        ].filter(Boolean).join(', ') || '—'}
                      />
                      <InfoRow
                        label="Permanent Address"
                        value={
                          form.isPermanentSameAsCurrent
                            ? 'Same as Current Address'
                            : [
                                form.permHouseNumber,
                                form.permStreet,
                                form.permBarangayName ? `Brgy. ${form.permBarangayName}` : '',
                                form.permCityName,
                                form.permProvinceName,
                                form.permPostalCode,
                              ].filter(Boolean).join(', ') || '—'
                        }
                      />
                    </CardBody>
                  </Card>

                  {/* Employment & Financials Summary */}
                  <Card className="border-slate-200">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between bg-slate-50/50">
                      <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" /> Employment & Financials
                      </CardTitle>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="text-xs font-semibold text-gold-700 hover:text-gold-800 underline"
                      >
                        Edit
                      </button>
                    </CardHeader>
                    <CardBody className="p-4 text-xs space-y-2">
                      <InfoRow label="Employment Status" value={form.employmentStatus || '—'} />
                      <InfoRow label="Employer / Business" value={form.employerName || form.businessName || '—'} />
                      <InfoRow label="Monthly Income" value={`₱${(form.monthlyIncome || 0).toLocaleString()}`} />
                      <InfoRow label="Monthly Expenses" value={`₱${(form.monthlyExpenses || 0).toLocaleString()}`} />
                      <InfoRow label="Source of Income" value={form.sourceOfIncome || '—'} />
                    </CardBody>
                  </Card>

                  {/* Government ID & Documents Summary */}
                  <Card className="border-slate-200">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between bg-slate-50/50">
                      <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" /> ID & Attached Documents
                      </CardTitle>
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="text-xs font-semibold text-gold-700 hover:text-gold-800 underline"
                      >
                        Edit
                      </button>
                    </CardHeader>
                    <CardBody className="p-4 text-xs space-y-2">
                      <InfoRow label="ID Type" value={GOV_ID_TYPES.find((g) => g.code === form.idType)?.label || form.idType} />
                      <InfoRow label="ID Number" value={form.idNumber || '—'} />
                      <InfoRow label="Name on ID" value={form.nameOnId || '—'} />
                      <SectionDivider />
                      <InfoRow label="Government ID Photo" value={hasUploadedDoc('GOVERNMENT_ID') ? '✓ Uploaded' : '❌ Missing'} />
                      <InfoRow label="Proof of Address" value={hasUploadedDoc('PROOF_OF_ADDRESS') ? '✓ Uploaded' : '❌ Missing'} />
                      <InfoRow label="Proof of Income" value={hasUploadedDoc('PROOF_OF_INCOME') ? '✓ Uploaded' : '❌ Missing'} />
                      <InfoRow label="Selfie with ID" value={hasUploadedDoc('SELFIE_WITH_ID') ? '✓ Uploaded' : '❌ Missing'} />
                    </CardBody>
                  </Card>
                </div>

                {/* Mandatory Declarations (Unchecked by default) */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-3.5">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Applicant Declarations & Statutory Consent
                  </h4>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.truthfulInformation}
                      onChange={(e) => update('truthfulInformation', e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold-600 focus:ring-gold-500"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      I declare that the information provided in this application is true, complete, and accurate, and that I have not withheld or falsified any material facts.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.documentOwnership}
                      onChange={(e) => update('documentOwnership', e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold-600 focus:ring-gold-500"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      I declare that every document submitted is authentic, valid, and legitimately issued to me.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.authorizedReview}
                      onChange={(e) => update('authorizedReview', e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold-600 focus:ring-gold-500"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      I authorize HOSCOMO Microfinance Cooperative and its authorized personnel to inspect, verify, and review the submitted information and documents with relevant authorities.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.privacyNotice}
                      onChange={(e) => update('privacyNotice', e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold-600 focus:ring-gold-500"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      I have read and agree to the Data Privacy Notice in compliance with Republic Act No. 10173 (Data Privacy Act of 2012), consenting to data processing for membership and credit assessment.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.penaltyAcknowledgment}
                      onChange={(e) => update('penaltyAcknowledgment', e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gold-600 focus:ring-gold-500"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      I understand that providing incorrect, forged, or misleading information will result in immediate rejection, account suspension, and possible legal action.
                    </span>
                  </label>
                </div>
              </FormSection>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => (step > 0 ? setStep(step - 1) : navigate('/portal'))}
          className="text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> {step === 0 ? 'Dashboard' : 'Previous Step'}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            onClick={handleNext}
            disabled={!canContinue()}
            className="text-xs font-semibold shadow-md shadow-slate-900/10"
          >
            Continue to Step {step + 2} <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canContinue()}
            loading={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/20"
          >
            <ShieldCheck className="h-4 w-4 mr-1.5" /> Submit KYC for Verification
          </Button>
        )}
      </div>
    </div>
  );
};

export default KycPage;