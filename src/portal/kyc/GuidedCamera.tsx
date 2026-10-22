import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, X, Check, Zap } from 'lucide-react';
import { analyseFrame, type CaptureTarget, type FrameVerdict } from '../../../shared/kyc-core';

/**
 * A full-screen camera with a guide (an ID-card frame or a face oval) and live
 * advice on light, glare, framing and focus. The member takes the photo; it is
 * taken automatically only when they switch that on and the picture has stayed
 * clear for a moment. The server checks the photo again before accepting it.
 */
export interface GuidedCameraProps {
  target: CaptureTarget;
  title: string;
  tips: string[];
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  /** Called when the camera cannot be used, so the page can offer an upload. */
  onUnavailable: (message: string) => void;
}

const STEADY_FRAMES = 6; // about a second of clear, steady picture
const SAMPLE_MS = 160;

export const GuidedCamera: React.FC<GuidedCameraProps> = ({ target, title, tips, onCapture, onClose, onUnavailable }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previousRef = useRef<Uint8ClampedArray | null>(null);
  const steadyRef = useRef(0);
  const [verdict, setVerdict] = useState<FrameVerdict | null>(null);
  const [ready, setReady] = useState(false);
  const [auto, setAuto] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        onUnavailable('This browser cannot use the camera. Upload a photo instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: target === 'FACE' ? 'user' : 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        onUnavailable(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Camera access was not allowed. Allow the camera in your browser settings, or upload a photo instead.'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'No camera was found on this device. Upload a photo instead.'
              : 'The camera could not be started. Upload a photo instead.',
        );
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [target, onUnavailable, stop]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPreview(canvas.toDataURL('image/jpeg', 0.92));
    setCountdown(null);
    steadyRef.current = 0;
  }, []);

  // Live guidance from small frames.
  useEffect(() => {
    if (!ready || preview) return;
    const small = document.createElement('canvas');
    small.width = 320;
    small.height = 240;
    const ctx = small.getContext('2d', { willReadFrequently: true });
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!ctx || !video || video.readyState < 2) return;
      ctx.drawImage(video, 0, 0, small.width, small.height);
      const data = ctx.getImageData(0, 0, small.width, small.height).data;
      const v = analyseFrame({ width: small.width, height: small.height, data }, target, previousRef.current);
      previousRef.current = new Uint8ClampedArray(data);
      setVerdict(v);
      steadyRef.current = v.ok ? steadyRef.current + 1 : 0;
      if (!v.ok) setCountdown(null);
    }, SAMPLE_MS);
    return () => clearInterval(timer);
  }, [ready, preview, target]);

  // Automatic capture: only when switched on, after a steady stretch, with a visible countdown.
  useEffect(() => {
    if (!auto || preview || !verdict?.ok || steadyRef.current < STEADY_FRAMES || countdown !== null) return;
    setCountdown(3);
  }, [auto, preview, verdict, countdown]);
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      capture();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 700);
    return () => clearTimeout(t);
  }, [countdown, capture]);

  const close = () => {
    stop();
    onClose();
  };

  const guideClass =
    target === 'FACE'
      ? 'aspect-[3/4] w-[62%] max-w-[300px] rounded-[50%]'
      : 'aspect-[1.586/1] w-[86%] max-w-[560px] rounded-2xl';
  const tone = verdict?.ok ? 'border-emerald-400' : 'border-gold-400';

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-navy-950 text-white" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-base font-bold sm:text-lg">{title}</h2>
        <button type="button" onClick={close} className="rounded-full p-2 hover:bg-white/10" aria-label="Close the camera">
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* The video stays mounted under the preview, so Retake goes straight back to the live picture. */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${target === 'FACE' ? '-scale-x-100' : ''} ${preview ? 'hidden' : ''}`}
          aria-label="Camera preview"
        />
        {preview ? (
          <img src={preview} alt="The photo you took" className="absolute inset-0 m-auto max-h-full max-w-full object-contain" />
        ) : (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={`${guideClass} border-4 ${tone} shadow-[0_0_0_9999px_rgba(9,21,39,0.55)] transition-colors`} />
            </div>
            {countdown !== null && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-7xl font-black text-white drop-shadow-lg">{countdown || ''}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="space-y-3 px-4 pb-6 pt-3">
        {!preview && (
          <>
            <p role="status" aria-live="polite" className={`text-center text-base font-semibold ${verdict?.ok ? 'text-emerald-300' : 'text-gold-300'}`}>
              {ready ? verdict?.guidance ?? 'Getting the camera ready…' : 'Starting the camera…'}
            </p>
            <ul className="mx-auto max-w-md list-disc space-y-0.5 pl-5 text-xs text-slate-300">
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <label className="mx-auto flex max-w-md items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-4 w-4 accent-gold-400" />
              <Zap className="h-4 w-4 text-gold-400" /> Take the photo automatically when the picture is clear
            </label>
            <button
              type="button"
              onClick={capture}
              disabled={!ready}
              className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-gold-400 py-4 text-lg font-bold text-navy-950 hover:bg-gold-300 disabled:opacity-50"
            >
              <Camera className="h-6 w-6" /> Take photo
            </button>
          </>
        )}
        {preview && (
          <div className="mx-auto flex max-w-md gap-3">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/30 py-4 text-base font-semibold hover:bg-white/10"
            >
              <RotateCcw className="h-5 w-5" /> Retake
            </button>
            <button
              type="button"
              onClick={() => {
                stop();
                onCapture(preview);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gold-400 py-4 text-base font-bold text-navy-950 hover:bg-gold-300"
            >
              <Check className="h-5 w-5" /> Use this photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
