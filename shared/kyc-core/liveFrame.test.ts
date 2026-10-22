import { describe, expect, it } from 'vitest';
import { analyseFrame, type FrameSample } from './liveFrame';

/** Synthetic 320x240 frames: a striped "card" on a plain background. */
const W = 320;
const H = 240;

function frame(paint: (x: number, y: number) => number): FrameSample {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = paint(x, y);
      const i = (y * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}

const card = (x0: number, x1: number, y0: number, y1: number, bg = 120) =>
  frame((x, y) => (x >= W * x0 && x < W * x1 && y >= H * y0 && y < H * y1 ? (Math.floor(x / 2) % 2 ? 220 : 40) : bg));

describe('live camera guidance', () => {
  it('accepts a sharp, well-lit card inside the frame', () => {
    expect(analyseFrame(card(0.25, 0.75, 0.3, 0.7), 'ID')).toMatchObject({ ok: true, issue: 'OK' });
  });

  it('asks for more light, less glare, or a closer card', () => {
    expect(analyseFrame(frame(() => 20), 'ID').issue).toBe('DARK');
    expect(analyseFrame(frame(() => 250), 'ID').issue).toBe('GLARE');
    expect(analyseFrame(frame(() => 128), 'ID').issue).toBe('TOO_FAR');
  });

  it('asks to keep all four corners inside the frame', () => {
    const v = analyseFrame(card(0.05, 0.55, 0.3, 0.7), 'ID');
    expect(v.issue).toBe('NOT_IN_FRAME');
    expect(v.guidance).toMatch(/four corners/);
  });

  it('asks to center a card that is inside the frame but pushed to one side', () => {
    const v = analyseFrame(card(0.2, 0.55, 0.3, 0.7), 'ID');
    expect(v.issue).toBe('OFF_CENTER');
    expect(v.guidance).toMatch(/Center the ID/);
  });

  it('asks to hold still when the picture moves between frames', () => {
    const a = card(0.25, 0.75, 0.3, 0.7);
    const b = card(0.25, 0.75, 0.3, 0.7, 200);
    expect(analyseFrame(b, 'ID', a.data).issue).toBe('MOVING');
    expect(analyseFrame(a, 'ID', a.data).ok).toBe(true);
  });

  it('for a selfie checks light and focus, not card edges', () => {
    const face = frame((x, y) => (Math.hypot(x - W / 2, y - H / 2) < 70 ? (Math.floor(x / 3) % 2 ? 190 : 90) : 130));
    expect(analyseFrame(face, 'FACE').ok).toBe(true);
    expect(analyseFrame(frame(() => 20), 'FACE').guidance).toMatch(/Face a window/);
  });
});
