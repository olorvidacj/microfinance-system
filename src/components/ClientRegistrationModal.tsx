import React, { useState } from 'react';
import {
  X,
  UserPlus,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileCheck,
  User,
  CreditCard,
  Calendar,
  Layers,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Info,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { Borrower, ClientStatus, KycDocumentType, KycStatus } from '../types';
import { formatCurrency } from '../utils/loanMath';

interface ClientRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientRegistered?: (client: Borrower) => void;
}

export const ClientRegistrationModal: React.FC<ClientRegistrationModalProps> = ({
  isOpen,
  onClose,
  onClientRegistered,
}) => {
  const { branches, activeBranchId, currentUser, registerClient } = useLoan();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Auto-generate client ID preview
  const currentYear = new Date().getFullYear();
  const defaultBranch = activeBranchId === 'all' ? (branches[0]?.id || 'br-main') : activeBranchId;

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Personal Info & Identity
    fullName: '',
    idNumber: '',
    idType: 'Philippine National ID (PhilSys)',
    dateOfBirth: '1992-06-15',
    placeOfBirth: 'San Jose del Monte, Bulacan',
    gender: 'Female' as 'Male' | 'Female' | 'Other',
    civilStatus: 'Single' as 'Single' | 'Married' | 'Widowed' | 'Separated' | 'Divorced',
    nationality: 'Filipino',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',

    // Step 2: Contact & Residential Address
    phone: '0917-842-1190',
    secondaryPhone: '',
    email: '',
    facebookAccount: '',
    address: '14 San Pedro St, Poblacion',
    barangay: 'Poblacion',
    city: 'San Jose del Monte',
    province: 'Bulacan',
    postalCode: '3023',
    homeOwnership: 'Owned' as 'Owned' | 'Rented' | 'Living with Parents/Family' | 'Mortgaged',
    yearsAtAddress: 5,
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: 'Spouse',

    // Step 3: Employment / Business Information
    branchId: defaultBranch,
    employmentStatus: 'Business Owner' as 'Employed' | 'Self-Employed' | 'Business Owner' | 'Contractor' | 'Farmer' | 'OFW / Overseas Worker' | 'Retired',
    employerOrBusiness: '',
    businessNature: 'Retail & Consumer Goods',
    occupation: 'Store Owner / Proprietor',
    yearsInBusinessOrJob: 4,
    workAddress: 'San Jose Public Market, Bulacan',
    workPhone: '',
    monthlyIncome: 45000,
    monthlyExpenses: 20000,

    // Step 4: KYC & Initial Setup
    clientStatus: 'Pending' as ClientStatus,
    kycStatus: 'PENDING' as KycStatus,
    initialSavingsDeposit: 2000,
    initialShareCapital: 2000,
    notes: 'Registered via authorized staff portal.',
  });

  // Attached KYC Documents
  const [kycDocs, setKycDocs] = useState<
    Array<{
      id: string;
      docType: KycDocumentType;
      fileName: string;
      fileSize: string;
      status: 'PENDING' | 'VERIFIED';
    }>
  >([
    {
      id: 'doc-init-1',
      docType: 'Government ID (Primary)',
      fileName: 'Primary_Government_ID_FrontBack.pdf',
      fileSize: '2.4 MB',
      status: 'PENDING',
    },
    {
      id: 'doc-init-2',
      docType: 'Proof of Income / Payslip / ITR',
      fileName: 'Income_Certificate_Business_Log.pdf',
      fileSize: '1.8 MB',
      status: 'PENDING',
    },
  ]);

  const [newDocType, setNewDocType] = useState<KycDocumentType>('Proof of Billing / Residence');
  const [newDocFileName, setNewDocFileName] = useState('');

  if (!isOpen) return null;

  // RBAC check
  const isAuthorized = ['SUPER_ADMIN', 'MANAGER', 'LOAN_PROCESSOR', 'CREDIT_COMMITTEE', 'BOOKKEEPER'].includes(
    currentUser.role
  );

  const handleAddDoc = () => {
    if (!newDocFileName) return;
    setKycDocs((prev) => [
      ...prev,
      {
        id: `doc-${Date.now()}`,
        docType: newDocType,
        fileName: newDocFileName,
        fileSize: `${(Math.random() * 2 + 0.8).toFixed(1)} MB`,
        status: 'PENDING',
      },
    ]);
    setNewDocFileName('');
  };

  const handleRemoveDoc = (id: string) => {
    setKycDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone) {
      alert('Please fill in the required client legal name and contact phone.');
      return;
    }

    let registered: Borrower;
    try {
      registered = registerClient({
        fullName: formData.fullName,
        idNumber: formData.idNumber || 'PH-ID-PENDING',
        idType: formData.idType,
        phone: formData.phone,
        secondaryPhone: formData.secondaryPhone,
        email: formData.email || `${formData.fullName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@client.hoscomo.ph`,
        dateOfBirth: formData.dateOfBirth,
        placeOfBirth: formData.placeOfBirth,
        gender: formData.gender,
        civilStatus: formData.civilStatus,
        nationality: formData.nationality,
        address: formData.address,
        barangay: formData.barangay,
        city: formData.city,
        province: formData.province,
        postalCode: formData.postalCode,
        homeOwnership: formData.homeOwnership,
        yearsAtAddress: Number(formData.yearsAtAddress),
        facebookAccount: formData.facebookAccount,
        branchId: formData.branchId,
        employmentStatus: formData.employmentStatus,
        employerOrBusiness: formData.employerOrBusiness || 'Self-Employed',
        employer: formData.employerOrBusiness || 'Self-Employed',
        businessNature: formData.businessNature,
        occupation: formData.occupation,
        yearsInBusinessOrJob: Number(formData.yearsInBusinessOrJob),
        workAddress: formData.workAddress,
        workPhone: formData.workPhone,
        monthlyIncome: Number(formData.monthlyIncome),
        monthlyExpenses: Number(formData.monthlyExpenses),
        emergencyContactName: formData.emergencyContactName,
        emergencyContactPhone: formData.emergencyContactPhone,
        emergencyContactRelation: formData.emergencyContactRelation,
        creditScore: 680,
        creditTier: 'Good',
        kycStatus: formData.kycStatus,
        memberStatus: formData.clientStatus,
        clientStatus: formData.clientStatus,
        savingsBalance: Number(formData.initialSavingsDeposit) || 0,
        shareCapital: Number(formData.initialShareCapital) || 0,
        avatar: formData.avatar,
        notes: formData.notes,
        kycDocuments: kycDocs.map((d) => ({
          id: d.id,
          docType: d.docType,
          fileName: d.fileName,
          fileSize: d.fileSize,
          uploadedAt: new Date().toISOString().split('T')[0],
          uploadedBy: `${currentUser.name} (${currentUser.title})`,
          status: d.status,
        })),
      });
    } catch (err: any) {
      alert(err.message || 'Unable to register client. Please check for duplicates.');
      return;
    }

    if (onClientRegistered) {
      onClientRegistered(registered);
    }
    onClose();
  };

  const netDisposable = Math.max(0, Number(formData.monthlyIncome) - Number(formData.monthlyExpenses));

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full my-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold shadow-inner">
              <UserPlus className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Client Registration & KYC Enrollment</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  Step {step} of 4
                </span>
              </div>
              <p className="text-xs text-blue-100/80 mt-0.5">
                Authorized staff portal for biometric, demographic, and identity compliance onboarding.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Navigation */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 shrink-0">
          <div className="grid grid-cols-4 gap-2">
            {[
              { num: 1, title: 'Personal Info & ID', desc: 'Demographics & ID' },
              { num: 2, title: 'Contact & Address', desc: 'Residence & Phone' },
              { num: 3, title: 'Employment & Income', desc: 'Business & Capacity' },
              { num: 4, title: 'KYC & Verification', desc: 'Documents & Status' },
            ].map((s) => (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num as any)}
                className={`text-left p-2.5 rounded-xl transition border text-xs flex items-center gap-2.5 ${
                  step === s.num
                    ? 'bg-white border-blue-600 shadow-xs ring-2 ring-blue-600/10 text-blue-900 font-semibold'
                    : step > s.num
                    ? 'bg-blue-50/60 border-blue-200 text-blue-700'
                    : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-100/80'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    step === s.num
                      ? 'bg-blue-600 text-white'
                      : step > s.num
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.num}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <p className="font-semibold truncate text-[11px] leading-tight">{s.title}</p>
                  <p className="text-[10px] text-slate-400 truncate leading-tight">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {!isAuthorized && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <strong>Role Notice:</strong> You are signed in as <strong>{currentUser.name}</strong> ({currentUser.role}). Only authorized loan processors, credit committee members, bookkeepers, and managers can complete KYC approvals.
              </p>
            </div>
          )}

          {/* STEP 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Personal Information & Legal Identification</h3>
                </div>
                <span className="text-[11px] text-slate-400">All information is encrypted under Data Privacy Act</span>
              </div>

              {/* Unique Client ID Banner */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600">Generated Unique Client ID</span>
                  <p className="text-sm font-mono font-bold text-blue-950">
                    CLI-{currentYear}-{String(Math.floor(Math.random() * 800) + 200).padStart(4, '0')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Auto-allocated by System</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Full Legal Name (First, Middle, Last, Suffix) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maria Clara De Los Santos"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary ID Type <span className="text-rose-500">*</span></label>
                  <select
                    value={formData.idType}
                    onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    <option value="Philippine National ID (PhilSys)">Philippine National ID (PhilSys)</option>
                    <option value="SSS / UMID Card">SSS / UMID Card</option>
                    <option value="Driver's License (LTO)">Driver's License (LTO)</option>
                    <option value="PRC Professional License">PRC Professional License</option>
                    <option value="Philippine Passport">Philippine Passport</option>
                    <option value="Voter's ID / Certification">Voter's ID / Certification</option>
                    <option value="TIN Card">TIN Card</option>
                    <option value="Barangay ID">Barangay ID</option>
                    <option value="Postal ID (Digitized)">Postal ID (Digitized)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ID Number / License Code <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9924-1823-9012 or SSS 03-8941294-1"
                    value={formData.idNumber}
                    onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date of Birth <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Place of Birth</label>
                  <input
                    type="text"
                    placeholder="e.g. San Jose del Monte, Bulacan"
                    value={formData.placeOfBirth}
                    onChange={(e) => setFormData({ ...formData, placeOfBirth: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Civil Status</label>
                  <select
                    value={formData.civilStatus}
                    onChange={(e) => setFormData({ ...formData, civilStatus: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                    <option value="Divorced">Divorced</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Branch <span className="text-rose-500">*</span></label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Contact & Residential Address */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Contact Information & Residential Address</h3>
                </div>
                <span className="text-[11px] text-slate-400">Used for field background investigation & notifications</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Primary Mobile Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0917-000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Secondary Phone / Landline</label>
                  <input
                    type="text"
                    placeholder="e.g. (044) 791-0000"
                    value={formData.secondaryPhone}
                    onChange={(e) => setFormData({ ...formData, secondaryPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="client@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Facebook / Messenger Handle</label>
                  <input
                    type="text"
                    placeholder="facebook.com/username"
                    value={formData.facebookAccount}
                    onChange={(e) => setFormData({ ...formData, facebookAccount: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Street Address & House / Building No. <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Block 12 Lot 4, St. Jude Village"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Barangay <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Poblacion / Kaypian"
                    value={formData.barangay}
                    onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City / Municipality <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. San Jose del Monte"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Province</label>
                  <input
                    type="text"
                    placeholder="e.g. Bulacan"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Postal / ZIP Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 3023"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Home Ownership Status</label>
                  <select
                    value={formData.homeOwnership}
                    onChange={(e) => setFormData({ ...formData, homeOwnership: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    <option value="Owned">Owned (Freehold)</option>
                    <option value="Rented">Rented / Leased</option>
                    <option value="Living with Parents/Family">Living with Parents / Relatives</option>
                    <option value="Mortgaged">Mortgaged (Pag-IBIG / Bank)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Years at Current Residence</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.yearsAtAddress}
                    onChange={(e) => setFormData({ ...formData, yearsAtAddress: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                {/* Emergency Contact Block */}
                <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                  <h4 className="font-bold text-slate-800 mb-2">Emergency Contact Person</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Contact Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Roberto Santos"
                        value={formData.emergencyContactName}
                        onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Emergency Phone</label>
                      <input
                        type="text"
                        placeholder="0917-000-0000"
                        value={formData.emergencyContactPhone}
                        onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Relationship</label>
                      <select
                        value={formData.emergencyContactRelation}
                        onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                      >
                        <option value="Spouse">Spouse</option>
                        <option value="Parent">Parent</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Child">Child of Legal Age</option>
                        <option value="Relative / Colleague">Relative / Colleague</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Employment / Business Information */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Employment, Business & Financial Capacity</h3>
                </div>
                <span className="text-[11px] text-slate-400">Used for debt-to-income and microloan limit calculations</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Employment / Livelihood Type <span className="text-rose-500">*</span></label>
                  <select
                    value={formData.employmentStatus}
                    onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    <option value="Business Owner">Micro/Small Business Owner</option>
                    <option value="Self-Employed">Self-Employed / Freelancer</option>
                    <option value="Employed">Formally Employed (Private / Gov)</option>
                    <option value="Farmer">Farmer / Agriculture / Fisherfolk</option>
                    <option value="Contractor">Trade Contractor / Courier</option>
                    <option value="OFW / Overseas Worker">OFW / Overseas Worker</option>
                    <option value="Retired">Retired / Pensioner</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Employer or Business Trade Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Santos General Merchandise & Bakery"
                    value={formData.employerOrBusiness}
                    onChange={(e) => setFormData({ ...formData, employerOrBusiness: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nature of Business / Industry</label>
                  <input
                    type="text"
                    placeholder="e.g. Food Processing & Retail Bakery"
                    value={formData.businessNature}
                    onChange={(e) => setFormData({ ...formData, businessNature: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Position / Occupation Title <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bakery Proprietor / Head Baker"
                    value={formData.occupation}
                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Years in Operation / Job Tenure</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.yearsInBusinessOrJob}
                    onChange={(e) => setFormData({ ...formData, yearsInBusinessOrJob: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Workplace / Business Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Stall #14, San Jose Public Market"
                    value={formData.workAddress}
                    onChange={(e) => setFormData({ ...formData, workAddress: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Gross Monthly Income (₱) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-slate-400">₱</span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1000"
                      value={formData.monthlyIncome}
                      onChange={(e) => setFormData({ ...formData, monthlyIncome: Number(e.target.value) })}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Estimated Monthly Expenses (₱) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-slate-400">₱</span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1000"
                      value={formData.monthlyExpenses}
                      onChange={(e) => setFormData({ ...formData, monthlyExpenses: Number(e.target.value) })}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Financial Capacity Quick Summary */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-3 gap-3 text-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Gross Income</span>
                  <p className="font-bold text-slate-800 text-sm">{formatCurrency(formData.monthlyIncome)}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Monthly Expenses</span>
                  <p className="font-bold text-slate-800 text-sm">{formatCurrency(formData.monthlyExpenses)}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-600">Net Disposable Surplus</span>
                  <p className="font-bold text-emerald-700 text-sm">{formatCurrency(netDisposable)}</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: KYC Documents & Verification Status */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">KYC Verification Documents & Initial Account Status</h3>
                </div>
                <span className="text-[11px] text-slate-400">Upload compliance verification proof</span>
              </div>

              {/* Document List */}
              <div className="space-y-2.5">
                <label className="font-semibold text-slate-700 block">Uploaded KYC Document Files</label>
                {kycDocs.length === 0 ? (
                  <p className="text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-dashed text-center">
                    No documents uploaded yet. Please attach at least 1 primary ID.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {kycDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl flex items-center justify-between transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{doc.docType}</p>
                            <p className="text-[11px] text-slate-400">
                              {doc.fileName} • {doc.fileSize}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            {doc.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDoc(doc.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Document Controls */}
                <div className="p-3.5 bg-blue-50/50 border border-blue-200/80 rounded-xl space-y-3">
                  <span className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    Attach Additional Document File
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value as any)}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs"
                    >
                      <option value="Government ID (Primary)">Government ID (Primary)</option>
                      <option value="Government ID (Secondary)">Government ID (Secondary)</option>
                      <option value="Proof of Income / Payslip / ITR">Proof of Income / Payslip / ITR</option>
                      <option value="Business Permit / DTI">Business Permit / DTI</option>
                      <option value="Proof of Billing / Residence">Proof of Billing / Residence</option>
                      <option value="2x2 ID Photo">2x2 ID Photo</option>
                      <option value="Barangay Clearance">Barangay Clearance</option>
                      <option value="Signature Specimen">Signature Specimen</option>
                      <option value="Other Document">Other Document</option>
                    </select>

                    <input
                      type="text"
                      placeholder="File name (e.g. Meralco_Bill_July.pdf)"
                      value={newDocFileName}
                      onChange={(e) => setNewDocFileName(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs"
                    />

                    <button
                      type="button"
                      onClick={handleAddDoc}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition flex items-center justify-center gap-1.5 text-xs shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Add to Client Files
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Client Account Status</label>
                  <select
                    value={formData.clientStatus}
                    onChange={(e) => setFormData({ ...formData, clientStatus: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900"
                  >
                    <option value="Pending">Pending (Awaiting Document Verification)</option>
                    <option value="Active">Active (Fully Onboarded & Verified)</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">KYC Verification Status</label>
                  <select
                    value={formData.kycStatus}
                    onChange={(e) => setFormData({ ...formData, kycStatus: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900"
                  >
                    <option value="PENDING">Pending Review</option>
                    <option value="VERIFIED">Verified & Approved</option>
                    <option value="CORRECTION_REQUIRED">Correction Requested</option>
                    <option value="NOT_STARTED">Incomplete</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Savings Deposit (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={formData.initialSavingsDeposit}
                    onChange={(e) => setFormData({ ...formData, initialSavingsDeposit: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Share Capital / CBU (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={formData.initialShareCapital}
                    onChange={(e) => setFormData({ ...formData, initialShareCapital: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer with Navigation Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev - 1) as any)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-semibold transition flex items-center gap-1.5 text-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous Step
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-semibold transition text-xs"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !formData.fullName) {
                    alert('Please input the client legal name before proceeding.');
                    return;
                  }
                  if (step === 2 && !formData.phone) {
                    alert('Please input the primary contact phone before proceeding.');
                    return;
                  }
                  setStep((prev) => (prev + 1) as any);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 text-xs shadow-md shadow-blue-600/20"
              >
                Next Step
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center gap-2 text-xs shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                Complete Client Registration
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
