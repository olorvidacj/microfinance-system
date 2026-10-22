import React, { useEffect, useState, useRef, useMemo } from 'react';
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
  Sparkles,
  Scan,
  UserCheck,
  RefreshCw,
  AlertTriangle,
  Eye,
  CheckSquare,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { profileService } from '../services/profile';
import {
  KycDocumentItem,
  KycStatusData,
  ExtractedIdData,
  IdValidationResult,
  FaceMatchResult,
} from '../types';
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
import { KycStatusBadge } from '../../components/KycStatusBadge';
import { CIVIL_STATUSES, EMPLOYMENT_STATUSES, GENDERS, ID_TYPES, SOURCES_OF_INCOME, isKycVerified, normaliseKycStatus, validateIdNumber } from '../../../shared/kyc-core';
import { EMPTY_KYC_FORM, buildKycApplication, formatMoney, kycFormFrom, kycStepsValid, manilaToday, type KycFormState } from '../../../shared/client';
import { ApiError } from '../services/clientApi';
import { useToast } from '../components/ui/Toast';

// Centralized Scanner & Quality Inspection Thresholds Configuration
export const ID_SCANNER_THRESHOLDS = {
  // Lighting (mean luminance 0-255)
  minLuminance: 55,
  maxLuminance: 225,
  maxDarkRatio: 0.42,
  maxGlareRatio: 0.16,

  // Sharpness / Blur (Laplacian / Edge diff gradient)
  minSharpness: 11.0,

  // Motion & Stability
  maxMotionDelta: 16.0,
  requiredStableFrames: 3, // ~360ms of continuous stability before countdown
  countdownDurationSec: 3,

  // Centering & Framing bounds tolerances (% of frame)
  minFillRatio: 0.45,
  maxFillRatio: 0.95,
  centeringTolerance: 0.16,
};

// 7 Wizard Steps corresponding to the strictly sequential KYC flow
const WIZARD_STEPS = [
  { id: 'id_upload', label: '1. Government ID', subtitle: 'ID Upload & Validation' },
  { id: 'face_match', label: '2. Face Biometrics', subtitle: 'Selfie & Face Matching' },
  { id: 'personal_info', label: '3. Personal Info', subtitle: 'Civil Registry Data' },
  { id: 'address', label: '4. Address', subtitle: 'PSGC Geographic Data' },
  { id: 'financial', label: '5. Livelihood & Income', subtitle: 'Employment & Income' },
  { id: 'documents', label: '6. Documents', subtitle: 'Supporting Proofs' },
  { id: 'review_submit', label: '7. Review & Consent', subtitle: 'Review & Submit' },
] as const;

const SUFFIXES = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'];
// Option lists and ID formats come from shared/kyc-core so the form offers exactly what the server accepts.
const GOV_ID_TYPES = ID_TYPES.map((t) => ({ code: t.code, label: t.label, hint: `e.g. ${t.example}` }));

/** Server requiredStep -> wizard step index. */
const STEP_INDEX: Record<string, number> = { ID_UPLOAD: 0, FACE_MATCH: 1, PERSONAL_INFO: 2, CONTACT: 2, ADDRESS: 3, FINANCIAL: 4, DOCUMENTS: 5, CONSENT: 6 };

/** Documents captured by the ID and selfie steps; every other required kind is uploaded in step 6. */
const CAPTURED_KINDS = ['ID_FRONT', 'ID_BACK', 'SELFIE'];

interface SupportingDocState {
  fileUrl?: string | null;
  fileName?: string | null;
  uploaded: boolean;
  isUploading: boolean;
}

type FormState = KycFormState;
const initialFormState: FormState = EMPTY_KYC_FORM;

