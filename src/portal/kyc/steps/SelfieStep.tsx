import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { faceResultForMember } from '../../../../shared/client';
import { ApiError } from '../../services/clientApi';
import { profileService } from '../../services/profile';
import { CheckField, Notice } from '../controls';
import { PhotoSlot } from '../PhotoSlot';
import type { StepProps } from './types';

const SELFIE_TIPS = ['Face a window or a light; avoid light behind you.', 'Remove glasses, a cap or a mask.', 'Look straight at the camera with your whole face inside the oval.'];

/**
 * Step 4: consent to the use of the selfie, then the selfie itself. The
 * server compares it with the stored ID photo through the configured
 * face-verification service; without one, staff compare the photos.
 */
export const SelfieStep: React.FC<StepProps> = ({ form, update, errors, status, locked, save, refresh }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selfie = status.requiredDocuments.find((d) => d.type === 'SELFIE' && d.submitted) ?? null;
  const result = status.faceMatchResult;
  const copy = result ? faceResultForMember(result) : null;

  const check = async (dataUrl?: string) => {
    setBusy(true);
    setError(null);
    try {
      // The server compares only with the consent it has on record.
      if (!(await save())) return;
      await profileService.matchFace(dataUrl ? { selfieImageBase64: dataUrl } : {});
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Your selfie could not be sent. Check your connection and try again.');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-navy-950">How your selfie is used</h3>
        <p className="text-sm text-slate-600">
          Your selfie is compared with the photo on your ID to check that the ID is yours. It is sensitive personal information under the Data Privacy Act (RA
          10173): it is stored securely, seen only by authorised branch staff and the face-check service, and used only to verify your identity.
        </p>
        <CheckField
          checked={form.biometricConsent}
          disabled={locked || busy}
          error={errors.biometricConsent}
          onChange={(v) => update({ biometricConsent: v })}
        >
          I agree to the use of my selfie to check that it matches my ID photo.
        </CheckField>
      </div>

      <PhotoSlot
        label="Your selfie"
        hint={form.biometricConsent ? 'Take it now with your camera.' : 'Agree above first.'}
        target="FACE"
        cameraTitle="Your selfie"
        tips={SELFIE_TIPS}
        value={selfie?.fileUrl ?? null}
        disabled={locked || !form.biometricConsent}
        busy={busy}
        error={error}
        accepted={Boolean(selfie && result)}
        onChange={(dataUrl) => check(dataUrl)}
      />

      {copy && !busy && (
        <Notice tone={copy.tone} title={copy.title} role="status">
          <p>{copy.body}</p>
          {copy.retake && <p className="font-medium">Use “Retake with camera” above.</p>}
        </Notice>
      )}

      {selfie && !result && !busy && !locked && form.biometricConsent && (
        <button
          type="button"
          onClick={() => check()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-navy-900 px-4 py-3 text-base font-semibold text-navy-900 hover:bg-navy-950/5"
        >
          <RefreshCw className="h-5 w-5" /> Compare my selfie with my ID
        </button>
      )}
    </div>
  );
};
