import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import type { RgbaImage } from '../../shared/kyc-core';

export type SniffedMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

/** Identifies a file by its leading bytes; the declared MIME type is never trusted. */
export function sniffMime(buf: Buffer): SniffedMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

/** Decodes JPEG or PNG to RGBA. Returns null for formats this server cannot analyse. */
export function decodeImage(buf: Buffer, mime: SniffedMime): RgbaImage | null {
  if (mime === 'image/jpeg') {
    const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 512 });
    return { width: img.width, height: img.height, data: img.data };
  }
  if (mime === 'image/png') {
    const img = PNG.sync.read(buf);
    return { width: img.width, height: img.height, data: img.data };
  }
  return null;
}
