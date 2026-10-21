import { describe, expect, it } from 'vitest';
import { assessImageQuality, evaluateQuality, measureImage, type RgbaImage } from './imageQuality';
import { QUALITY_THRESHOLDS } from './config';

/** A synthetic "document": light background with dark text-like strokes. */
function documentImage(width: number, height: number, opts: { bg?: number; ink?: number; blur?: number; glareBox?: number } = {}): RgbaImage {
  const bg = opts.bg ?? 200;
  const ink = opts.ink ?? 30;
  const gray = new Float32Array(width * height).fill(bg);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inLine = Math.floor(y / 14) % 2 === 0 && y % 14 < 6;
      const inGlyph = Math.floor(x / 7) % 3 !== 2;
      if (inLine && inGlyph && x % 7 < 4) gray[y * width + x] = ink;
    }
  }
  if (opts.glareBox) {
    const s = opts.glareBox;
    for (let y = 0; y < Math.floor(height * s); y++) for (let x = 0; x < Math.floor(width * s); x++) gray[y * width + x] = 255;
  }
  let g = gray;
  for (let pass = 0; pass < (opts.blur ?? 0); pass++) {
    const next = new Float32Array(g.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let s = 0;
        let n = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy >= 0 && yy < height && xx >= 0 && xx < width) {
              s += g[yy * width + xx];
              n++;
            }
          }
        }
        next[y * width + x] = s / n;
      }
    }
    g = next;
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let k = 0; k < g.length; k++) {
    data[k * 4] = data[k * 4 + 1] = data[k * 4 + 2] = g[k];
    data[k * 4 + 3] = 255;
  }
  return { width, height, data };
}

describe('image quality', () => {
  it('accepts a sharp, evenly lit ID photo', () => {
    const report = assessImageQuality(documentImage(1000, 630), 'ID_FRONT');
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('flags a blurred photo', () => {
    const sharp = measureImage(documentImage(1000, 630));
    const blurred = measureImage(documentImage(1000, 630, { blur: 6 }));
    expect(blurred.sharpness).toBeLessThan(sharp.sharpness / 100);
    expect(assessImageQuality(documentImage(1000, 630, { blur: 6 }), 'ID_FRONT').problems).toContain('BLURRY');
    expect(assessImageQuality(documentImage(1000, 630, { blur: 1 }), 'ID_FRONT').problems).not.toContain('BLURRY');
  });

  it('flags dark, overexposed, glare and low-resolution photos', () => {
    expect(assessImageQuality(documentImage(1000, 630, { bg: 25, ink: 5 }), 'ID_FRONT').problems).toContain('TOO_DARK');
    expect(assessImageQuality(documentImage(1000, 630, { bg: 252, ink: 200 }), 'ID_FRONT').problems).toContain('TOO_BRIGHT');
    expect(assessImageQuality(documentImage(1000, 630, { glareBox: 0.6 }), 'ID_FRONT').problems).toContain('GLARE');
    expect(assessImageQuality(documentImage(400, 250), 'ID_FRONT').problems).toContain('TOO_SMALL');
  });

  it('uses per-kind thresholds: a small selfie can pass where an ID cannot', () => {
    const img = documentImage(480, 360);
    expect(assessImageQuality(img, 'ID_FRONT').problems).toContain('TOO_SMALL');
    expect(assessImageQuality(img, 'SELFIE').problems).not.toContain('TOO_SMALL');
  });

  it('explains each problem in plain language', () => {
    const r = evaluateQuality({ width: 100, height: 100, brightness: 10, glareRatio: 0, sharpness: 0 }, QUALITY_THRESHOLDS.ID_FRONT);
    expect(r.ok).toBe(false);
    expect(r.messages.join(' ')).toMatch(/too dark/);
  });

  it('rejects malformed pixel buffers', () => {
    expect(() => measureImage({ width: 10, height: 10, data: new Uint8Array(10) })).toThrow();
  });
});