export const KycPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [kyc, setKyc] = useState<KycStatusData | null>(null);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  // Form State
  const [form, setForm] = useState<FormState>(initialFormState);
  const [documents, setDocuments] = useState<any[]>([]);
  const [autoFilledKeys, setAutoFilledKeys] = useState<Set<string>>(new Set());

  // AI OCR & ID Verification State
  const [idFrontImage, setIdFrontImage] = useState<string>('');
  const [idBackImage, setIdBackImage] = useState<string>('');
  const [isProcessingId, setIsProcessingId] = useState(false);
  const [scanStage, setScanStage] = useState<'idle' | 'scanning' | 'checking_quality' | 'reading_info' | 'complete' | 'failed'>('idle');
  const [extractedData, setExtractedData] = useState<ExtractedIdData | null>(null);
  const [idValidationResult, setIdValidationResult] = useState<IdValidationResult | null>(null);

  // AI Face Biometrics State
  const [selfieImage, setSelfieImage] = useState<string>('');
  const [isMatchingFace, setIsMatchingFace] = useState(false);
  const [faceMatchResult, setFaceMatchResult] = useState<FaceMatchResult | null>(null);

  // Auto ID Detection & Capture State
  const [autoCaptureStatus, setAutoCaptureStatus] = useState<'positioning' | 'holding_still' | 'capturing'>('positioning');
  const [autoCaptureGuidance, setAutoCaptureGuidance] = useState<string>('Position your ID inside the frame');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [extractedConfirmed, setExtractedConfirmed] = useState(false);
  const [autoFlipNotice, setAutoFlipNotice] = useState(false);

  // References for real-time video frame processing
  const autoDetectLoopRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stableFramesCountRef = useRef<number>(0);
  const lastSampledDataRef = useRef<Uint8ClampedArray | null>(null);

  // Camera Modal / Live Stream State
  const [cameraActive, setCameraActive] = useState<false | 'ID_FRONT' | 'ID_BACK' | 'SELFIE'>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Step 6 supporting documents, one entry per required document kind (from the server).
  const [supportingDocs, setSupportingDocs] = useState<Record<string, SupportingDocState>>({});
  const requiredSupportingKinds = useMemo(
    () => (kyc?.requiredDocuments || []).map((r: any) => String(r.type)).filter((k) => !CAPTURED_KINDS.includes(k)),
    [kyc],
  );
  const anySupportingUploading = Object.values(supportingDocs).some((d) => d.isUploading);

  // PSGC Dropdowns
  const [regions, setRegions] = useState<Array<{ code: string; name: string }>>([]);
  const [currentProvinces, setCurrentProvinces] = useState<Array<{ code: string; name: string }>>([]);
  const [currentCities, setCurrentCities] = useState<Array<{ code: string; name: string; isRegionalDistrict?: boolean }>>([]);
  const [currentBarangays, setCurrentBarangays] = useState<Array<{ code: string; name: string }>>([]);

  const [permProvinces, setPermProvinces] = useState<Array<{ code: string; name: string }>>([]);
  const [permCities, setPermCities] = useState<Array<{ code: string; name: string; isRegionalDistrict?: boolean }>>([]);
  const [permBarangays, setPermBarangays] = useState<Array<{ code: string; name: string }>>([]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleUploadSupportingDoc = async (file: File, kind: string, docName: string) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('The file is larger than 10 MB. Please choose a smaller photo or PDF.');
      return;
    }
    setSupportingDocs((prev) => ({ ...prev, [kind]: { ...(prev[kind] || { uploaded: false }), isUploading: true } }));
    const reader = new FileReader();
    reader.onerror = () => {
      toast.error('Could not read the selected file. Please try another.');
      setSupportingDocs((prev) => ({ ...prev, [kind]: { ...(prev[kind] || { uploaded: false }), isUploading: false } }));
    };
    reader.onload = async () => {
      try {
        const uploadedDoc = await profileService.uploadKycDocument({
          documentType: kind,
          documentName: docName,
          fileName: file.name,
          imageBase64: reader.result as string,
          mime: file.type,
        });
        setSupportingDocs((prev) => ({ ...prev, [kind]: { fileUrl: uploadedDoc?.fileUrl ?? null, fileName: file.name, uploaded: true, isUploading: false } }));
        toast.success(`${docName} uploaded.`);
      } catch (err: any) {
        toast.error(err.message || `Failed to upload ${docName}`);
        setSupportingDocs((prev) => ({ ...prev, [kind]: { ...(prev[kind] || { uploaded: false }), isUploading: false } }));
      }
    };
    reader.readAsDataURL(file);
  };

  // ---------------------------------------------------------------------------
  // STRICT STEP-BY-STEP COMPLETION VALIDATIONS
  // ---------------------------------------------------------------------------

  // Step 1: ID Upload, Validation & User Review Confirmation
  const isStep1Completed = useMemo(() => {
    const unreadable = (idValidationResult as any)?.status === 'COMPLETED' && idValidationResult?.isReadable === false;
    return Boolean(idFrontImage && idValidationResult && !unreadable && extractedConfirmed && form.idType.trim() && !validateIdNumber(form.idType, form.idNumber));
  }, [idFrontImage, idValidationResult, extractedConfirmed, form.idType, form.idNumber]);

  // Step 2: Face Biometric Matching
  const isStep2Completed = useMemo(() => {
    return Boolean(
      isStep1Completed &&
      selfieImage &&
      faceMatchResult &&
      faceMatchResult.matchStatus !== 'NO_MATCH'
    );
  }, [isStep1Completed, selfieImage, faceMatchResult]);

  // Steps 3-5: the server's own field checks (shared/kyc-core validateKycApplication).
  const today = manilaToday();
  const isStep3Completed = useMemo(() => isStep2Completed && kycStepsValid(form, ['PERSONAL_INFO', 'CONTACT'], today), [isStep2Completed, form, today]);
  const isStep4Completed = useMemo(() => isStep3Completed && kycStepsValid(form, ['ADDRESS'], today), [isStep3Completed, form, today]);
  const isStep5Completed = useMemo(() => isStep4Completed && kycStepsValid(form, ['FINANCIAL'], today), [isStep4Completed, form, today]);

  // Step 6: every required supporting document uploaded, none still uploading
  const isStep6Completed = useMemo(() => {
    if (!isStep5Completed || anySupportingUploading) return false;
    return requiredSupportingKinds.every((k) => supportingDocs[k]?.uploaded);
  }, [isStep5Completed, anySupportingUploading, requiredSupportingKinds, supportingDocs]);

  // Step 7: Final Declarations & Consent
  const isStep7Completed = useMemo(() => {
    return Boolean(
      isStep6Completed &&
      form.truthfulInformation &&
      form.documentOwnership &&
      form.privacyNotice
    );
  }, [isStep6Completed, form]);

  // Highest unlocked step that client is permitted to navigate to
  const maxAllowedStep = useMemo(() => {
    if (!isStep1Completed) return 0; // Must validate ID
    if (!isStep2Completed) return 1; // Must complete Face Match
    if (!isStep3Completed) return 2; // Must complete Personal Info
    if (!isStep4Completed) return 3; // Must complete Address Info
    if (!isStep5Completed) return 4; // Must complete Financial Info
    if (!isStep6Completed) return 5; // Supporting Documents / Review
    return 6; // Review & Final Consent
  }, [
    isStep1Completed,
    isStep2Completed,
    isStep3Completed,
    isStep4Completed,
    isStep5Completed,
    isStep6Completed,
  ]);

  // Guard: If step is ever higher than maxAllowedStep, bound it immediately
  useEffect(() => {
    if (!loading && step > maxAllowedStep) {
      setStep(maxAllowedStep);
    }
  }, [maxAllowedStep, step, loading]);

  // Handler for strict stepper clicks
  const handleStepClick = (targetIndex: number) => {
    if (targetIndex > maxAllowedStep) {
      if (!isStep1Completed) {
        toast.error('You cannot proceed yet. Please upload and validate your Government ID first.');
      } else if (!isStep2Completed) {
        toast.error('Face verification is required before you can continue.');
      } else if (!isStep3Completed) {
        toast.error('Please complete all required Personal Information fields first.');
      } else if (!isStep4Completed) {
        toast.error('Please complete your full residential address details first.');
      } else if (!isStep5Completed) {
        toast.error('Please complete your employment and income details first.');
      } else if (!isStep6Completed) {
        toast.error('Please upload every required supporting document first.');
      } else {
        toast.error('Please complete all required previous steps before proceeding.');
      }
      return;
    }
    setStep(targetIndex);
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
      const k = await profileService.kycStatus();
      setKyc(k);
      setDocuments(k.uploadedDocuments || []);

      // Anything past the member's own editing (submitted, decided, suspended) shows the status screen.
      setSubmitted(!['NOT_STARTED', 'IN_PROGRESS'].includes(normaliseKycStatus(k.kycStatus)));

      if (k.extractedIdData) {
        setExtractedData(k.extractedIdData);
        setIdValidationResult({
          status: (k.extractedIdData as any).status,
          isReadable: k.extractedIdData.isReadable,
          confidenceScore: k.extractedIdData.confidenceScore,
          detectedType: k.extractedIdData.detectedType || k.extractedIdData.idType || null,
          validationWarnings: k.extractedIdData.validationWarnings || [],
        } as any);
        setExtractedConfirmed(true);
      }

      if (k.faceMatchResult) {
        setFaceMatchResult(k.faceMatchResult);
      }

      setForm(kycFormFrom(k));

      // Find existing ID images in documents
      const idFrontDoc = (k.uploadedDocuments || []).find((d: any) =>
        ['GOVERNMENT_ID', 'ID_FRONT', 'VALID_ID'].includes(d.type || d.documentType)
      );
      if (idFrontDoc?.fileUrl) setIdFrontImage(idFrontDoc.fileUrl);

      const selfieDoc = (k.uploadedDocuments || []).find((d: any) =>
        ['SELFIE', 'SELFIE_WITH_ID', 'PHOTO_2X2'].includes(d.type || d.documentType)
      );
      if (selfieDoc?.fileUrl) setSelfieImage(selfieDoc.fileUrl);

      // Supporting documents already on file, by kind
      const onFile: Record<string, SupportingDocState> = {};
      for (const r of k.requiredDocuments || []) {
        const kind = String((r as any).type);
        if (CAPTURED_KINDS.includes(kind)) continue;
        onFile[kind] = { fileUrl: (r as any).fileUrl ?? null, fileName: (r as any).fileName ?? null, uploaded: Boolean((r as any).submitted), isUploading: false };
      }
      setSupportingDocs(onFile);

    } catch (err: any) {
      setError(err.message || 'Unable to load KYC data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // PSGC Cascade for Current Address
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

  // PSGC Cascade for Permanent Address
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

  // Real-Time Frame Analysis Loop for Automatic Capture
  useEffect(() => {
    if (!cameraActive) {
      if (autoDetectLoopRef.current) {
        cancelAnimationFrame(autoDetectLoopRef.current);
        autoDetectLoopRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(null);
      stableFramesCountRef.current = 0;
      lastSampledDataRef.current = null;
      setAutoCaptureStatus('positioning');
      setAutoCaptureGuidance('Position your ID inside the frame');
      return;
    }

    let isRunning = true;
    let lastCheckTime = 0;

    const loop = (time: number) => {
      if (!isRunning) return;

      // Throttle frame sampling to every 120ms
      if (time - lastCheckTime >= 120) {
        lastCheckTime = time;
        if (videoRef.current && videoRef.current.readyState >= 2) {
          const video = videoRef.current;
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 240;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            // Region of interest
            const roiLeft = Math.floor(canvas.width * 0.15);
            const roiRight = Math.floor(canvas.width * 0.85);
            const roiTop = Math.floor(canvas.height * 0.2);
            const roiBottom = Math.floor(canvas.height * 0.8);
            const roiMidX = Math.floor((roiLeft + roiRight) / 2);
            const roiMidY = Math.floor((roiTop + roiBottom) / 2);

            let roiLuminance = 0;
            let roiPixels = 0;
            let glareCount = 0;
            let darkCount = 0;
            let edgeDiffSum = 0;

            let leftSum = 0;
            let rightSum = 0;
            let topSum = 0;
            let bottomSum = 0;
            let borderEdgeSum = 0;

            for (let y = roiTop; y < roiBottom; y += 2) {
              for (let x = roiLeft; x < roiRight; x += 2) {
                const idx = (y * canvas.width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                roiLuminance += lum;
                roiPixels++;

                if (x < roiMidX) leftSum += lum;
                else rightSum += lum;

                if (y < roiMidY) topSum += lum;
                else bottomSum += lum;

                if (r > 238 && g > 238 && b > 238) glareCount++;
                if (lum < 40) darkCount++;

                if (x + 2 < roiRight) {
                  const rightIdx = (y * canvas.width + (x + 2)) * 4;
                  const rightLum = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
                  const diff = Math.abs(lum - rightLum);
                  edgeDiffSum += diff;

                  // Check if edges leak beyond safe frame boundaries
                  if (x <= roiLeft + 6 || x >= roiRight - 8 || y <= roiTop + 6 || y >= roiBottom - 8) {
                    borderEdgeSum += diff;
                  }
                }
              }
            }

            const avgLum = roiLuminance / (roiPixels || 1);
            const glareRatio = glareCount / (roiPixels || 1);
            const darkRatio = darkCount / (roiPixels || 1);
            const sharpness = edgeDiffSum / (roiPixels || 1);

            const horizontalBalance = Math.abs(leftSum - rightSum) / ((leftSum + rightSum) || 1);
            const verticalBalance = Math.abs(topSum - bottomSum) / ((topSum + bottomSum) || 1);

            let motionDelta = 0;
            if (lastSampledDataRef.current && lastSampledDataRef.current.length === data.length) {
              let diff = 0;
              for (let k = 0; k < data.length; k += 32) {
                diff += Math.abs(data[k] - lastSampledDataRef.current[k]);
              }
              motionDelta = diff / (data.length / 32);
            }
            lastSampledDataRef.current = new Uint8ClampedArray(data);

            // Determine condition evaluation using centralized ID_SCANNER_THRESHOLDS
            let isGood = true;
            let guidance = 'Position your ID inside the frame';

            if (avgLum < ID_SCANNER_THRESHOLDS.minLuminance || darkRatio > ID_SCANNER_THRESHOLDS.maxDarkRatio) {
              isGood = false;
              guidance = 'The lighting is too dark. Move to a brighter area.';
            } else if (avgLum > ID_SCANNER_THRESHOLDS.maxLuminance || glareRatio > ID_SCANNER_THRESHOLDS.maxGlareRatio) {
              isGood = false;
              guidance = 'There is too much glare. Adjust the lighting or angle.';
            } else if (sharpness < 7.0) {
              isGood = false;
              guidance = 'Move your ID closer.';
            } else if (borderEdgeSum > edgeDiffSum * 0.45) {
              isGood = false;
              guidance = 'Make sure all four corners of your ID are visible.';
            } else if (horizontalBalance > ID_SCANNER_THRESHOLDS.centeringTolerance + 0.15) {
              isGood = false;
              guidance = leftSum > rightSum ? 'Move your ID to the right.' : 'Move your ID to the left.';
            } else if (verticalBalance > ID_SCANNER_THRESHOLDS.centeringTolerance + 0.15) {
              isGood = false;
              guidance = topSum > bottomSum ? 'Move your ID down.' : 'Move your ID up.';
            } else if (sharpness < ID_SCANNER_THRESHOLDS.minSharpness) {
              isGood = false;
              guidance = 'ID is blurry. Hold your phone steady.';
            } else if (motionDelta > ID_SCANNER_THRESHOLDS.maxMotionDelta) {
              isGood = false;
              guidance = 'Hold still...';
            }

            if (isGood) {
              stableFramesCountRef.current += 1;
              if (stableFramesCountRef.current >= ID_SCANNER_THRESHOLDS.requiredStableFrames) {
                setAutoCaptureStatus('capturing');
                setAutoCaptureGuidance('ID detected — Capturing...');

                // Start countdown if not already running
                if (!countdownTimerRef.current && countdown === null) {
                  setCountdown(3);
                  let currentSec = 3;
                  const interval = setInterval(() => {
                    currentSec -= 1;
                    if (currentSec > 0) {
                      setCountdown(currentSec);
                    } else {
                      clearInterval(interval);
                      countdownTimerRef.current = null;
                      setCountdown(null);
                      executeAutoSnap();
                    }
                  }, 800);
                  countdownTimerRef.current = interval;
                }
              } else {
                setAutoCaptureStatus('holding_still');
                setAutoCaptureGuidance('Hold still...');
              }
            } else {
              stableFramesCountRef.current = 0;
              setAutoCaptureStatus('positioning');
              setAutoCaptureGuidance(guidance);
              if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;
              }
              setCountdown(null);
            }
          }
        }
      }

      autoDetectLoopRef.current = requestAnimationFrame(loop);
    };

    autoDetectLoopRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (autoDetectLoopRef.current) {
        cancelAnimationFrame(autoDetectLoopRef.current);
        autoDetectLoopRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [cameraActive]);

  // Camera Management
  const startCamera = async (mode: 'ID_FRONT' | 'ID_BACK' | 'SELFIE') => {
    setCameraActive(mode);
    setCountdown(null);
    setAutoCaptureStatus('positioning');
    setAutoCaptureGuidance(
      mode === 'SELFIE'
        ? 'Center your face within the oval guide'
        : mode === 'ID_FRONT'
          ? 'Position your ID inside the frame'
          : 'Position the back side of your ID inside the frame'
    );
    stableFramesCountRef.current = 0;

    try {
      const facingMode = mode === 'SELFIE' ? 'user' : 'environment';
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      toast.error('Unable to access camera. Please use file upload instead.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    setCameraActive(false);
  };

  const executeAutoSnap = () => {
    if (!videoRef.current) return;

    // Trigger visual flash
    setIsFlashActive(true);
    setTimeout(() => setIsFlashActive(false), 300);

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    const isBackNeeded = ['PHILSYS_ID', 'DRIVERS_LICENSE', 'UMID', 'POSTAL_ID', 'SSS_ID'].includes(form.idType);

    if (cameraActive === 'ID_FRONT') {
      setIdFrontImage(dataUrl);
      setIdValidationResult(null);
      setExtractedData(null);
      setFaceMatchResult(null);
      setExtractedConfirmed(false);

      if (isBackNeeded && !idBackImage) {
        stopCamera();
        toast.success('Front side captured! Now flip your ID to the Back Side.');
        setAutoFlipNotice(true);
        setTimeout(() => {
          setAutoFlipNotice(false);
          startCamera('ID_BACK');
        }, 1200);
        return;
      }

      stopCamera();
      toast.success('ID captured successfully.');
      setTimeout(() => {
        handleProcessId(dataUrl, idBackImage);
      }, 300);
    } else if (cameraActive === 'ID_BACK') {
      setIdBackImage(dataUrl);
      stopCamera();
      toast.success('Back side captured successfully.');
      setTimeout(() => {
        handleProcessId(idFrontImage, dataUrl);
      }, 300);
    } else if (cameraActive === 'SELFIE') {
      setSelfieImage(dataUrl);
      setFaceMatchResult(null);
      stopCamera();
      toast.success('Selfie captured successfully.');
    }
  };

  const captureCameraPhoto = () => {
    executeAutoSnap();
  };

  // Convert File to Base64 with Invalidation on change
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'ID_FRONT' | 'ID_BACK' | 'SELFIE') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size exceeds 15MB. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (target === 'ID_FRONT') {
        setIdFrontImage(base64);
        setIdValidationResult(null);
        setExtractedData(null);
        setFaceMatchResult(null);
        setExtractedConfirmed(false);
        // Automatically start OCR process on uploaded ID
        setTimeout(() => {
          handleProcessId(base64, idBackImage);
        }, 300);
      }
      if (target === 'ID_BACK') {
        setIdBackImage(base64);
        if (idFrontImage) {
          setTimeout(() => {
            handleProcessId(idFrontImage, base64);
          }, 300);
        }
      }
      if (target === 'SELFIE') {
        setSelfieImage(base64);
        setFaceMatchResult(null);
      }
      toast.success('Image loaded successfully.');
    };
    reader.readAsDataURL(file);
  };

  // Process ID with AI OCR (Step 1 -> Step 2 transition)
  const handleProcessId = async (customFront?: string, customBack?: string) => {
    const frontToUse = customFront || idFrontImage;
    const backToUse = customBack !== undefined ? customBack : idBackImage;

    if (!frontToUse) {
      toast.error('Please upload or capture the front side of your ID first.');
      return;
    }

    setIsProcessingId(true);
    setScanStage('scanning');
    setExtractedConfirmed(false);
    try {
      const t1 = setTimeout(() => setScanStage('checking_quality'), 600);
      const t2 = setTimeout(() => setScanStage('reading_info'), 1300);

      const result = await profileService.processId({
        frontImageBase64: frontToUse,
        backImageBase64: backToUse || undefined,
        documentType: form.idType,
      });

      clearTimeout(t1);
      clearTimeout(t2);

      const extracted: ExtractedIdData = (result.extractedData || {}) as ExtractedIdData;
      const validation: any = result.validation;

      setExtractedData(extracted);
      setIdValidationResult(validation);
      setFaceMatchResult(null);

      if (validation?.status === 'COMPLETED' && validation.isReadable === false) {
        setScanStage('failed');
        toast.error(validation.qualityMessage || "We couldn't read your ID clearly. Please retake the photo.");
        return;
      }
      if (validation?.status !== 'COMPLETED') {
        toast.success(validation?.qualityMessage || 'Your ID photo passed the quality check. Please type your details exactly as printed.');
      }

      setScanStage('complete');

      // Auto-fill form fields and mark them
      const autoKeys = new Set<string>();

      setForm((prev) => {
        const next = { ...prev };

        if (extracted.firstName) {
          next.firstName = extracted.firstName;
          autoKeys.add('firstName');
        }
        if (extracted.middleName) {
          next.middleName = extracted.middleName;
          autoKeys.add('middleName');
        }
        if (extracted.lastName) {
          next.lastName = extracted.lastName;
          autoKeys.add('lastName');
        }
        if (extracted.suffix) {
          next.suffix = extracted.suffix;
          autoKeys.add('suffix');
        }
        if (extracted.dateOfBirth) {
          next.dateOfBirth = extracted.dateOfBirth;
          next.idDateOfBirth = extracted.dateOfBirth;
          autoKeys.add('dateOfBirth');
        }
        if (extracted.gender) {
          next.gender = extracted.gender;
          autoKeys.add('gender');
        }
        if (extracted.civilStatus) {
          next.civilStatus = extracted.civilStatus;
          autoKeys.add('civilStatus');
        }
        if (extracted.nationality) {
          next.nationality = extracted.nationality;
          autoKeys.add('nationality');
        }
        if (extracted.idNumber) {
          next.idNumber = extracted.idNumber;
          autoKeys.add('idNumber');
        }
        if (extracted.expirationDate) {
          next.idExpiryDate = extracted.expirationDate;
          autoKeys.add('idExpiryDate');
        }
        if (extracted.issueDate) {
          next.idIssueDate = extracted.issueDate;
          autoKeys.add('idIssueDate');
        }
        if (extracted.fullName) {
          next.nameOnId = extracted.fullName;
          autoKeys.add('nameOnId');
        }
        if (extracted.street || extracted.address) {
          next.currentStreet = extracted.street || extracted.address || next.currentStreet;
          autoKeys.add('currentStreet');
        }
        if (extracted.barangay) {
          next.currentBarangayName = extracted.barangay;
          autoKeys.add('currentBarangay');
        }
        if (extracted.city) {
          next.currentCityName = extracted.city;
          autoKeys.add('currentCity');
        }
        if (extracted.province) {
          next.currentProvinceName = extracted.province;
          autoKeys.add('currentProvince');
        }
        if (extracted.postalCode) {
          next.currentPostalCode = extracted.postalCode;
          autoKeys.add('currentPostalCode');
        }

        return next;
      });

      setAutoFilledKeys(autoKeys);
      if (validation?.status === 'COMPLETED') toast.success('Your ID was read. Please check every field against the card.');
    } catch (err: any) {
      setScanStage('failed');
      setIdValidationResult(null);
      toast.error(err.message || 'Failed to validate ID. Please ensure the image is clear and well-lit.');
    } finally {
      setIsProcessingId(false);
    }
  };

  // Perform Face Biometric Matching (Step 2 -> Step 3 transition)
  const handleMatchFace = async () => {
    if (!selfieImage) {
      toast.error('Please capture or upload your selfie first.');
      return;
    }
    if (!idFrontImage || !isStep1Completed) {
      toast.error('Front ID must be validated before face matching can proceed.');
      setStep(0);
      return;
    }

    setIsMatchingFace(true);
    try {
      const result = await profileService.matchFace({ selfieImageBase64: selfieImage });
      setFaceMatchResult(result.matchResult);
      const status = result.matchResult.matchStatus;
      if (status === 'NO_MATCH') {
        toast.error('Your selfie does not appear to match your ID photo. Please retake it in good light, facing the camera.');
      } else {
        toast.success(status === 'MATCH' ? `Selfie matches your ID (${result.matchResult.matchConfidence}%).` : result.matchResult.details || 'A branch officer will compare your selfie with your ID.');
        setStep(2);
      }
    } catch (err: any) {
      setFaceMatchResult(null);
      toast.error(err.message || 'Face matching failed. Please try again with clear front lighting.');
    } finally {
      setIsMatchingFace(false);
    }
  };

  const buildPayload = () => buildKycApplication(form);

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await profileService.saveDraft({ ...buildPayload(), currentStep: step });
      toast.success('KYC progress saved as draft.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitKyc = async () => {
    if (!isStep1Completed) {
      toast.error('You cannot submit yet. Please upload and validate your Government ID first.');
      setStep(0);
      return;
    }
    if (!isStep2Completed) {
      toast.error('Face biometric verification is required before submitting.');
      setStep(1);
      return;
    }
    if (!isStep3Completed) {
      toast.error('Please complete all required Personal Information fields.');
      setStep(2);
      return;
    }
    if (!isStep4Completed) {
      toast.error('Please complete your full residential address details.');
      setStep(3);
      return;
    }
    if (!isStep5Completed) {
      toast.error('Please complete your employment and financial capacity details.');
      setStep(4);
      return;
    }
    if (!form.truthfulInformation || !form.documentOwnership || !form.privacyNotice) {
      toast.error('Please affirm the required legal declarations and Data Privacy Act consent to submit.');
      setStep(6);
      return;
    }

    setSaving(true);
    try {
      await profileService.submitKyc(buildPayload());
      toast.success('Your KYC application was submitted for branch review.');
      setSubmitted(true);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit KYC application.');
      const target = err instanceof ApiError ? STEP_INDEX[String((err.details as any)?.requiredStep ?? '')] : undefined;
      if (target !== undefined) setStep(target);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading your identity verification status…" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  // ---------------------------------------------------------------------------
  // Status Banner / Verification Queue (Step 10)
  // ---------------------------------------------------------------------------
  const faceSummary = (r: FaceMatchResult | null): string => {
    if (!r) return 'Not run';
    if (r.matchStatus === 'MATCH') return `Matches ID (${r.matchConfidence}%)`;
    if (r.matchStatus === 'LOW_CONFIDENCE') return `Low confidence (${r.matchConfidence}%), officer will check`;
    if (r.matchStatus === 'NO_MATCH') return 'Does not match';
    return 'Not available, officer will compare';
  };

  if (submitted) {
    const isApproved = isKycVerified(kyc?.kycStatus);
    const isCorrection = normaliseKycStatus(kyc?.kycStatus) === 'CORRECTION_REQUIRED';
    const isRejected = normaliseKycStatus(kyc?.kycStatus) === 'REJECTED';

    return (
      <div className="space-y-6 max-w-4xl mx-auto py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/portal/profile')}>
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Profile</span>
            </Button>
          </div>
          <KycStatusBadge status={kyc?.kycStatus} size="sm" />
        </div>

        <Card className="overflow-hidden border-2 shadow-md">
          <div
            className={`p-6 text-white ${
              isApproved
                ? 'bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800'
                : isCorrection
                  ? 'bg-gradient-to-r from-amber-600 to-orange-700'
                  : isRejected
                    ? 'bg-gradient-to-r from-rose-700 to-red-800'
                    : 'bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur ring-2 ring-white/20">
                  {isApproved ? (
                    <BadgeCheck className="h-8 w-8 text-emerald-300" />
                  ) : isCorrection ? (
                    <AlertTriangle className="h-8 w-8 text-amber-300" />
                  ) : isRejected ? (
                    <XCircle className="h-8 w-8 text-rose-300" />
                  ) : (
                    <Clock className="h-8 w-8 text-blue-300 animate-pulse" />
                  )}
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                    {isApproved
                      ? 'Verified'
                      : isCorrection
                        ? 'Resubmission required'
                        : isRejected
                          ? 'KYC application rejected'
                          : normaliseKycStatus(kyc?.kycStatus) === 'UNDER_REVIEW'
                            ? 'A branch officer is reviewing your application'
                            : 'Waiting for branch review'}
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-slate-200">
                    Application Ref:{' '}
                    <span className="font-mono font-bold text-amber-300">{kyc?.submissionId || '—'}</span>
                    {kyc?.submittedAt ? ` · Submitted ${new Date(kyc.submittedAt).toLocaleString()}` : ''}
                  </p>
                </div>
              </div>

              {(isCorrection || isRejected) && (
                <Button
                  variant="outline"
                  onClick={() => setSubmitted(false)}
                  className="border-white bg-white font-bold text-slate-900 shadow-md hover:bg-slate-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>{isRejected ? 'Start a new application' : 'Update & resubmit'}</span>
                </Button>
              )}
            </div>
          </div>

          <CardBody className="space-y-6 p-6">
            {/* Correction or Rejection Details */}
            {(isCorrection || isRejected) && (kyc?.correctionReason || kyc?.rejectionReason) && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                      {isRejected ? 'Reason for rejection:' : 'What needs to change:'}
                    </p>
                    <p className="mt-1 text-sm text-amber-800 font-medium">
                      {kyc.correctionReason || kyc.rejectionReason}
                    </p>
                    {kyc.reviewedByName && (
                      <p className="mt-2 text-xs text-amber-700">
                        Reviewer: <span className="font-bold">{kyc.reviewedByName}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Verification Progress Timeline */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-4">Verification Workflow Progress</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>1. ID & Biometrics</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Face check: {faceSummary(faceMatchResult)}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>2. Details Submitted</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">Personal & Financial info provided</p>
                </div>

                <div
                  className={`rounded-xl border p-3.5 ${
                    isApproved
                      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-700'
                      : isCorrection
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : 'border-blue-200 bg-blue-50/60 text-blue-800'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    {isApproved ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Clock className="h-4 w-4 animate-spin text-blue-600" />
                    )}
                    <span>3. Staff Due Diligence</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    {isApproved ? `Verified by ${kyc?.reviewedByName || 'branch officer'}` : isRejected ? 'Rejected' : isCorrection ? 'Returned to you' : 'Waiting for an officer'}
                  </p>
                </div>

                <div
                  className={`rounded-xl border p-3.5 ${
                    isApproved ? 'border-emerald-200 bg-emerald-50/60 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    {isApproved ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4" />}
                    <span>4. Verified Status</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {isApproved ? 'You can now apply for loans and use savings' : 'Not verified yet'}
                  </p>
                </div>
              </div>
            </div>

            {/* Application Summary Box */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Submitted ID Credentials</span>
                <span className="text-xs font-mono font-bold text-slate-800">{GOV_ID_TYPES.find((t) => t.code === form.idType)?.label || form.idType}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Legal Name</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{form.nameOnId || `${form.firstName} ${form.lastName}`}</p>
                </div>
                <div>
                  <span className="text-slate-400">ID Number</span>
                  <p className="font-mono font-bold text-slate-900 mt-0.5">{form.idNumber || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-400">Date of Birth</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{form.dateOfBirth || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-400">Face check</span>
                  <p className="font-bold text-emerald-700 mt-0.5">
                    {faceSummary(faceMatchResult)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => navigate('/portal/loans')}>
                <span>View Loan Offers</span>
              </Button>
              <Button variant="brand" onClick={() => navigate('/portal/dashboard')}>
                <span>Go to Dashboard</span>
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main KYC Interactive Wizard with Strict Step Gating
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-800">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verify Your Identity (KYC)</h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Sequential identity validation, biometric face check, and profile verification. Every required step must be successfully completed to proceed.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving…' : 'Save Progress'}</span>
          </Button>
        </div>
      </div>

      {/* Strict Locked Progress Stepper Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 rounded-2xl bg-slate-100 p-1.5">
        {WIZARD_STEPS.map((s, idx) => {
          const isCompleted =
            (idx === 0 && isStep1Completed) ||
            (idx === 1 && isStep2Completed) ||
            (idx === 2 && isStep3Completed) ||
            (idx === 3 && isStep4Completed) ||
            (idx === 4 && isStep5Completed) ||
            (idx === 5 && isStep6Completed) ||
            (idx === 6 && isStep7Completed);

          const isCurrent = idx === step;
          const isLocked = idx > maxAllowedStep;

          return (
            <button
              key={s.id}
              type="button"
              disabled={isLocked}
              onClick={() => handleStepClick(idx)}
              className={`flex flex-col items-start rounded-xl p-2 text-left transition ${
                isCurrent
                  ? 'bg-white text-emerald-950 shadow-sm ring-2 ring-emerald-600'
                  : isCompleted
                    ? 'text-emerald-800 hover:bg-white/80 cursor-pointer'
                    : isLocked
                      ? 'text-slate-400 opacity-60 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-200/60 cursor-pointer'
              }`}
              title={isLocked ? 'Locked until previous steps are completed' : undefined}
            >
              <div className="flex items-center gap-1.5 w-full">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                        ? 'bg-emerald-100 text-emerald-900 font-bold ring-1 ring-emerald-600'
                        : isLocked
                          ? 'bg-slate-200 text-slate-400'
                          : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3" />
                  ) : isLocked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className="truncate text-xs font-bold">{s.label.split('. ')[1] || s.label}</span>
              </div>
              <span className="text-[10px] font-medium mt-1 text-slate-500 truncate w-full">
                {isCompleted ? '✓ Completed' : isCurrent ? '● Current' : isLocked ? '🔒 Locked' : 'Pending'}
              </span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: UPLOAD GOVERNMENT ID & OCR VALIDATION */}
      {/* ========================================================================= */}
      {step === 0 && (
        <Card className="shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Step 1: Upload & Validate Government ID</CardTitle>
                <p className="text-xs text-slate-500">
                  Select your government ID type, capture or upload high-resolution photos, and run ID validation to unlock next steps.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardBody className="space-y-6 pt-5">
            {/* ID Type Selection */}
            <div>
              <Field label="Select Government ID Type" required hint="Choose a valid, unexpired government-issued photo identification">
                <Select
                  value={form.idType}
                  onChange={(e) => {
                    const found = GOV_ID_TYPES.find((g) => g.code === e.target.value);
                    update('idType', e.target.value);
                  }}
                >
                  {GOV_ID_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* ID Guidelines Banner */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                <div className="space-y-1 text-xs text-blue-900">
                  <p className="font-bold text-blue-950">ID Photo Quality Checklist for Verification:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                    <li>Ensure all 4 corners of the ID card are completely visible.</li>
                    <li>Text, photo, and ID numbers must be sharp, clear, and free of glare or blur.</li>
                    <li>Accepted formats: JPG, PNG, WebP (up to 15MB).</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Front & Back ID Upload Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Front Side */}
              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-4 text-center hover:border-emerald-500 transition">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Front Side of ID *</span>
                
                {idFrontImage ? (
                  <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-200 group bg-slate-950">
                    <img src={idFrontImage} alt="Front ID Preview" className="w-full h-44 object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <Button size="sm" variant="brand" onClick={() => startCamera('ID_FRONT')}>
                        <Camera className="h-3.5 w-3.5" />
                        <span>Retake</span>
                      </Button>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'ID_FRONT')}
                        />
                        <span className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-white shadow">
                          Replace
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-xs text-slate-500 max-w-[200px]">Capture with camera or upload photo file</p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => startCamera('ID_FRONT')}>
                        <Camera className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Camera</span>
                      </Button>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'ID_FRONT')}
                        />
                        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs">
                          <Upload className="h-3.5 w-3.5" />
                          <span>Upload</span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Back Side */}
              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-4 text-center hover:border-emerald-500 transition">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Back Side of ID (Optional)</span>

                {idBackImage ? (
                  <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-200 group bg-slate-950">
                    <img src={idBackImage} alt="Back ID Preview" className="w-full h-44 object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <Button size="sm" variant="brand" onClick={() => startCamera('ID_BACK')}>
                        <Camera className="h-3.5 w-3.5" />
                        <span>Retake</span>
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setIdBackImage('')}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <p className="text-xs text-slate-500 max-w-[200px]">Required for PhilID / Driver's License</p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => startCamera('ID_BACK')}>
                        <Camera className="h-3.5 w-3.5 text-slate-600" />
                        <span>Camera</span>
                      </Button>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'ID_BACK')}
                        />
                        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs">
                          <Upload className="h-3.5 w-3.5" />
                          <span>Upload</span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Scanning Progress Bar */}
            {isProcessingId && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-3 animate-pulse">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
                    {scanStage === 'scanning' && '1/3: Scanning ID document...'}
                    {scanStage === 'checking_quality' && '2/3: Checking image quality & glare...'}
                    {scanStage === 'reading_info' && '3/3: Reading ID information with OCR...'}
                  </span>
                  <span className="font-mono text-emerald-700">
                    {scanStage === 'scanning' ? '30%' : scanStage === 'checking_quality' ? '65%' : '90%'}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-emerald-200 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
                    style={{
                      width: scanStage === 'scanning' ? '33%' : scanStage === 'checking_quality' ? '66%' : '95%',
                    }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-emerald-800">
                  <div className={`flex items-center gap-1 ${scanStage === 'scanning' ? 'font-bold text-emerald-900' : 'text-emerald-700'}`}>
                    <span>{scanStage !== 'scanning' ? '✅' : '🔍'}</span>
                    <span>Scanning ID</span>
                  </div>
                  <div className={`flex items-center gap-1 ${scanStage === 'checking_quality' ? 'font-bold text-emerald-900' : scanStage === 'reading_info' ? 'text-emerald-700' : 'text-slate-400'}`}>
                    <span>{scanStage === 'reading_info' ? '✅' : scanStage === 'checking_quality' ? '🧪' : '⏳'}</span>
                    <span>Quality Check</span>
                  </div>
                  <div className={`flex items-center gap-1 ${scanStage === 'reading_info' ? 'font-bold text-emerald-900' : 'text-slate-400'}`}>
                    <span>{scanStage === 'reading_info' ? '📑' : '⏳'}</span>
                    <span>Reading Info</span>
                  </div>
                </div>
              </div>
            )}

            {/* Validation & OCR Scan Action */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-900">Mandatory Action: AI ID Validation & OCR Extraction</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  You must run and pass ID validation before unlocking face biometrics and profile steps.
                </p>
              </div>

              <Button
                variant="brand"
                size="md"
                onClick={() => handleProcessId()}
                disabled={!idFrontImage || isProcessingId}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shrink-0 shadow-sm"
              >
                {isProcessingId ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Validating ID…</span>
                  </>
                ) : (
                  <>
                    <Scan className="h-4 w-4" />
                    <span>Validate & Extract ID</span>
                  </>
                )}
              </Button>
            </div>

            {/* Quality Failure Warning Card */}
            {idValidationResult && idValidationResult.status === 'COMPLETED' && idValidationResult.isReadable === false && (
              <div className="rounded-2xl border border-rose-300 bg-rose-50/80 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-rose-950">ID Image Quality Check Failed</h4>
                    <p className="text-xs font-medium text-rose-900 leading-relaxed">
                      {idValidationResult.qualityMessage ||
                        "We can't clearly read your ID. Please retake the photo in good lighting and make sure the entire ID is visible."}
                    </p>
                  </div>
                </div>

                {idValidationResult.qualityChecks && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-rose-200/80 text-xs">
                    <div className={`flex items-center gap-1.5 ${idValidationResult.qualityChecks.isBlurry ? 'text-rose-700 font-bold' : 'text-slate-600'}`}>
                      {idValidationResult.qualityChecks.isBlurry ? '❌ Blurry image' : '✅ Clear focus'}
                    </div>
                    <div className={`flex items-center gap-1.5 ${idValidationResult.qualityChecks.isTooDark ? 'text-rose-700 font-bold' : 'text-slate-600'}`}>
                      {idValidationResult.qualityChecks.isTooDark ? '❌ Too dark / shadows' : '✅ Good brightness'}
                    </div>
                    <div className={`flex items-center gap-1.5 ${idValidationResult.qualityChecks.isTooBrightOrGlare ? 'text-rose-700 font-bold' : 'text-slate-600'}`}>
                      {idValidationResult.qualityChecks.isTooBrightOrGlare ? '❌ Flash glare detected' : '✅ Glare-free'}
                    </div>
                    <div className={`flex items-center gap-1.5 ${idValidationResult.qualityChecks.isCutOff ? 'text-rose-700 font-bold' : 'text-slate-600'}`}>
                      {idValidationResult.qualityChecks.isCutOff ? '❌ Edges / corners cut off' : '✅ 4 corners visible'}
                    </div>
                    <div className={`flex items-center gap-1.5 ${idValidationResult.qualityChecks.isTooFar ? 'text-rose-700 font-bold' : 'text-slate-600'}`}>
                      {idValidationResult.qualityChecks.isTooFar ? '❌ ID is too far away' : '✅ Proper distance'}
                    </div>
                    <div className={`flex items-center gap-1.5 ${idValidationResult.qualityChecks.isUpsideDown ? 'text-rose-700 font-bold' : 'text-slate-600'}`}>
                      {idValidationResult.qualityChecks.isUpsideDown ? '❌ Upside down / tilted' : '✅ Proper orientation'}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="brand" onClick={() => startCamera('ID_FRONT')} className="bg-rose-600 hover:bg-rose-700 font-bold text-white">
                    <Camera className="h-3.5 w-3.5 mr-1" />
                    <span>Retake Photo</span>
                  </Button>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'ID_FRONT')} />
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 shadow-xs">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload New Photo</span>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Quality Pass & Extracted Information Review Card */}
            {idValidationResult && !(idValidationResult.status === 'COMPLETED' && idValidationResult.isReadable === false) && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-950">
                      {idValidationResult.status === 'COMPLETED'
                        ? `ID photo accepted and read${idValidationResult.confidenceScore != null ? ` (${idValidationResult.confidenceScore}% confidence)` : ''}`
                        : 'ID photo accepted. Automatic reading is not available, so type your details exactly as printed.'}
                    </span>
                  </div>
                  <span className="rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-900">
                    {idValidationResult.detectedType || GOV_ID_TYPES.find((t) => t.code === form.idType)?.label || form.idType}
                  </span>
                </div>

                {extractedData && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-emerald-200 bg-white p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          Extracted Information Review
                        </p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          ✨ Auto-filled to KYC Form
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 text-[11px]">First Name:</span>
                          <p className="font-semibold text-slate-900 truncate">{extractedData.firstName || '—'}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 text-[11px]">Middle Name:</span>
                          <p className="font-semibold text-slate-900 truncate">{extractedData.middleName || '—'}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 text-[11px]">Last Name:</span>
                          <p className="font-semibold text-slate-900 truncate">{extractedData.lastName || '—'}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 text-[11px]">Date of Birth:</span>
                          <p className="font-semibold text-slate-900">{extractedData.dateOfBirth || '—'}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 text-[11px]">Sex / Gender:</span>
                          <p className="font-semibold text-slate-900">{extractedData.gender || '—'}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 text-[11px]">ID Number:</span>
                          <p className="font-mono font-bold text-slate-900 truncate">{extractedData.idNumber || '—'}</p>
                        </div>
                        {extractedData.expirationDate && (
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="text-slate-400 text-[11px]">Expiration Date:</span>
                            <p className="font-semibold text-slate-900">{extractedData.expirationDate}</p>
                          </div>
                        )}
                        {extractedData.address && (
                          <div className="col-span-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="text-slate-400 text-[11px]">Extracted Address:</span>
                            <p className="font-semibold text-slate-900">{extractedData.address}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mandatory Extraction Confirmation Checkbox */}
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-3.5 flex items-start gap-3 shadow-2xs">
                      <input
                        type="checkbox"
                        id="confirmExtractedCheckbox"
                        checked={extractedConfirmed}
                        onChange={(e) => setExtractedConfirmed(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="confirmExtractedCheckbox" className="text-xs font-semibold text-slate-800 cursor-pointer select-none">
                        <span className="font-bold text-emerald-950 block">
                          I confirm that the information extracted from my ID is correct.
                        </span>
                        <span className="text-slate-600 text-[11px] block mt-0.5">
                          You can review and correct any details or supplement missing fields in the subsequent steps.
                        </span>
                      </label>
                    </div>

                    {/* Authenticity Notice */}
                    <div className="flex items-center gap-2 rounded-xl bg-amber-50/80 border border-amber-200 p-2.5 text-xs text-amber-900">
                      <Info className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Authenticity Notice:</strong> ID information extracted — manual verification required by cooperative staff.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                {!isStep1Completed &&
                  (idValidationResult && !extractedConfirmed
                    ? '⚠️ Please check the confirmation checkbox above to proceed.'
                    : '🔒 Next steps are locked until ID validation is completed.')}
              </span>
              <Button
                variant="brand"
                onClick={() => {
                  if (!isStep1Completed) {
                    if (idValidationResult && !extractedConfirmed) {
                      toast.error('Please check "I confirm that the information extracted from my ID is correct." to proceed.');
                    } else {
                      toast.error('You cannot proceed yet. Please upload and validate your Government ID first.');
                    }
                    return;
                  }
                  setStep(1);
                }}
                disabled={!isStep1Completed}
                className="font-bold"
              >
                <span>Continue to Biometrics</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: FACE BIOMETRICS & LIVE SELFIE MATCH */}
      {/* ========================================================================= */}
      {step === 1 && (
        <Card className="shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Step 2: Biometric Face Capture & Verification</CardTitle>
                <p className="text-xs text-slate-500">
                  Take a clear live selfie to verify facial features against the portrait on your government ID.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardBody className="space-y-6 pt-5">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                <div className="space-y-1 text-xs text-blue-900">
                  <p className="font-bold text-blue-950">Selfie Guidance for Face Verification:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                    <li>Position your face directly inside the camera oval frame.</li>
                    <li>Ensure ample front lighting; avoid glare, backlighting, or dark shadows.</li>
                    <li>Remove eyeglasses, hats, and masks covering your eyes or mouth.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Selfie & ID Comparison Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Submitted ID Portrait */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Reference: Government ID</span>
                <div className="mt-3 flex h-52 items-center justify-center rounded-xl bg-slate-900 overflow-hidden border border-slate-200">
                  {idFrontImage ? (
                    <img src={idFrontImage} alt="ID Front" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400">No ID uploaded</span>
                  )}
                </div>
              </div>

              {/* Live Selfie Box */}
              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-4 text-center hover:border-blue-500 transition">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Live Selfie *</span>

                {selfieImage ? (
                  <div className="mt-3 relative h-52 rounded-xl overflow-hidden border border-slate-200 group bg-slate-950">
                    <img src={selfieImage} alt="Selfie" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <Button size="sm" variant="brand" onClick={() => startCamera('SELFIE')}>
                        <Camera className="h-3.5 w-3.5" />
                        <span>Retake</span>
                      </Button>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'SELFIE')}
                        />
                        <span className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-white shadow">
                          Replace
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex h-52 flex-col items-center justify-center p-4 bg-slate-50 rounded-xl space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                      <Camera className="h-6 w-6" />
                    </div>
                    <p className="text-xs text-slate-500">Capture with front camera or upload photo</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button size="sm" variant="brand" onClick={() => startCamera('SELFIE')}>
                        <Camera className="h-3.5 w-3.5" />
                        <span>Take Selfie</span>
                      </Button>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'SELFIE')}
                        />
                        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs">
                          <Upload className="h-3.5 w-3.5" />
                          <span>Upload</span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Run Face Match Action */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-900">Mandatory Biometric Matching</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Execute AI biometric face matching between your selfie and government ID to unlock the application form.
                </p>
              </div>

              <Button
                variant="brand"
                size="md"
                onClick={handleMatchFace}
                disabled={!selfieImage || !idFrontImage || isMatchingFace}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold shrink-0 shadow-sm"
              >
                {isMatchingFace ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Matching Biometrics…</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4" />
                    <span>Run Face Match</span>
                  </>
                )}
              </Button>
            </div>

            {/* Face Match Result Gauge */}
            {faceMatchResult && (
              <div
                className={`rounded-2xl border p-4 space-y-3 ${
                  faceMatchResult.matchStatus === 'NO_MATCH'
                    ? 'border-rose-300 bg-rose-50/70'
                    : faceMatchResult.matchStatus === 'MATCH'
                      ? 'border-emerald-300 bg-emerald-50/70'
                      : 'border-amber-300 bg-amber-50/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {faceMatchResult.matchStatus === 'NO_MATCH' ? (
                      <AlertCircle className="h-5 w-5 text-rose-600" />
                    ) : (
                      <CheckCircle2 className={`h-5 w-5 ${faceMatchResult.matchStatus === 'MATCH' ? 'text-emerald-600' : 'text-amber-600'}`} />
                    )}
                    <span className="text-xs font-bold text-slate-900">
                      {faceMatchResult.matchStatus === 'NO_MATCH'
                        ? 'Your selfie does not match your ID photo. Please retake it.'
                        : faceMatchResult.matchStatus === 'MATCH'
                          ? 'Selfie matches your ID photo'
                          : 'Selfie saved. A branch officer will compare it with your ID.'}
                    </span>
                  </div>
                  <span
                    className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-bold text-slate-700"
                  >
                    {faceSummary(faceMatchResult)}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{faceMatchResult.details}</p>
                {faceMatchResult.matchStatus === 'NO_MATCH' && (
                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="brand"
                      onClick={() => startCamera('SELFIE')}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                    >
                      <Camera className="h-3.5 w-3.5 mr-1" />
                      <span>Retake Selfie</span>
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span>Back to ID</span>
              </Button>
              <Button
                variant="brand"
                onClick={() => {
                  if (!isStep2Completed) {
                    toast.error('Face verification is required before you can continue.');
                    return;
                  }
                  setStep(2);
                }}
                disabled={!isStep2Completed}
                className="font-bold"
              >
                <span>Continue to Form Details</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: PERSONAL INFORMATION (AUTO-FILLED) */}
      {/* ========================================================================= */}
      {step === 2 && (
        <Card className="shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <UserRound className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">Step 3: Personal Information</CardTitle>
                  <p className="text-xs text-slate-500">Legal civil registry identity details pre-filled from your Government ID.</p>
                </div>
              </div>

              {autoFilledKeys.size > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  <Sparkles className="h-3 w-3 text-emerald-600" />
                  <span>{autoFilledKeys.size} Fields Auto-Filled</span>
                </span>
              )}
            </div>
          </CardHeader>

          <CardBody className="space-y-4 pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Field
                  label={
                    <span className="flex items-center gap-1">
                      <span>First Name</span>
                      {autoFilledKeys.has('firstName') && (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-md">✨ Auto-filled from ID</span>
                      )}
                    </span>
                  }
                  required
                >
                  <Input
                    value={form.firstName}
                    onChange={(e) => update('firstName', e.target.value)}
                    placeholder="First Name"
                  />
                </Field>
              </div>

              <div>
                <Field
                  label={
                    <span className="flex items-center gap-1">
                      <span>Middle Name</span>
                      {autoFilledKeys.has('middleName') && (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-md">✨ Auto-filled from ID</span>
                      )}
                    </span>
                  }
                >
                  <Input
                    value={form.middleName}
                    disabled={form.hasNoMiddleName}
                    onChange={(e) => update('middleName', e.target.value)}
                    placeholder={form.hasNoMiddleName ? 'N/A' : 'Middle Name'}
                  />
                  <label className="mt-1.5 flex items-center gap-1.5 cursor-pointer text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.hasNoMiddleName}
                      onChange={(e) => update('hasNoMiddleName', e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>No middle name</span>
                  </label>
                </Field>
              </div>

              <div>
                <Field
                  label={
                    <span className="flex items-center gap-1">
                      <span>Last Name</span>
                      {autoFilledKeys.has('lastName') && (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-md">✨ Auto-filled from ID</span>
                      )}
                    </span>
                  }
                  required
                >
                  <Input
                    value={form.lastName}
                    onChange={(e) => update('lastName', e.target.value)}
                    placeholder="Last Name"
                  />
                </Field>
              </div>

              <div>
                <Field label="Suffix">
                  <Select value={form.suffix} onChange={(e) => update('suffix', e.target.value)}>
                    {SUFFIXES.map((s) => (
                      <option key={s} value={s}>
                        {s || 'None'}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div>
                <Field
                  label={
                    <span className="flex items-center gap-1">
                      <span>Date of Birth</span>
                      {autoFilledKeys.has('dateOfBirth') && (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-md">✨ Auto-filled from ID</span>
                      )}
                    </span>
                  }
                  required
                >
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => {
                      update('dateOfBirth', e.target.value);
                      update('idDateOfBirth', e.target.value);
                    }}
                  />
                </Field>
              </div>

              <div>
                <Field label="Place of Birth" required hint="City/Municipality, Province">
                  <Input
                    value={form.placeOfBirth}
                    onChange={(e) => update('placeOfBirth', e.target.value)}
                    placeholder="e.g. Quezon City"
                  />
                </Field>
              </div>

              <div>
                <Field
                  label={
                    <span className="flex items-center gap-1">
                      <span>Sex / Gender</span>
                      {autoFilledKeys.has('gender') && (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-md">✨ Auto-filled from ID</span>
                      )}
                    </span>
                  }
                  required
                >
                  <Select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                    <option value="">Select Gender</option>
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div>
                <Field
                  label={
                    <span className="flex items-center gap-1">
                      <span>Civil Status</span>
                      {autoFilledKeys.has('civilStatus') && (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-md">✨ Auto-filled from ID</span>
                      )}
                    </span>
                  }
                  required
                >
                  <Select value={form.civilStatus} onChange={(e) => update('civilStatus', e.target.value)}>
                    <option value="">Select Status</option>
                    {CIVIL_STATUSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div>
                <Field
                  label={
                    <span className="flex items-center gap-1">
                      <span>Nationality</span>
                      {autoFilledKeys.has('nationality') && (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-md">✨ Auto-filled from ID</span>
                      )}
                    </span>
                  }
                  required
                >
                  <Input
                    value={form.nationality}
                    onChange={(e) => update('nationality', e.target.value)}
                    placeholder="Filipino"
                  />
                </Field>
              </div>

              <div>
                <Field label="Citizenship" required>
                  <Input
                    value={form.citizenship}
                    onChange={(e) => update('citizenship', e.target.value)}
                    placeholder="Filipino"
                  />
                </Field>
              </div>

              <div>
                <Field label="Primary Mobile Number" required>
                  <Input
                    value={form.mobileNumber}
                    onChange={(e) => update('mobileNumber', e.target.value)}
                    placeholder="09171234567"
                  />
                </Field>
              </div>

              <div>
                <Field label="Email Address" required>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder="client@domain.com"
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span>Back</span>
              </Button>
              <Button
                variant="brand"
                onClick={() => {
                  if (!isStep3Completed) {
                    toast.error('Please complete all required Personal Information fields before proceeding.');
                    return;
                  }
                  setStep(3);
                }}
                disabled={!isStep3Completed}
                className="font-bold"
              >
                <span>Continue to Address</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: ADDRESS DETAILS (PSGC CASCADE) */}
      {/* ========================================================================= */}
      {step === 3 && (
        <Card className="shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Home className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Step 4: Residential & Permanent Address</CardTitle>
                <p className="text-xs text-slate-500">Official Philippine Standard Geographic Code (PSGC) cascade.</p>
              </div>
            </div>
          </CardHeader>

          <CardBody className="space-y-6 pt-5">
            {/* Current Address */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Current Residential Address</span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Primary Residence</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Field label="Region" required>
                    <Select
                      value={form.currentRegionCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const r = regions.find((x) => x.code === code);
                        update('currentRegionCode', code);
                        update('currentRegionName', r ? r.name : '');
                        update('currentProvinceCode', '');
                        update('currentProvinceName', '');
                        update('currentCityCode', '');
                        update('currentCityName', '');
                        update('currentBarangayCode', '');
                        update('currentBarangayName', '');
                      }}
                    >
                      <option value="">Select Region</option>
                      {regions.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div>
                  <Field label="Province">
                    <Select
                      value={form.currentProvinceCode}
                      disabled={!form.currentRegionCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const p = currentProvinces.find((x) => x.code === code);
                        update('currentProvinceCode', code);
                        update('currentProvinceName', p ? p.name : '');
                        update('currentCityCode', '');
                        update('currentCityName', '');
                        update('currentBarangayCode', '');
                        update('currentBarangayName', '');
                      }}
                    >
                      <option value="">{currentProvinces.length === 0 ? 'No Province (NCR / Direct)' : 'Select Province'}</option>
                      {currentProvinces.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div>
                  <Field label="City / Municipality" required>
                    <Select
                      value={form.currentCityCode}
                      disabled={!form.currentRegionCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const c = currentCities.find((x) => x.code === code);
                        update('currentCityCode', code);
                        update('currentCityName', c ? c.name : '');
                        update('currentBarangayCode', '');
                        update('currentBarangayName', '');
                      }}
                    >
                      <option value="">Select City/Municipality</option>
                      {currentCities.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div>
                  <Field label="Barangay" required>
                    <Select
                      value={form.currentBarangayCode}
                      disabled={!form.currentCityCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const b = currentBarangays.find((x) => x.code === code);
                        update('currentBarangayCode', code);
                        update('currentBarangayName', b ? b.name : '');
                      }}
                    >
                      <option value="">Select Barangay</option>
                      {currentBarangays.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div>
                  <Field label="Postal / ZIP Code" required>
                    <Input
                      value={form.currentPostalCode}
                      onChange={(e) => update('currentPostalCode', e.target.value)}
                      placeholder="e.g. 1100"
                    />
                  </Field>
                </div>

                <div>
                  <Field label="House / Unit No.">
                    <Input
                      value={form.currentHouseNumber}
                      onChange={(e) => update('currentHouseNumber', e.target.value)}
                      placeholder="e.g. Unit 4B / Blk 5 Lot 2"
                    />
                  </Field>
                </div>

                <div className="sm:col-span-2">
                  <Field label="Street / Subdivision / Landmark" required>
                    <Input
                      value={form.currentStreet}
                      onChange={(e) => update('currentStreet', e.target.value)}
                      placeholder="e.g. Mabini St., Greenhills"
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* Permanent Address Toggle */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPermanentSameAsCurrent}
                  onChange={(e) => update('isPermanentSameAsCurrent', e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  Permanent Address is the same as Current Residential Address
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span>Back</span>
              </Button>
              <Button
                variant="brand"
                onClick={() => {
                  if (!isStep4Completed) {
                    toast.error('Please complete your full residential address details before proceeding.');
                    return;
                  }
                  setStep(4);
                }}
                disabled={!isStep4Completed}
                className="font-bold"
              >
                <span>Continue to Financials</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 5: EMPLOYMENT & FINANCIALS */}
      {/* ========================================================================= */}
      {step === 4 && (
        <Card className="shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Step 5: Employment & Financial Capacity</CardTitle>
                <p className="text-xs text-slate-500">Declared livelihood and repayment capacity assessment.</p>
              </div>
            </div>
          </CardHeader>

          <CardBody className="space-y-4 pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Field label="Employment Status" required>
                  <Select
                    value={form.employmentStatus}
                    onChange={(e) => update('employmentStatus', e.target.value)}
                  >
                    <option value="">Select Employment Status</option>
                    {EMPLOYMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div>
                <Field label="Employer / Business Name" required>
                  <Input
                    value={form.employerName || form.businessName}
                    onChange={(e) => {
                      update('employerName', e.target.value);
                      update('businessName', e.target.value);
                    }}
                    placeholder="e.g. San Miguel Corp / Sari-Sari Store"
                  />
                </Field>
              </div>

              <div>
                <Field label="Job Position / Nature of Business" required>
                  <Input
                    value={form.jobPosition || form.natureOfBusiness}
                    onChange={(e) => {
                      update('jobPosition', e.target.value);
                      update('natureOfBusiness', e.target.value);
                    }}
                    placeholder="e.g. Store Owner / Cashier"
                  />
                </Field>
              </div>

              <div>
                <Field label="Monthly Gross Income (₱)" required>
                  <Input
                    type="number"
                    value={form.monthlyIncome}
                    onChange={(e) => update('monthlyIncome', e.target.value)}
                    placeholder="25000"
                  />
                </Field>
              </div>

              <div>
                <Field label="Monthly Living Expenses (₱)" required>
                  <Input
                    type="number"
                    value={form.monthlyExpenses}
                    onChange={(e) => update('monthlyExpenses', e.target.value)}
                    placeholder="15000"
                  />
                </Field>
              </div>

              <div>
                <Field label="Primary Source of Income" required>
                  <Select
                    value={form.sourceOfIncome}
                    onChange={(e) => update('sourceOfIncome', e.target.value)}
                  >
                    <option value="">Select Source</option>
                    {SOURCES_OF_INCOME.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div>
                <Field label="Emergency Contact Name" required>
                  <Input
                    value={form.emergencyContactName}
                    onChange={(e) => update('emergencyContactName', e.target.value)}
                    placeholder="Full Legal Name"
                  />
                </Field>
              </div>

              <div>
                <Field label="Emergency Contact Relationship" required>
                  <Input
                    value={form.emergencyContactRelationship}
                    onChange={(e) => update('emergencyContactRelationship', e.target.value)}
                    placeholder="e.g. Spouse / Sibling / Parent"
                  />
                </Field>
              </div>

              <div>
                <Field label="Alternative / Emergency Mobile" required>
                  <Input
                    value={form.alternativeMobile}
                    onChange={(e) => update('alternativeMobile', e.target.value)}
                    placeholder="09181234567"
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span>Back</span>
              </Button>
              <Button
                variant="brand"
                onClick={() => {
                  if (!isStep5Completed) {
                    toast.error('Please complete your employment and income details first.');
                    return;
                  }
                  setStep(5);
                }}
                disabled={!isStep5Completed}
                className="font-bold"
              >
                <span>Continue to Documents</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 6: SUPPORTING DOCUMENTS (PROOF OF ADDRESS / INCOME) */}
      {/* ========================================================================= */}
      {step === 5 && (
        <Card className="shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <FileCheck2 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Step 6: Supporting Documents</CardTitle>
                <p className="text-xs text-slate-500">Upload each document your branch requires. A branch officer checks them during review.</p>
              </div>
            </div>
          </CardHeader>

          <CardBody className="space-y-5 pt-5">
            {requiredSupportingKinds.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">No supporting documents are required. Continue to review.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(kyc?.requiredDocuments || [])
                  .filter((r: any) => !CAPTURED_KINDS.includes(String(r.type)))
                  .map((r: any) => {
                    const kind = String(r.type);
                    const doc = supportingDocs[kind] || { uploaded: false, isUploading: false };
                    const isPdf = (doc.fileName || '').toLowerCase().endsWith('.pdf');
                    return (
                      <div key={kind} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">{r.name}</span>
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">Required</span>
                        </div>
                        {doc.isUploading ? (
                          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-emerald-400 rounded-xl bg-emerald-50/40 text-center animate-pulse">
                            <RefreshCw className="h-7 w-7 text-emerald-600 animate-spin mb-2" />
                            <span className="text-xs font-bold text-emerald-900">Uploading…</span>
                          </div>
                        ) : (
                          <label className={`flex items-center gap-3 rounded-xl border-2 border-dashed p-4 cursor-pointer transition ${doc.uploaded ? 'border-emerald-300 bg-white' : 'border-slate-300 bg-white hover:border-emerald-500'}`}>
                            {doc.uploaded && doc.fileUrl && !isPdf ? (
                              <img src={doc.fileUrl} alt={r.name} className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover" />
                            ) : (
                              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                                {doc.uploaded ? <FileText className="h-7 w-7 text-emerald-600" /> : <Upload className="h-6 w-6" />}
                              </span>
                            )}
                            <span className="min-w-0 text-xs">
                              {doc.uploaded ? (
                                <>
                                  <span className="flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Uploaded</span>
                                  <span className="block truncate text-slate-600">{doc.fileName || 'On file'}</span>
                                  <span className="block text-slate-400">Choose a file to replace it</span>
                                </>
                              ) : (
                                <>
                                  <span className="block font-bold text-emerald-700">Upload {String(r.name).toLowerCase()}</span>
                                  <span className="block text-slate-400">JPG, PNG, WEBP or PDF, up to 10 MB</span>
                                </>
                              )}
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadSupportingDoc(file, kind, r.name);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setStep(4)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span>Back</span>
              </Button>
              <Button
                variant="brand"
                onClick={() => {
                  if (anySupportingUploading) {
                    toast.error('Please wait for document upload to finish before continuing.');
                    return;
                  }
                  if (!isStep6Completed) {
                    toast.error('Please upload every required supporting document to continue.');
                    return;
                  }
                  setStep(6);
                }}
                disabled={!isStep6Completed || anySupportingUploading}
                className="font-bold"
              >
                {anySupportingUploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                    <span>Uploading Document...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Review & Consent</span>
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 7: REVIEW, CONSENT & SUBMIT */}
      {/* ========================================================================= */}
      {step === 6 && (
        <Card className="shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckSquare className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Step 7: Final Review & Legal Consent</CardTitle>
                <p className="text-xs text-slate-500">Review all captured data and confirm your Data Privacy Act consent.</p>
              </div>
            </div>
          </CardHeader>

          <CardBody className="space-y-6 pt-5">
            {/* Visual Biometric & ID Match Card */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-950">Biometric & Identity Check Summary</span>
                    <p className="text-xs text-emerald-800">
                      {GOV_ID_TYPES.find((t) => t.code === form.idType)?.label || form.idType} · Face check: {faceSummary(faceMatchResult)}
                    </p>
                  </div>
                </div>


              </div>
            </div>

            {/* Summary Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-slate-200 p-4 space-y-2 bg-white">
                <span className="font-bold text-slate-800 uppercase tracking-wider">Legal Personal Info</span>
                <div className="space-y-1 text-slate-600">
                  <p><span className="text-slate-400">Name:</span> {form.firstName} {form.middleName} {form.lastName} {form.suffix}</p>
                  <p><span className="text-slate-400">Date of Birth:</span> {form.dateOfBirth}</p>
                  <p><span className="text-slate-400">Gender / Status:</span> {form.gender} · {form.civilStatus}</p>
                  <p><span className="text-slate-400">Mobile / Email:</span> {form.mobileNumber} · {form.email}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-2 bg-white">
                <span className="font-bold text-slate-800 uppercase tracking-wider">Address & Financials</span>
                <div className="space-y-1 text-slate-600">
                  <p><span className="text-slate-400">Address:</span> {form.currentStreet}, {form.currentBarangayName}, {form.currentCityName}</p>
                  <p><span className="text-slate-400">Income:</span> {formatMoney(form.monthlyIncome)} / month</p>
                  <p><span className="text-slate-400">Employer:</span> {form.employerName || form.businessName || '—'}</p>
                  <p><span className="text-slate-400">Emergency:</span> {form.emergencyContactName} ({form.emergencyContactRelationship})</p>
                </div>
              </div>
            </div>

            {/* Consent Checkboxes */}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.truthfulInformation}
                  onChange={(e) => update('truthfulInformation', e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700">
                  <strong>Declaration of Truthfulness:</strong> I hereby certify under penalty of perjury that all information provided and documents attached are true, accurate, and correct.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.documentOwnership}
                  onChange={(e) => update('documentOwnership', e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700">
                  <strong>Document Legitimacy:</strong> I affirm that the submitted government-issued ID and live biometric photo belong exclusively to me.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.privacyNotice}
                  onChange={(e) => update('privacyNotice', e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700">
                  <strong>Data Privacy Act of 2012 (RA 10173):</strong> I give full consent for the processing, identity verification, credit risk assessment, and storage of my personal information in accordance with financial regulations.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setStep(5)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span>Back</span>
              </Button>

              <Button
                variant="brand"
                size="lg"
                onClick={handleSubmitKyc}
                disabled={saving || !isStep7Completed}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Submitting Application…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5" />
                    <span>Submit Identity Verification</span>
                  </>
                )}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* LIVE CAMERA CAPTURE MODAL WITH AUTO-DETECTION HUD */}
      {/* ========================================================================= */}
      {cameraActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 p-5 text-white shadow-2xl border border-slate-800 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${autoCaptureStatus === 'capturing' ? 'bg-emerald-500/20 text-emerald-400' : autoCaptureStatus === 'holding_still' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-emerald-400'}`}>
                  <Camera className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-sm font-bold block">
                    {cameraActive === 'SELFIE'
                      ? 'Biometric Selfie Capture'
                      : cameraActive === 'ID_FRONT'
                        ? 'Government ID (Front Side)'
                        : 'Government ID (Back Side)'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {cameraActive === 'SELFIE' ? 'Face recognition validation' : 'Automatic ID document detection'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Live Camera Viewport */}
            <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

              {/* Camera Flash Animation */}
              {isFlashActive && (
                <div className="pointer-events-none absolute inset-0 z-30 bg-white opacity-95 transition-opacity duration-300" />
              )}

              {/* Status & Guidance Indicator Banner */}
              <div className="pointer-events-none absolute top-3 inset-x-3 z-20 flex justify-center">
                <div
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold backdrop-blur-md shadow-lg border transition-all duration-300 ${
                    autoCaptureStatus === 'capturing'
                      ? 'bg-emerald-500/90 text-white border-emerald-400 shadow-emerald-500/30'
                      : autoCaptureStatus === 'holding_still'
                        ? 'bg-amber-500/90 text-slate-950 border-amber-300 shadow-amber-500/30'
                        : 'bg-slate-900/85 text-amber-300 border-amber-500/40'
                  }`}
                >
                  <span className="inline-block h-2 w-2 rounded-full animate-ping bg-current" />
                  <span>
                    {autoCaptureStatus === 'capturing'
                      ? '🟢 ID detected — Capturing...'
                      : autoCaptureStatus === 'holding_still'
                        ? '🟡 Hold still...'
                        : `🟠 ${autoCaptureGuidance}`}
                  </span>
                </div>
              </div>

              {/* 3-2-1 Auto Capture Countdown Overlay */}
              {countdown !== null && (
                <div className="pointer-events-none absolute inset-0 z-25 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/90 text-white text-5xl font-black shadow-2xl border-4 border-white animate-bounce">
                    {countdown}
                  </div>
                  <span className="mt-3 rounded-full bg-black/75 px-3.5 py-1 text-xs font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                    Hold Still · Auto Snapping...
                  </span>
                </div>
              )}

              {/* Viewfinder Overlay Guides */}
              {cameraActive === 'SELFIE' ? (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-3">
                  <div className="relative h-64 w-52 rounded-[50%] border-2 border-dashed border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                    <div className="absolute inset-x-6 top-1/2 h-0.5 bg-emerald-400/40 animate-pulse" />
                  </div>
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-3">
                  <div
                    className={`relative h-44 w-72 rounded-xl border border-dashed transition-all duration-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ${
                      autoCaptureStatus === 'capturing'
                        ? 'border-emerald-400 ring-2 ring-emerald-400/60'
                        : autoCaptureStatus === 'holding_still'
                          ? 'border-amber-400 ring-2 ring-amber-400/60'
                          : 'border-white/50'
                    }`}
                  >
                    {/* Corner Reticles */}
                    <div
                      className={`absolute -top-1 -left-1 h-5 w-5 border-t-4 border-l-4 rounded-tl transition-colors duration-300 ${
                        autoCaptureStatus === 'capturing'
                          ? 'border-emerald-400'
                          : autoCaptureStatus === 'holding_still'
                            ? 'border-amber-400'
                            : 'border-white'
                      }`}
                    />
                    <div
                      className={`absolute -top-1 -right-1 h-5 w-5 border-t-4 border-r-4 rounded-tr transition-colors duration-300 ${
                        autoCaptureStatus === 'capturing'
                          ? 'border-emerald-400'
                          : autoCaptureStatus === 'holding_still'
                            ? 'border-amber-400'
                            : 'border-white'
                      }`}
                    />
                    <div
                      className={`absolute -bottom-1 -left-1 h-5 w-5 border-b-4 border-l-4 rounded-bl transition-colors duration-300 ${
                        autoCaptureStatus === 'capturing'
                          ? 'border-emerald-400'
                          : autoCaptureStatus === 'holding_still'
                            ? 'border-amber-400'
                            : 'border-white'
                      }`}
                    />
                    <div
                      className={`absolute -bottom-1 -right-1 h-5 w-5 border-b-4 border-r-4 rounded-br transition-colors duration-300 ${
                        autoCaptureStatus === 'capturing'
                          ? 'border-emerald-400'
                          : autoCaptureStatus === 'holding_still'
                            ? 'border-amber-400'
                            : 'border-white'
                      }`}
                    />

                    {/* Laser Scan Beam */}
                    <div className="absolute inset-x-3 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
                  </div>
                </div>
              )}
            </div>

            {/* Hint Notice */}
            <p className="mt-3 text-center text-xs text-slate-400">
              {cameraActive === 'SELFIE'
                ? 'Center your face within the oval guide, keep eyes open, and maintain good front lighting.'
                : 'Align your document within the frame. Photo will be captured automatically when steady and glare-free.'}
            </p>

            {/* Action Bar */}
            <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <Button variant="outline" onClick={stopCamera} className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700">
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="brand"
                  size="md"
                  onClick={captureCameraPhoto}
                  className="bg-emerald-500 hover:bg-emerald-600 font-bold shadow-lg text-white"
                >
                  <Camera className="h-4 w-4 mr-1.5" />
                  <span>Manual Snap</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default KycPage;