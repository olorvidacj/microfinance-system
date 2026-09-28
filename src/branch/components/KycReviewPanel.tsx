import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck2,
  Home,
  Briefcase,
  UserRound,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  DollarSign,
  Info,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Lock,
  Unlock,
} from 'lucide-react';
import { Modal } from '../../portal/components/ui/Modal';
import { Button } from '../../portal/components/ui/Button';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { LoadingState, ErrorState } from '../../portal/components/ui/States';
import { Field, Select, Textarea, Input } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { kycService } from '../services';
import { KycDossier, KycStructuredDocument } from '../types';

interface KycReviewPanelProps {
  clientId: string | null;
  onClose: () => void;
  onDone?: (status: string) => void;
}

const CHECKLIST_ITEMS = [
  { id: 'name_match', category: 'Identity', label: 'Legal name matches submitted Government ID exactly' },
  { id: 'dob_match', category: 'Identity', label: 'Date of birth and place of birth match Government ID' },
  { id: 'id_valid', category: 'Identity', label: 'Government ID is authentic, unexpired, and clearly legible' },
  { id: 'face_match', category: 'Identity', label: 'Facial features on Government ID match Selfie with ID' },
  { id: 'selfie_clear', category: 'Identity', label: 'Selfie is clear with ID held beside face without glare' },
  { id: 'addr_complete', category: 'Address', label: 'Current residential address is complete with Philippine PSGC data' },
  { id: 'addr_proof', category: 'Address', label: 'Proof of address document is recent (dated within 3 months)' },
  { id: 'addr_match', category: 'Address', label: 'Address on proof matches the declared residential address' },
  { id: 'emp_valid', category: 'Financial', label: 'Employment or business details are reasonable and consistent' },
  { id: 'income_proof', category: 'Financial', label: 'Declared monthly income is supported by submitted income proof' },
  { id: 'capacity_pay', category: 'Financial', label: 'Capacity to pay verified: Monthly income exceeds living expenses' },
  { id: 'funds_source', category: 'Financial', label: 'Legitimate source of funds and income declared' },
  { id: 'consent_signed', category: 'Compliance', label: 'Data Privacy Act (RA 10173) & truthfulness declarations affirmed' },
  { id: 'no_fraud', category: 'Compliance', label: 'No fraud, duplicate account, or blacklist indicators detected' },
];

