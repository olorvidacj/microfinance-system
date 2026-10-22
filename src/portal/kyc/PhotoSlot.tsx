import React, { useCallback, useRef, useState } from 'react';
import { Camera, FileText, ImageUp, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UPLOAD_LIMITS, type CaptureTarget } from '../../../shared/kyc-core';
import { GuidedCamera } from './GuidedCamera';

/**
 * One photo or document: shows what is there (a new capture, or the stored
 * file through its short-lived link), and lets the member take it with the
 * guided camera or upload a file. Size and type are checked here for quick
 * feedback; the server checks the file again before keeping it.
 */
export interface PhotoSlotProps {
  label: string;
  hint?: string;
  target: CaptureTarget;
  cameraTitle: string;
  tips: string[];
  /** A data URL just taken, or the stored file's signed link. */
  value: string | null;
  /** Shown for a stored PDF. */
  fileName?: string | null;
  allowPdf?: boolean;
  allowCamera?: boolean;
  disabled?: boolean;
  busy?: boolean;
  error?: string | null;
  /** The file was accepted by the server. */
  accepted?: boolean;
  onChange: (dataUrl: string, fileName: string | null) => void;
}

export const PhotoSlot: React.FC<PhotoSlotProps> = ({
  label,
  hint,
  target,
  cameraTitle,
  tips,
  value,
  fileName,
  allowPdf = false,
  allowCamera = true,
  disabled,
  busy,
  error,
  accepted,
  onChange,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [camera, setCamera] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);
  const accept = allowPdf ? 'image/jpeg,image/png,application/pdf' : 'image/jpeg,image/png';
  const isPdf = Boolean(value?.startsWith('data:application/pdf') || fileName?.toLowerCase().endsWith('.pdf'));

  const onFile = (file: File | undefined) => {
    setLocalError(null);
    if (!file) return;
    const allowed = allowPdf ? ['image/jpeg', 'image/png', 'application/pdf'] : ['image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      setLocalError(allowPdf ? 'Choose a JPG, PNG or PDF file.' : 'Choose a JPG or PNG photo.');
      return;
    }
    if (file.size > UPLOAD_LIMITS.maxBytes) {
      setLocalError('The file is larger than 10 MB. Choose a smaller one.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && onChange(reader.result, file.name);
    reader.onerror = () => setLocalError('The file could not be read. Try another one.');
    reader.readAsDataURL(file);
  };

  const unavailable = useCallback((message: string) => {
    setCamera(false);
    setCameraNotice(message);
  }, []);

  const shownError = error || localError;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-navy-950">{label}</p>
          {hint && <p className="text-sm text-slate-500">{hint}</p>}
        </div>
        {accepted && !shownError && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Received
          </span>
        )}
      </div>

      <div className={`flex items-center justify-center overflow-hidden rounded-xl bg-slate-100 ${target === 'FACE' ? 'mx-auto aspect-square w-full max-w-72' : 'aspect-[1.586/1]'}`}>
        {busy ? (
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" /> Checking the photo…
          </span>
        ) : value && isPdf ? (
          <span className="flex items-center gap-2 text-sm text-slate-700">
            <FileText className="h-6 w-6 text-navy-900" /> {fileName || 'PDF document'}
          </span>
        ) : value ? (
          <img src={value} alt={label} className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm text-slate-400">No photo yet</span>
        )}
      </div>

      {shownError && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {shownError}
        </p>
      )}
      {cameraNotice && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{cameraNotice}</p>}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {allowCamera && (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => {
              setCameraNotice(null);
              setCamera(true);
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-navy-950 px-4 py-3 text-base font-semibold text-white hover:bg-navy-900 disabled:opacity-50"
          >
            <Camera className="h-5 w-5" /> {value ? 'Retake with camera' : 'Take photo'}
          </button>
        )}
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-navy-900 hover:bg-slate-50 disabled:opacity-50"
        >
          <ImageUp className="h-5 w-5" /> {value ? 'Replace with a file' : 'Upload a file'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          aria-label={`Upload ${label}`}
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {camera && (
        <GuidedCamera
          target={target}
          title={cameraTitle}
          tips={tips}
          onClose={() => setCamera(false)}
          onUnavailable={unavailable}
          onCapture={(dataUrl) => {
            setCamera(false);
            setLocalError(null);
            onChange(dataUrl, null);
          }}
        />
      )}
    </div>
  );
};
