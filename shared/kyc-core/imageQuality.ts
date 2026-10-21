import { QUALITY_THRESHOLDS, type DocumentKind, type QualityThresholds } from './config';

/** Decoded image: RGBA bytes, row-major (the layout of canvas ImageData and of jpeg-js/pngjs output). */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

export interface QualityMetrics {
  width: number;
  height: number;
  brightness: number;
  glareRatio: number;
  sharpness: number;
}

export type QualityProblem = 'TOO_SMALL' | 'TOO_DARK' | 'TOO_BRIGHT' | 'GLARE' | 'BLURRY';

export interface QualityReport {
  ok: boolean;
  problems: QualityProblem[];
  messages: string[];
  metrics: QualityMetrics;
}

const MESSAGES: Readonly<Record<QualityProblem, string>> = {
  TOO_SMALL: 'The photo resolution is too low. Move closer or use a higher camera setting.',
  TOO_DARK: 'The photo is too dark. Retake it in brighter light.',
  TOO_BRIGHT: 'The photo is overexposed. Avoid direct light or flash.',
  GLARE: 'There is strong glare on the photo. Tilt the card away from the light and retake it.',
  BLURRY: 'The photo is blurry. Hold the camera steady and make sure the text is in focus.',
};

/** Longest side analysed; larger images are box-downsampled so cost is bounded and the sharpness scale is stable. */
const ANALYSIS_SIZE = 512;

function toGray(img: RgbaImage): { gray: Float32Array; w: number; h: number } {
  const scale = Math.min(1, ANALYSIS_SIZE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const gray = new Float32Array(w * h);
  const counts = new Uint32Array(w * h);
  for (let y = 0; y < img.height; y++) {
    const gy = Math.min(h - 1, Math.floor(y * scale));
    for (let x = 0; x < img.width; x++) {
      const gx = Math.min(w - 1, Math.floor(x * scale));
      const i = (y * img.width + x) * 4;
      // Rec. 601 luma
      const l = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
      gray[gy * w + gx] += l;
      counts[gy * w + gx] += 1;
    }
  }
  for (let k = 0; k < gray.length; k++) gray[k] = counts[k] ? gray[k] / counts[k] : 0;
  return { gray, w, h };
}

export function measureImage(img: RgbaImage): QualityMetrics {
  if (img.width <= 0 || img.height <= 0 || img.data.length < img.width * img.height * 4) {
    throw new Error('Invalid image data.');
  }
  const { gray, w, h } = toGray(img);

  let sum = 0;
  let glare = 0;
  for (let k = 0; k < gray.length; k++) {
    sum += gray[k];
    if (gray[k] >= 250) glare += 1;
  }

  // Variance of the 4-neighbour Laplacian.
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = gray[y * w + x];
      const v = gray[(y - 1) * w + x] + gray[(y + 1) * w + x] + gray[y * w + x - 1] + gray[y * w + x + 1] - 4 * c;
      lapSum += v;
      lapSq += v * v;
      n += 1;
    }
  }
  const mean = n ? lapSum / n : 0;
  const sharpness = n ? lapSq / n - mean * mean : 0;

  return {
    width: img.width,
    height: img.height,
    brightness: sum / gray.length,
    glareRatio: glare / gray.length,
    sharpness,
  };
}

export function evaluateQuality(metrics: QualityMetrics, t: QualityThresholds): QualityReport {
  const problems: QualityProblem[] = [];
  const long = Math.max(metrics.width, metrics.height);
  const short = Math.min(metrics.width, metrics.height);
  if (long < t.minLongSide || short < t.minShortSide) problems.push('TOO_SMALL');
  if (metrics.brightness < t.minBrightness) problems.push('TOO_DARK');
  if (metrics.brightness > t.maxBrightness) problems.push('TOO_BRIGHT');
  if (metrics.glareRatio > t.maxGlareRatio) problems.push('GLARE');
  if (metrics.sharpness < t.minSharpness) problems.push('BLURRY');
  return { ok: problems.length === 0, problems, messages: problems.map((p) => MESSAGES[p]), metrics };
}

export function assessImageQuality(img: RgbaImage, kind: DocumentKind): QualityReport {
  return evaluateQuality(measureImage(img), QUALITY_THRESHOLDS[kind]);
}
