import React, { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { ID_TYPES, findIdType } from '../../../../shared/kyc-core';
import { ApiError } from '../../services/clientApi';
import { profileService } from '../../services/profile';
import type { KycStatusData } from '../../types';
import { Notice, SelectField } from '../controls';
import { PhotoSlot } from '../PhotoSlot';
import { needsBack } from '../wizard';
import type { StepProps } from './types';

const ID_TIPS = ['Place the ID on a plain, dark surface.', 'Use good light and avoid glare on the card.', 'Keep all four corners inside the frame.'];

type Side = 'FRONT' | 'BACK';

const stored = (status: KycStatusData, kind: string) => status.requiredDocuments.find((d) => d.type === kind && d.submitted) ?? null;

/**
 * Step 2: photos of one government ID. Each photo is sent as soon as it is
 * taken, and the server checks its quality before keeping it. Once every side
 * is in, the ID is read automatically; the reading fills in details for the
 * member to check and never verifies the ID by itself.
 */
export const IdStep: React.FC<StepProps> = ({ form, update, status, locked, save, refresh }) => {
  const [busy, setBusy] = useState<Side | null>(null);
  const [reading, setReading] = useState(false);
  const [slotError, setSlotError] = useState<Record<Side, string | null>>({ FRONT: null, BACK: null });
  const [readError, setReadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const idType = findIdType(form.idType);
  const back = needsBack(form.idType);
  const front = stored(status, 'ID_FRONT');
  const backDoc = stored(status, 'ID_BACK');
  const scan = status.extractedIdData;

  const readId = async () => {
    setReading(true);
    setReadError(null);
    try {
      const result = await profileService.processId();
      setMessage(result.validation.qualityMessage);
      await refresh();
    } catch (err) {
      setReadError(err instanceof ApiError ? err.message : 'Your ID could not be read. Try again.');
    } finally {
      setReading(false);
    }
  };

  const upload = async (side: Side, dataUrl: string, fileName: string | null) => {
    setBusy(side);
    setSlotError((e) => ({ ...e, [side]: null }));
    setMessage(null);
    try {
      // The chosen ID type decides whether the back is needed; the server must have it first.
      if (!(await save())) return;
      await profileService.uploadKycDocument({
        documentType: side === 'FRONT' ? 'ID_FRONT' : 'ID_BACK',
        documentName: side === 'FRONT' ? 'Government ID (front)' : 'Government ID (back)',
        fileName: fileName ?? `id-${side.toLowerCase()}.jpg`,
        imageBase64: dataUrl,
      });
      const next = await refresh();
      if (next && stored(next, 'ID_FRONT') && (!back || stored(next, 'ID_BACK'))) await readId();
    } catch (err) {
      setSlotError((e) => ({ ...e, [side]: err instanceof ApiError ? err.message : 'The photo could not be sent. Check your connection and try again.' }));
    } finally {
      setBusy(null);
    }
  };

  const allIn = Boolean(front) && (!back || Boolean(backDoc));
  const detectedOther = scan?.detectedType && scan.detectedType !== form.idType ? findIdType(scan.detectedType) : undefined;

  return (
    <div className="space-y-4">
      <SelectField
        label="Which ID are you using?"
        required
        disabled={locked || Boolean(busy) || reading}
        value={form.idType}
        options={ID_TYPES.map((t) => ({ value: t.code, label: t.label }))}
        hint="Use an ID that has not expired. The name must match your application."
        onChange={(e) => update({ idType: e.target.value })}
      />

      <PhotoSlot
        label={back ? 'Front of the ID' : 'Photo page of the ID'}
        hint={idType ? `Your ${idType.label}, with your photo` : undefined}
        target="ID"
        cameraTitle="Front of your ID"
        tips={ID_TIPS}
        value={front?.fileUrl ?? null}
        disabled={locked || reading || (busy !== null && busy !== 'FRONT')}
        busy={busy === 'FRONT'}
        error={slotError.FRONT}
        accepted={Boolean(front)}
        onChange={(dataUrl, name) => upload('FRONT', dataUrl, name)}
      />

      {back && (
        <PhotoSlot
          label="Back of the ID"
          target="ID"
          cameraTitle="Back of your ID"
          tips={ID_TIPS}
          value={backDoc?.fileUrl ?? null}
          disabled={locked || reading || !front || (busy !== null && busy !== 'BACK')}
          busy={busy === 'BACK'}
          error={slotError.BACK}
          accepted={Boolean(backDoc)}
          hint={front ? undefined : 'Add the front first.'}
          onChange={(dataUrl, name) => upload('BACK', dataUrl, name)}
        />
      )}

      {reading && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-navy-950/5 px-4 py-3 text-sm font-medium text-navy-900">
          <Loader2 className="h-5 w-5 animate-spin" /> Reading your ID…
        </p>
      )}
      {readError && (
        <Notice tone="error" role="alert" title="Your ID was not read">
          <p>{readError}</p>
        </Notice>
      )}

      {!reading && allIn && !scan && !readError && (
        <Notice tone="info" title="Your photos are in">
          <p>Read your ID so its details can be filled in for you to check.</p>
        </Notice>
      )}
      {!reading && scan && (
        <Notice
          tone={scan.status === 'COMPLETED' && scan.isReadable !== false ? 'ok' : 'warn'}
          title={
            scan.status === 'COMPLETED' && scan.isReadable !== false
              ? 'Your ID was read'
              : scan.status === 'UNAVAILABLE'
                ? 'Automatic reading is not available'
                : 'Your ID could not be read clearly'
          }
        >
          <p>
            {message ??
              (scan.status === 'COMPLETED' && scan.isReadable !== false
                ? 'Check every detail against your card on the next step.'
                : scan.status === 'UNAVAILABLE'
                  ? 'Your photos were accepted. On the next step, type the details exactly as printed on your ID.'
                  : 'Retake the photos in good light with the whole card visible, or type the details yourself on the next step.')}
          </p>
          {detectedOther && <p className="font-medium">This looks like a {detectedOther.label}. Choose the matching ID type above if so.</p>}
          {scan.validationWarnings.length > 0 && (
            <ul className="list-disc pl-5">
              {scan.validationWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      {allIn && !locked && (!scan || scan.status !== 'COMPLETED' || scan.isReadable === false) && (
        <button
          type="button"
          onClick={readId}
          disabled={reading || busy !== null}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-navy-900 px-4 py-3 text-base font-semibold text-navy-900 hover:bg-navy-950/5 disabled:opacity-50"
        >
          <RefreshCw className="h-5 w-5" /> {scan ? 'Read my ID again' : 'Read my ID'}
        </button>
      )}

      <p className="text-xs text-slate-500">
        Reading your ID only fills in its details for you to check. It does not verify the ID: a branch officer reviews your ID and photos before your account is
        approved.
      </p>
    </div>
  );
};