export const KycReviewPanel: React.FC<KycReviewPanelProps> = ({ clientId, onClose, onDone }) => {
  const toast = useToast();
  const [dossier, setDossier] = useState<KycDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Document viewer modal state
  const [viewingDoc, setViewingDoc] = useState<KycStructuredDocument | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Unmask ID state
  const [unmaskedId, setUnmaskedId] = useState(false);

  // Compliance checklist state
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Decision Modals state
  const [activeDecisionModal, setActiveDecisionModal] = useState<'APPROVE' | 'CORRECTION' | 'REJECT' | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [correctionSection, setCorrectionSection] = useState('Personal Information');
  const [correctionField, setCorrectionField] = useState('Government ID Photo');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // Document individual review statuses
  const [docStatuses, setDocStatuses] = useState<Record<string, { status: string; reason?: string }>>({});

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    setLoading(true);
    setError(null);

    kycService
      .get(clientId)
      .then((res) => {
        if (active) {
          if (!res) {
            setError('Client KYC application record not found.');
          } else {
            setDossier(res);
            // Prepopulate document statuses
            const initialDocMap: Record<string, { status: string; reason?: string }> = {};
            (res.documents || []).forEach((d) => {
              if (d.documentId) {
                initialDocMap[d.documentId] = { status: d.status || 'PENDING', reason: d.rejectionReason || '' };
              }
            });
            setDocStatuses(initialDocMap);
          }
        }
      })
      .catch((err: any) => {
        if (active) setError(err.message || 'Failed to load KYC dossier.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [clientId]);

  if (!clientId) return null;

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const checkAllItems = () => {
    const all: Record<string, boolean> = {};
    CHECKLIST_ITEMS.forEach((item) => {
      all[item.id] = true;
    });
    setCheckedItems(all);
    toast.success('All 14 compliance verification points verified.');
  };

  const openDocumentViewer = (doc: KycStructuredDocument) => {
    setViewingDoc(doc);
    setZoomLevel(1);
    setRotation(0);
  };

  const handleDocStatusChange = (docId: string, status: string, reason?: string) => {
    setDocStatuses((prev) => ({
      ...prev,
      [docId]: { status, reason },
    }));
  };

  const executeDecision = async (decision: 'APPROVED' | 'CORRECTION_REQUIRED' | 'REJECTED') => {
    if (!dossier?.client?.id) return;

    if ((decision === 'CORRECTION_REQUIRED' || decision === 'REJECTED') && !decisionNotes.trim()) {
      toast.error('Please specify a detailed reason or instructions for this decision.');
      return;
    }

    setIsSubmittingDecision(true);
    try {
      const docDecisions = Object.entries(docStatuses).map(([id, val]) => ({
        id,
        status: val.status,
        reason: val.reason,
      }));

      await kycService.review(dossier.client.id, decision, decisionNotes.trim(), {
        correctionDetails:
          decision === 'CORRECTION_REQUIRED'
            ? {
                section: correctionSection,
                field: correctionField,
                reason: decisionNotes.trim(),
              }
            : undefined,
        documentDecisions: docDecisions,
      });

      toast.success(
        decision === 'APPROVED'
          ? 'KYC Verification Approved! Client account is now Active with verified privileges.'
          : decision === 'CORRECTION_REQUIRED'
            ? 'Correction request sent to the client with your instructions.'
            : 'KYC application rejected.'
      );

      setActiveDecisionModal(null);
      onDone?.(decision);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit KYC decision.');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const client = dossier?.client;
  const sub = dossier?.submission;
  const pInfo = sub?.personalInfo || {};
  const cAddr = sub?.address?.current || {};
  const pAddr = sub?.address?.permanent || {};
  const isPermanentSame = sub?.address?.isPermanentSameAsCurrent !== false;
  const contact = sub?.contactInfo || {};
  const emp = sub?.employment || {};
  const govId = sub?.governmentId || {};
  const decl = sub?.declarations || {};

  const maskIdNumber = (num?: string) => {
    if (!num) return '—';
    if (unmaskedId || num.length <= 4) return num;
    return '••••••••' + num.slice(-4);
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="KYC Verification & Client Due Diligence Dossier"
      size="xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Verified Checklist: {Object.values(checkedItems).filter(Boolean).length} / {CHECKLIST_ITEMS.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmittingDecision}>
              Close
            </Button>

            <Button
              variant="outline"
              className="border-rose-300 text-rose-700 hover:bg-rose-50"
              onClick={() => {
                setDecisionNotes(sub?.correctionReason || '');
                setActiveDecisionModal('CORRECTION');
              }}
              disabled={isSubmittingDecision}
            >
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <span>Request Correction</span>
            </Button>

            <Button
              variant="danger"
              onClick={() => {
                setDecisionNotes('');
                setActiveDecisionModal('REJECT');
              }}
              disabled={isSubmittingDecision}
            >
              <XCircle className="h-4 w-4" />
              <span>Reject KYC</span>
            </Button>

            <Button
              variant="brand"
              onClick={() => setActiveDecisionModal('APPROVE')}
              disabled={isSubmittingDecision}
              className="bg-emerald-600 hover:bg-emerald-700 shadow-sm text-white"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Approve KYC</span>
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <LoadingState label="Loading client KYC dossier and documents…" />
      ) : error || !dossier || !client ? (
        <ErrorState message={error || 'Unable to display KYC dossier.'} onRetry={() => {}} />
      ) : (
        <div className="max-h-[75vh] space-y-6 overflow-y-auto pr-1">
          {/* 1. Header Banner & Client Summary */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 text-xl font-bold text-amber-300 ring-2 ring-amber-400/40">
                    {(client.fullName || '??').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                    <ShieldCheck className="h-3 w-3" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-white">{client.fullName}</h2>
                    <span className="rounded-full bg-slate-700/80 px-2.5 py-0.5 text-xs font-mono font-medium text-amber-300">
                      {client.borrowerNumber || 'NO CLIENT NO.'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-300">
                    Application Ref: <span className="font-mono text-white">{sub?.id || 'KYC-PENDING'}</span> · Branch:{' '}
                    <span className="text-white">{client.branchId || 'Main Branch'}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Registered: {client.membershipDate || client.joinedDate || '—'} · Submitted:{' '}
                    {sub?.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Not submitted yet'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300">Current KYC Status:</span>
                  <StatusBadge status={sub?.status || client.kycStatus} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300">Account Status:</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                    {client.memberStatus || 'Active'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Alert if correction reason or rejection reason exists */}
          {(sub?.correctionReason || sub?.rejectionReason) && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50/80 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  {sub.correctionReason ? 'Current Correction Request' : 'Rejection Reason'}
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  {sub.correctionReason || sub.rejectionReason}
                </p>
                {sub.reviewedByName && (
                  <p className="mt-1 text-xs text-amber-700">
                    Issued by <span className="font-semibold">{sub.reviewedByName}</span> on{' '}
                    {sub.reviewedAt ? new Date(sub.reviewedAt).toLocaleString() : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 2. Personal Information Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <UserRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">1. Legal Personal Information</h3>
                  <p className="text-xs text-slate-500">Legal identity matching Philippine Civil Registry</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">First Name</p>
                <p className="text-sm font-semibold text-slate-800">{pInfo.firstName || client.firstName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Middle Name</p>
                <p className="text-sm font-semibold text-slate-800">
                  {pInfo.hasNoMiddleName || client.hasNoMiddleName ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">No Middle Name</span>
                  ) : (
                    pInfo.middleName || client.middleName || '—'
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Last Name</p>
                <p className="text-sm font-semibold text-slate-800">{pInfo.lastName || client.lastName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Suffix</p>
                <p className="text-sm font-semibold text-slate-800">{pInfo.suffix || client.suffix || 'None'}</p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Date of Birth</p>
                <p className="text-sm font-semibold text-slate-800">{pInfo.dateOfBirth || client.dateOfBirth || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Place of Birth</p>
                <p className="text-sm font-semibold text-slate-800">{pInfo.placeOfBirth || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Sex / Gender</p>
                <p className="text-sm font-semibold text-slate-800">{pInfo.gender || client.gender || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Civil Status</p>
                <p className="text-sm font-semibold text-slate-800">{pInfo.civilStatus || client.civilStatus || '—'}</p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Nationality</p>
                <p className="text-sm font-semibold text-slate-800">{pInfo.nationality || 'Filipino'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Citizenship</p>
                <p className="text-sm font-semibold text-slate-800">{pInfo.citizenship || 'Filipino'}</p>
              </div>
            </div>
          </div>

          {/* 3. Address Information Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Home className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">2. Complete Residential & Permanent Address</h3>
                  <p className="text-xs text-slate-500">Philippine Standard Geographic Code (PSGC) Cascade</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Current Address */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Current Address</span>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Primary</span>
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Region:</span>
                    <span className="font-semibold text-slate-800">{cAddr.region || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Province:</span>
                    <span className="font-semibold text-slate-800">{cAddr.province || client.province || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">City / Municipality:</span>
                    <span className="font-semibold text-slate-800">{cAddr.city || client.cityMunicipality || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Barangay:</span>
                    <span className="font-semibold text-slate-800">{cAddr.barangay || client.barangay || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">House / Unit / Street:</span>
                    <span className="font-semibold text-slate-800">
                      {[cAddr.houseNumber, cAddr.street, cAddr.subdivision].filter(Boolean).join(', ') || client.address || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ZIP / Postal Code:</span>
                    <span className="font-semibold text-slate-800">{cAddr.postalCode || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Permanent Address */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Permanent Address</span>
                  {isPermanentSame && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                      Same as Current
                    </span>
                  )}
                </div>

                {isPermanentSame ? (
                  <div className="mt-6 flex flex-col items-center justify-center text-center text-xs text-slate-500">
                    <CheckCircle2 className="h-6 w-6 text-blue-500 mb-1" />
                    <p className="font-semibold text-slate-700">Declared identical to Current Address</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {[cAddr.houseNumber, cAddr.street, cAddr.barangay, cAddr.city, cAddr.province].filter(Boolean).join(', ')}
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Region:</span>
                      <span className="font-semibold text-slate-800">{pAddr.region || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Province:</span>
                      <span className="font-semibold text-slate-800">{pAddr.province || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">City / Municipality:</span>
                      <span className="font-semibold text-slate-800">{pAddr.city || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Barangay:</span>
                      <span className="font-semibold text-slate-800">{pAddr.barangay || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">House / Street:</span>
                      <span className="font-semibold text-slate-800">
                        {[pAddr.houseNumber, pAddr.street, pAddr.subdivision].filter(Boolean).join(', ') || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ZIP Code:</span>
                      <span className="font-semibold text-slate-800">{pAddr.postalCode || '—'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. Contact Information Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">3. Contact Verification</h3>
                  <p className="text-xs text-slate-500">Verified mobile and email channels</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Mobile Number</p>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> Verified OTP
                  </span>
                </div>
                <p className="mt-1 text-sm font-mono font-bold text-slate-800">{contact.mobileNumber || client.phone || '—'}</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Email Address</p>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> Verified Gmail
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-800 truncate">{contact.email || client.email || '—'}</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5">
                <p className="text-xs text-slate-400">Emergency / Alt Contact</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {contact.emergencyContactName
                    ? `${contact.emergencyContactName} (${contact.emergencyContactRelationship || 'Contact'})`
                    : contact.alternativeMobile || 'None specified'}
                </p>
              </div>
            </div>
          </div>

          {/* 5. Employment & Financial Information Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">4. Employment & Financial Assessment</h3>
                  <p className="text-xs text-slate-500">Livelihood verification and monthly repayment capacity</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Employment Status</p>
                <p className="text-sm font-semibold text-slate-800">{emp.employmentStatus || client.employmentStatus || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Employer / Business Name</p>
                <p className="text-sm font-semibold text-slate-800">
                  {emp.employerName || emp.businessName || client.employerOrBusiness || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Job Title / Nature of Business</p>
                <p className="text-sm font-semibold text-slate-800">
                  {emp.jobPosition || emp.natureOfBusiness || client.occupation || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Years of Operation/Work</p>
                <p className="text-sm font-semibold text-slate-800">{emp.yearsEmployed || emp.yearsInBusiness || '—'}</p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                <p className="text-xs font-semibold text-emerald-800">Monthly Gross Income</p>
                <p className="mt-1 text-base font-bold text-emerald-700">
                  ₱{(Number(emp.monthlyIncome) || client.monthlyIncome || 0).toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                <p className="text-xs font-semibold text-rose-800">Monthly Living Expenses</p>
                <p className="mt-1 text-base font-bold text-rose-700">
                  ₱{(Number(emp.monthlyExpenses) || client.monthlyExpenses || 0).toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                <p className="text-xs font-semibold text-blue-800">Net Disposable Cashflow</p>
                <p className="mt-1 text-base font-bold text-blue-700">
                  ₱{Math.max(
                    0,
                    (Number(emp.monthlyIncome) || client.monthlyIncome || 0) -
                      (Number(emp.monthlyExpenses) || client.monthlyExpenses || 0)
                  ).toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Source of Income / Funds</p>
                <p className="mt-1 text-xs font-semibold text-slate-800">{emp.sourceOfIncome || 'Salary & Business'}</p>
              </div>
            </div>
          </div>

          {/* 6. Government Identification Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">5. Government Identification Details</h3>
                  <p className="text-xs text-slate-500">Official government-issued primary identification</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setUnmaskedId(!unmaskedId)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {unmaskedId ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                <span>{unmaskedId ? 'Mask ID' : 'Unmask ID'}</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">ID Type</p>
                <p className="text-sm font-semibold text-slate-800">{govId.idType || 'Philippine National ID (PhilSys)'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">ID Number</p>
                <p className="text-sm font-mono font-bold text-slate-900">{maskIdNumber(govId.idNumber || client.idNumber)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Name on ID</p>
                <p className="text-sm font-semibold text-slate-800">{govId.nameOnId || client.fullName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Expiration Date</p>
                <p className="text-sm font-semibold text-slate-800">{govId.expiryDate || 'No Expiry / Lifetime'}</p>
              </div>
            </div>
          </div>

          {/* 7. Submitted Documents & Verification Controls */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <FileCheck2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">6. Submitted Supporting Documents</h3>
                  <p className="text-xs text-slate-500">Review uploads, inspect high-res photos, and set document verdicts</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {dossier.documents.map((doc) => {
                const currentVerdict = doc.documentId ? docStatuses[doc.documentId]?.status : doc.status;

                return (
                  <div
                    key={doc.type}
                    className={`rounded-2xl border p-4 transition-all ${
                      currentVerdict === 'ACCEPTED'
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : currentVerdict === 'REJECTED'
                          ? 'border-rose-200 bg-rose-50/40'
                          : doc.isUploaded
                            ? 'border-slate-200 bg-slate-50/60'
                            : 'border-slate-200 bg-slate-50/20 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">{doc.name}</span>
                        <p className="text-[11px] text-slate-500">{doc.description}</p>
                      </div>
                      <StatusBadge status={doc.isUploaded ? currentVerdict || 'SUBMITTED' : 'NOT_UPLOADED'} />
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/60">
                      {doc.isUploaded ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDocumentViewer(doc)}
                            className="bg-white text-xs font-semibold shadow-xs"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-600" />
                            <span>View High-Res</span>
                          </Button>
                          <span className="text-[11px] text-slate-500 truncate max-w-[140px]">{doc.fileName}</span>
                        </div>
                      ) : (
                        <span className="text-xs italic text-slate-400">No document uploaded</span>
                      )}

                      {doc.documentId && doc.isUploaded && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDocStatusChange(doc.documentId!, 'ACCEPTED')}
                            className={`rounded-lg p-1 text-xs transition ${
                              currentVerdict === 'ACCEPTED'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                            title="Accept Document"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDocStatusChange(doc.documentId!, 'REJECTED', 'Illegible or invalid')}
                            className={`rounded-lg p-1 text-xs transition ${
                              currentVerdict === 'REJECTED'
                                ? 'bg-rose-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-rose-50 hover:text-rose-700'
                            }`}
                            title="Reject Document"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 8. 14-Point Compliance Review Checklist */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">7. Compliance Verification Checklist</h3>
                  <p className="text-xs text-slate-500">14-point regulatory & risk verification requirements</p>
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={checkAllItems} className="text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Mark All Verified</span>
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {CHECKLIST_ITEMS.map((item, idx) => {
                const isChecked = !!checkedItems[item.id];
                return (
                  <label
                    key={item.id}
                    onClick={() => toggleCheck(item.id)}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                      isChecked
                        ? 'border-emerald-300 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-300/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-800">
                        {idx + 1}. {item.label}
                      </span>
                      <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.2 text-[9px] font-bold text-slate-500">
                        {item.category}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 9. Chronological Audit Log History */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">8. Chronological KYC Review Audit Trail</h3>
                  <p className="text-xs text-slate-500">Immutable audit record of all verification activities</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {(dossier.auditTrail || []).length === 0 ? (
                <p className="text-xs italic text-slate-400">No review events logged yet.</p>
              ) : (
                dossier.auditTrail.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-700">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          {log.action} · {log.staffName || 'System'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-0.5">
                        Status Transition:{' '}
                        <span className="font-semibold text-slate-700">{log.previousStatus || 'NOT_STARTED'}</span> →{' '}
                        <span className="font-semibold text-slate-900">{log.newStatus || log.action}</span>
                      </p>
                      {log.reason && (
                        <p className="mt-1 rounded bg-white p-2 text-slate-700 border border-slate-200">
                          Notes / Reason: {log.reason}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECURE DOCUMENT VIEWER MODAL */}
      {viewingDoc && (
        <Modal
          open={!!viewingDoc}
          onClose={() => setViewingDoc(null)}
          title={`Document Preview: ${viewingDoc.name}`}
          size="lg"
          footer={
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs font-mono font-semibold text-slate-600">{Math.round(zoomLevel * 100)}%</span>
                <Button variant="outline" size="sm" onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRotation((r) => (r + 90) % 360)}>
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {viewingDoc.fileUrl && (
                  <a
                    href={viewingDoc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download / Open Original</span>
                  </a>
                )}
                <Button variant="brand" size="sm" onClick={() => setViewingDoc(null)}>
                  Done
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex min-h-[400px] max-h-[65vh] items-center justify-center overflow-auto rounded-xl bg-slate-900/90 p-4">
            {viewingDoc.fileUrl ? (
              <img
                src={viewingDoc.fileUrl}
                alt={viewingDoc.name}
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-h-[55vh] max-w-full rounded-lg object-contain shadow-2xl"
              />
            ) : (
              <div className="text-center text-white">
                <AlertTriangle className="mx-auto h-8 w-8 text-amber-400 mb-2" />
                <p className="text-sm font-semibold">Document image could not be loaded</p>
                <p className="text-xs text-slate-400 mt-1">{viewingDoc.fileName || 'No file reference available.'}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* APPROVE CONFIRMATION MODAL */}
      {activeDecisionModal === 'APPROVE' && (
        <Modal
          open={true}
          onClose={() => setActiveDecisionModal(null)}
          title="Confirm KYC Approval"
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setActiveDecisionModal(null)} disabled={isSubmittingDecision}>
                Cancel
              </Button>
              <Button
                variant="brand"
                onClick={() => executeDecision('APPROVED')}
                loading={isSubmittingDecision}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm & Approve KYC</span>
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-emerald-800">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-bold">Approve Verified Client Status</p>
                <p className="text-xs">
                  This will mark <span className="font-semibold">{client?.fullName}</span> as fully KYC-verified and activate full microfinance services.
                </p>
              </div>
            </div>

            <Field label="Approval Remarks (Optional)">
              <Textarea
                rows={3}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Optional notes regarding verification checklist compliance…"
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* CORRECTION REQUEST MODAL */}
      {activeDecisionModal === 'CORRECTION' && (
        <Modal
          open={true}
          onClose={() => setActiveDecisionModal(null)}
          title="Request Client KYC Correction"
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setActiveDecisionModal(null)} disabled={isSubmittingDecision}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => executeDecision('CORRECTION_REQUIRED')}
                loading={isSubmittingDecision}
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Send Correction Request</span>
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-amber-800 text-xs">
              <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p>
                The client will be immediately notified on their portal with your specific instructions on what needs to be corrected and resubmitted.
              </p>
            </div>

            <Field label="Section Requiring Correction" required>
              <Select value={correctionSection} onChange={(e) => setCorrectionSection(e.target.value)}>
                <option value="Personal Information">Personal Information (Name, DOB, Civil Status)</option>
                <option value="Address Information">Address Information (Barangay, Street, Proof)</option>
                <option value="Contact Information">Contact Information (Phone, Email)</option>
                <option value="Employment & Financial">Employment & Financial Information</option>
                <option value="Government ID">Government ID (Blurry, Mismatched, Expired)</option>
                <option value="Supporting Documents">Supporting Documents (Proof of Address / Income)</option>
                <option value="Selfie Verification">Selfie with ID Verification</option>
              </Select>
            </Field>

            <Field label="Specific Field or Document Name" required>
              <Input
                value={correctionField}
                onChange={(e) => setCorrectionField(e.target.value)}
                placeholder="e.g. Government ID Photo / Proof of Address Date"
              />
            </Field>

            <Field
              label="Detailed Reason & Instructions for Client"
              required
              hint="Be clear on what the client must do to resolve the issue."
            >
              <Textarea
                rows={4}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="e.g. The submitted Government ID photo has glare covering the ID number. Please upload a clear, uncropped photo."
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* REJECTION MODAL */}
      {activeDecisionModal === 'REJECT' && (
        <Modal
          open={true}
          onClose={() => setActiveDecisionModal(null)}
          title="Reject KYC Application"
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setActiveDecisionModal(null)} disabled={isSubmittingDecision}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => executeDecision('REJECTED')}
                loading={isSubmittingDecision}
              >
                <XCircle className="h-4 w-4" />
                <span>Confirm Rejection</span>
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-red-50 p-3 text-red-800 text-xs">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <p>
                Rejecting KYC will prevent this account from accessing credit and financial services. Please provide a clear formal reason.
              </p>
            </div>

            <Field
              label="Formal Rejection Reason"
              required
              hint="Required for compliance and regulatory records."
            >
              <Textarea
                rows={4}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="e.g. Fraudulent document detected or failed duplicate account policy…"
              />
            </Field>
          </div>
        </Modal>
      )}
    </Modal>
  );
};

export default KycReviewPanel;