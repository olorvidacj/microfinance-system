/**
 * Live guidance for the camera: a quick look at a small video frame (about
 * 320x240 RGBA) telling the member what to fix before the photo is taken.
 * It only guides; the server checks the full photo (assessImageQuality) and
 * decides whether it is accepted. Passing here never means the ID is genuine.
 */

export type CaptureTarget = 'ID' | 'FACE';

export type FrameIssue = 'OK' | 'DARK' | 'GLARE' | 'TOO_FAR' | 'NOT_IN_FRAME' | 'OFF_CENTER' | 'BLURRY' | 'MOVING';

export interface FrameVerdict {
  ok: boolean;
  issue: FrameIssue;
  guidance: string;
  metrics: { brightness: number; glare: number; dark: number; sharpness: number; motion: number; borderShare: number };
}

export interface FrameSample {
  width: number;
  height: number;
  /** RGBA bytes, row by row. */
  data: Uint8ClampedArray | Uint8Array;
}

export const LIVE_FRAME_LIMITS = {
  minBrightness: 55,
  maxBrightness: 225,
  maxDarkShare: 0.42,
  maxGlareShare: 0.16,
  /** Mean neighbour difference inside the frame: below this the card is too far or out of focus. */
  minDetail: 7,
  minSharpness: 11,
  /** Detail on any border band of the guide, relative to the detail inside it: the card runs past the guide. */
  maxBorderShare: 0.45,
  /** How far the card's detail may sit from the guide's centre (share of the guide's size). */
  maxOffCenter: 0.12,
  maxMotion: 16,
} as const;

const GUIDANCE: Readonly<Record<FrameIssue, Record<CaptureTarget, string>>> = {
  OK: { ID: 'Looks good. Hold still.', FACE: 'Looks good. Hold still.' },
  DARK: { ID: 'Too dark. Move to a brighter place.', FACE: 'Too dark. Face a window or a light.' },
  GLARE: { ID: 'Too much glare. Tilt the card or move away from direct light.', FACE: 'Too bright. Move away from direct light behind or above you.' },
  TOO_FAR: { ID: 'Move the ID closer so it fills the frame.', FACE: 'Move a little closer.' },
  NOT_IN_FRAME: { ID: 'Keep all four corners of the ID inside the frame.', FACE: 'Keep your face inside the oval.' },
  OFF_CENTER: { ID: 'Center the ID in the frame.', FACE: 'Center your face in the oval.' },
  BLURRY: { ID: 'The ID is blurry. Hold the phone steady.', FACE: 'The photo is blurry. Hold the phone steady.' },
  MOVING: { ID: 'Hold still…', FACE: 'Hold still…' },
};

/** The guide drawn on screen, as shares of the frame: the analysis looks inside it. */
export const GUIDE_REGION: Readonly<Record<CaptureTarget, { left: number; right: number; top: number; bottom: number }>> = {
  ID: { left: 0.15, right: 0.85, top: 0.2, bottom: 0.8 },
  FACE: { left: 0.3, right: 0.7, top: 0.15, bottom: 0.85 },
};

const lum = (d: FrameSample['data'], i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

export function analyseFrame(frame: FrameSample, target: CaptureTarget, previous?: FrameSample['data'] | null): FrameVerdict {
  const { width, data } = frame;
  const g = GUIDE_REGION[target];
  const left = Math.floor(width * g.left);
  const right = Math.floor(width * g.right);
  const top = Math.floor(frame.height * g.top);
  const bottom = Math.floor(frame.height * g.bottom);
  const midX = Math.floor((left + right) / 2);
  const midY = Math.floor((top + bottom) / 2);

  let total = 0;
  let pixels = 0;
  let glare = 0;
  let dark = 0;
  let detail = 0;
  let detailX = 0;
  let detailY = 0;
  // Detail per sample on each side band of the guide, and inside it.
  const band = { left: [0, 0], right: [0, 0], top: [0, 0], bottom: [0, 0], inner: [0, 0] };
  const BAND = 8;

  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const i = (y * width + x) * 4;
      const l = lum(data, i);
      total += l;
      pixels += 1;
      if (data[i] > 238 && data[i + 1] > 238 && data[i + 2] > 238) glare += 1;
      if (l < 40) dark += 1;
      if (x + 2 < right) {
        const diff = Math.abs(l - lum(data, (y * width + x + 2) * 4));
        detail += diff;
        detailX += diff * x;
        detailY += diff * y;
        const where = x < left + BAND ? band.left : x >= right - BAND - 2 ? band.right : y < top + BAND ? band.top : y >= bottom - BAND ? band.bottom : band.inner;
        where[0] += diff;
        where[1] += 1;
      }
    }
  }

  let motion = 0;
  if (previous && previous.length === data.length) {
    let diff = 0;
    let n = 0;
    for (let k = 0; k < data.length; k += 32) {
      diff += Math.abs(data[k] - previous[k]);
      n += 1;
    }
    motion = diff / (n || 1);
  }

  const n = pixels || 1;
  const density = (b: number[]) => (b[1] ? b[0] / b[1] : 0);
  const inner = density(band.inner);
  // A card running past the guide puts its printed detail on the border bands.
  const borderShare = inner > 0 ? Math.max(density(band.left), density(band.right), density(band.top), density(band.bottom)) / inner : 0;
  const metrics = {
    brightness: total / n,
    glare: glare / n,
    dark: dark / n,
    sharpness: detail / n,
    motion,
    borderShare,
  };
  const L = LIVE_FRAME_LIMITS;
  // Where the detail sits, as a share of the guide's size away from its centre.
  const offX = detail > 0 ? Math.abs(detailX / detail - midX) / (right - left) : 0;
  const offY = detail > 0 ? Math.abs(detailY / detail - midY) / (bottom - top) : 0;

  let issue: FrameIssue = 'OK';
  if (metrics.brightness < L.minBrightness || metrics.dark > L.maxDarkShare) issue = 'DARK';
  else if (metrics.brightness > L.maxBrightness || metrics.glare > L.maxGlareShare) issue = 'GLARE';
  else if (metrics.sharpness < L.minDetail) issue = 'TOO_FAR';
  else if (target === 'ID' && metrics.borderShare > L.maxBorderShare) issue = 'NOT_IN_FRAME';
  else if (target === 'ID' && (offX > L.maxOffCenter || offY > L.maxOffCenter)) issue = 'OFF_CENTER';
  else if (metrics.sharpness < L.minSharpness) issue = 'BLURRY';
  else if (motion > L.maxMotion) issue = 'MOVING';

  return { ok: issue === 'OK', issue, guidance: GUIDANCE[issue][target], metrics };
}
